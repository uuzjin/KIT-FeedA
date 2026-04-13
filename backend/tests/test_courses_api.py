from types import SimpleNamespace
from unittest.mock import MagicMock, patch


def _make_query_result(data):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.maybe_single.return_value = query
    query.execute.return_value = SimpleNamespace(data=data)
    return query


def _make_execute_query(data):
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


def test_join_via_invite_creates_notifications(app_client):
    from app.main import app
    from app.core.auth import get_current_user
    from app.routers import courses

    app.dependency_overrides[get_current_user] = lambda: {
        "id": "student-1",
        "role": "STUDENT",
    }

    enrollments_table = MagicMock()
    existing_query = _make_execute_query(None)
    joined_query = _make_execute_query({"joined_at": "2026-04-13T00:00:00Z"})
    enrollments_table.select.side_effect = [existing_query, joined_query]
    enrollments_table.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"course_id": "course-1", "student_id": "student-1"}]
    )

    notifications_table = MagicMock()
    notifications_table.insert.return_value.execute.return_value = SimpleNamespace(
        data=[{"id": "noti-1"}]
    )

    def table_side_effect(name: str):
        if name == "course_invites":
            return _make_execute_query({"course_id": "course-1", "expires_at": None})
        if name == "course_enrollments":
            return enrollments_table
        if name == "courses":
            return _make_execute_query({"course_name": "알고리즘"})
        if name == "course_instructors":
            return _make_execute_query([{"instructor_id": "inst-1"}])
        if name == "profiles":
            return _make_execute_query({"name": "김학생"})
        if name == "notifications":
            return notifications_table
        raise AssertionError(f"unexpected table: {name}")

    mocked_supabase = MagicMock()
    mocked_supabase.table.side_effect = table_side_effect

    try:
        with patch.object(courses, "supabase", mocked_supabase):
            response = app_client.post("/api/courses/join", json={"token": "invite-token"})
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 201
    assert response.json()["courseId"] == "course-1"

    insert_calls = notifications_table.insert.call_args_list
    assert len(insert_calls) == 2
    assert insert_calls[0].args[0]["user_id"] == "student-1"
    assert insert_calls[0].args[0]["notification_type"] == "SYSTEM"
    assert insert_calls[1].args[0]["user_id"] == "inst-1"
    assert insert_calls[1].args[0]["notification_type"] == "SYSTEM"


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
