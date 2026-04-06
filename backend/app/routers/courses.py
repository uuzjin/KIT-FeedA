from fastapi import APIRouter
from pydantic import BaseModel

from ..data import COURSES
from ..schemas import Course

router = APIRouter(prefix="/api/courses", tags=["courses"])


class CourseCreateRequest(BaseModel):
    name: str
    semester: str
    studentCount: int


@router.get("")
def list_courses():
    return COURSES


@router.post("")
def create_course(payload: CourseCreateRequest):
    next_id = max((course.id for course in COURSES), default=0) + 1
    new_course = Course(
        id=next_id,
        name=payload.name,
        semester=payload.semester,
        studentCount=payload.studentCount,
    )
    COURSES.append(new_course)
    return {"message": "강의가 추가되었습니다.", "course": new_course}
