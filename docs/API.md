# API Contract

Base URL: `http://localhost:8000`

## `GET /health`
Returns API and local Ollama runtime status.

## `POST /auth/login`
Request:
```json
{ "username": "admin", "password": "admin" }
```
Response:
```json
{ "access_token": "...", "token_type": "bearer" }
```

## `POST /upload`
Multipart form-data with `file`.
Headers: `Authorization: Bearer <token>`

## `POST /ocr`
Multipart form-data with `file`.
Headers: `Authorization: Bearer <token>`
Response: extracted plaintext from report.

## `POST /extract`
Request:
```json
{ "text": "Patient complains of chest pain for 3 days..." }
```
Response:
```json
{
  "model": "gemma3:4b",
  "extraction": {
    "symptoms": ["chest pain"],
    "duration": "3 days",
    "conditions": ["hypertension", "diabetes"],
    "blood_pressure": "150/95",
    "medications": ["aspirin 75mg"],
    "allergies": [],
    "vitals": {},
    "diagnosis": [],
    "lab_values": {}
  }
}
```

## `POST /extract/stream`
Server-sent events endpoint for token-by-token output.
Each frame:
```json
{ "type": "token", "delta": "..." }
```
Final validated frame:
```json
{ "type": "result", "result": { ...schema... } }
```

## `GET /models`
Returns locally available Ollama models and current selected model.

## `POST /models/select`
Request:
```json
{ "model": "qwen3" }
```
Admin role required.

## `GET /admin/audit-logs`
Admin-only audit trail feed.
