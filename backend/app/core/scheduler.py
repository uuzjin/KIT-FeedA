"""APScheduler 기반 백그라운드 작업 모듈.

등록된 작업:
  - send_pending_reminders : 매 분 — scheduled_at 도래한 PENDING 리마인더 발송
  - cleanup_deleted_accounts: 매일 03:00 UTC — deleted_at 30일 경과 계정 영구 삭제
"""

import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="UTC")


# ──────────────────────────────────────────────────────────────────────────────
# 작업 1: 리마인더 발송 (매 분)
# ──────────────────────────────────────────────────────────────────────────────

def send_pending_reminders() -> None:
    """scheduled_at이 현재 시각 이하이고 status=PENDING인 리마인더를 발송한다."""
    from ..database import supabase
    from .config import settings

    now = datetime.now(timezone.utc).isoformat()

    reminders = (
        supabase.table("reminders")
        .select("id, deadline_id, user_id, channel, hours_before, deadlines(title, due_at, course_id)")
        .eq("status", "PENDING")
        .lte("scheduled_at", now)
        .limit(100)
        .execute()
    ).data or []

    for reminder in reminders:
        try:
            _dispatch_reminder(reminder, settings)
            supabase.table("reminders").update({
                "status": "SENT",
                "sent_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", reminder["id"]).execute()
        except Exception as exc:
            logger.error("리마인더 발송 실패 reminder_id=%s: %s", reminder["id"], exc)
            supabase.table("reminders").update({"status": "FAILED"}).eq("id", reminder["id"]).execute()


def _dispatch_reminder(reminder: dict, settings) -> None:
    deadline_info = reminder.get("deadlines") or {}
    title = deadline_info.get("title", "마감 알림")
    due_at = deadline_info.get("due_at", "")
    hours_before = reminder["hours_before"]
    channel = reminder["channel"]
    user_id = reminder["user_id"]

    body = f"'{title}' 마감이 {hours_before}시간 후입니다.\n마감일시: {due_at}"

    if channel == "IN_APP":
        _send_in_app(user_id, title, body, reminder)
    elif channel == "EMAIL":
        _send_email(user_id, title, body, settings)
    elif channel == "KAKAO":
        _send_kakao(user_id, title, body, settings)
    # PUSH: 미구현 — 채널이 존재해도 발송 없이 SENT 처리


def _send_in_app(user_id: str, title: str, body: str, reminder: dict) -> None:
    from ..database import supabase

    deadline_info = reminder.get("deadlines") or {}
    supabase.table("notifications").insert({
        "user_id": user_id,
        "notification_type": "REMINDER",
        "title": title,
        "body": body,
        "metadata": {
            "deadlineId": reminder["deadline_id"],
            "courseId": deadline_info.get("course_id"),
        },
        "is_read": False,
    }).execute()


def _build_email_html(title: str, body: str) -> str:
    """마감 알림 HTML 이메일 템플릿."""
    lines = body.replace("\n", "<br>")
    return f"""<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Apple SD Gothic Neo',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;max-width:560px;width:100%;">
        <!-- 헤더 -->
        <tr>
          <td style="background:#6366f1;padding:24px 32px;">
            <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">FeedA</p>
            <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px;">강의 지원 플랫폼</p>
          </td>
        </tr>
        <!-- 본문 -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;font-size:18px;color:#1e1b4b;">{title}</h2>
            <p style="margin:0;font-size:14px;line-height:1.7;color:#374151;">{lines}</p>
          </td>
        </tr>
        <!-- 푸터 -->
        <tr>
          <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              이 메일은 FeedA 플랫폼에서 자동 발송되었습니다. 수신을 원치 않으시면 알림 설정을 변경해 주세요.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_email(user_id: str, title: str, body: str, settings) -> None:
    if not settings.SMTP_HOST:
        logger.debug("SMTP 미설정 — 이메일 발송 스킵 user_id=%s", user_id)
        return

    from ..database import supabase

    profile = (
        supabase.table("profiles")
        .select("email")
        .eq("id", user_id)
        .maybe_single()
        .execute()
    )
    if not profile.data or not profile.data.get("email"):
        return

    recipient = profile.data["email"]
    sender = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"[FeedA] {title}"
    msg["From"] = sender
    msg["To"] = recipient

    msg.attach(MIMEText(body, "plain", "utf-8"))
    msg.attach(MIMEText(_build_email_html(title, body), "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


def _send_kakao(user_id: str, title: str, body: str, settings) -> None:
    if not settings.KAKAO_ACCESS_TOKEN:
        logger.debug("KAKAO_ACCESS_TOKEN 미설정 — 카카오 발송 스킵 user_id=%s", user_id)
        return

    from ..database import supabase

    # 카카오 연동 여부 확인
    noti_settings = (
        supabase.table("notification_settings")
        .select("kakao_verified_at")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not noti_settings.data or not noti_settings.data.get("kakao_verified_at"):
        return  # 카카오 미연동 사용자 스킵

    httpx.post(
        "https://kapi.kakao.com/v2/api/talk/memo/default/send",
        headers={"Authorization": f"Bearer {settings.KAKAO_ACCESS_TOKEN}"},
        json={
            "template_object": {
                "object_type": "text",
                "text": f"[FeedA] {title}\n\n{body}",
                "link": {"web_url": "", "mobile_web_url": ""},
            }
        },
        timeout=10,
    )


# ──────────────────────────────────────────────────────────────────────────────
# 작업 2: 탈퇴 계정 영구 삭제 (매일 03:00 UTC)
# ──────────────────────────────────────────────────────────────────────────────

def cleanup_deleted_accounts() -> None:
    """deleted_at이 30일 경과한 profiles의 auth.users를 영구 삭제한다.

    Supabase admin API를 사용하므로 SUPABASE_SERVICE_KEY가 필요하다.
    미설정 시 경고 로그만 남기고 스킵.
    """
    from ..database import supabase
    from .config import settings

    cutoff = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    expired = (
        supabase.table("profiles")
        .select("id")
        .lte("deleted_at", cutoff)
        .execute()
    ).data or []

    if not expired:
        return

    if not settings.SUPABASE_SERVICE_KEY:
        logger.warning(
            "SUPABASE_SERVICE_KEY 미설정 — 탈퇴 계정 %d건 영구 삭제 스킵", len(expired)
        )
        return

    from supabase import create_client

    admin_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

    for profile in expired:
        uid = profile["id"]
        try:
            admin_client.auth.admin.delete_user(uid)
            logger.info("탈퇴 계정 영구 삭제 완료: %s", uid)
        except Exception as exc:
            logger.error("탈퇴 계정 삭제 실패 user_id=%s: %s", uid, exc)
