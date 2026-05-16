from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=('.env', 'backend/.env'), env_file_encoding='utf-8', extra='ignore')

    app_name: str = Field(default='Offline Clinical Intelligence Platform', alias='APP_NAME')
    env: str = Field(default='development', alias='ENV')
    host: str = Field(default='0.0.0.0', alias='HOST')
    port: int = Field(default=8000, alias='PORT')
    log_level: str = Field(default='INFO', alias='LOG_LEVEL')

    database_url: str = Field(default='sqlite+aiosqlite:///./data/clinical.db', alias='DATABASE_URL')
    jwt_secret: str = Field(default='change-me', alias='JWT_SECRET')
    jwt_algorithm: str = Field(default='HS256', alias='JWT_ALGORITHM')
    access_token_expire_minutes: int = Field(default=60, alias='ACCESS_TOKEN_EXPIRE_MINUTES')

    ollama_base_url: str = Field(default='http://localhost:11434/v1', alias='OLLAMA_BASE_URL')
    ollama_model: str = Field(default='gemma3:4b', alias='OLLAMA_MODEL')
    ollama_timeout_seconds: int = Field(default=180, alias='OLLAMA_TIMEOUT_SECONDS')
    ollama_max_retries: int = Field(default=3, alias='OLLAMA_MAX_RETRIES')
    ollama_temperature: float = Field(default=0.1, alias='OLLAMA_TEMPERATURE')

    max_upload_mb: int = Field(default=25, alias='MAX_UPLOAD_MB')
    upload_dir: str = Field(default='./data/uploads', alias='UPLOAD_DIR')
    no_telemetry: bool = Field(default=True, alias='NO_TELEMETRY')


settings = Settings()
