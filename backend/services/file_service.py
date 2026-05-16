import mimetypes
from pathlib import Path

from fastapi import HTTPException, UploadFile
from pypdf import PdfReader
from docx import Document
from PIL import Image
import pytesseract

from backend.utils.config import settings


ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.png', '.jpg', '.jpeg'}


def ensure_upload_dir() -> Path:
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


async def save_upload_file(file: UploadFile) -> Path:
    suffix = Path(file.filename or '').suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail='Unsupported file format')

    upload_dir = ensure_upload_dir()
    path = upload_dir / (file.filename or 'upload.bin')
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail='File exceeds configured size limit')
    path.write_bytes(content)
    return path


def extract_text_from_path(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix == '.txt':
        return path.read_text(encoding='utf-8', errors='ignore')
    if suffix == '.pdf':
        reader = PdfReader(str(path))
        return '\n'.join((page.extract_text() or '') for page in reader.pages)
    if suffix == '.docx':
        doc = Document(str(path))
        return '\n'.join(p.text for p in doc.paragraphs)
    if suffix in {'.png', '.jpg', '.jpeg'}:
        image = Image.open(path)
        return pytesseract.image_to_string(image)
    raise ValueError('Unsupported file type')


def guess_content_type(path: Path) -> str:
    content_type, _ = mimetypes.guess_type(path.name)
    return content_type or 'application/octet-stream'
