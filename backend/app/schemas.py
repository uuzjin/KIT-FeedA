from pydantic import BaseModel


class SignupRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Course(BaseModel):
    id: int
    name: str
    semester: str
    studentCount: int


class DashboardSummary(BaseModel):
    averageAccuracy: int
    weakTopics: list[str]
    uploadedWeeks: int
    totalWeeks: int
