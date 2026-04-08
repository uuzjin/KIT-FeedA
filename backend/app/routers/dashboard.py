from fastapi import APIRouter, Depends, HTTPException

from ..core.auth import get_current_user, require_instructor
from ..database import supabase

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _get_course_ids_for_instructor(user_id: str) -> list[str]:
    result = (
        supabase.table("course_instructors")
        .select("course_id")
        .eq("instructor_id", user_id)
        .execute()
    )
    return [r["course_id"] for r in (result.data or [])]


def _calc_overall_trend(weekly_stats: list[dict]) -> str:
    scores = [w.get("averageScore", 0) for w in weekly_stats if w.get("averageScore") is not None]
    if len(scores) < 6:
        return "STABLE"
    recent = sum(scores[-3:]) / 3
    previous = sum(scores[-6:-3]) / 3
    diff = recent - previous
    if diff >= 5:
        return "IMPROVING"
    if diff <= -5:
        return "DECLINING"
    return "STABLE"


# ── 9.1.1 강의별 이해도 추이 ──────────────────────────────────────────────────
@router.get("/instructors/comprehension-trends")
def get_comprehension_trends(
    courseId: str | None = None,
    semester: str | None = None,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if courseId:
        course_ids = [courseId]
    else:
        course_ids = _get_course_ids_for_instructor(user_id)

    if not course_ids:
        return {"trends": [], "overallTrend": "STABLE"}

    q = supabase.table("dashboard_snapshots").select("course_id, weekly_stats").in_("course_id", course_ids)
    snapshots = q.execute()

    trends = []
    all_weekly: list[dict] = []

    for snap in (snapshots.data or []):
        weekly = snap.get("weekly_stats") or []
        all_weekly.extend(weekly)

        for w in weekly:
            entry = {
                "weekNumber": w.get("weekNumber"),
                "topic": w.get("topic"),
                "averageScore": w.get("averageScore"),
                "participationRate": w.get("participationRate"),
                "quizId": w.get("quizId"),
            }
            if not courseId:
                entry["courseId"] = snap["course_id"]
            trends.append(entry)

    return {"trends": trends, "overallTrend": _calc_overall_trend(all_weekly)}


# ── 9.1.2 취약 토픽 요약 ──────────────────────────────────────────────────────
@router.get("/instructors/weak-topics")
def get_weak_topics(
    courseId: str | None = None,
    limit: int = 10,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if courseId:
        course_ids = [courseId]
    else:
        course_ids = _get_course_ids_for_instructor(user_id)

    if not course_ids:
        return {"weakTopics": []}

    snapshots = (
        supabase.table("dashboard_snapshots")
        .select("weak_topics")
        .in_("course_id", course_ids)
        .execute()
    )

    # 전체 weak_topics 병합 후 wrongRate 내림차순 정렬
    merged: list[dict] = []
    for snap in (snapshots.data or []):
        merged.extend(snap.get("weak_topics") or [])

    merged.sort(key=lambda x: x.get("wrongRate", 0), reverse=True)
    ranked = [{"rank": i + 1, **t} for i, t in enumerate(merged[:limit])]

    return {"weakTopics": ranked}


# ── 9.1.3 자료 업로드 현황 ────────────────────────────────────────────────────
@router.get("/instructors/upload-status")
def get_upload_status(
    courseId: str | None = None,
    semester: str | None = None,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if courseId:
        course_ids = [courseId]
    else:
        course_ids = _get_course_ids_for_instructor(user_id)

    if not course_ids:
        return {"uploadStatus": [], "completionRate": 0.0}

    snapshots = (
        supabase.table("dashboard_snapshots")
        .select("course_id, uploaded_weeks, total_weeks, weekly_stats")
        .in_("course_id", course_ids)
        .execute()
    )

    upload_status = []
    total_uploaded = 0
    total_weeks = 0

    for snap in (snapshots.data or []):
        total_uploaded += snap.get("uploaded_weeks", 0)
        total_weeks += snap.get("total_weeks", 16)
        for w in (snap.get("weekly_stats") or []):
            upload_status.append({
                "weekNumber": w.get("weekNumber"),
                "topic": w.get("topic"),
                "previewGuide": w.get("previewDone", False),
                "reviewSummary": w.get("reviewDone", False),
                "script": w.get("scriptDone", False),
            })

    completion_rate = round(total_uploaded / total_weeks * 100, 1) if total_weeks else 0.0
    return {"uploadStatus": upload_status, "completionRate": completion_rate}


# ── 9.2.1 학생 퀴즈 참여 이력 ────────────────────────────────────────────────
@router.get("/students/quiz-history")
def get_student_quiz_history(
    courseId: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    q = (
        supabase.table("quiz_submissions")
        .select("id, quiz_id, score, correct_count, total_count, submitted_at, quizzes(course_id, schedule_id)")
        .eq("student_id", user_id)
    )
    submissions = q.execute()

    history = []
    for sub in (submissions.data or []):
        quiz_info = sub.get("quizzes") or {}
        if courseId and quiz_info.get("course_id") != courseId:
            continue

        # 오답 조회
        wrong_answers_result = (
            supabase.table("quiz_submission_answers")
            .select("question_id, selected_option, is_correct, quiz_questions(content, answer)")
            .eq("submission_id", sub["id"])
            .eq("is_correct", False)
            .execute()
        )
        wrong_answers = [
            {
                "questionId": wa["question_id"],
                "content": wa["quiz_questions"]["content"] if wa.get("quiz_questions") else None,
                "correctAnswer": wa["quiz_questions"]["answer"] if wa.get("quiz_questions") else None,
                "selectedOption": wa.get("selected_option"),
            }
            for wa in (wrong_answers_result.data or [])
        ]

        history.append({
            "submissionId": sub["id"],
            "quizId": sub["quiz_id"],
            "courseId": quiz_info.get("course_id"),
            "score": sub["score"],
            "correctCount": sub["correct_count"],
            "totalCount": sub["total_count"],
            "submittedAt": sub["submitted_at"],
            "wrongAnswers": wrong_answers,
        })

    return {"history": history, "totalCount": len(history)}


# ── 9.2.2 예습·복습 자료 모아보기 ────────────────────────────────────────────
@router.get("/students/materials")
def get_student_materials(
    courseId: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    # 수강 중인 강의 조회
    enrollments = (
        supabase.table("course_enrollments")
        .select("course_id")
        .eq("student_id", user_id)
        .execute()
    )
    enrolled_ids = [r["course_id"] for r in (enrollments.data or [])]

    if courseId:
        if courseId not in enrolled_ids:
            raise HTTPException(status_code=403, detail="수강 중인 강의가 아닙니다.")
        target_ids = [courseId]
    else:
        target_ids = enrolled_ids

    if not target_ids:
        return {"materials": []}

    previews = (
        supabase.table("preview_guides")
        .select("id, course_id, schedule_id, title, status, created_at")
        .in_("course_id", target_ids)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .execute()
    )
    reviews = (
        supabase.table("review_summaries")
        .select("id, course_id, schedule_id, title, status, created_at")
        .in_("course_id", target_ids)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .execute()
    )

    materials = []
    for p in (previews.data or []):
        materials.append({"type": "PREVIEW", "id": p["id"], "courseId": p["course_id"], "title": p["title"], "createdAt": p["created_at"]})
    for r in (reviews.data or []):
        materials.append({"type": "REVIEW", "id": r["id"], "courseId": r["course_id"], "title": r["title"], "createdAt": r["created_at"]})

    materials.sort(key=lambda x: x["createdAt"] or "", reverse=True)
    return {"materials": materials, "totalCount": len(materials)}
