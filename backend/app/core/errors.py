from datetime import datetime, timezone

from fastapi import Request
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str, errors: list | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.errors = errors or []


_HTTP_CODE_MAP = {
    400: "INVALID_PARAMETER",
    401: "AUTH_TOKEN_EXPIRED",
    403: "ACCESS_DENIED",
    404: "RESOURCE_NOT_FOUND",
    409: "RESOURCE_CONFLICT",
    410: "RESOURCE_GONE",
    422: "VALIDATION_FAILED",
    500: "INTERNAL_ERROR",
}


def _error_body(status_code: int, code: str, message: str, errors: list | None = None) -> dict:
    return {
        "status": status_code,
        "code": code,
        "message": message,
        "errors": errors or [],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.status_code, exc.code, exc.message, exc.errors),
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _HTTP_CODE_MAP.get(exc.status_code, "INTERNAL_ERROR")
    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(exc.status_code, code, str(exc.detail)),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": ".".join(str(loc) for loc in e["loc"]), "reason": e["msg"]}
        for e in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content=_error_body(422, "VALIDATION_FAILED", "요청 데이터 유효성 검증에 실패했습니다.", errors),
    )
