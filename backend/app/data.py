from .schemas import Course, DashboardSummary

COURSES = [
    Course(id=1, name="인공지능개론", semester="2026-1", studentCount=42),
    Course(id=2, name="웹프로그래밍", semester="2026-1", studentCount=36),
]

DASHBOARD = DashboardSummary(
    averageAccuracy=74,
    weakTopics=["Transformer Attention", "정규화", "REST API 설계"],
    uploadedWeeks=6,
    totalWeeks=8,
)
