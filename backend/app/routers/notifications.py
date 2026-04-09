from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import get_current_user
from ..database import supabase

router = APIRouter(prefix="/api/users/{user_id}", tags=["notifications"])

# ──────────────────────────────────────────────────────────────────────────────
# 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _check_self(user_id: str, current_user: dict) -> None:
    if user_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인의 알림만 조회/수정할 수 있습니다.")


def _format_notification(row: dict) -> dict:
    return {
        "notificationId": row["id"],
        "userId": row["user_id"],
        "notificationType": row["notification_type"],
        "title": row["title"],
        "body": row["body"],
        "metadata": row.get("metadata"),
        "isRead": row["is_read"],
        "createdAt": row["created_at"],
        "readAt": row.get("read_at"),
    }


def _get_settings_row(user_id: str) -> dict | None:
    result = (
        supabase.table("notification_settings")
        .select("*")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    return result.data


# ──────────────────────────────────────────────────────────────────────────────
# 인앱 알림 목록 / 읽음 / 삭제  (API 명세 6-2 보완 항목)
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/notifications")
def list_notifications(
    user_id: str,
    limit: int = 20,
    offset: int = 0,
    is_read: bool | None = None,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)

    q = (
        supabase.table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if is_read is not None:
        q = q.eq("is_read", is_read)

    notifications = (q.execute()).data or []

    total = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    ).count or 0
    unread = (
        supabase.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    ).count or 0

    return {
        "notifications": [_format_notification(n) for n in notifications],
        "totalCount": total,
        "unreadCount": unread,
    }


# literal path를 parameterized path보다 먼저 등록
@router.put("/notifications/read-all", status_code=204)
def mark_all_read(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("notifications").update({
        "is_read": True,
        "read_at": now,
    }).eq("user_id", user_id).eq("is_read", False).execute()


@router.patch("/notifications/{noti_id}")
def mark_notification_read(
    user_id: str,
    noti_id: str,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)
    now = datetime.now(timezone.utc).isoformat()
    result = (
        supabase.table("notifications")
        .update({"is_read": True, "read_at": now})
        .eq("id", noti_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다.")
    return _format_notification(result.data[0])


@router.delete("/notifications/{noti_id}", status_code=204)
def delete_notification(
    user_id: str,
    noti_id: str,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)
    supabase.table("notifications").delete().eq("id", noti_id).eq("user_id", user_id).execute()


# ──────────────────────────────────────────────────────────────────────────────
# 10.1.1 알림 채널 설정  PUT /notifications/channels
# ──────────────────────────────────────────────────────────────────────────────

class ChannelItem(BaseModel):
    type: str       # EMAIL | PUSH | IN_APP | KAKAO
    enabled: bool


class ChannelsRequest(BaseModel):
    channels: list[ChannelItem]


_CHANNEL_COL = {
    "EMAIL": "email_enabled",
    "PUSH": "push_enabled",
    "IN_APP": "in_app_enabled",
    "KAKAO": "kakao_enabled",
}

_VALID_CHANNELS = set(_CHANNEL_COL.keys())


def _build_channels_response(row: dict | None) -> dict:
    if row is None:
        return {
            "channels": [
                {"type": "EMAIL",  "enabled": True,  "verifiedAt": None},
                {"type": "PUSH",   "enabled": True,  "verifiedAt": None},
                {"type": "IN_APP", "enabled": True,  "verifiedAt": None},
                {"type": "KAKAO",  "enabled": False, "verifiedAt": None},
            ],
            "updatedAt": None,
        }
    return {
        "channels": [
            {"type": "EMAIL",  "enabled": row.get("email_enabled", True),  "verifiedAt": None},
            {"type": "PUSH",   "enabled": row.get("push_enabled", True),   "verifiedAt": None},
            {"type": "IN_APP", "enabled": row.get("in_app_enabled", True), "verifiedAt": None},
            {
                "type": "KAKAO",
                "enabled": row.get("kakao_enabled", False),
                "verifiedAt": row.get("kakao_verified_at"),
            },
        ],
        "updatedAt": row.get("updated_at"),
    }


@router.put("/notifications/channels")
def update_notification_channels(
    user_id: str,
    payload: ChannelsRequest,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)

    # 채널 유효성 검증
    for item in payload.channels:
        if item.type not in _VALID_CHANNELS:
            raise HTTPException(
                status_code=400,
                detail=f"유효하지 않은 채널 type: {item.type}. 허용값: {_VALID_CHANNELS}",
            )

    # KAKAO enabled=true 시 연동 여부 확인 → 422
    kakao_item = next((c for c in payload.channels if c.type == "KAKAO"), None)
    if kakao_item and kakao_item.enabled:
        existing = _get_settings_row(user_id)
        verified = existing.get("kakao_verified_at") if existing else None
        if not verified:
            raise HTTPException(
                status_code=422,
                detail="카카오 채널은 연동 완료 후 활성화할 수 있습니다.",
            )

    row: dict = {"user_id": user_id}
    for item in payload.channels:
        col = _CHANNEL_COL[item.type]
        row[col] = item.enabled

    result = (
        supabase.table("notification_settings")
        .upsert(row, on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="채널 설정 저장에 실패했습니다.")
    return _build_channels_response(result.data[0])


# ──────────────────────────────────────────────────────────────────────────────
# 10.1.2 알림 채널 조회  GET /notifications/channels
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/notifications/channels")
def get_notification_channels(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)
    row = _get_settings_row(user_id)
    return _build_channels_response(row)  # 행 없으면 기본값 반환, 404 아님


# ──────────────────────────────────────────────────────────────────────────────
# 10.1.3 알림 유형별 ON/OFF  PUT /notifications/preferences
# ──────────────────────────────────────────────────────────────────────────────

class PreferenceItem(BaseModel):
    type: str       # QUIZ | MATERIAL | DEADLINE
    enabled: bool


class PreferencesRequest(BaseModel):
    preferences: list[PreferenceItem]


_PREF_COL = {
    "QUIZ":     "quiz_published",
    "MATERIAL": "material_ready",
    "DEADLINE": "deadline_reminder",
}

_VALID_PREF_TYPES = set(_PREF_COL.keys())


def _build_prefs_response(row: dict | None) -> dict:
    if row is None:
        return {
            "preferences": [
                {"type": "QUIZ",     "enabled": True},
                {"type": "MATERIAL", "enabled": True},
                {"type": "DEADLINE", "enabled": True},
            ],
            "updatedAt": None,
        }
    return {
        "preferences": [
            {"type": "QUIZ",     "enabled": row.get("quiz_published", True)},
            {"type": "MATERIAL", "enabled": row.get("material_ready", True)},
            {"type": "DEADLINE", "enabled": row.get("deadline_reminder", True)},
        ],
        "updatedAt": row.get("updated_at"),
    }


@router.put("/notifications/preferences")
def update_notification_preferences(
    user_id: str,
    payload: PreferencesRequest,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)

    for item in payload.preferences:
        if item.type not in _VALID_PREF_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"유효하지 않은 알림 type: {item.type}. 허용값: {_VALID_PREF_TYPES}",
            )

    row: dict = {"user_id": user_id}
    for item in payload.preferences:
        row[_PREF_COL[item.type]] = item.enabled

    result = (
        supabase.table("notification_settings")
        .upsert(row, on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="알림 유형 설정 저장에 실패했습니다.")
    return _build_prefs_response(result.data[0])


# ──────────────────────────────────────────────────────────────────────────────
# 10.1.4 알림 유형별 조회  GET /notifications/preferences
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/notifications/preferences")
def get_notification_preferences(
    user_id: str,
    current_user: dict = Depends(get_current_user),
):
    _check_self(user_id, current_user)
    row = _get_settings_row(user_id)
    return _build_prefs_response(row)  # 행 없으면 기본값 반환, 404 아님
