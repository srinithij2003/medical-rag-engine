import json
from pathlib import Path

from pydantic import ValidationError

from backend.models.schemas import ExtractionSchema
from backend.services.model_registry import model_registry
from backend.services.ollama_client import ollama_client
from backend.utils.config import settings


PROMPT_PATH = Path(__file__).resolve().parent.parent / 'prompts' / 'clinical_extraction_prompt.txt'
SYSTEM_PROMPT = PROMPT_PATH.read_text(encoding='utf-8')


def chunk_text(text: str, max_chars: int = 6000, overlap: int = 400) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return chunks


def extract_json_blob(content: str) -> str:
    if '```json' in content:
        section = content.split('```json', 1)[1]
        return section.split('```', 1)[0].strip()
    if '```' in content:
        section = content.split('```', 1)[1]
        return section.split('```', 1)[0].strip()
    return content.strip()


async def _extract_once(text: str) -> ExtractionSchema:
    model = model_registry.get_selected_model()
    response = await ollama_client.chat_completion(
        model=model,
        system_prompt=SYSTEM_PROMPT,
        user_prompt=f'Clinical Note:\n{text}',
    )
    parsed = json.loads(extract_json_blob(response))
    return ExtractionSchema.model_validate(parsed)


async def extract_structured_data(text: str) -> ExtractionSchema:
    last_error: Exception | None = None
    chunks = chunk_text(text)

    if len(chunks) == 1:
        for _ in range(settings.ollama_max_retries):
            try:
                return await _extract_once(chunks[0])
            except (json.JSONDecodeError, ValidationError) as error:
                last_error = error
        raise ValueError(f'Extraction failed after retries: {last_error}')

    combined = ExtractionSchema()
    for chunk in chunks:
        for _ in range(settings.ollama_max_retries):
            try:
                item = await _extract_once(chunk)
                combined.symptoms.extend(x for x in item.symptoms if x not in combined.symptoms)
                combined.conditions.extend(x for x in item.conditions if x not in combined.conditions)
                combined.medications.extend(x for x in item.medications if x not in combined.medications)
                combined.allergies.extend(x for x in item.allergies if x not in combined.allergies)
                combined.diagnosis.extend(x for x in item.diagnosis if x not in combined.diagnosis)
                combined.vitals.update(item.vitals)
                combined.lab_values.update(item.lab_values)
                combined.duration = combined.duration or item.duration
                combined.blood_pressure = combined.blood_pressure or item.blood_pressure
                break
            except (json.JSONDecodeError, ValidationError) as error:
                last_error = error
        else:
            raise ValueError(f'Extraction failed for one chunk: {last_error}')

    return combined
