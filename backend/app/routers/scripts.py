import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_failed, mark_processing
from ..core.storage import (
    ALLOWED_SCRIPT_TYPES,
    BUCKET_SCRIPTS,
    MAX_SCRIPT_SIZE,
    get_signed_url,
    upload_file,
)
from ..database import supabase

router = APIRouter(prefix="/api/courses/{course_id}/scripts", tags=["scripts"])


def _require_instructor_of(course_id: str, user_id: str) -> None:
    result = (
        supabase.table("course_instructors")
        .select("id")
        .eq("course_id", course_id)
        .eq("instructor_id", user_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=403, detail="해당 강의의 담당 강사가 아닙니다.")


def _format_script(row: dict) -> dict:
    return {
        "scriptId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row.get("schedule_id"),
        "title": row["title"],
        "fileName": row["file_name"],
        "fileSize": row["file_size"],
        "mimeType": row["mime_type"],
        "weekNumber": row.get("week_number"),
        "uploadedAt": row["uploaded_at"],
    }


# ── 4.1.1 스크립트 업로드 ─────────────────────────────────────────────────────
@router.post("", status_code=201)
async def upload_script(
    course_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(...),
    week_number: int | None = Form(None),
    schedule_id: str | None = Form(None),
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    file_id = str(uuid.uuid4())
    storage_path = f"{course_id}/{file_id}_{file.filename}"

    content_bytes = await upload_file(
        file, BUCKET_SCRIPTS, storage_path, ALLOWED_SCRIPT_TYPES, MAX_SCRIPT_SIZE
    )

    # 메타데이터 저장
    result = supabase.table("scripts").insert({
        "course_id": course_id,
        "schedule_id": schedule_id,
        "title": title,
        "file_name": file.filename,
        "file_size": file.size or 0,
        "mime_type": file.content_type,
        "content_path": storage_path,
        "week_number": week_number,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="스크립트 업로드에 실패했습니다.")

    script = result.data[0]
    script_id = script["id"]

    # 분석 레코드 미리 생성 (pending 상태)
    analysis_rows = [
        {"script_id": script_id, "analysis_type": t}
        for t in ("logic", "terminology", "prerequisites")
    ]
    supabase.table("script_analyses").insert(analysis_rows).execute()

    # Phase 3에서 실제 AI 호출로 교체 예정
    background_tasks.add_task(_placeholder_analysis, script_id)

    return _format_script(script)


async def _placeholder_analysis(script_id: str) -> None:
    """Phase 3 AI 분석 구현 전 placeholder. 실제 LLM 호출로 교체 예정."""
    pass


# ── 스크립트 목록 조회 ────────────────────────────────────────────────────────
@router.get("")
def list_scripts(course_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("scripts")
        .select("*")
        .eq("course_id", course_id)
        .order("uploaded_at", desc=True)
        .execute()
    )
    scripts = [_format_script(r) for r in (result.data or [])]
    return {"scripts": scripts, "totalCount": len(scripts)}


# ── 스크립트 상세 조회 ────────────────────────────────────────────────────────
@router.get("/{script_id}")
def get_script(course_id: str, script_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("scripts")
        .select("*")
        .eq("id", script_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

    script = _format_script(result.data)
    script["downloadUrl"] = get_signed_url(BUCKET_SCRIPTS, result.data["content_path"])
    return script


# ── 스크립트 삭제 ─────────────────────────────────────────────────────────────
@router.delete("/{script_id}", status_code=204)
def delete_script(
    course_id: str,
    script_id: str,
    current_user: dict = Depends(require_instructor),
):
    _require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("scripts")
        .select("content_path")
        .eq("id", script_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="스크립트를 찾을 수 없습니다.")

    from ..core.storage import delete_file
    delete_file(BUCKET_SCRIPTS, result.data["content_path"])
    supabase.table("scripts").delete().eq("id", script_id).execute()


# ── 분석 상태 조회 ────────────────────────────────────────────────────────────
@router.get("/{script_id}/analysis")
def get_analysis_status(
    course_id: str,
    script_id: str,
    current_user: dict = Depends(get_current_user),
):
    analyses = (
        supabase.table("script_analyses")
        .select("*")
        .eq("script_id", script_id)
        .execute()
    )
    suggestions = (
        supabase.table("script_suggestions")
        .select("*")
        .eq("script_id", script_id)
        .execute()
    )
    report = (
        supabase.table("script_reports")
        .select("*")
        .eq("script_id", script_id)
        .maybe_single()
        .execute()
    )

    return {
        "scriptId": script_id,
        "analyses": analyses.data or [],
        "suggestions": suggestions.data or [],
        "report": report.data,
    }
