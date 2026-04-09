"""7-1. notifications 라우터 단위 테스트."""
from unittest.mock import MagicMock, patch


# ── _format_notification 단위 테스트 ─────────────────────────────────────────

def test_format_notification_fields():
    from app.routers.notifications import _format_notification
    row = {
        "id": "noti-001",
        "user_id": "user-001",
        "notification_type": "REMINDER",
        "title": "마감 알림",
        "body": "퀴즈 마감 2시간 전입니다.",
        "metadata": {"deadlineId": "dl-001"},
        "is_read": False,
        "created_at": "2026-04-01T10:00:00Z",
        "read_at": None,
    }
    result = _format_notification(row)
    assert result["notificationId"] == "noti-001"
    assert result["notificationType"] == "REMINDER"
    assert result["isRead"] is False
    assert result["metadata"]["deadlineId"] == "dl-001"


# ── list_notifications HTTP 테스트 ────────────────────────────────────────────

def test_list_notifications_self_only(app_client):
    """본인이 아닌 user_id로 조회 시 403 반환."""
    from app.core.auth import get_current_user
    from tests.conftest import get_fastapi_app
    app = get_fastapi_app()

    app.dependency_overrides[get_current_user] = lambda: {"id": "other-user", "role": "student"}

    try:
        resp = app_client.get("/api/users/target-user/notifications")
        assert resp.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_list_notifications_ok(app_client):
    """본인 조회 시 목록 반환."""
    from app.core.auth import get_current_user
    from tests.conftest import get_fastapi_app
    app = get_fastapi_app()

    user_id = "user-self-001"
    app.dependency_overrides[get_current_user] = lambda: {"id": user_id, "role": "student"}

    mock_sb = MagicMock()
    execute_result = MagicMock()
    execute_result.data = [
        {
            "id": "n1", "user_id": user_id, "notification_type": "REMINDER",
            "title": "알림", "body": "내용", "metadata": {}, "is_read": False,
            "created_at": "2026-04-01T00:00:00Z", "read_at": None,
        }
    ]
    # 체인 모킹
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .order.return_value.range.return_value.execute.return_value = execute_result

    with patch("app.routers.notifications.supabase", mock_sb):
        resp = app_client.get(f"/api/users/{user_id}/notifications")

    assert resp.status_code == 200
    data = resp.json()
    assert "notifications" in data
    app.dependency_overrides.pop(get_current_user, None)


# ── PATCH 읽음 처리 테스트 ────────────────────────────────────────────────────

def test_mark_notification_read(app_client):
    """읽음 처리 시 is_read=True로 업데이트."""
    from app.core.auth import get_current_user
    from tests.conftest import get_fastapi_app
    app = get_fastapi_app()

    user_id = "user-self-002"
    noti_id = "noti-abc"
    app.dependency_overrides[get_current_user] = lambda: {"id": user_id, "role": "student"}

    mock_sb = MagicMock()
    updated = MagicMock()
    updated.data = [{
        "id": noti_id, "user_id": user_id, "notification_type": "SYSTEM",
        "title": "t", "body": "b", "metadata": {}, "is_read": True,
        "created_at": "2026-04-01T00:00:00Z", "read_at": "2026-04-02T00:00:00Z",
    }]
    mock_sb.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = updated

    with patch("app.routers.notifications.supabase", mock_sb):
        resp = app_client.patch(f"/api/users/{user_id}/notifications/{noti_id}")

    assert resp.status_code == 200
    assert resp.json()["isRead"] is True
    app.dependency_overrides.pop(get_current_user, None)
