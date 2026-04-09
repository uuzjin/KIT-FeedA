from typing import Any
from pydantic import BaseModel


# ── 공통 에러 ──────────────────────────────────────────────────────────────────
class ErrorDetail(BaseModel):
    field: str
    reason: str


class ErrorResponse(BaseModel):
    status: int
    code: str
    message: str
    errors: list[ErrorDetail]
    timestamp: str


# ── 2. 사용자 ──────────────────────────────────────────────────────────────────
class ProfileResponse(BaseModel):
    userId: str
    name: str
    email: str
    role: str
    profileImageUrl: str | None
    title: str | None
    createdAt: str


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    title: str | None = None


class RoleUpdateRequest(BaseModel):
    role: str


# ── 3. 강의 ───────────────────────────────────────────────────────────────────
class CourseCreateRequest(BaseModel):
    courseName: str
    semester: str
    dayOfWeek: list[str] = []
    startTime: str | None = None
    endTime: str | None = None
    maxStudents: int = 50
    description: str | None = None


class CourseUpdateRequest(BaseModel):
    courseName: str | None = None
    semester: str | None = None
    dayOfWeek: list[str] | None = None
    startTime: str | None = None
    endTime: str | None = None
    maxStudents: int | None = None
    description: str | None = None


class ScheduleCreateRequest(BaseModel):
    weekNumber: int
    topic: str
    date: str | None = None
    description: str | None = None


class ScheduleUpdateRequest(BaseModel):
    topic: str | None = None
    date: str | None = None
    description: str | None = None


class EnrollStudentsRequest(BaseModel):
    studentIds: list[str]


class InviteCreateRequest(BaseModel):
    expiresAt: str  # ISO 8601


class JoinCourseRequest(BaseModel):
    token: str


class AssignCoursesRequest(BaseModel):
    courseIds: list[str]
