import logging
import time
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


LOG_FORMAT = '%(asctime)s %(levelname)s %(name)s %(message)s'


def configure_logging(level: str = 'INFO') -> None:
    logging.basicConfig(level=level, format=LOG_FORMAT)


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        started = time.perf_counter()
        response: Response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers['X-Request-Time-Ms'] = f'{elapsed_ms:.2f}'
        logging.getLogger('http').info(
            'request_complete method=%s path=%s status=%s latency_ms=%.2f',
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
