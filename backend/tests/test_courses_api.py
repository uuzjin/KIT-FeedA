from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def _make_query_result(data):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.maybe_single.return_value = query
    query.execute.return_value = SimpleNamespace(data=data)
    return query


def test_get_invite_preview_returns_404_for_missing_token(app_client):
    from app.routers import courses

    mocked_supabase = MagicMock()
    mocked_supabase.table.return_value = _make_query_result(None)

    with patch.object(courses, "supabase", mocked_supabase):
        response = app_client.get("/api/courses/invites/missing-token")

    assert response.status_code == 404
    assert response.json()["code"] == "RESOURCE_NOT_FOUND"


def test_list_course_materials_filters_by_type(app_client):
    from app.main import app
    from app.core.auth import get_current_user
    from app.routers import content

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "student-1",
        "role": "STUDENT",
    }

    preview_rows = [
        {
            "id": "pg-1",
            "course_id": "course-1",
            "schedule_id": "sched-1",
            "title": "1주차 예습 가이드",
            "summary": "preview",
            "status": "completed",
            "created_at": "2026-04-13T00:00:00Z",
            "completed_at": "2026-04-13T00:05:00Z",
            "course_schedules": {"week_number": 1, "topic": "intro"},
        }
    ]
    review_rows = [
        {
            "id": "rv-1",
            "course_id": "course-1",
            "schedule_id": "sched-1",
            "title": "1주차 복습 요약",
            "content": "review",
            "status": "completed",
            "created_at": "2026-04-13T00:10:00Z",
            "completed_at": "2026-04-13T00:11:00Z",
            "course_schedules": {"week_number": 1, "topic": "intro"},
        }
    ]

    def table_side_effect(name: str):
        if name == "preview_guides":
            return _make_query_result(preview_rows)
        if name == "review_summaries":
            return _make_query_result(review_rows)
        raise AssertionError(f"unexpected table: {name}")

    mocked_supabase = MagicMock()
    mocked_supabase.table.side_effect = table_side_effect

    try:
        with patch.object(content, "supabase", mocked_supabase):
            response = app_client.get("/api/courses/course-1/materials?type=PREVIEW_GUIDE")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body["totalCount"] == 1
    assert body["materials"][0]["type"] == "PREVIEW_GUIDE"
