import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_completed, mark_failed, mark_processing
from ..dependencies import require_instructor_of
from ..core.storage import (
    ALLOWED_SCRIPT_TYPES,
    BUCKET_SCRIPTS,
    MAX_SCRIPT_SIZE,
    get_signed_url,
    upload_file,
    delete_file,
)
from ..database import supabase

router = APIRouter(prefix="/api/courses/{course_id}/scripts", tags=["scripts"])


def _format_script(row: dict) -> dict:
    status = "analyzing"
    if row.get("script_reports"):
        status = "completed"

    return {
        "scriptId": row.get("id"),
        "courseId": row.get("course_id"),
        "scheduleId": row.get("schedule_id"),
        "title": row.get("title"),
        "fileName": row.get("file_name"),
        "fileSize": row.get("file_size"),
        "mimeType": row.get("mime_type"),
        "weekNumber": row.get("week_number"),
        "uploadedAt": row.get("uploaded_at") or row.get("created_at"),
        "status": status,
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
    require_instructor_of(course_id, current_user["id"])

    # schedule_id가 없는 경우 자동으로 첫 번째 스케줄 할당 시도
    if not schedule_id:
        schedules_res = (
            supabase.table("course_schedules")
            .select("id, week_number")
            .eq("course_id", course_id)
            .order("week_number")
            .limit(1)
            .execute()
        )
        if schedules_res.data:
            schedule_id = schedules_res.data[0]["id"]
            if not week_number:
                week_number = schedules_res.data[0]["week_number"]

    try:
        file_id = str(uuid.uuid4())
        storage_path = f"{course_id}/{file_id}_{file.filename}"

        await upload_file(file, BUCKET_SCRIPTS, storage_path, ALLOWED_SCRIPT_TYPES, MAX_SCRIPT_SIZE)

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

        # 분석 레코드 미리 생성 (pending)
        analysis_rows = [
            {"script_id": script_id, "analysis_type": t}
            for t in ("logic", "terminology", "prerequisites")
        ]
        supabase.table("script_analyses").insert(analysis_rows).execute()

        # 1단계 분석 background 실행
        background_tasks.add_task(_run_structural_analysis, script_id, storage_path, file.content_type)

        return _format_script(script)
    
    except Exception as e:
        print(f"❌ 스크립트 업로드 실패: {e}")
        raise HTTPException(status_code=500, detail=f"서버 오류: {str(e)}")


def _run_structural_analysis(script_id: str, storage_path: str, mime_type: str) -> None:
    """1단계: Claude Haiku로 구조 분석 (논리/용어/전제지식)."""
    from ..core.ai import call_haiku_json
    from ..core.text_extract import extract_text
    from ..prompts.script_analysis import (
        LOGIC_SYSTEM, logic_user,
        TERMINOLOGY_SYSTEM, terminology_user,
        PREREQUISITES_SYSTEM, prerequisites_user,
    )

    # 분석 레코드 ID 조회
    records = (
        supabase.table("script_analyses")
        .select("id, analysis_type")
        .eq("script_id", script_id)
        .execute()
    )
    record_map = {r["analysis_type"]: r["id"] for r in (records.data or [])}

    # Storage에서 파일 다운로드
    try:
        file_bytes: bytes = supabase.storage.from_(BUCKET_SCRIPTS).download(storage_path)
        raw_text = extract_text(file_bytes, mime_type)
    except Exception as e:
        for rid in record_map.values():
            mark_failed("script_analyses", rid, f"파일 읽기 실패: {str(e)}")
        return

    from ..core.sanitize import sanitize_prompt_input
    script_text = sanitize_prompt_input(raw_text)

    # 세 가지 분석 실행
    analysis_tasks = [
        ("logic",          LOGIC_SYSTEM,          logic_user(script_text)),
        ("terminology",    TERMINOLOGY_SYSTEM,     terminology_user(script_text)),
        ("prerequisites",  PREREQUISITES_SYSTEM,  prerequisites_user(script_text)),
    ]

    for analysis_type, system_prompt, user_prompt in analysis_tasks:
        rid = record_map.get(analysis_type)
        if not rid:
            continue
        mark_processing("script_analyses", rid)
        try:
            result = call_haiku_json(system_prompt, user_prompt)
            mark_completed("script_analyses", rid, result)
        except Exception as e:
            mark_failed("script_analyses", rid, str(e))

    # 1단계 완료 후 2단계(보완 제안) 트리거
    _run_suggestions(script_id, script_text)


def _run_suggestions(script_id: str, script_text: str) -> None:
    """2단계: Claude Sonnet으로 보완 제안 + 리포트 생성."""
    from ..core.ai import call_sonnet_json
    from ..prompts.script_analysis import (
        DIFFICULTY_SYSTEM, difficulty_user,
        REPORT_SYSTEM, report_user,
    )

    # 1단계 분석 결과 조회
    analyses = (
        supabase.table("script_analyses")
        .select("analysis_type, result")
        .eq("script_id", script_id)
        .eq("status", "completed")
        .execute()
    )
    analyses_data = analyses.data or []

    # 제안 레코드 생성
    supabase.table("script_suggestions").insert([
        {"script_id": script_id, "suggestion_type": "difficulty"},
        {"script_id": script_id, "suggestion_type": "supplements"},
    ]).execute()

    suggestion_records = (
        supabase.table("script_suggestions")
        .select("id, suggestion_type")
        .eq("script_id", script_id)
        .execute()
    )
    sug_map = {r["suggestion_type"]: r["id"] for r in (suggestion_records.data or [])}

    # 난이도 설명 제안
    diff_id = sug_map.get("difficulty")
    if diff_id:
        mark_processing("script_suggestions", diff_id)
        try:
            result = call_sonnet_json(DIFFICULTY_SYSTEM, difficulty_user(script_text, analyses_data))
            mark_completed("script_suggestions", diff_id, result)
        except Exception as e:
            mark_failed("script_suggestions", diff_id, str(e))

    # 리포트 생성
    flow_score = None
    for a in analyses_data:
        if a["analysis_type"] == "logic" and a.get("result"):
            flow_score = a["result"].get("overallFlowScore")
            break

    all_results = {
        "flowScore": flow_score,
        "terms": next((a["result"].get("undefined_terms", []) for a in analyses_data if a["analysis_type"] == "terminology" and a.get("result")), []),
        "prerequisites": next((a["result"].get("missing_prerequisites", []) for a in analyses_data if a["analysis_type"] == "prerequisites" and a.get("result")), []),
    }

    # script_reports 생성
    try:
        report_result = call_sonnet_json(REPORT_SYSTEM, report_user(script_text, all_results))
        supabase.table("script_reports").upsert({
            "script_id": script_id,
            "slides": report_result.get("slides", []),
            "overall_score": report_result.get("overall_score"),
        }, on_conflict="script_id").execute()
    except Exception as e:
        print(f"❌ 리포트 생성 실패 (상태 처리를 위해 빈 리포트 생성): {e}")
        # 실패 시에도 상태가 '완료'로 넘어가도록 빈 리포트를 삽입
        supabase.table("script_reports").upsert({
            "script_id": script_id,
            "slides": [],
            "overall_score": 0,
        }, on_conflict="script_id").execute()


# ── 4.1.2 스크립트 목록 조회 ─────────────────────────────────────────────────
@router.get("")
def list_scripts(
    course_id: str,
    week_number: int | None = None,
    current_user: dict = Depends(get_current_user),
):
    try:
        q = (
            supabase.table("scripts")
            .select("*, script_reports(id)")
            .eq("course_id", course_id)
            .order("uploaded_at", desc=True)
        )
        if week_number is not None:
            q = q.eq("week_number", week_number)

        result = q.execute()
        scripts = [_format_script(r) for r in (result.data or [])]
        return {"scripts": scripts, "totalCount": len(scripts)}
    except Exception as e:
        print(f"❌ 스크립트 목록 조회 실패: {str(e)}")
        raise HTTPException(status_code=500, detail="스크립트 목록을 불러오는 중 서버 오류가 발생했습니다.")


# ── 스크립트 상세 조회 ────────────────────────────────────────────────────────
@router.get("/{script_id}")
def get_script(course_id: str, script_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("scripts")
        .select("*, script_reports(id)")
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
    require_instructor_of(course_id, current_user["id"])

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

    delete_file(BUCKET_SCRIPTS, result.data["content_path"])
    supabase.table("scripts").delete().eq("id", script_id).execute()


# ── 4.2/4.3 분석 결과 조회 ───────────────────────────────────────────────────
@router.get("/{script_id}/analysis")
def get_analysis(
    course_id: str,
    script_id: str,
    current_user: dict = Depends(get_current_user),
):
    analyses = (
        supabase.table("script_analyses")
        .select("id, analysis_type, status, result, error_message, started_at, completed_at")
        .eq("script_id", script_id)
        .execute()
    )
    suggestions = (
        supabase.table("script_suggestions")
        .select("id, suggestion_type, status, result, error_message, started_at, completed_at")
        .eq("script_id", script_id)
        .execute()
    )
    report = (
        supabase.table("script_reports")
        .select("slides, overall_score, generated_at")
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