from fastapi import FastAPI
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware

from .core.errors import AppError, app_error_handler, http_exception_handler, validation_exception_handler
from .database import supabase
from .routers import analysis, content, courses, dashboard, materials, notices, quiz, scripts, users

app = FastAPI(title="FeedA API", version="0.1.0")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
app.include_router(courses.router)
app.include_router(scripts.router)
app.include_router(materials.router)
app.include_router(quiz.router)
app.include_router(notices.router)
app.include_router(dashboard.router)
app.include_router(analysis.router)
app.include_router(content.preview_router)
app.include_router(content.review_router)


# ── 헬스체크 ───────────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


@app.get("/test-db", tags=["health"])
def test_db_connection():
    response = supabase.table("profiles").select("*").limit(1).execute()
    return {"status": "success", "data": response.data}