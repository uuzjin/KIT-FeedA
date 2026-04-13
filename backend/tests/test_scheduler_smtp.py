"""3-C. 스케줄러 + SMTP 이메일 발송 테스트.

커버리지:
  - _send_email  : SMTP 미설정 시 스킵, 설정 시 smtplib 호출
  - _send_in_app : notifications 테이블에 INSERT
  - send_pending_reminders : PENDING 리마인더 조회 → _dispatch_reminder → SENT 업데이트
  - _build_email_html : HTML 템플릿에 제목·본문 포함 여부

NOTE: conftest.py의 session-scoped app_client fixture가
  `patch.object(scheduler_module, "send_pending_reminders", MagicMock())` 를 수행하므로
  테스트 파일 임포트 시점(컬렉션 단계 — fixture 활성화 전)에 실제 함수를 캡처해 둔다.
"""
import smtplib
from types import SimpleNamespace
from unittest.mock import MagicMock, call, patch

# ── 모듈 임포트 시점에 실제 함수 레퍼런스 보관 ──────────────────────────────────
# pytest 컬렉션 단계(session fixture 활성화 전)에 실행되므로 아직 패치되지 않은 상태.
import app.core.scheduler as _sched_mod
_real_send_pending_reminders = _sched_mod.send_pending_reminders


# ─────────────────────────────────────────────────────────────────────────────
# _build_email_html
# ─────────────────────────────────────────────────────────────────────────────

def test_build_email_html_contains_title_and_body():
    from app.core.scheduler import _build_email_html
    html = _build_email_html("퀴즈 마감 알림", "마감이 2시간 후입니다.")
    assert "퀴즈 마감 알림" in html
    assert "마감이 2시간 후입니다." in html
    assert "<!DOCTYPE html>" in html


def test_build_email_html_newlines_converted_to_br():
    from app.core.scheduler import _build_email_html
    html = _build_email_html("제목", "줄1\n줄2")
    assert "<br>" in html
    # 원문 \n은 HTML 엔티티로 존재하지 않아야 함 (br로 치환됨)


# ─────────────────────────────────────────────────────────────────────────────
# _send_email — SMTP 미설정 시 스킵
# ─────────────────────────────────────────────────────────────────────────────

def test_send_email_skips_when_no_smtp_host():
    """SMTP_HOST 미설정이면 smtplib.SMTP가 호출되지 않아야 한다."""
    fake_settings = SimpleNamespace(SMTP_HOST="", SMTP_PORT=587, SMTP_USER="", SMTP_PASSWORD="", SMTP_FROM="")

    with patch("smtplib.SMTP") as mock_smtp:
        from app.core.scheduler import _send_email
        _send_email("user-001", "제목", "내용", fake_settings)

    mock_smtp.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# _send_email — SMTP 설정 시 실제 발송
# ─────────────────────────────────────────────────────────────────────────────

def test_send_email_calls_smtp_when_configured():
    """SMTP_HOST 설정 시 smtplib.SMTP.__enter__ → starttls → login → send_message 순서."""
    fake_settings = SimpleNamespace(
        SMTP_HOST="smtp.example.com",
        SMTP_PORT=587,
        SMTP_USER="user@example.com",
        SMTP_PASSWORD="secret",
        SMTP_FROM="no-reply@example.com",
    )

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(
        data={"email": "student@example.com"}
    )

    mock_server = MagicMock()
    mock_smtp_cls = MagicMock()
    mock_smtp_cls.return_value.__enter__ = MagicMock(return_value=mock_server)
    mock_smtp_cls.return_value.__exit__ = MagicMock(return_value=False)

    with (
        patch("app.core.scheduler.smtplib.SMTP", mock_smtp_cls),
        patch("app.database.supabase", mock_sb),
    ):
        from app.core.scheduler import _send_email
        _send_email("user-001", "퀴즈 마감 알림", "2시간 후 마감입니다.", fake_settings)

    mock_server.starttls.assert_called_once()
    mock_server.login.assert_called_once_with("user@example.com", "secret")
    mock_server.send_message.assert_called_once()


def test_send_email_skips_if_no_profile_email():
    """profiles.email이 없으면 smtplib.SMTP가 호출되지 않아야 한다."""
    fake_settings = SimpleNamespace(
        SMTP_HOST="smtp.example.com",
        SMTP_PORT=587,
        SMTP_USER="u",
        SMTP_PASSWORD="p",
        SMTP_FROM="",
    )

    mock_sb = MagicMock()
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .maybe_single.return_value.execute.return_value = MagicMock(data=None)

    with (
        patch("smtplib.SMTP") as mock_smtp,
        patch("app.database.supabase", mock_sb),
    ):
        from app.core.scheduler import _send_email
        _send_email("user-no-email", "제목", "내용", fake_settings)

    mock_smtp.assert_not_called()


# ─────────────────────────────────────────────────────────────────────────────
# _send_in_app
# ─────────────────────────────────────────────────────────────────────────────

def test_send_in_app_inserts_notification():
    """IN_APP 채널 발송 시 notifications 테이블에 INSERT 호출."""
    mock_sb = MagicMock()
    insert_result = MagicMock()
    insert_result.data = [{"id": "noti-001"}]
    mock_sb.table.return_value.insert.return_value.execute.return_value = insert_result

    reminder = {
        "deadline_id": "dl-001",
        "deadlines": {"course_id": "course-001"},
    }

    with patch("app.database.supabase", mock_sb):
        from app.core.scheduler import _send_in_app
        _send_in_app("user-001", "마감 알림", "1시간 후", reminder)

    mock_sb.table.assert_called_with("notifications")
    mock_sb.table.return_value.insert.assert_called_once()
    inserted = mock_sb.table.return_value.insert.call_args[0][0]
    assert inserted["user_id"] == "user-001"
    assert inserted["title"] == "마감 알림"
    assert inserted["is_read"] is False


# ─────────────────────────────────────────────────────────────────────────────
# send_pending_reminders 통합 흐름
# ─────────────────────────────────────────────────────────────────────────────

def test_send_pending_reminders_marks_sent():
    """PENDING 리마인더 → _dispatch_reminder 호출 → status=SENT 업데이트."""
    dispatched: list[dict] = []

    def fake_dispatch(reminder, settings):
        dispatched.append(reminder)

    mock_sb = MagicMock()

    # PENDING 리마인더 2건 반환
    pending_data = [
        {
            "id": "r-001", "deadline_id": "dl-001", "user_id": "u-001",
            "channel": "IN_APP", "hours_before": 2,
            "deadlines": {"title": "퀴즈 마감", "due_at": "2026-05-01T09:00:00Z", "course_id": "c-001"},
        },
        {
            "id": "r-002", "deadline_id": "dl-002", "user_id": "u-002",
            "channel": "EMAIL", "hours_before": 24,
            "deadlines": {"title": "과제 마감", "due_at": "2026-05-02T12:00:00Z", "course_id": "c-001"},
        },
    ]
    pending_result = MagicMock()
    pending_result.data = pending_data

    # select → eq → lte → limit → execute 체인
    mock_sb.table.return_value.select.return_value.eq.return_value\
        .lte.return_value.limit.return_value.execute.return_value = pending_result

    # update → eq → execute
    mock_sb.table.return_value.update.return_value.eq.return_value\
        .execute.return_value = MagicMock(data=[])

    fake_settings = SimpleNamespace(
        SMTP_HOST="", SMTP_PORT=587, SMTP_USER="", SMTP_PASSWORD="", SMTP_FROM="",
        KAKAO_ACCESS_TOKEN="",
    )

    with (
        patch("app.database.supabase", mock_sb),
        patch("app.core.config.settings", fake_settings),
        patch("app.core.scheduler._dispatch_reminder", fake_dispatch),
    ):
        _real_send_pending_reminders()

    assert len(dispatched) == 2, f"dispatch 호출 횟수 불일치: {len(dispatched)}"

    # SENT 업데이트가 2회 호출되었는지 확인
    update_calls = mock_sb.table.return_value.update.call_args_list
    sent_updates = [c for c in update_calls if c[0][0].get("status") == "SENT"]
    assert len(sent_updates) == 2, f"SENT 업데이트 횟수 불일치: {len(sent_updates)}"


def test_send_pending_reminders_marks_failed_on_dispatch_error():
    """_dispatch_reminder 예외 시 status=FAILED 업데이트."""
    mock_sb = MagicMock()

    pending_data = [{
        "id": "r-err", "deadline_id": "dl-001", "user_id": "u-001",
        "channel": "IN_APP", "hours_before": 2,
        "deadlines": {"title": "제목", "due_at": "2026-05-01T09:00:00Z", "course_id": "c-001"},
    }]
    pending_result = MagicMock()
    pending_result.data = pending_data

    mock_sb.table.return_value.select.return_value.eq.return_value\
        .lte.return_value.limit.return_value.execute.return_value = pending_result
    mock_sb.table.return_value.update.return_value.eq.return_value\
        .execute.return_value = MagicMock(data=[])

    fake_settings = SimpleNamespace(
        SMTP_HOST="", SMTP_PORT=587, SMTP_USER="", SMTP_PASSWORD="", SMTP_FROM="",
        KAKAO_ACCESS_TOKEN="",
    )

    with (
        patch("app.database.supabase", mock_sb),
        patch("app.core.config.settings", fake_settings),
        patch("app.core.scheduler._dispatch_reminder",
              side_effect=RuntimeError("발송 실패")),
    ):
        _real_send_pending_reminders()

    update_calls = mock_sb.table.return_value.update.call_args_list
    failed_updates = [c for c in update_calls if c[0][0].get("status") == "FAILED"]
    assert len(failed_updates) == 1, f"FAILED 업데이트 없음: {update_calls}"
