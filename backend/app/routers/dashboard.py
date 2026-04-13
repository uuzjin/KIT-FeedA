from collections import defaultdict
from datetime import datetime, timezone

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
    course_id: str | None = None,
    semester: str | None = None,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if course_id:
        course_ids = [course_id]
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
            if not course_id:
                entry["courseId"] = snap["course_id"]
            trends.append(entry)

    return {"trends": trends, "overallTrend": _calc_overall_trend(all_weekly)}


# ── 9.1.2 취약 토픽 요약 ──────────────────────────────────────────────────────
@router.get("/instructors/weak-topics")
def get_weak_topics(
    course_id: str | None = None,
    limit: int = 10,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if course_id:
        course_ids = [course_id]
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
    course_id: str | None = None,
    semester: str | None = None,
    current_user: dict = Depends(require_instructor),
):
    user_id = current_user["id"]

    if course_id:
        course_ids = [course_id]
    else:
        course_ids = _get_course_ids_for_instructor(user_id)

    if not course_ids:
        return {"uploadStatus": [], "completionRate": 0.0}

    try:
        snapshots = (
            supabase.table("dashboard_snapshots")
            .select("*")
            .in_("course_id", course_ids)
            .execute()
        )
        data = snapshots.data or []
    except Exception as e:
        print(f"Error fetching dashboard_snapshots: {e}")
        data = []

    upload_status = []
    total_uploaded = 0
    total_weeks = 0

    for snap in data:
        try:
            total_uploaded += int(snap.get("uploaded_weeks") or 0)
        except (ValueError, TypeError):
            pass
            
        try:
            total_weeks += int(snap.get("total_weeks") or 16)
        except (ValueError, TypeError):
            total_weeks += 16
            
        weekly = snap.get("weekly_stats") or []
        if isinstance(weekly, str):
            import json
            try:
                weekly = json.loads(weekly)
            except Exception:
                weekly = []
                
        for w in weekly:
            if not isinstance(w, dict):
                continue
            upload_status.append({
                "weekNumber": w.get("weekNumber"),
                "topic": w.get("topic"),
                "previewGuide": w.get("previewDone", False),
                "reviewSummary": w.get("reviewDone", False),
                "script": w.get("scriptDone", False),
            })

    completion_rate = round((total_uploaded / total_weeks) * 100, 1) if total_weeks > 0 else 0.0
    return {"uploadStatus": upload_status, "completionRate": completion_rate}


# ── 9.2.1 학생 퀴즈 참여 이력 ────────────────────────────────────────────────
@router.get("/students/quiz-history")
def get_student_quiz_history(
    course_id: str | None = None,
    current_user: dict = Depends(get_current_user),
):
    user_id = current_user["id"]

    q = (
        supabase.table("quiz_submissions")
        .select("id, quiz_id, score, correct_count, total_count, submitted_at, quizzes(course_id, schedule_id)")
        .eq("student_id", user_id)
    )
    submissions = q.execute()

    # courseId 필터 먼저 적용
    filtered_subs = [
        s for s in (submissions.data or [])
        if not course_id or (s.get("quizzes") or {}).get("course_id") == course_id
    ]

    # 오답 일괄 조회 — N+1 방지
    sub_ids = [s["id"] for s in filtered_subs]
    wrong_by_sub: dict[str, list] = defaultdict(list)
    if sub_ids:
        all_wrong = (
            supabase.table("quiz_submission_answers")
            .select("submission_id, question_id, selected_option, is_correct, quiz_questions(content, answer)")
            .in_("submission_id", sub_ids)
            .eq("is_correct", False)
            .execute()
        )
        for wa in (all_wrong.data or []):
            wrong_by_sub[wa["submission_id"]].append(wa)

    history = []
    for sub in filtered_subs:
        quiz_info = sub.get("quizzes") or {}
        wrong_answers = [
            {
                "questionId": wa["question_id"],
                "content": wa["quiz_questions"]["content"] if wa.get("quiz_questions") else None,
                "correctAnswer": wa["quiz_questions"]["answer"] if wa.get("quiz_questions") else None,
                "selectedOption": wa.get("selected_option"),
            }
            for wa in wrong_by_sub.get(sub["id"], [])
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
    course_id: str | None = None,
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

    if course_id:
        if course_id not in enrolled_ids:
            raise HTTPException(status_code=403, detail="수강 중인 강의가 아닙니다.")
        target_ids = [course_id]
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


# ── 대시보드 스냅샷 수동 새로고침 ────────────────────────────────────────────
@router.post("/refresh/{course_id}")
def refresh_dashboard_snapshot(
    course_id: str,
    current_user: dict = Depends(require_instructor),
):
    """강의 대시보드 스냅샷을 실제 데이터로 즉시 재구성합니다."""
    user_id = current_user["id"]

    # 해당 강의에 대한 접근 권한 확인
    instructor_courses = _get_course_ids_for_instructor(user_id)
    if course_id not in instructor_courses:
        raise HTTPException(status_code=403, detail="해당 강의에 대한 권한이 없습니다.")

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

    # ③ 스케줄 목록
    schedules = (
        supabase.table("course_schedules")
        .select("id, week_number, topic")
        .eq("course_id", course_id)
        .order("week_number")
        .execute()
    ).data or []

    # ④ 수강생 수
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

    # ⑧ 실제 오답률 기반 취약 토픽 계산
    weak_topics: list[dict] = []
    if quiz_ids:
        questions = (
            supabase.table("quiz_questions")
            .select("id, content, quiz_id")
            .in_("quiz_id", quiz_ids)
            .execute()
        ).data or []

        total_subs_all = sum(len(v) for v in submissions_by_quiz.values())

        if questions and total_subs_all:
            q_ids = [q["id"] for q in questions]
            wrong_counts: dict[str, int] = {}
            total_by_q: dict[str, int] = {}

            answers = (
                supabase.table("quiz_submission_answers")
                .select("question_id, is_correct")
                .in_("question_id", q_ids)
                .execute()
            ).data or []

            for ans in answers:
                qid = ans["question_id"]
                total_by_q[qid] = total_by_q.get(qid, 0) + 1
                if not ans["is_correct"]:
                    wrong_counts[qid] = wrong_counts.get(qid, 0) + 1

            topic_wrong: dict[str, dict] = {}
            q_map = {q["id"]: q for q in questions}
            for qid, wrong in wrong_counts.items():
                total = total_by_q.get(qid, 0)
                if not total:
                    continue
                wrong_rate = round(wrong / total, 3)
                content = q_map.get(qid, {}).get("content", "알 수 없음")
                quiz_id_for_q = q_map.get(qid, {}).get("quiz_id")
                if content not in topic_wrong or topic_wrong[content]["wrongRate"] < wrong_rate:
                    topic_wrong[content] = {
                        "topic": content[:60],
                        "wrongRate": wrong_rate,
                        "relatedQuizzes": [{"quizId": quiz_id_for_q}] if quiz_id_for_q else [],
                    }

            weak_topics = sorted(topic_wrong.values(), key=lambda x: x["wrongRate"], reverse=True)[:10]

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

    all_scores = [s for scores in submissions_by_quiz.values() for s in scores]
    avg_accuracy = round(sum(all_scores) / len(all_scores), 1) if all_scores else 0.0

    supabase.table("dashboard_snapshots").upsert({
        "course_id": course_id,
        "average_accuracy": avg_accuracy,
        "weak_topics": weak_topics,
        "uploaded_weeks": len(script_week_numbers),
        "total_weeks": len(schedules),
        "weekly_stats": weekly_stats,
        "refreshed_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="course_id").execute()

    return {
        "message": "대시보드 스냅샷이 갱신되었습니다.",
        "courseId": course_id,
        "refreshedAt": datetime.now(timezone.utc).isoformat(),
        "totalWeeks": len(schedules),
        "uploadedWeeks": len(script_week_numbers),
        "averageAccuracy": avg_accuracy,
    }
