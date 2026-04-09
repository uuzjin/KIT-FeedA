"""7-1. reminders 라우터 단위 테스트.

deadline CRUD + reminder 스케줄링 로직을 테스트한다.
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch


# ── _compute_deadline_status 단위 테스트 ─────────────────────────────────────

def test_compute_deadline_status_upcoming():
    from app.routers.reminders import _compute_deadline_status
    future = (datetime.now(timezone.utc) + timedelta(hours=10)).isoformat()
    status, remaining = _compute_deadline_status(future)
    assert status == "UPCOMING"
    assert remaining > 0


def test_compute_deadline_status_overdue():
    from app.routers.reminders import _compute_deadline_status
    past = (datetime.now(timezone.utc) - timedelta(hours=5)).isoformat()
    status, remaining = _compute_deadline_status(past)
    assert status == "OVERDUE"
    assert remaining < 0


# ── _format_deadline 단위 테스트 ──────────────────────────────────────────────

def test_format_deadline_fields():
    from app.routers.reminders import _format_deadline
    future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    row = {
        "id": "dl-001",
        "course_id": "course-001",
        "schedule_id": "sched-001",
        "deadline_type": "QUIZ",
        "title": "1주차 퀴즈 마감",
        "description": "퀴즈 설명",
        "due_at": future,
        "created_by": "instructor-001",
        "created_at": "2026-04-01T00:00:00Z",
    }
    result = _format_deadline(row)
    assert result["deadlineId"] == "dl-001"
    assert result["status"] == "UPCOMING"
    assert result["deadlineType"] == "QUIZ"
    assert "remainingHours" in result


# ── _create_reminders_for_deadline 단위 테스트 ────────────────────────────────

def test_create_reminders_skips_past_schedule():
    """이미 지난 발송 시각은 reminder를 생성하지 않아야 한다."""
    # due_at을 1시간 후로 설정 → hours_before=[24, 2]이면
    # 24시간 전 발송 시각은 이미 지나므로 skip, 2시간 전만 생성
    future_1h = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()

    mock_sb = MagicMock()
    insert_result = MagicMock()
    insert_result.data = [{"id": "r-001", "scheduled_at": "...", "channel": "IN_APP"}]
    mock_sb.table.return_value.insert.return_value.execute.return_value = insert_result

    with patch("app.routers.reminders.supabase", mock_sb):
        from app.routers.reminders import _create_reminders_for_deadline
        created = _create_reminders_for_deadline(
            "dl-001", future_1h, "user-001",
            hours_list=[24, 2],
            channels=["IN_APP"],
        )

    # 24시간 전 발송 시각이 이미 지났으므로 insert는 최대 1건(2시간 전)
    call_args = mock_sb.table.return_value.insert.call_args
    if call_args:
        rows_inserted = call_args[0][0]
        assert all(r["hours_before"] == 2 for r in rows_inserted), \
            "이미 지난 발송 시각(hours_before=24)은 삽입되면 안 됩니다."


def test_create_reminders_no_future_schedule():
    """due_at이 이미 지나면 reminder를 하나도 생성하지 않아야 한다."""
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()

    mock_sb = MagicMock()
    with patch("app.routers.reminders.supabase", mock_sb):
        from app.routers.reminders import _create_reminders_for_deadline
        created = _create_reminders_for_deadline(
            "dl-001", past, "user-001",
            hours_list=[24, 2],
            channels=["IN_APP"],
        )

    # insert가 호출되지 않아야 한다
    mock_sb.table.return_value.insert.assert_not_called()
    assert created == []


# ── _format_reminder_settings 단위 테스트 ────────────────────────────────────

def test_format_reminder_settings_defaults():
    from app.routers.reminders import _format_reminder_settings
    row = {
        "channels": ["EMAIL"],
        "hours_before": [48],
        "quiz_notifications": False,
        "material_notifications": True,
        "updated_at": None,
    }
    result = _format_reminder_settings(row)
    assert result["channels"] == ["EMAIL"]
    assert result["hoursBefore"] == [48]
    assert result["quizNotifications"] is False
    assert result["materialNotifications"] is True
