"""LMS 연동 라우터.

엔드포인트 구조:
  3.3.1  POST /api/courses/{courseId}/lms-syncs          — 수강생 동기화 (200 동기식)
  6.4.1-A POST /api/courses/{courseId}/preview-guides/{guideId}/distributions
  6.4.1-B POST /api/courses/{courseId}/review-summaries/{summaryId}/distributions
  6.4.1-C POST /api/courses/{courseId}/announcements/{announcementId}/distributions
"""

from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from ..core.auth import require_instructor
from ..core.lms_client import get_lms_client
from ..database import supabase
from ..dependencies import require_instructor_of

# ── 3.3.1 LMS 수강생 동기화  /api/courses/{courseId}/lms-syncs ───────────────
lms_syncs_router = APIRouter(
    prefix="/api/courses/{course_id}/lms-syncs",
    tags=["lms"],
)

# ── 6.4 LMS 배포 — 자료 유형별 3개 라우터 ─────────────────────────────────────
preview_dist_router = APIRouter(
    prefix="/api/courses/{course_id}/preview-guides/{guide_id}/distributions",
    tags=["lms"],
)
review_dist_router = APIRouter(
    prefix="/api/courses/{course_id}/review-summaries/{summary_id}/distributions",
    tags=["lms"],
)
announce_dist_router = APIRouter(
    prefix="/api/courses/{course_id}/announcements/{announcement_id}/distributions",
    tags=["lms"],
)

_VALID_LMS = {"MOODLE", "CANVAS", "BLACKBOARD"}


# ──────────────────────────────────────────────────────────────────────────────
# 헬퍼
# ──────────────────────────────────────────────────────────────────────────────

def _format_distribution(row: dict) -> dict:
    return {
        "distributionId": row["id"],
        "courseId": row["course_id"],
        "materialType": row["material_type"],
        "sourceId": row["source_id"],
        "targetLms": row["target_lms"],
        "lmsSection": row.get("lms_section"),
        "status": row["status"],
        "lmsUrl": row.get("lms_url"),
        "errorMessage": row.get("error_message"),
        "distributedBy": row["distributed_by"],
        "distributedAt": row.get("distributed_at"),
    }


def _fetch_material(material_type: str, source_id: str) -> tuple[str, str]:
    """자료 유형별 제목·HTML 본문 반환."""
    _TABLE = {
        "preview_guide":  ("preview_guides",   "title", "summary"),
        "review_summary": ("review_summaries", "title", "content"),
        "announcement":   ("announcements",    "title", "content"),
    }
    table, title_col, content_col = _TABLE[material_type]
    row = (
        supabase.table(table)
        .select(f"{title_col}, {content_col}")
        .eq("id", source_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(status_code=404, detail="배포할 자료를 찾을 수 없습니다.")
    title = row.data.get(title_col) or "FeedA 자료"
    raw = row.data.get(content_col) or ""
    html = f"<p>{raw.replace(chr(10), '</p><p>')}</p>" if raw else ""
    return title, html


def _run_distribution(
    distribution_id: str,
    material_type: str,
    source_id: str,
    target_lms: str,
    lms_course_id: str,
    lms_section: str | None,
) -> None:
    try:
        title, html = _fetch_material(material_type, source_id)
        client = get_lms_client(target_lms)
        lms_url = client.upload_material(
            lms_course_id,
            lms_section or "FeedA 자료",
            title,
            html,
        )
        supabase.table("lms_distributions").update({
            "status": "COMPLETED",
            "lms_url": lms_url,
            "distributed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", distribution_id).execute()
    except HTTPException as e:
        supabase.table("lms_distributions").update({
            "status": "FAILED",
            "error_message": e.detail,
        }).eq("id", distribution_id).execute()
    except Exception as exc:
        supabase.table("lms_distributions").update({
            "status": "FAILED",
            "error_message": str(exc),
        }).eq("id", distribution_id).execute()


class DistributeRequest(BaseModel):
    targetLms: str          # MOODLE | CANVAS | BLACKBOARD
    lmsCourseId: str
    section: str | None = None


def _create_distribution(
    course_id: str,
    material_type: str,
    source_id: str,
    payload: DistributeRequest,
    user_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    if payload.targetLms not in _VALID_LMS:
        raise HTTPException(status_code=400, detail=f"targetLms는 {_VALID_LMS} 중 하나여야 합니다.")

    # 자료 존재 확인 (404 조기 반환)
    _fetch_material(material_type, source_id)

    result = supabase.table("lms_distributions").insert({
        "course_id": course_id,
        "material_type": material_type,
        "source_id": source_id,
        "target_lms": payload.targetLms,
        "lms_section": payload.section,
        "status": "PENDING",
        "distributed_by": user_id,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="배포 요청 생성에 실패했습니다.")

    dist = result.data[0]
    background_tasks.add_task(
        _run_distribution,
        dist["id"],
        material_type,
        source_id,
        payload.targetLms,
        payload.lmsCourseId,
        payload.section,
    )
    return dist


# ──────────────────────────────────────────────────────────────────────────────
# 3.3.1  LMS 수강생 동기화 (동기식 200)
# ──────────────────────────────────────────────────────────────────────────────

class LmsSyncRequest(BaseModel):
    lmsType: str        # MOODLE | CANVAS | BLACKBOARD
    lmsCourseId: str
    syncStudents: bool = True


@lms_syncs_router.post("", status_code=200)
def sync_lms(
    course_id: str,
    payload: LmsSyncRequest,
    current_user: dict = Depends(require_instructor),
):
    """LMS에서 과목·수강생 정보를 동기화한다."""
    require_instructor_of(course_id, current_user["id"])

    if payload.lmsType not in _VALID_LMS:
        raise HTTPException(status_code=400, detail=f"lmsType은 {_VALID_LMS} 중 하나여야 합니다.")

    synced_count = 0
    try:
        client = get_lms_client(payload.lmsType)

        if payload.syncStudents:
            students = client.get_students(payload.lmsCourseId)
            for student in students:
                email = student.get("email", "")
                if not email:
                    continue
                profile = (
                    supabase.table("profiles")
                    .select("id")
                    .eq("email", email)
                    .maybe_single()
                    .execute()
                )
                if profile.data:
                    existing = (
                        supabase.table("course_enrollments")
                        .select("id")
                        .eq("course_id", course_id)
                        .eq("student_id", profile.data["id"])
                        .maybe_single()
                        .execute()
                    )
                    if not existing.data:
                        supabase.table("course_enrollments").insert({
                            "course_id": course_id,
                            "student_id": profile.data["id"],
                            "join_method": "FILE",
                        }).execute()
                        synced_count += 1

    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LMS 서버 연결 실패: {exc}")

    now = datetime.now(timezone.utc).isoformat()
    sync_result = supabase.table("lms_syncs").insert({
        "course_id": course_id,
        "lms_type": payload.lmsType,
        "lms_course_id": payload.lmsCourseId,
        "synced_students": synced_count,
        "synced_at": now,
    }).execute()

    sync_id = sync_result.data[0]["id"] if sync_result.data else None
    return {
        "syncId": sync_id,
        "syncedStudents": synced_count,
        "lastSyncAt": now,
    }


# ──────────────────────────────────────────────────────────────────────────────
# 6.4.1-A  예습 가이드 LMS 배포
# ──────────────────────────────────────────────────────────────────────────────

@preview_dist_router.post("", status_code=202)
def distribute_preview_guide(
    course_id: str,
    guide_id: str,
    payload: DistributeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    dist = _create_distribution(
        course_id, "preview_guide", guide_id, payload, current_user["id"], background_tasks
    )
    return {
        **_format_distribution(dist),
        "message": "LMS 배포가 시작되었습니다.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# 6.4.1-B  복습 요약본 LMS 배포
# ──────────────────────────────────────────────────────────────────────────────

@review_dist_router.post("", status_code=202)
def distribute_review_summary(
    course_id: str,
    summary_id: str,
    payload: DistributeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    dist = _create_distribution(
        course_id, "review_summary", summary_id, payload, current_user["id"], background_tasks
    )
    return {
        **_format_distribution(dist),
        "message": "LMS 배포가 시작되었습니다.",
    }


# ──────────────────────────────────────────────────────────────────────────────
# 6.4.1-C  공지문 LMS 배포
# ──────────────────────────────────────────────────────────────────────────────

@announce_dist_router.post("", status_code=202)
def distribute_announcement(
    course_id: str,
    announcement_id: str,
    payload: DistributeRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    dist = _create_distribution(
        course_id, "announcement", announcement_id, payload, current_user["id"], background_tasks
    )
    return {
        **_format_distribution(dist),
        "message": "LMS 배포가 시작되었습니다.",
    }
