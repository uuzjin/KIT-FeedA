from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import supabase

from .routers import analysis, auth, courses, dashboard, materials, notices, quiz

app = FastAPI(title="AI Lecture Assistant API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(courses.router)
app.include_router(analysis.router)
app.include_router(materials.router)
app.include_router(quiz.router)
app.include_router(notices.router)
app.include_router(dashboard.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}


# DB 연결 테스트용 API 추가
@app.get("/test-db")
def test_db_connection():
    # profiles 테이블에서 데이터 1개만 가져와서 연결 테스트
    response = supabase.table("profiles").select("*").limit(1).execute()
    return {"status": "success", "data": response.data}