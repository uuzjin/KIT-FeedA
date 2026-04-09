"""Phase 5 — 학생 AI 시뮬레이션 라우터.

흐름:
  POST /contexts          (5-1a) 201 — 스크립트 텍스트 추출 후 컨텍스트 세션 생성
  POST /simulations       (5-1b) 201 — DOCUMENT_ONLY 시뮬레이션 세션 생성
  POST /assessments       (5-2)  202 — 대형 LLM이 문항 생성 (비동기)
  GET  /assessments/{id}  (5-2)  200 — 생성된 문항 조회
  POST /assessments/{id}/answers        (5-3) 202 — 소형 LLM이 자료만 참조해 답변 (비동기)
  GET  /assessments/{id}/answers        (5-3) 200 — 답변 조회
  POST /assessments/{id}/grades         (5-4) 202 — 대형 LLM이 채점 (비동기)
  GET  /assessments/{id}/grades         (5-4) 200 — 채점 결과 조회
  POST /assessments/{id}/quality-reports (5-4) 202 — 자료 품질 진단 (비동기)
  GET  /assessments/{id}/quality-reports (5-4) 200 — 품질 진단 결과 조회
  POST /assessments/{id}/qa-pairs       (5-5) 202 — 핵심 Q&A 생성 (비동기)
  GET  /assessments/{id}/qa-pairs       (5-5) 200 — Q&A 조회
"""
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_failed, mark_processing
from ..core.rate_limit import AI_RATE_LIMIT, limiter
from ..database import supabase
from ..dependencies import require_instructor_of

router = APIRouter(
    prefix="/api/courses/{course_id}/ai-student",
    tags=["ai-simulation"],
)


# ── 공통 헬퍼 ─────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_context_or_404(course_id: str, context_id: str) -> dict:
    """컨텍스트 조회. 없으면 404."""
    result = (
        supabase.table("ai_sim_contexts")
        .select("id, course_id, script_ids, model, loaded_documents, total_tokens, created_at")
        .eq("id", context_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="컨텍스트를 찾을 수 없습니다.")
    return result.data


def _get_assessment_or_404(course_id: str, assessment_id: str) -> dict:
    """평가 조회. 없으면 404."""
    result = (
        supabase.table("ai_sim_assessments")
        .select("id, course_id, context_id, question_types, count, status, questions, error_message, started_at, completed_at")
        .eq("id", assessment_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="평가를 찾을 수 없습니다.")
    return result.data


def _load_script_text(script_ids: list[str], course_id: str) -> tuple[str, int]:
    """스크립트 ID 목록에서 텍스트를 추출·연결하여 반환.

    Returns:
        (combined_text, estimated_token_count)
    """
    from ..core.storage import BUCKET_SCRIPTS
    from ..core.text_extract import extract_text

    parts: list[str] = []
    for sid in script_ids:
        row = (
            supabase.table("scripts")
            .select("content_path, mime_type, title")
            .eq("id", sid)
            .eq("course_id", course_id)
            .maybe_single()
            .execute()
        )
        if not row.data:
            continue
        try:
            file_bytes: bytes = supabase.storage.from_(BUCKET_SCRIPTS).download(
                row.data["content_path"]
            )
            text = extract_text(file_bytes, row.data["mime_type"])
            if text:
                title = row.data.get("title") or sid
                parts.append(f"=== {title} ===\n{text}")
        except Exception:
            continue

    combined = "\n\n".join(parts)
    # 프롬프트 인젝션 방어
    from ..core.sanitize import sanitize_prompt_input
    combined = sanitize_prompt_input(combined)
    # 한국어 포함 문서: 글자 수 / 2 ≈ 토큰 (rough estimate)
    token_estimate = max(1, len(combined) // 2)
    return combined, token_estimate


def _get_context_text(context_id: str, course_id: str) -> str:
    """컨텍스트의 스크립트 텍스트 반환. 실패해도 빈 문자열."""
    row = (
        supabase.table("ai_sim_contexts")
        .select("script_ids")
        .eq("id", context_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        return ""
    script_ids = row.data.get("script_ids") or []
    text, _ = _load_script_text(script_ids, course_id)
    return text


# ═════════════════════════════════════════════════════════════════════════════
# 5-1a. 컨텍스트 주입
# ═════════════════════════════════════════════════════════════════════════════

class ContextCreateRequest(BaseModel):
    scriptIds: list[str]
    model: str = "gemini-2.0-flash-lite"


@router.post("/contexts", status_code=201)
def create_context(
    course_id: str,
    payload: ContextCreateRequest,
    current_user: dict = Depends(require_instructor),
):
    """8.1.1 — 스크립트 텍스트를 추출하여 ICL 컨텍스트 세션을 생성합니다."""
    require_instructor_of(course_id, current_user["id"])

    if not payload.scriptIds:
        raise HTTPException(status_code=400, detail="scriptIds는 비어 있을 수 없습니다.")

    # 스크립트 존재 여부 사전 확인
    rows = (
        supabase.table("scripts")
        .select("id")
        .eq("course_id", course_id)
        .in_("id", payload.scriptIds)
        .execute()
    )
    found_ids = {r["id"] for r in (rows.data or [])}
    missing = [sid for sid in payload.scriptIds if sid not in found_ids]
    if missing:
        raise HTTPException(
            status_code=404,
            detail=f"다음 스크립트를 찾을 수 없습니다: {missing}",
        )

    # 텍스트 추출 및 토큰 추정
    combined_text, token_count = _load_script_text(payload.scriptIds, course_id)
    loaded_documents = len([sid for sid in payload.scriptIds if sid in found_ids])

    result = supabase.table("ai_sim_contexts").insert({
        "course_id": course_id,
        "script_ids": payload.scriptIds,
        "model": payload.model,
        "loaded_documents": loaded_documents,
        "total_tokens": token_count,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="컨텍스트 생성에 실패했습니다.")

    ctx = result.data[0]
    return {
        "contextId": ctx["id"],
        "loadedDocuments": ctx["loaded_documents"],
        "totalTokens": ctx["total_tokens"],
        "model": ctx["model"],
        "createdAt": ctx["created_at"],
    }


# ── 컨텍스트 조회 ─────────────────────────────────────────────────────────────

@router.get("/contexts/{context_id}")
def get_context(
    course_id: str,
    context_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    ctx = _get_context_or_404(course_id, context_id)
    return {
        "contextId": ctx["id"],
        "scriptIds": ctx.get("script_ids") or [],
        "loadedDocuments": ctx["loaded_documents"],
        "totalTokens": ctx["total_tokens"],
        "model": ctx["model"],
        "createdAt": ctx["created_at"],
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-1b. 백지 상태 시뮬레이션 생성
# ═════════════════════════════════════════════════════════════════════════════

class SimulationCreateRequest(BaseModel):
    contextId: str


@router.post("/simulations", status_code=201)
def create_simulation(
    course_id: str,
    payload: SimulationCreateRequest,
    current_user: dict = Depends(require_instructor),
):
    """8.1.2 — DOCUMENT_ONLY 지식 범위로 시뮬레이션 세션을 생성합니다."""
    require_instructor_of(course_id, current_user["id"])
    _get_context_or_404(course_id, payload.contextId)  # 404 guard

    result = supabase.table("ai_sim_simulations").insert({
        "context_id": payload.contextId,
        "status": "READY",
        "knowledge_scope": "DOCUMENT_ONLY",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="시뮬레이션 생성에 실패했습니다.")

    sim = result.data[0]
    return {
        "simulationId": sim["id"],
        "contextId": payload.contextId,
        "status": sim["status"],
        "knowledgeScope": sim["knowledge_scope"],
        "createdAt": sim["created_at"],
    }


# ── 시뮬레이션 조회 ───────────────────────────────────────────────────────────

@router.get("/simulations/{simulation_id}")
def get_simulation(
    course_id: str,
    simulation_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    result = (
        supabase.table("ai_sim_simulations")
        .select("id, context_id, status, knowledge_scope, created_at")
        .eq("id", simulation_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다.")
    sim = result.data
    return {
        "simulationId": sim["id"],
        "contextId": sim["context_id"],
        "status": sim["status"],
        "knowledgeScope": sim["knowledge_scope"],
        "createdAt": sim["created_at"],
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-2. 학습 목표 기반 문항 생성 (비동기)
# ═════════════════════════════════════════════════════════════════════════════

class AssessmentCreateRequest(BaseModel):
    contextId: str
    questionTypes: list[str] = ["CONCEPT", "APPLICATION", "REASONING", "CONNECTION"]
    count: int = 10


@router.post("/assessments", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def create_assessment(
    request: Request,
    course_id: str,
    payload: AssessmentCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    """8.2.1 — 대형 LLM이 강의 자료 기반 평가 문항을 비동기 생성합니다."""
    require_instructor_of(course_id, current_user["id"])
    _get_context_or_404(course_id, payload.contextId)

    valid_types = {"CONCEPT", "APPLICATION", "REASONING", "CONNECTION"}
    invalid = [t for t in payload.questionTypes if t not in valid_types]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"유효하지 않은 문항 유형: {invalid}. 허용: {valid_types}",
        )
    if not (1 <= payload.count <= 30):
        raise HTTPException(status_code=400, detail="문항 수는 1~30 사이여야 합니다.")

    result = supabase.table("ai_sim_assessments").insert({
        "course_id": course_id,
        "context_id": payload.contextId,
        "question_types": payload.questionTypes,
        "count": payload.count,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="평가 생성 요청에 실패했습니다.")

    assessment = result.data[0]
    background_tasks.add_task(
        _run_assessment_generation,
        assessment["id"],
        course_id,
        payload.contextId,
        payload.questionTypes,
        payload.count,
    )

    return {
        "assessmentId": assessment["id"],
        "status": "pending",
        "message": "문항 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_assessment_generation(
    assessment_id: str,
    course_id: str,
    context_id: str,
    question_types: list[str],
    count: int,
) -> None:
    from ..core.ai import call_sonnet_json
    from ..prompts.ai_simulation import ASSESSMENT_SYSTEM, assessment_user

    mark_processing("ai_sim_assessments", assessment_id)
    try:
        script_text = _get_context_text(context_id, course_id)
        if not script_text:
            raise ValueError("컨텍스트에 유효한 스크립트 텍스트가 없습니다.")

        result = call_sonnet_json(
            ASSESSMENT_SYSTEM,
            assessment_user(script_text, question_types, count),
        )
        questions = result.get("questions", [])

        supabase.table("ai_sim_assessments").update({
            "status": "completed",
            "questions": questions,
            "completed_at": _now(),
        }).eq("id", assessment_id).execute()

    except Exception as e:
        mark_failed("ai_sim_assessments", assessment_id, str(e))


# ── 5-2. 문항 조회 ────────────────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}")
def get_assessment(
    course_id: str,
    assessment_id: str,
    current_user: dict = Depends(require_instructor),
):
    """8.2.2 — 생성된 평가 문항을 조회합니다."""
    require_instructor_of(course_id, current_user["id"])
    assessment = _get_assessment_or_404(course_id, assessment_id)
    return {
        "assessmentId": assessment["id"],
        "contextId": assessment["context_id"],
        "status": assessment["status"],
        "questionTypes": assessment.get("question_types") or [],
        "count": assessment.get("count"),
        "questions": assessment.get("questions") or [],
        "errorMessage": assessment.get("error_message"),
        "completedAt": assessment.get("completed_at"),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-3. AI 학생 답변 생성 (비동기)
# ═════════════════════════════════════════════════════════════════════════════

class AnswerCreateRequest(BaseModel):
    simulationId: str


@router.post("/assessments/{assessment_id}/answers", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def create_answers(
    request: Request,
    course_id: str,
    assessment_id: str,
    payload: AnswerCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    """8.3.1 — AI 학생이 교수 자료만 참조하여 문항에 답변합니다 (비동기)."""
    require_instructor_of(course_id, current_user["id"])

    assessment = _get_assessment_or_404(course_id, assessment_id)
    if assessment["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail="문항 생성이 완료된 평가에만 답변을 생성할 수 있습니다.",
        )

    # 시뮬레이션 검증
    sim_row = (
        supabase.table("ai_sim_simulations")
        .select("id, context_id, knowledge_scope")
        .eq("id", payload.simulationId)
        .maybe_single()
        .execute()
    )
    if not sim_row.data:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다.")

    # 중복 답변 방지 (UNIQUE: assessment_id)
    existing = (
        supabase.table("ai_sim_answers")
        .select("id, status")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="이미 답변이 존재합니다. 기존 답변을 조회하세요.",
        )

    result = supabase.table("ai_sim_answers").insert({
        "assessment_id": assessment_id,
        "simulation_id": payload.simulationId,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="답변 생성 요청에 실패했습니다.")

    answer = result.data[0]
    background_tasks.add_task(
        _run_answer_generation,
        answer["id"],
        assessment_id,
        course_id,
        assessment["context_id"],
    )

    return {
        "answerId": answer["id"],
        "status": "pending",
        "message": "답변 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_answer_generation(
    answer_id: str,
    assessment_id: str,
    course_id: str,
    context_id: str,
) -> None:
    from ..core.ai import call_haiku_json
    from ..prompts.ai_simulation import STUDENT_ANSWER_SYSTEM, student_answer_user

    mark_processing("ai_sim_answers", answer_id)
    try:
        # 문항 조회
        assessment_row = (
            supabase.table("ai_sim_assessments")
            .select("questions")
            .eq("id", assessment_id)
            .maybe_single()
            .execute()
        )
        questions = (assessment_row.data or {}).get("questions") or []
        if not questions:
            raise ValueError("문항이 없습니다.")

        # 강의 자료 텍스트 (DOCUMENT_ONLY 제약)
        script_text = _get_context_text(context_id, course_id)
        if not script_text:
            raise ValueError("컨텍스트에 유효한 스크립트 텍스트가 없습니다.")

        result = call_haiku_json(
            STUDENT_ANSWER_SYSTEM,
            student_answer_user(script_text, questions),
            max_tokens=4096,
        )
        answers = result.get("answers", [])

        supabase.table("ai_sim_answers").update({
            "status": "completed",
            "answers": answers,
            "completed_at": _now(),
        }).eq("id", answer_id).execute()

    except Exception as e:
        mark_failed("ai_sim_answers", answer_id, str(e))


# ── 5-3. 답변 조회 ────────────────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}/answers")
def get_answers(
    course_id: str,
    assessment_id: str,
    current_user: dict = Depends(require_instructor),
):
    """8.3.2 — AI 학생 답변을 조회합니다."""
    require_instructor_of(course_id, current_user["id"])
    _get_assessment_or_404(course_id, assessment_id)  # 404 guard

    row = (
        supabase.table("ai_sim_answers")
        .select("id, simulation_id, status, answers, error_message, started_at, completed_at")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(
            status_code=404,
            detail="답변이 아직 없습니다. 먼저 답변 생성을 요청하세요.",
        )
    r = row.data
    return {
        "answerId": r["id"],
        "assessmentId": assessment_id,
        "simulationId": r["simulation_id"],
        "status": r["status"],
        "answers": r.get("answers") or [],
        "errorMessage": r.get("error_message"),
        "completedAt": r.get("completed_at"),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-4a. 채점 (비동기)
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/assessments/{assessment_id}/grades", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def create_grades(
    request: Request,
    course_id: str,
    assessment_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    """8.4.1 — 대형 LLM이 AI 학생 답변을 채점합니다 (비동기)."""
    require_instructor_of(course_id, current_user["id"])
    _get_assessment_or_404(course_id, assessment_id)

    # 답변 완료 여부 확인
    answer_row = (
        supabase.table("ai_sim_answers")
        .select("id, status")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if not answer_row.data or answer_row.data["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail="답변 생성이 완료된 평가만 채점할 수 있습니다.",
        )

    # 중복 채점 방지 (UNIQUE: assessment_id)
    existing = (
        supabase.table("ai_sim_grades")
        .select("id, status")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="이미 채점이 존재합니다. 기존 채점 결과를 조회하세요.",
        )

    result = supabase.table("ai_sim_grades").insert({
        "assessment_id": assessment_id,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="채점 요청에 실패했습니다.")

    grade = result.data[0]
    background_tasks.add_task(
        _run_grading,
        grade["id"],
        assessment_id,
    )

    return {
        "gradeId": grade["id"],
        "status": "pending",
        "message": "채점이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_grading(grade_id: str, assessment_id: str) -> None:
    from ..core.ai import call_sonnet_json
    from ..prompts.ai_simulation import GRADING_SYSTEM, grading_user

    mark_processing("ai_sim_grades", grade_id)
    try:
        # 문항 조회
        assessment_row = (
            supabase.table("ai_sim_assessments")
            .select("questions")
            .eq("id", assessment_id)
            .maybe_single()
            .execute()
        )
        questions = (assessment_row.data or {}).get("questions") or []

        # 답변 조회
        answer_row = (
            supabase.table("ai_sim_answers")
            .select("answers")
            .eq("assessment_id", assessment_id)
            .maybe_single()
            .execute()
        )
        answers = (answer_row.data or {}).get("answers") or []

        if not questions or not answers:
            raise ValueError("문항 또는 답변 데이터가 없습니다.")

        result = call_sonnet_json(
            GRADING_SYSTEM,
            grading_user(questions, answers),
        )

        supabase.table("ai_sim_grades").update({
            "status": "completed",
            "total_score": result.get("total_score", 0.0),
            "grades": result.get("grades", []),
            "strengths": result.get("strengths", []),
            "weaknesses": result.get("weaknesses", []),
            "completed_at": _now(),
        }).eq("id", grade_id).execute()

    except Exception as e:
        mark_failed("ai_sim_grades", grade_id, str(e))


# ── 5-4a. 채점 결과 조회 ──────────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}/grades")
def get_grades(
    course_id: str,
    assessment_id: str,
    current_user: dict = Depends(require_instructor),
):
    """8.4.2 — 채점 결과를 조회합니다."""
    require_instructor_of(course_id, current_user["id"])
    _get_assessment_or_404(course_id, assessment_id)

    row = (
        supabase.table("ai_sim_grades")
        .select("id, status, total_score, grades, strengths, weaknesses, error_message, started_at, completed_at")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(
            status_code=404,
            detail="채점 결과가 없습니다. 먼저 채점을 요청하세요.",
        )
    r = row.data
    return {
        "gradeId": r["id"],
        "assessmentId": assessment_id,
        "status": r["status"],
        "totalScore": r.get("total_score"),
        "grades": r.get("grades") or [],
        "strengths": r.get("strengths") or [],
        "weaknesses": r.get("weaknesses") or [],
        "errorMessage": r.get("error_message"),
        "completedAt": r.get("completed_at"),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-4b. 자료 품질 진단 (비동기)
# ═════════════════════════════════════════════════════════════════════════════

@router.post("/assessments/{assessment_id}/quality-reports", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def create_quality_report(
    request: Request,
    course_id: str,
    assessment_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    """8.4.2 — 강의 자료 품질 진단 리포트를 비동기 생성합니다."""
    require_instructor_of(course_id, current_user["id"])
    assessment = _get_assessment_or_404(course_id, assessment_id)

    # 중복 방지 (UNIQUE: assessment_id)
    existing = (
        supabase.table("ai_sim_quality_reports")
        .select("id, status")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="이미 품질 진단 리포트가 존재합니다. 기존 결과를 조회하세요.",
        )

    result = supabase.table("ai_sim_quality_reports").insert({
        "assessment_id": assessment_id,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="품질 진단 요청에 실패했습니다.")

    report = result.data[0]
    background_tasks.add_task(
        _run_quality_report,
        report["id"],
        assessment_id,
        course_id,
        assessment["context_id"],
    )

    return {
        "reportId": report["id"],
        "status": "pending",
        "message": "품질 진단이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_quality_report(
    report_id: str,
    assessment_id: str,
    course_id: str,
    context_id: str,
) -> None:
    from ..core.ai import call_sonnet_json
    from ..prompts.ai_simulation import QUALITY_REPORT_SYSTEM, quality_report_user

    mark_processing("ai_sim_quality_reports", report_id)
    try:
        script_text = _get_context_text(context_id, course_id)

        # 채점 결과 조회 (있으면 활용, 없어도 진행)
        grade_row = (
            supabase.table("ai_sim_grades")
            .select("grades, weaknesses")
            .eq("assessment_id", assessment_id)
            .eq("status", "completed")
            .maybe_single()
            .execute()
        )
        grades = (grade_row.data or {}).get("grades") or []
        weaknesses = (grade_row.data or {}).get("weaknesses") or []

        result = call_sonnet_json(
            QUALITY_REPORT_SYSTEM,
            quality_report_user(script_text, grades, weaknesses),
        )

        supabase.table("ai_sim_quality_reports").update({
            "status": "completed",
            "coverage_rate": result.get("coverage_rate", 0.0),
            "sufficient_topics": result.get("sufficient_topics", []),
            "insufficient_topics": result.get("insufficient_topics", []),
            "completed_at": _now(),
        }).eq("id", report_id).execute()

    except Exception as e:
        mark_failed("ai_sim_quality_reports", report_id, str(e))


# ── 5-4b. 품질 진단 결과 조회 ────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}/quality-reports")
def get_quality_report(
    course_id: str,
    assessment_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    _get_assessment_or_404(course_id, assessment_id)

    row = (
        supabase.table("ai_sim_quality_reports")
        .select("id, status, coverage_rate, sufficient_topics, insufficient_topics, error_message, started_at, completed_at")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(
            status_code=404,
            detail="품질 진단 결과가 없습니다. 먼저 품질 진단을 요청하세요.",
        )
    r = row.data
    return {
        "reportId": r["id"],
        "assessmentId": assessment_id,
        "status": r["status"],
        "coverageRate": r.get("coverage_rate"),
        "sufficientTopics": r.get("sufficient_topics") or [],
        "insufficientTopics": r.get("insufficient_topics") or [],
        "errorMessage": r.get("error_message"),
        "completedAt": r.get("completed_at"),
    }


# ═════════════════════════════════════════════════════════════════════════════
# 5-5. 핵심 Q&A 생성 (비동기)
# ═════════════════════════════════════════════════════════════════════════════

class QaPairsCreateRequest(BaseModel):
    simulationId: str


@router.post("/assessments/{assessment_id}/qa-pairs", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def create_qa_pairs(
    request: Request,
    course_id: str,
    assessment_id: str,
    payload: QaPairsCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    """8.4.5 — 취약 개념 중심의 핵심 Q&A를 비동기 생성합니다."""
    require_instructor_of(course_id, current_user["id"])
    assessment = _get_assessment_or_404(course_id, assessment_id)

    # 시뮬레이션 존재 확인 (spec 요구사항)
    sim_row = (
        supabase.table("ai_sim_simulations")
        .select("id")
        .eq("id", payload.simulationId)
        .maybe_single()
        .execute()
    )
    if not sim_row.data:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다.")

    # 중복 방지 (UNIQUE: assessment_id)
    existing = (
        supabase.table("ai_sim_qa_pairs")
        .select("id, status")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail="이미 Q&A가 존재합니다. 기존 결과를 조회하세요.",
        )

    result = supabase.table("ai_sim_qa_pairs").insert({
        "assessment_id": assessment_id,
        "status": "pending",
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Q&A 생성 요청에 실패했습니다.")

    qa = result.data[0]
    background_tasks.add_task(
        _run_qa_pairs,
        qa["id"],
        assessment_id,
        course_id,
        assessment["context_id"],
    )

    return {
        "qaPairId": qa["id"],
        "status": "pending",
        "message": "Q&A 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_qa_pairs(
    qa_id: str,
    assessment_id: str,
    course_id: str,
    context_id: str,
) -> None:
    from ..core.ai import call_sonnet_json
    from ..prompts.ai_simulation import QA_PAIRS_SYSTEM, qa_pairs_user

    mark_processing("ai_sim_qa_pairs", qa_id)
    try:
        script_text = _get_context_text(context_id, course_id)
        if not script_text:
            raise ValueError("컨텍스트에 유효한 스크립트 텍스트가 없습니다.")

        # 채점 결과의 취약 개념 활용 (있으면)
        grade_row = (
            supabase.table("ai_sim_grades")
            .select("weaknesses")
            .eq("assessment_id", assessment_id)
            .eq("status", "completed")
            .maybe_single()
            .execute()
        )
        weaknesses = (grade_row.data or {}).get("weaknesses") or []

        result = call_sonnet_json(
            QA_PAIRS_SYSTEM,
            qa_pairs_user(script_text, weaknesses),
        )

        supabase.table("ai_sim_qa_pairs").update({
            "status": "completed",
            "qa_pairs": result.get("qa_pairs", []),
            "completed_at": _now(),
        }).eq("id", qa_id).execute()

    except Exception as e:
        mark_failed("ai_sim_qa_pairs", qa_id, str(e))


# ── 5-5. Q&A 조회 ─────────────────────────────────────────────────────────────

@router.get("/assessments/{assessment_id}/qa-pairs")
def get_qa_pairs(
    course_id: str,
    assessment_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])
    _get_assessment_or_404(course_id, assessment_id)

    row = (
        supabase.table("ai_sim_qa_pairs")
        .select("id, status, qa_pairs, error_message, started_at, completed_at")
        .eq("assessment_id", assessment_id)
        .maybe_single()
        .execute()
    )
    if not row.data:
        raise HTTPException(
            status_code=404,
            detail="Q&A가 없습니다. 먼저 Q&A 생성을 요청하세요.",
        )
    r = row.data
    return {
        "qaPairId": r["id"],
        "assessmentId": assessment_id,
        "status": r["status"],
        "qaPairs": r.get("qa_pairs") or [],
        "errorMessage": r.get("error_message"),
        "completedAt": r.get("completed_at"),
    }
