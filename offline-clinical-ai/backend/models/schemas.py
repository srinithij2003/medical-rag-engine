from typing import Any

from pydantic import BaseModel, Field


class ExtractionSchema(BaseModel):
    symptoms: list[str] = Field(default_factory=list)
    duration: str | None = None
    conditions: list[str] = Field(default_factory=list)
    blood_pressure: str | None = None
    medications: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)
    vitals: dict[str, Any] = Field(default_factory=dict)
    diagnosis: list[str] = Field(default_factory=list)
    lab_values: dict[str, Any] = Field(default_factory=dict)


class ExtractRequest(BaseModel):
    text: str
    patient_id: int | None = None


class ExtractResponse(BaseModel):
    model: str
    extraction: ExtractionSchema


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'bearer'


class LoginRequest(BaseModel):
    username: str
    password: str


class ModelSelectRequest(BaseModel):
    model: str
