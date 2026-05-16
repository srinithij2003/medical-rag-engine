from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import router
from backend.models.db import init_db
from backend.utils.config import settings
from backend.utils.logging import RequestTimingMiddleware, configure_logging


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging(settings.log_level)
    await init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(RequestTimingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_methods=['*'],
    allow_headers=['*'],
    allow_credentials=True,
)

app.include_router(router)
