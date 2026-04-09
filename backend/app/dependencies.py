from fastapi import HTTPException

from .database import supabase


def require_instructor_of(course_id: str, user_id: str) -> None:
    """주어진 강의의 담당 강사인지 확인. 아니면 403 반환."""
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
