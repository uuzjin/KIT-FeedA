from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from ..core.auth import get_current_user, require_instructor
from ..core.background import mark_completed, mark_failed, mark_processing, mark_status
from ..core.rate_limit import AI_RATE_LIMIT, limiter
from ..database import supabase
from ..dependencies import require_instructor_of

router = APIRouter(prefix="/api/courses/{course_id}/quizzes", tags=["quiz"])


def _format_quiz(row: dict, include_questions: bool = False) -> dict:
    data = {
        "quizId": row["id"],
        "courseId": row["course_id"],
        "scheduleId": row.get("schedule_id"),
        "status": row["status"],
        "difficultyLevel": row["difficulty_level"],
        "anonymousEnabled": row["anonymous_enabled"],
        "expiresAt": row.get("expires_at"),
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }
    if include_questions and "quiz_questions" in row:
        data["questions"] = [
            {
                "questionId": q["id"],
                "orderNum": q["order_num"],
                "questionType": q["question_type"],
                "difficulty": q["difficulty"],
                "content": q["content"],
                "options": q.get("options", []),
                # 학생에게는 answer 숨김 — 라우터 레벨에서 처리
            }
            for q in (row["quiz_questions"] or [])
        ]
    return data


# ── 5.1.1 퀴즈 자동 생성 (비동기) ────────────────────────────────────────────
class QuizGenerateRequest(BaseModel):
    scheduleId: str
    questionCount: int = 5
    questionTypes: list[str] = ["MULTIPLE_CHOICE", "TRUE_FALSE"]
    difficultyLevel: str = "MIXED"


@router.post("", status_code=202)
def generate_quiz(
    course_id: str,
    payload: QuizGenerateRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    if payload.questionCount < 1 or payload.questionCount > 20:
        raise HTTPException(status_code=400, detail="문항 수는 1~20 사이여야 합니다.")

    valid_types = {"MULTIPLE_CHOICE", "TRUE_FALSE", "SHORT_ANSWER"}
    if not all(t in valid_types for t in payload.questionTypes):
        raise HTTPException(status_code=400, detail=f"유효하지 않은 문항 유형입니다. 허용: {valid_types}")

    # 해당 스케줄에 이미 퀴즈가 있으면 409
    existing = (
        supabase.table("quizzes")
        .select("id")
        .eq("schedule_id", payload.scheduleId)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="해당 스케줄에 이미 퀴즈가 존재합니다.")

    result = supabase.table("quizzes").insert({
        "course_id": course_id,
        "schedule_id": payload.scheduleId,
        "status": "generating",
        "difficulty_level": payload.difficultyLevel,
        "anonymous_enabled": True,
    }).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="퀴즈 생성 요청에 실패했습니다.")

    quiz = result.data[0]
    background_tasks.add_task(
        _run_quiz_generation,
        quiz["id"],
        course_id,
        payload.scheduleId,
        payload.questionCount,
        payload.questionTypes,
        payload.difficultyLevel,
    )

    return {
        "quizId": quiz["id"],
        "status": "generating",
        "message": "퀴즈 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


def _run_quiz_generation(
    quiz_id: str,
    course_id: str,
    schedule_id: str,
    question_count: int,
    question_types: list[str],
    difficulty_level: str,
) -> None:
    from ..core.ai import call_sonnet_json
    from ..core.storage import BUCKET_SCRIPTS
    from ..core.text_extract import extract_text
    from ..prompts.quiz_generation import QUIZ_SYSTEM, quiz_user

    try:
        # 해당 스케줄의 토픽 조회
        schedule = (
            supabase.table("course_schedules")
            .select("topic")
            .eq("id", schedule_id)
            .maybe_single()
            .execute()
        )
        topic = schedule.data["topic"] if schedule.data else "강의 내용"

        # 해당 스케줄 또는 같은 course의 최근 스크립트 조회
        script_row = (
            supabase.table("scripts")
            .select("content_path, mime_type")
            .eq("course_id", course_id)
            .eq("schedule_id", schedule_id)
            .order("uploaded_at", desc=True)
            .limit(1)
            .execute()
        )

        script_text = ""
        if script_row.data:
            try:
                file_bytes: bytes = supabase.storage.from_(BUCKET_SCRIPTS).download(script_row.data[0]["content_path"])
                script_text = extract_text(file_bytes, script_row.data[0]["mime_type"])
            except Exception:
                pass

        if not script_text:
            script_text = f"이 강의는 '{topic}'에 관한 내용입니다."

        # Claude Sonnet으로 퀴즈 생성
        result = call_sonnet_json(
            QUIZ_SYSTEM,
            quiz_user(script_text, question_count, question_types, difficulty_level, topic),
        )

        questions = result.get("questions", [])

        # quiz_questions 저장
        if questions:
            q_rows = [
                {
                    "quiz_id": quiz_id,
                    "order_num": q.get("order_num", i + 1),
                    "question_type": q.get("question_type", "MULTIPLE_CHOICE"),
                    "difficulty": q.get("difficulty", "MEDIUM"),
                    "content": q["content"],
                    "options": q.get("options", []),
                    "answer": q.get("answer", ""),
                }
                for i, q in enumerate(questions)
            ]
            supabase.table("quiz_questions").insert(q_rows).execute()

        # 퀴즈 상태를 DRAFT로 업데이트
        mark_status("quizzes", quiz_id, "DRAFT")

    except Exception as e:
        mark_status("quizzes", quiz_id, "generating", {"status": "DRAFT"})  # 실패해도 DRAFT로
        supabase.table("quizzes").update({"status": "DRAFT"}).eq("id", quiz_id).execute()


# ── 5.1.3 퀴즈 목록 조회 ─────────────────────────────────────────────────────
@router.get("")
def list_quizzes(
    course_id: str,
    status: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    q = (
        supabase.table("quizzes")
        .select("*")
        .eq("course_id", course_id)
        .order("created_at", desc=True)
    )
    if status:
        q = q.eq("status", status)

    result = q.execute()
    quizzes = [_format_quiz(r) for r in (result.data or [])]
    return {"quizzes": quizzes, "totalCount": len(quizzes)}


# ── 5.1.2/퀴즈 상세 조회 ─────────────────────────────────────────────────────
@router.get("/{quiz_id}")
def get_quiz(course_id: str, quiz_id: str, current_user: dict = Depends(get_current_user)):
    result = (
        supabase.table("quizzes")
        .select("*, quiz_questions(*)")
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    data = _format_quiz(result.data, include_questions=True)

    # 학생이면 answer 필드 제거
    if current_user["role"] == "STUDENT" and "questions" in data:
        for q in data["questions"]:
            q.pop("answer", None)

    return data


# ── 5.1.5 퀴즈 문항 전체 수정 (PUT) ─────────────────────────────────────────
class QuizQuestionUpdate(BaseModel):
    questionId: str
    content: str
    options: list | None = None
    answer: str
    difficulty: str = "MEDIUM"


class QuizUpdateRequest(BaseModel):
    questions: list[QuizQuestionUpdate]


@router.put("/{quiz_id}")
def update_quiz_questions(
    course_id: str,
    quiz_id: str,
    payload: QuizUpdateRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    quiz = (
        supabase.table("quizzes")
        .select("id")
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not quiz.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    for q in payload.questions:
        supabase.table("quiz_questions").update({
            "content": q.content,
            "options": q.options,
            "answer": q.answer,
            "difficulty": q.difficulty,
        }).eq("id", q.questionId).eq("quiz_id", quiz_id).execute()

    result = (
        supabase.table("quizzes")
        .update({})
        .eq("id", quiz_id)
        .execute()
    )
    return {"quizId": quiz_id, "updatedAt": result.data[0]["updated_at"] if result.data else None}


# ── 5.1.6 퀴즈 삭제 (DELETE) ─────────────────────────────────────────────────
@router.delete("/{quiz_id}", status_code=204)
def delete_quiz(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("quizzes")
        .select("id")
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    supabase.table("quizzes").delete().eq("id", quiz_id).execute()


# ── 5.1.2 난이도 수정 (PATCH) ─────────────────────────────────────────────────
class QuizPatchRequest(BaseModel):
    difficultyLevel: str | None = None
    anonymousEnabled: bool | None = None
    expiresAt: str | None = None


@router.patch("/{quiz_id}")
def patch_quiz(
    course_id: str,
    quiz_id: str,
    payload: QuizPatchRequest,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    updates = {}
    if payload.difficultyLevel is not None:
        updates["difficulty_level"] = payload.difficultyLevel
    if payload.anonymousEnabled is not None:
        updates["anonymous_enabled"] = payload.anonymousEnabled
    if payload.expiresAt is not None:
        updates["expires_at"] = payload.expiresAt

    if not updates:
        raise HTTPException(status_code=400, detail="수정할 항목을 하나 이상 입력하세요.")

    result = (
        supabase.table("quizzes")
        .update(updates)
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    return _format_quiz(result.data[0])


# ── 퀴즈 공개 (PUBLISHED) ────────────────────────────────────────────────────
@router.put("/{quiz_id}/publish")
def publish_quiz(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("quizzes")
        .update({"status": "PUBLISHED"})
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .in_("status", ["DRAFT"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="DRAFT 상태의 퀴즈만 공개할 수 있습니다.")

    return {"quizId": quiz_id, "status": "PUBLISHED"}


# ── 퀴즈 종료 (CLOSED) ───────────────────────────────────────────────────────
@router.put("/{quiz_id}/close")
def close_quiz(
    course_id: str,
    quiz_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("quizzes")
        .update({"status": "CLOSED"})
        .eq("id", quiz_id)
        .eq("course_id", course_id)
        .eq("status", "PUBLISHED")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="PUBLISHED 상태의 퀴즈만 종료할 수 있습니다.")

    # 종료 시 오답 분석 자동 트리거
    background_tasks.add_task(_run_response_analysis, quiz_id, course_id)

    return {"quizId": quiz_id, "status": "CLOSED"}


# ── 5.2.1 학생 퀴즈 제출 ─────────────────────────────────────────────────────
class SubmitAnswer(BaseModel):
    questionId: str
    selectedOption: str | None = None


class QuizSubmitRequest(BaseModel):
    answers: list[SubmitAnswer]


# ── 5.3 퀴즈 응시 결과 상세 뷰 ───────────────────────────────────────────────────

@router.get("/{quiz_id}/submissions/me")
def get_my_submission(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(get_current_user),
):
    student_id = current_user["id"]

    # 제출 내역 확인
    sub = (
        supabase.table("quiz_submissions")
        .select("*")
        .eq("quiz_id", quiz_id)
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    if not sub.data:
        raise HTTPException(status_code=404, detail="제출 내역이 없습니다.")

    submission_id = sub.data["id"]

    # 퀴즈 및 문항 정보 조회 (정답/해설 포함)
    quiz = (
        supabase.table("quizzes")
        .select("id, title, \"questions\":quiz_questions(id, order_num, content, options, answer, explanation)")
        .eq("id", quiz_id)
        .maybe_single()
        .execute()
    )

    # 학생의 답안 조회
    answers = (
        supabase.table("quiz_submission_answers")
        .select("question_id, selected_option, is_correct")
        .eq("submission_id", submission_id)
        .execute()
    )
    ans_map = {a["question_id"]: a for a in (answers.data or [])}

    # 결과 조립
    questions_result = []
    for q in (quiz.data.get("questions") or []):
        ans = ans_map.get(q["id"], {})
        questions_result.append({
            "id": q["id"],
            "orderNum": q["order_num"],
            "content": q["content"],
            "options": q["options"],
            "answer": q["answer"],
            "explanation": q.get("explanation"),
            "selectedOption": ans.get("selected_option"),
            "isCorrect": ans.get("is_correct", False)
        })

    return {
        "quizId": quiz.data["id"],
        "title": quiz.data["title"],
        "score": sub.data["score"],
        "correctCount": sub.data["correct_count"],
        "totalCount": sub.data["total_count"],
        "submittedAt": sub.data["submitted_at"],
        "questions": sorted(questions_result, key=lambda x: x["orderNum"])
    }


@router.post("/{quiz_id}/submissions", status_code=201)
def submit_quiz(
    course_id: str,
    quiz_id: str,
    payload: QuizSubmitRequest,
    current_user: dict = Depends(get_current_user),
):
    # 퀴즈 상태 확인
    quiz = (
        supabase.table("quizzes")
        .select("status, anonymous_enabled")
        .eq("id", quiz_id)
        .maybe_single()
        .execute()
    )
    if not quiz.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")
    if quiz.data["status"] != "PUBLISHED":
        raise HTTPException(status_code=400, detail="공개된 퀴즈에만 응시할 수 있습니다.")

    student_id = current_user["id"]

    # 중복 제출 확인
    existing = (
        supabase.table("quiz_submissions")
        .select("id")
        .eq("quiz_id", quiz_id)
        .eq("student_id", student_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="이미 제출한 퀴즈입니다.")

    # 정답 조회
    questions = (
        supabase.table("quiz_questions")
        .select("id, answer, order_num")
        .eq("quiz_id", quiz_id)
        .execute()
    )
    answer_map = {q["id"]: q["answer"] for q in (questions.data or [])}

    # 채점
    correct_count = 0
    total_count = len(payload.answers)
    answer_rows = []

    for ans in payload.answers:
        correct = answer_map.get(ans.questionId, "")
        is_correct = (ans.selectedOption or "").strip() == correct.strip()
        if is_correct:
            correct_count += 1
        answer_rows.append({
            "question_id": ans.questionId,
            "selected_option": ans.selectedOption,
            "is_correct": is_correct,
        })

    score = round(correct_count / total_count * 100, 1) if total_count else 0.0

    # submission 저장
    sub_result = supabase.table("quiz_submissions").insert({
        "quiz_id": quiz_id,
        "student_id": student_id,
        "score": score,
        "correct_count": correct_count,
        "total_count": total_count,
    }).execute()

    if not sub_result.data:
        raise HTTPException(status_code=500, detail="제출에 실패했습니다.")

    submission_id = sub_result.data[0]["id"]

    # 개별 답변 저장
    for row in answer_rows:
        row["submission_id"] = submission_id
    supabase.table("quiz_submission_answers").insert(answer_rows).execute()

    return {
        "submissionId": submission_id,
        "score": score,
        "correctCount": correct_count,
        "totalCount": total_count,
    }


# ── 5.3.1 이해도 판정 ────────────────────────────────────────────────────────
@router.get("/{quiz_id}/comprehension")
def get_comprehension(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    submissions = (
        supabase.table("quiz_submissions")
        .select("score")
        .eq("quiz_id", quiz_id)
        .execute()
    )
    scores = [s["score"] for s in (submissions.data or [])]
    if not scores:
        raise HTTPException(status_code=404, detail="제출 데이터가 없습니다.")

    overall_rate = round(sum(scores) / len(scores), 1)
    if overall_rate >= 80:
        level = "GOOD"
    elif overall_rate >= 60:
        level = "PARTIAL"
    else:
        level = "LOW"

    # 문항별 정답률 (topic breakdown)
    questions = (
        supabase.table("quiz_questions")
        .select("id, content")
        .eq("quiz_id", quiz_id)
        .execute()
    )
    topic_breakdown = []
    total = len(scores)
    for q in (questions.data or []):
        correct = (
            supabase.table("quiz_submission_answers")
            .select("id", count="exact")
            .eq("question_id", q["id"])
            .eq("is_correct", True)
            .execute()
        ).count or 0
        rate = round(correct / total * 100, 1) if total else 0.0
        topic_breakdown.append({
            "topic": q["content"][:50],
            "rate": rate,
            "level": "GOOD" if rate >= 80 else ("PARTIAL" if rate >= 60 else "LOW"),
        })

    return {"overallRate": overall_rate, "level": level, "topicBreakdown": topic_breakdown}


# ── 5.3 퀴즈 결과 조회 (강사) ────────────────────────────────────────────────
@router.get("/{quiz_id}/results")
def get_quiz_results(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    quiz = (
        supabase.table("quizzes")
        .select("anonymous_enabled, quiz_questions(id, order_num, content)")
        .eq("id", quiz_id)
        .maybe_single()
        .execute()
    )
    if not quiz.data:
        raise HTTPException(status_code=404, detail="퀴즈를 찾을 수 없습니다.")

    anonymous = quiz.data["anonymous_enabled"]
    questions = quiz.data.get("quiz_questions") or []

    submissions = (
        supabase.table("quiz_submissions")
        .select("id, student_id, score, correct_count, total_count, submitted_at")
        .eq("quiz_id", quiz_id)
        .execute()
    )

    total_submissions = len(submissions.data or [])
    avg_score = (
        round(sum(s["score"] for s in submissions.data) / total_submissions, 1)
        if total_submissions else 0.0
    )

    # 문항별 오답률 계산
    question_stats = []
    for q in questions:
        wrong_count = (
            supabase.table("quiz_submission_answers")
            .select("id", count="exact")
            .eq("question_id", q["id"])
            .eq("is_correct", False)
            .execute()
        )
        wrong_rate = round((wrong_count.count or 0) / total_submissions * 100, 1) if total_submissions else 0.0
        question_stats.append({
            "questionId": q["id"],
            "orderNum": q["order_num"],
            "content": q["content"],
            "wrongRate": wrong_rate,
        })

    result = {
        "quizId": quiz_id,
        "totalSubmissions": total_submissions,
        "averageScore": avg_score,
        "questionStats": question_stats,
        "submissions": [
            {
                "submissionId": s["id"],
                "studentId": None if anonymous else s["student_id"],
                "score": s["score"],
                "correctCount": s["correct_count"],
                "totalCount": s["total_count"],
                "submittedAt": s["submitted_at"],
            }
            for s in (submissions.data or [])
        ],
    }
    return result


# ── 5.3.2 오답 분석 트리거 ────────────────────────────────────────────────────
@router.post("/{quiz_id}/analyze", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def trigger_analysis(
    request: Request,
    course_id: str,
    quiz_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    # 분석 레코드 생성 또는 재실행
    supabase.table("quiz_response_analyses").upsert(
        {"quiz_id": quiz_id, "status": "pending"},
        on_conflict="quiz_id",
    ).execute()

    background_tasks.add_task(_run_response_analysis, quiz_id, course_id)
    return {"quizId": quiz_id, "status": "pending", "message": "오답 분석이 시작되었습니다."}


# ── 오답 분석 결과 조회 ────────────────────────────────────────────────────────
@router.get("/{quiz_id}/analyze")
def get_analysis(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    analysis = (
        supabase.table("quiz_response_analyses")
        .select("*")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    if not analysis.data:
        raise HTTPException(status_code=404, detail="분석 결과가 없습니다. 먼저 분석을 트리거하세요.")

    suggestions = (
        supabase.table("quiz_improvement_suggestions")
        .select("*")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )

    return {
        "analysis": analysis.data,
        "suggestions": suggestions.data,
    }


# ── 5.3.3-A 개선 제안 트리거 ─────────────────────────────────────────────────
@router.post("/{quiz_id}/improvement-suggestions", status_code=202)
@limiter.limit(AI_RATE_LIMIT)
def trigger_improvement_suggestions(
    request: Request,
    course_id: str,
    quiz_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    # 오답 분석 결과가 있어야 개선 제안 생성 가능
    analysis = (
        supabase.table("quiz_response_analyses")
        .select("id, status, weak_concepts")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    if not analysis.data or analysis.data["status"] != "completed":
        raise HTTPException(status_code=400, detail="먼저 오답 분석을 완료하세요.")

    supabase.table("quiz_improvement_suggestions").upsert(
        {"quiz_id": quiz_id, "status": "pending"},
        on_conflict="quiz_id",
    ).execute()

    rec = (
        supabase.table("quiz_improvement_suggestions")
        .select("id")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    sug_id = rec.data["id"] if rec.data else None

    weak_concepts = analysis.data.get("weak_concepts") or []
    background_tasks.add_task(_run_improvement_suggestions, quiz_id, weak_concepts, sug_id)

    return {
        "suggestionId": sug_id,
        "status": "pending",
        "message": "제안 생성이 시작되었습니다. 완료 시 Supabase Realtime으로 반영됩니다.",
    }


# ── 5.3.3-B 개선 제안 조회 ───────────────────────────────────────────────────
@router.get("/{quiz_id}/improvement-suggestions")
def get_improvement_suggestions(
    course_id: str,
    quiz_id: str,
    current_user: dict = Depends(require_instructor),
):
    require_instructor_of(course_id, current_user["id"])

    result = (
        supabase.table("quiz_improvement_suggestions")
        .select("*")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="개선 제안이 없습니다. 먼저 생성을 요청하세요.")

    row = result.data
    suggestions = row.get("suggestions") or {}
    return {
        "suggestionId": row["id"],
        "status": row["status"],
        "suggestions": suggestions.get("items", []),
        "startedAt": row.get("started_at"),
        "completedAt": row.get("completed_at"),
    }


def _run_improvement_suggestions(quiz_id: str, weak_concepts: list[str], sug_id: str | None) -> None:
    """취약 개념 기반 다음 수업 개선 제안 생성."""
    from ..core.ai import call_sonnet_json
    from ..prompts.quiz_generation import QUIZ_ANALYSIS_SYSTEM, quiz_analysis_user

    if not sug_id:
        return

    from ..core.background import mark_completed, mark_failed, mark_processing
    mark_processing("quiz_improvement_suggestions", sug_id)

    try:
        # 취약 개념 목록으로 개선 제안 생성
        questions_data = [{"order_num": i + 1, "content": c, "wrong_rate": 70} for i, c in enumerate(weak_concepts)]
        result = call_sonnet_json(QUIZ_ANALYSIS_SYSTEM, quiz_analysis_user(questions_data))
        suggestions_content = result.get("next_class_suggestions", [])
        mark_completed("quiz_improvement_suggestions", sug_id, {"items": suggestions_content})
    except Exception as e:
        mark_failed("quiz_improvement_suggestions", sug_id, str(e))


def _run_response_analysis(quiz_id: str, course_id: str) -> None:
    """퀴즈 종료 후 오답 분석 + 개선 제안 생성."""
    from ..core.ai import call_sonnet_json
    from ..prompts.quiz_generation import QUIZ_ANALYSIS_SYSTEM, quiz_analysis_user

    # 분석 레코드 확인/생성
    supabase.table("quiz_response_analyses").upsert(
        {"quiz_id": quiz_id, "status": "processing"},
        on_conflict="quiz_id",
    ).execute()

    analysis_rec = (
        supabase.table("quiz_response_analyses")
        .select("id")
        .eq("quiz_id", quiz_id)
        .maybe_single()
        .execute()
    )
    analysis_id = analysis_rec.data["id"] if analysis_rec.data else None

    try:
        # 문항별 오답률 계산
        questions = (
            supabase.table("quiz_questions")
            .select("id, order_num, content")
            .eq("quiz_id", quiz_id)
            .order("order_num")
            .execute()
        )
        total_submissions = (
            supabase.table("quiz_submissions")
            .select("id", count="exact")
            .eq("quiz_id", quiz_id)
            .execute()
        ).count or 0

        questions_with_rates = []
        for q in (questions.data or []):
            wrong = (
                supabase.table("quiz_submission_answers")
                .select("id", count="exact")
                .eq("question_id", q["id"])
                .eq("is_correct", False)
                .execute()
            ).count or 0
            questions_with_rates.append({
                "order_num": q["order_num"],
                "content": q["content"],
                "wrong_rate": round(wrong / total_submissions * 100, 1) if total_submissions else 0.0,
            })

        result = call_sonnet_json(QUIZ_ANALYSIS_SYSTEM, quiz_analysis_user(questions_with_rates))

        if analysis_id:
            mark_completed("quiz_response_analyses", analysis_id, {
                "analyses": result.get("analyses", []),
                "weak_concepts": result.get("weak_concepts", []),
            })
            supabase.table("quiz_response_analyses").update({
                "weak_concepts": result.get("weak_concepts", []),
            }).eq("id", analysis_id).execute()

        # 개선 제안 저장
        suggestions_content = result.get("next_class_suggestions", [])
        supabase.table("quiz_improvement_suggestions").upsert({
            "quiz_id": quiz_id,
            "status": "completed",
            "suggestions": {"items": suggestions_content},
        }, on_conflict="quiz_id").execute()

        # dashboard_snapshots 갱신
        _refresh_dashboard_snapshot(course_id, quiz_id, result.get("weak_concepts", []))

    except Exception as e:
        if analysis_id:
            mark_failed("quiz_response_analyses", analysis_id, str(e))


def _refresh_dashboard_snapshot(course_id: str, quiz_id: str, weak_concepts: list[str]) -> None:
    """퀴즈 CLOSED 후 dashboard_snapshots 갱신.

    쿼리 구조 (총 7회, N+1 없음):
    ① quizzes       — course의 quiz_ids + schedule→quiz 매핑
    ② submissions   — ①의 quiz_ids로 일괄 조회
    ③ schedules     — week_number, topic 포함
    ④ enrollments   — count만 (참여율 분모)
    ⑤ scripts       — scriptDone 판별
    ⑥ preview_guides — previewDone 판별
    ⑦ review_summaries — reviewDone 판별
    """
    from datetime import datetime, timezone

    try:
        # ① 과목의 모든 퀴즈 (schedule_id → quiz_id 매핑)
        quiz_rows = (
            supabase.table("quizzes")
            .select("id, schedule_id")
            .eq("course_id", course_id)
            .execute()
        ).data or []
        quiz_ids = [q["id"] for q in quiz_rows]
        schedule_to_quiz_id: dict[str, str] = {
            q["schedule_id"]: q["id"]
            for q in quiz_rows
            if q.get("schedule_id")
        }

        # ② 해당 과목 퀴즈의 전체 제출 일괄 조회
        submissions_by_quiz: dict[str, list[float]] = {}
        if quiz_ids:
            for sub in (
                supabase.table("quiz_submissions")
                .select("quiz_id, score")
                .in_("quiz_id", quiz_ids)
                .execute()
            ).data or []:
                submissions_by_quiz.setdefault(sub["quiz_id"], []).append(sub["score"])

        # ③ 스케줄 목록 (topic 포함)
        schedules = (
            supabase.table("course_schedules")
            .select("id, week_number, topic")
            .eq("course_id", course_id)
            .order("week_number")
            .execute()
        ).data or []

        # ④ 수강생 수 (참여율 분모)
        enrolled_count = (
            supabase.table("course_enrollments")
            .select("id", count="exact")
            .eq("course_id", course_id)
            .execute()
        ).count or 0

        # ⑤ 스크립트 업로드 현황
        script_rows = (
            supabase.table("scripts")
            .select("schedule_id, week_number")
            .eq("course_id", course_id)
            .execute()
        ).data or []
        script_schedule_ids = {s["schedule_id"] for s in script_rows if s.get("schedule_id")}
        script_week_numbers = {s["week_number"] for s in script_rows if s.get("week_number")}

        # ⑥ 예습 가이드 완료 현황
        preview_done_ids = {
            p["schedule_id"]
            for p in (
                supabase.table("preview_guides")
                .select("schedule_id")
                .eq("course_id", course_id)
                .eq("status", "completed")
                .execute()
            ).data or []
            if p.get("schedule_id")
        }

        # ⑦ 복습 요약 완료 현황
        review_done_ids = {
            r["schedule_id"]
            for r in (
                supabase.table("review_summaries")
                .select("schedule_id")
                .eq("course_id", course_id)
                .eq("status", "completed")
                .execute()
            ).data or []
            if r.get("schedule_id")
        }

        # weekly_stats 구성
        weekly_stats = []
        for sched in schedules:
            sched_id = sched["id"]
            week_num = sched["week_number"]
            qid = schedule_to_quiz_id.get(sched_id)
            scores = submissions_by_quiz.get(qid, []) if qid else []

            weekly_stats.append({
                "weekNumber": week_num,
                "topic": sched.get("topic"),
                "quizId": qid,
                "averageScore": round(sum(scores) / len(scores), 1) if scores else None,
                "participationRate": round(len(scores) / enrolled_count * 100, 1) if (scores and enrolled_count) else 0.0,
                "previewDone": sched_id in preview_done_ids,
                "reviewDone": sched_id in review_done_ids,
                "scriptDone": sched_id in script_schedule_ids or week_num in script_week_numbers,
            })

        # 전체 평균 정답률
        all_scores = [s for scores in submissions_by_quiz.values() for s in scores]
        avg_accuracy = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0

        # TODO: weak_topics[].wrongRate는 quiz_response_analyses 결과와 미연결.
        #       실제 오답률 계산은 이후 작업으로 분리.
        weak_topics = [
            {"topic": c, "wrongRate": 0, "relatedQuizzes": [{"quizId": quiz_id}]}
            for c in weak_concepts
        ]

        supabase.table("dashboard_snapshots").upsert({
            "course_id": course_id,
            "average_accuracy": avg_accuracy,
            "weak_topics": weak_topics,
            "uploaded_weeks": len(script_week_numbers),
            "total_weeks": len(schedules),
            "weekly_stats": weekly_stats,
            "refreshed_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="course_id").execute()

    except Exception:
        pass
