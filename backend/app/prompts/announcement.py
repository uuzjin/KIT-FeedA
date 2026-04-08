"""공지문 자동 생성 프롬프트.

templateType:
  PREVIEW  — 수업 전 예습 안내
  REVIEW   — 수업 후 복습 자료 안내
  GENERAL  — 일반 공지
"""

ANNOUNCEMENT_SYSTEM = """당신은 대학 강의 보조 시스템입니다.
교수자를 대신하여 수강생에게 전달할 공지문을 작성합니다.
어조는 공손하고 명확하게 유지하세요.
반드시 JSON 형식으로만 응답하세요."""


def announcement_user(
    template_type: str,
    topic: str,
    week_number: int | None,
    custom_message: str | None,
) -> str:
    week_str = f"{week_number}주차 " if week_number else ""
    custom_str = f"\n\n[교수자 추가 메시지]\n{custom_message}" if custom_message else ""

    if template_type == "PREVIEW":
        instruction = f"""{week_str}강의 주제: {topic}

다음 수업에 대한 예습 안내 공지문을 작성해주세요.
수강생이 수업 전에 무엇을 준비하면 좋을지 안내하는 내용을 포함하세요.{custom_str}"""
    elif template_type == "REVIEW":
        instruction = f"""{week_str}강의 주제: {topic}

방금 완료된 수업에 대한 복습 안내 공지문을 작성해주세요.
복습 방법, 핵심 개념 정리 권고 등을 포함하세요.{custom_str}"""
    else:  # GENERAL
        instruction = f"""강의 주제: {topic}

일반 강의 공지문을 작성해주세요.{custom_str}"""

    return f"""{instruction}

다음 JSON 형식으로 응답하세요:
{{
  "title": "공지문 제목 (50자 이내)",
  "content": "공지문 본문 (200~400자, 수강생에게 전달되는 내용)"
}}"""
