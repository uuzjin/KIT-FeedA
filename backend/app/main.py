from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from .core.errors import AppError, app_error_handler, http_exception_handler, validation_exception_handler
from .core.rate_limit import limiter
from .core.scheduler import cleanup_deleted_accounts, scheduler, send_pending_reminders
from .database import supabase
from .routers import (
    ai_simulation,
    analysis,
    content,
    courses,
    dashboard,
    materials,
    notifications,
    notices,
    quiz,
    reminders,
    scripts,
    users,
)
from .routers.lms import announce_dist_router, lms_syncs_router, preview_dist_router, review_dist_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # APScheduler 작업 등록 및 시작
    scheduler.add_job(send_pending_reminders, "interval", minutes=1, id="send_reminders")
    scheduler.add_job(cleanup_deleted_accounts, "cron", hour=3, id="cleanup_accounts")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="FeedA API", version="0.1.0", lifespan=lifespan)

# ── Rate Limiter ───────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, lambda req, exc: __import__("fastapi").responses.JSONResponse(
    status_code=429,
    content={"detail": "요청 횟수 제한을 초과했습니다. 잠시 후 다시 시도하세요."},
))
app.add_middleware(
    SlowAPIMiddleware
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 모든 도메인 허용 (추후 프론트엔드 URL이 고정되면 여기에 추가)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 에러 핸들러 ────────────────────────────────────────────────────────────────
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)

# ── 라우터 ─────────────────────────────────────────────────────────────────────
app.include_router(users.router)
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(scripts.router)
app.include_router(materials.router)
app.include_router(quiz.router)
app.include_router(notices.router)
app.include_router(dashboard.router)
app.include_router(analysis.router)
app.include_router(content.preview_router)
app.include_router(content.review_router)
app.include_router(ai_simulation.router)
app.include_router(notifications.router)
app.include_router(reminders.deadlines_router)
app.include_router(reminders.settings_router)
app.include_router(lms_syncs_router)
app.include_router(preview_dist_router)
app.include_router(review_dist_router)
app.include_router(announce_dist_router)


# ── 헬스체크 ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


@app.get("/test-db", tags=["health"])
def test_db_connection():
    response = supabase.table("profiles").select("*").limit(1).execute()
    return {"status": "success", "data": response.data}