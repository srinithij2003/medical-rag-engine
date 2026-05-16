import json
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user, require_admin
from backend.models.db import AuditLog, ExtractionResult, Patient, Upload, User, get_db_session
from backend.models.schemas import (
    ExtractRequest,
    ExtractResponse,
    ExtractFromUploadRequest,
    ExtractionHistoryItem,
    LoginRequest,
    ModelSelectRequest,
    PatientCreateRequest,
    PatientResponse,
    TokenResponse,
)
from backend.ocr.pipeline import run_ocr_pipeline
from backend.services.auth_service import create_access_token, hash_password, verify_password
from backend.services.extraction_service import SYSTEM_PROMPT, extract_structured_data
from backend.services.file_service import guess_content_type, save_upload_file
from backend.services.model_registry import model_registry
from backend.services.ollama_client import ollama_client


router = APIRouter()


def _serialize_extraction(item: ExtractionResult, patient: Patient | None, upload: Upload | None) -> ExtractionHistoryItem:
    structured_json: dict = {}
    if item.structured_json:
        try:
            structured_json = json.loads(item.structured_json)
        except json.JSONDecodeError:
            structured_json = {'raw': item.structured_json}

    return ExtractionHistoryItem(
        id=item.id,
        patient_id=item.patient_id,
        upload_id=item.upload_id,
        upload_filename=upload.filename if upload else None,
        patient_code=patient.patient_code if patient else None,
        patient_name=patient.name if patient else None,
        model_name=item.model_name,
        structured_json=structured_json,
        created_at=item.created_at.isoformat(),
    )


async def _resolve_patient(db: AsyncSession, patient_id: int | None) -> Patient | None:
    if patient_id is None:
        return None
    patient = await db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail='Patient not found')
    return patient


async def _resolve_upload(db: AsyncSession, upload_id: int | None) -> Upload | None:
    if upload_id is None:
        return None
    upload = await db.get(Upload, upload_id)
    if upload is None:
        raise HTTPException(status_code=404, detail='Upload not found')
    return upload


def _resolve_text(text: str | None, upload: Upload | None) -> str:
    if text is not None and text.strip():
        return text.strip()
    if upload is None:
        raise HTTPException(status_code=400, detail='Provide note text or a valid upload_id')

    path = Path(upload.path)
    if not path.exists():
        raise HTTPException(status_code=404, detail='Stored upload file not found on disk')
    extracted = run_ocr_pipeline(path).strip()
    if not extracted:
        raise HTTPException(status_code=400, detail='No extractable text found in uploaded document')
    return extracted


@router.get('/health')
async def health_check():
    try:
        models = await ollama_client.list_models()
        return {'status': 'ok', 'ollama': 'reachable', 'models': models}
    except Exception as error:
        return {'status': 'degraded', 'ollama': 'unreachable', 'error': str(error)}


@router.post('/auth/login', response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()

    if user is None:
        # Bootstrap single admin user for local deployments.
        # Truncate password to 72 bytes to satisfy bcrypt backend limits.
        pw = getattr(payload, 'password', '')
        user = User(username=payload.username, hashed_password=hash_password(pw[:72]), role='admin')
        db.add(user)
        db.add(AuditLog(actor=payload.username, action='bootstrap_user', details='Initial local admin created'))
        await db.commit()
        await db.refresh(user)

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail='Invalid credentials')

    token = create_access_token(subject=user.username, role=user.role)
    return TokenResponse(access_token=token)


@router.post('/upload')
async def upload_file(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    path = await save_upload_file(file)
    user_row = await db.execute(select(User).where(User.username == user['sub']))
    db_user = user_row.scalar_one_or_none()
    upload = Upload(
        filename=path.name,
        content_type=guess_content_type(path),
        path=str(path),
        uploaded_by=db_user.id if db_user else None,
    )
    db.add(upload)
    db.add(AuditLog(actor=user['sub'], action='upload', details=json.dumps({'file': path.name})))
    await db.commit()
    await db.refresh(upload)
    return {'upload_id': upload.id, 'filename': upload.filename, 'path': upload.path}


@router.post('/ocr')
async def run_ocr(
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    path = await save_upload_file(file)
    text = run_ocr_pipeline(path)
    return {'filename': path.name, 'text': text}


@router.post('/extract', response_model=ExtractResponse)
async def extract(payload: ExtractRequest, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    await _resolve_patient(db, payload.patient_id)
    upload = await _resolve_upload(db, payload.upload_id)
    note_text = _resolve_text(payload.text, upload)
    extraction = await extract_structured_data(note_text)

    result = ExtractionResult(
        model_name=model_registry.get_selected_model(),
        raw_text=note_text,
        structured_json=extraction.model_dump_json(),
        patient_id=payload.patient_id,
        upload_id=payload.upload_id,
    )
    db.add(result)
    db.add(
        AuditLog(
            actor=user['sub'],
            action='extract',
            details=json.dumps({'model': model_registry.get_selected_model(), 'patient_id': payload.patient_id, 'upload_id': payload.upload_id}),
        )
    )
    await db.commit()

    return ExtractResponse(model=model_registry.get_selected_model(), extraction=extraction)


@router.post('/extract/stream')
async def extract_stream(
    payload: ExtractRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    await _resolve_patient(db, payload.patient_id)
    upload = await _resolve_upload(db, payload.upload_id)
    note_text = _resolve_text(payload.text, upload)
    model = model_registry.get_selected_model()

    async def event_stream():
        collected = ''
        yield f"data: {json.dumps({'type': 'meta', 'model': model})}\n\n"
        async for token in ollama_client.stream_chat_completion(
            model=model,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=f'Clinical Note:\n{note_text}',
        ):
            collected += token
            yield f"data: {json.dumps({'type': 'token', 'delta': token})}\n\n"

        try:
            from backend.services.extraction_service import extract_json_blob
            from backend.models.schemas import ExtractionSchema

            parsed = json.loads(extract_json_blob(collected))
            validated = ExtractionSchema.model_validate(parsed)
            result = ExtractionResult(
                model_name=model,
                raw_text=note_text,
                structured_json=validated.model_dump_json(),
                patient_id=payload.patient_id,
                upload_id=payload.upload_id,
            )
            db.add(result)
            db.add(
                AuditLog(
                    actor=user['sub'],
                    action='extract_stream',
                    details=json.dumps({'model': model, 'patient_id': payload.patient_id, 'upload_id': payload.upload_id}),
                )
            )
            await db.commit()
            yield f"data: {json.dumps({'type': 'result', 'result': validated.model_dump()})}\n\n"
        except Exception as error:
            yield f"data: {json.dumps({'type': 'error', 'message': str(error)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(event_stream(), media_type='text/event-stream')


@router.get('/models')
async def list_models(user: dict = Depends(get_current_user)):
    models = await ollama_client.list_models()
    return {'selected': model_registry.get_selected_model(), 'models': models}


@router.post('/models/select')
async def select_model(
    payload: ModelSelectRequest,
    user: dict = Depends(require_admin),
    db: AsyncSession = Depends(get_db_session),
):
    available = await ollama_client.list_models()
    if payload.model not in available:
        raise HTTPException(status_code=400, detail='Model unavailable in local Ollama runtime')
    model_registry.set_selected_model(payload.model)
    db.add(AuditLog(actor=user['sub'], action='model_select', details=json.dumps({'model': payload.model})))
    await db.commit()
    return {'selected': payload.model}


@router.get('/admin/audit-logs')
async def audit_logs(user: dict = Depends(require_admin), db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(AuditLog).order_by(AuditLog.created_at.desc()).limit(200))
    logs = result.scalars().all()
    return {
        'items': [
            {'actor': item.actor, 'action': item.action, 'details': item.details, 'created_at': item.created_at.isoformat()}
            for item in logs
        ]
    }


@router.post('/patients', response_model=PatientResponse)
async def create_patient(
    payload: PatientCreateRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    duplicate = await db.execute(select(Patient).where(Patient.patient_code == payload.patient_code))
    if duplicate.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail='Patient code already exists')

    patient = Patient(patient_code=payload.patient_code, name=payload.name)
    db.add(patient)
    db.add(AuditLog(actor=user['sub'], action='patient_create', details=json.dumps({'patient_code': payload.patient_code})))
    await db.commit()
    await db.refresh(patient)
    return PatientResponse(
        id=patient.id,
        patient_code=patient.patient_code,
        name=patient.name,
        created_at=patient.created_at.isoformat(),
    )


@router.get('/patients')
async def list_patients(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(Patient).order_by(Patient.created_at.desc()).limit(500))
    patients = result.scalars().all()
    return {
        'items': [
            PatientResponse(
                id=patient.id,
                patient_code=patient.patient_code,
                name=patient.name,
                created_at=patient.created_at.isoformat(),
            ).model_dump()
            for patient in patients
        ]
    }


@router.get('/patients/{patient_id}/history')
async def patient_history(patient_id: int, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db_session)):
    patient = await db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail='Patient not found')

    result = await db.execute(
        select(ExtractionResult).where(ExtractionResult.patient_id == patient_id).order_by(ExtractionResult.created_at.desc()).limit(200)
    )
    items = result.scalars().all()
    upload_ids = sorted({row.upload_id for row in items if row.upload_id is not None})
    uploads_by_id: dict[int, Upload] = {}
    if upload_ids:
        upload_rows = await db.execute(select(Upload).where(Upload.id.in_(upload_ids)))
        uploads_by_id = {item.id: item for item in upload_rows.scalars().all()}
    return {
        'patient': {
            'id': patient.id,
            'patient_code': patient.patient_code,
            'name': patient.name,
            'created_at': patient.created_at.isoformat(),
        },
        'items': [
            _serialize_extraction(
                item,
                patient,
                uploads_by_id.get(item.upload_id) if item.upload_id is not None else None,
            ).model_dump()
            for item in items
        ],
    }


@router.get('/extractions')
async def list_extractions(
    patient_id: int | None = None,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    if patient_id is None:
        query = select(ExtractionResult).order_by(ExtractionResult.created_at.desc()).limit(300)
    else:
        query = (
            select(ExtractionResult)
            .where(ExtractionResult.patient_id == patient_id)
            .order_by(ExtractionResult.created_at.desc())
            .limit(300)
        )
    result = await db.execute(query)
    rows = result.scalars().all()

    patient_ids = sorted({row.patient_id for row in rows if row.patient_id is not None})
    upload_ids = sorted({row.upload_id for row in rows if row.upload_id is not None})
    patients_by_id: dict[int, Patient] = {}
    uploads_by_id: dict[int, Upload] = {}
    if patient_ids:
        patient_rows = await db.execute(select(Patient).where(Patient.id.in_(patient_ids)))
        patients_by_id = {item.id: item for item in patient_rows.scalars().all()}
    if upload_ids:
        upload_rows = await db.execute(select(Upload).where(Upload.id.in_(upload_ids)))
        uploads_by_id = {item.id: item for item in upload_rows.scalars().all()}

    return {
        'items': [
            _serialize_extraction(
                row,
                patients_by_id.get(row.patient_id) if row.patient_id is not None else None,
                uploads_by_id.get(row.upload_id) if row.upload_id is not None else None,
            ).model_dump()
            for row in rows
        ]
    }


@router.post('/extract/from-upload', response_model=ExtractResponse)
async def extract_from_upload(
    payload: ExtractFromUploadRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    request = ExtractRequest(text=None, upload_id=payload.upload_id, patient_id=payload.patient_id)
    return await extract(payload=request, user=user, db=db)
