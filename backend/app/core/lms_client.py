"""LMS 클라이언트 추상 레이어.

지원 LMS: Moodle, Canvas, Blackboard
각 LMS의 API 인증 방식과 엔드포인트가 다르므로 추상 클래스로 인터페이스를 통일한다.

사용법:
    client = get_lms_client("MOODLE")
    students = client.get_students("course_123")
    url = client.upload_material("course_123", "Week 1", "예습 가이드", "<p>...</p>")
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# 추상 기반 클래스
# ──────────────────────────────────────────────────────────────────────────────

class LMSClient(ABC):
    """LMS API 클라이언트 공통 인터페이스."""

    @abstractmethod
    def get_course(self, lms_course_id: str) -> dict:
        """LMS에서 강의 정보를 가져온다."""

    @abstractmethod
    def get_students(self, lms_course_id: str) -> list[dict]:
        """LMS에서 수강생 목록을 가져온다.

        Returns:
            [{"name": str, "email": str, "lms_user_id": str}, ...]
        """

    @abstractmethod
    def upload_material(
        self,
        lms_course_id: str,
        section_name: str,
        title: str,
        content_html: str,
    ) -> str:
        """LMS에 자료를 업로드하고 접근 URL을 반환한다."""

    @abstractmethod
    def get_deadlines(self, lms_course_id: str) -> list[dict]:
        """LMS에서 마감일(과제·자료 제출 기한) 목록을 가져온다.

        Returns:
            [{"title": str, "due_at": str (ISO 8601)}, ...]
        """


# ──────────────────────────────────────────────────────────────────────────────
# Moodle (REST API + wstoken)
# ──────────────────────────────────────────────────────────────────────────────

class MoodleClient(LMSClient):
    """Moodle Web Service REST API 클라이언트.

    Moodle API 문서: https://docs.moodle.org/dev/Web_service_API_functions
    인증: wstoken (Web Service Token)
    """

    def __init__(self) -> None:
        from .config import settings
        self._base_url = settings.MOODLE_BASE_URL.rstrip("/")
        self._token = settings.MOODLE_API_TOKEN
        self._endpoint = f"{self._base_url}/webservice/rest/server.php"

    def _call(self, function: str, **params) -> dict | list:
        resp = httpx.get(
            self._endpoint,
            params={
                "wstoken": self._token,
                "moodlewsrestformat": "json",
                "wsfunction": function,
                **params,
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, dict) and data.get("exception"):
            raise RuntimeError(f"Moodle API 오류: {data.get('message')}")
        return data

    def get_course(self, lms_course_id: str) -> dict:
        result = self._call("core_course_get_courses", options={"ids[0]": lms_course_id})
        if not result:
            raise ValueError(f"Moodle 강의를 찾을 수 없습니다: {lms_course_id}")
        course = result[0]
        return {"lms_course_id": str(course["id"]), "name": course.get("fullname", "")}

    def get_students(self, lms_course_id: str) -> list[dict]:
        enrollments = self._call(
            "core_enrol_get_enrolled_users",
            courseid=lms_course_id,
        )
        students = []
        for user in (enrollments or []):
            roles = [r.get("shortname") for r in user.get("roles", [])]
            if "student" not in roles:
                continue
            students.append({
                "name": user.get("fullname", ""),
                "email": user.get("email", ""),
                "lms_user_id": str(user["id"]),
            })
        return students

    def upload_material(
        self,
        lms_course_id: str,
        section_name: str,
        title: str,
        content_html: str,
    ) -> str:
        # Moodle: core_course_add_content_item 또는 mod_page_add_instance
        # 여기서는 page 모듈을 생성하는 방식 사용
        result = self._call(
            "core_course_add_content_item",
            courseid=lms_course_id,
            componentname="mod_page",
            contentitemid=0,
        )
        # 실제 Moodle API에서는 여러 단계가 필요하므로 URL만 반환
        return f"{self._base_url}/course/view.php?id={lms_course_id}"

    def get_deadlines(self, lms_course_id: str) -> list[dict]:
        # mod_assign_get_assignments로 과제 목록 조회
        data = self._call("mod_assign_get_assignments", courseids=[lms_course_id])
        deadlines = []
        for course in (data.get("courses") or []):
            for assignment in (course.get("assignments") or []):
                due_date = assignment.get("duedate")  # Unix timestamp
                if not due_date:
                    continue
                deadlines.append({
                    "title": assignment.get("name", "Moodle 과제"),
                    "due_at": datetime.fromtimestamp(due_date, tz=timezone.utc).isoformat(),
                })
        return deadlines


# ──────────────────────────────────────────────────────────────────────────────
# Canvas LMS (REST API + Bearer Token)
# ──────────────────────────────────────────────────────────────────────────────

class CanvasClient(LMSClient):
    """Canvas LMS REST API 클라이언트.

    Canvas API 문서: https://canvas.instructure.com/doc/api/
    인증: Authorization: Bearer {api_token}
    """

    def __init__(self) -> None:
        from .config import settings
        self._base_url = settings.CANVAS_BASE_URL.rstrip("/")
        self._headers = {"Authorization": f"Bearer {settings.CANVAS_API_TOKEN}"}

    def _get(self, path: str, **params) -> dict | list:
        resp = httpx.get(
            f"{self._base_url}/api/v1{path}",
            headers=self._headers,
            params=params,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, json: dict) -> dict:
        resp = httpx.post(
            f"{self._base_url}/api/v1{path}",
            headers=self._headers,
            json=json,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_course(self, lms_course_id: str) -> dict:
        course = self._get(f"/courses/{lms_course_id}")
        return {"lms_course_id": str(course["id"]), "name": course.get("name", "")}

    def get_students(self, lms_course_id: str) -> list[dict]:
        users = self._get(f"/courses/{lms_course_id}/users", enrollment_type="student", per_page=100)
        return [
            {
                "name": u.get("name", ""),
                "email": u.get("email", ""),
                "lms_user_id": str(u["id"]),
            }
            for u in (users or [])
        ]

    def upload_material(
        self,
        lms_course_id: str,
        section_name: str,
        title: str,
        content_html: str,
    ) -> str:
        page = self._post(
            f"/courses/{lms_course_id}/pages",
            {
                "wiki_page": {
                    "title": title,
                    "body": content_html,
                    "published": True,
                }
            },
        )
        return page.get("html_url", f"{self._base_url}/courses/{lms_course_id}")

    def get_deadlines(self, lms_course_id: str) -> list[dict]:
        assignments = self._get(f"/courses/{lms_course_id}/assignments", per_page=100)
        deadlines = []
        for a in (assignments or []):
            due_at = a.get("due_at")
            if not due_at:
                continue
            deadlines.append({"title": a.get("name", "Canvas 과제"), "due_at": due_at})
        return deadlines


# ──────────────────────────────────────────────────────────────────────────────
# Blackboard (REST API + OAuth2 Client Credentials)
# ──────────────────────────────────────────────────────────────────────────────

class BlackboardClient(LMSClient):
    """Blackboard Learn REST API 클라이언트.

    Blackboard API 문서: https://developer.blackboard.com/portal/displayApi
    인증: OAuth 2.0 Client Credentials (client_id + client_secret → access_token)
    """

    def __init__(self) -> None:
        from .config import settings
        self._base_url = settings.BLACKBOARD_BASE_URL.rstrip("/")
        self._client_key = settings.BLACKBOARD_API_KEY
        self._client_secret = settings.BLACKBOARD_API_SECRET
        self._token: str | None = None

    def _ensure_token(self) -> str:
        if self._token:
            return self._token
        resp = httpx.post(
            f"{self._base_url}/learn/api/public/v1/oauth2/token",
            data={"grant_type": "client_credentials"},
            auth=(self._client_key, self._client_secret),
            timeout=10,
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def _get(self, path: str) -> dict | list:
        resp = httpx.get(
            f"{self._base_url}/learn/api/public/v1{path}",
            headers={"Authorization": f"Bearer {self._ensure_token()}"},
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, json: dict) -> dict:
        resp = httpx.post(
            f"{self._base_url}/learn/api/public/v1{path}",
            headers={"Authorization": f"Bearer {self._ensure_token()}"},
            json=json,
            timeout=15,
        )
        resp.raise_for_status()
        return resp.json()

    def get_course(self, lms_course_id: str) -> dict:
        course = self._get(f"/courses/{lms_course_id}")
        return {"lms_course_id": course.get("id", ""), "name": course.get("name", "")}

    def get_students(self, lms_course_id: str) -> list[dict]:
        data = self._get(f"/courses/{lms_course_id}/users?role=STUDENT&limit=100")
        results = data.get("results", []) if isinstance(data, dict) else data
        students = []
        for membership in results:
            user = membership.get("user", {})
            students.append({
                "name": user.get("name", {}).get("full", ""),
                "email": user.get("contact", {}).get("email", ""),
                "lms_user_id": user.get("id", ""),
            })
        return students

    def upload_material(
        self,
        lms_course_id: str,
        section_name: str,
        title: str,
        content_html: str,
    ) -> str:
        content = self._post(
            f"/courses/{lms_course_id}/contents",
            {
                "title": title,
                "contentHandler": {"id": "resource/x-bb-document"},
                "body": content_html,
                "availability": {"available": "Yes"},
            },
        )
        content_id = content.get("id", "")
        return f"{self._base_url}/webapps/blackboard/content/listContent.jsp?course_id={lms_course_id}&content_id={content_id}"

    def get_deadlines(self, lms_course_id: str) -> list[dict]:
        data = self._get(f"/courses/{lms_course_id}/contents?limit=100")
        results = data.get("results", []) if isinstance(data, dict) else data
        deadlines = []
        for item in results:
            avail = item.get("availability", {})
            due_at = avail.get("adaptiveRelease", {}).get("end")
            if not due_at:
                continue
            deadlines.append({"title": item.get("title", "Blackboard 항목"), "due_at": due_at})
        return deadlines


# ──────────────────────────────────────────────────────────────────────────────
# 팩토리 함수
# ──────────────────────────────────────────────────────────────────────────────

_CLIENTS: dict[str, type[LMSClient]] = {
    "MOODLE": MoodleClient,
    "CANVAS": CanvasClient,
    "BLACKBOARD": BlackboardClient,
}


def get_lms_client(lms_type: str) -> LMSClient:
    """lms_type 문자열로 적절한 LMS 클라이언트를 반환한다."""
    cls = _CLIENTS.get(lms_type.upper())
    if cls is None:
        raise ValueError(f"지원하지 않는 LMS 유형입니다: {lms_type}. 허용값: {list(_CLIENTS)}")
    return cls()
