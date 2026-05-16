import json
from pathlib import Path

import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.api.dependencies import get_current_user, require_admin
from backend.models.db import AuditLog, ExtractionResult, Upload, User, get_db_session
from backend.models.schemas import ExtractRequest, ExtractResponse, LoginRequest, ModelSelectRequest, TokenResponse
from backend.ocr.pipeline import run_ocr_pipeline
from backend.services.auth_service import create_access_token, hash_password, verify_password
from backend.services.extraction_service import SYSTEM_PROMPT, extract_structured_data
from backend.services.file_service import guess_content_type, save_upload_file
from backend.services.model_registry import model_registry
from backend.services.ollama_client import ollama_client


router = APIRouter()


@router.get('/health')
async def health_check():
    try:
        models = await ollama_client.list_models()
        return {'status': 'ok', 'ollama': 'reachable', 'models': models}
    except Exception as error:
        return {'status': 'degraded', 'ollama': 'unreachable', 'error': str(error)}


@router.post('/auth/login', response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db_session)):
    try:
        # print directly so it appears in uvicorn log output for debugging
        print(f"LOGIN DEBUG username={payload.username} pw_len={len(getattr(payload, 'password', ''))}")
    except Exception:
        pass
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
    upload = Upload(
        filename=path.name,
        content_type=guess_content_type(path),
        path=str(path),
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
    extraction = await extract_structured_data(payload.text)

    result = ExtractionResult(
        model_name=model_registry.get_selected_model(),
        raw_text=payload.text,
        structured_json=extraction.model_dump_json(),
    )
    db.add(result)
    db.add(AuditLog(actor=user['sub'], action='extract', details=json.dumps({'model': model_registry.get_selected_model()})))
    await db.commit()

    return ExtractResponse(model=model_registry.get_selected_model(), extraction=extraction)


@router.post('/extract/stream')
async def extract_stream(payload: ExtractRequest, user: dict = Depends(get_current_user)):
    model = model_registry.get_selected_model()

    async def event_stream():
        collected = ''
        yield f"data: {json.dumps({'type': 'meta', 'model': model})}\n\n"
        async for token in ollama_client.stream_chat_completion(
            model=model,
            system_prompt=SYSTEM_PROMPT,
            user_prompt=f'Clinical Note:\n{payload.text}',
        ):
            collected += token
            yield f"data: {json.dumps({'type': 'token', 'delta': token})}\n\n"

        try:
            from backend.services.extraction_service import extract_json_blob
            from backend.models.schemas import ExtractionSchema

            parsed = json.loads(extract_json_blob(collected))
            validated = ExtractionSchema.model_validate(parsed)
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
