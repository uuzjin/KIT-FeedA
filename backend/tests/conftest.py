"""공통 pytest fixtures.

환경 변수를 앱 임포트 전에 설정하여 Supabase/AI 실제 연결 없이 테스트한다.
"""
import os

# ── 앱 임포트 전 환경 변수 주입 ───────────────────────────────────────────────
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_KEY", "fake-anon-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "fake-jwt-secret-that-is-long-enough-32chars")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "fake-service-key")
os.environ.setdefault("GOOGLE_API_KEY", "fake-google-api-key")

from unittest.mock import MagicMock, patch  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# 스케줄러 모듈을 미리 임포트하여 patch 대상이 될 수 있게 함
import app.core.scheduler as _app_scheduler  # noqa: E402  # type: ignore[import]


# ── 앱 및 DB 목킹 ─────────────────────────────────────────────────────────────

def _make_supabase_mock() -> MagicMock:
    """체인 쿼리(.table().select()...execute())를 지원하는 Supabase 목 반환."""
    mock = MagicMock()
    # 기본 execute() 결과: 빈 목록
    execute_result = MagicMock()
    execute_result.data = []
    execute_result.count = 0
    # 어떤 체인이든 execute()가 호출되면 빈 결과 반환
    mock.table.return_value.select.return_value.eq.return_value.eq.return_value.execute.return_value = execute_result
    mock.table.return_value.insert.return_value.execute.return_value = execute_result
    mock.table.return_value.update.return_value.eq.return_value.execute.return_value = execute_result
    mock.table.return_value.delete.return_value.eq.return_value.execute.return_value = execute_result
    mock.table.return_value.upsert.return_value.execute.return_value = execute_result
    return mock


@pytest.fixture(scope="session")
def mock_supabase():
    return _make_supabase_mock()


@pytest.fixture(scope="session")
def app_client(mock_supabase):
    """APScheduler와 Supabase를 모두 목킹한 TestClient."""
    mock_sched = MagicMock()
    mock_sched.add_job = MagicMock()
    mock_sched.start = MagicMock()
    mock_sched.shutdown = MagicMock()

    with (
        patch("app.database.supabase", mock_supabase),
        patch.object(_app_scheduler, "scheduler", mock_sched),
        patch.object(_app_scheduler, "send_pending_reminders", MagicMock()),
        patch.object(_app_scheduler, "cleanup_deleted_accounts", MagicMock()),
    ):
        from app.main import app as fastapi_app
        with TestClient(fastapi_app, raise_server_exceptions=False) as client:
            yield client


# ── 인증 목킹 헬퍼 ───────────────────────────────────────────────────────────

FAKE_INSTRUCTOR = {"id": "instructor-uuid-001", "role": "instructor", "email": "prof@test.com"}
FAKE_STUDENT = {"id": "student-uuid-002", "role": "student", "email": "stu@test.com"}


def instructor_auth_override():
    return FAKE_INSTRUCTOR


def student_auth_override():
    return FAKE_STUDENT


def get_fastapi_app():
    """테스트에서 app.dependency_overrides 접근용."""
    from app.main import app as fastapi_app
    return fastapi_app
