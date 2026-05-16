from pathlib import Path

from backend.services.file_service import extract_text_from_path


def run_ocr_pipeline(file_path: Path) -> str:
    # Uses format-aware extraction; image files pass through OCR.
    return extract_text_from_path(file_path)
