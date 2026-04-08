"""예습 가이드 / 복습 요약본 생성 프롬프트."""

# ── 예습 가이드 (Gemini Flash) ─────────────────────────────────────────────────

PREVIEW_GUIDE_SYSTEM = """당신은 대학 강의 예습 자료를 만드는 교육 전문가입니다.
다음 수업의 주제와 강의 자료를 바탕으로 학생이 수업 전에 읽어야 할 예습 가이드를 작성합니다.
반드시 JSON 형식으로만 응답하세요."""


def preview_guide_user(
    topic: str,
    week_number: int | None,
    script_text: str,
) -> str:
    week_str = f"{week_number}주차: " if week_number else ""
    script_section = (
        f"\n[강의 자료 (앞 6000자)]\n{script_text[:6000]}"
        if script_text
        else "\n[강의 자료 없음 — 주제만으로 가이드를 작성하세요]"
    )
    return f"""다음 강의의 예습 가이드를 작성해주세요.

강의: {week_str}{topic}{script_section}

다음 JSON 형식으로 응답하세요:
{{
  "key_concepts": ["핵심 개념1", "핵심 개념2", "..."],
  "summary": "이번 수업에서 다룰 내용 요약 (3~5문장)",
  "reading_materials": [
    {{
      "title": "참고 자료 제목",
      "description": "왜 읽으면 좋은지 (1~2문장)",
      "type": "book|article|video|website"
    }}
  ]
}}"""


# ── 복습 요약본 (Gemini Flash) ─────────────────────────────────────────────────

REVIEW_SUMMARY_SYSTEM = """당신은 대학 강의 복습 자료를 만드는 교육 전문가입니다.
수업이 끝난 후 학생이 내용을 정리할 수 있도록 핵심 내용 요약본을 작성합니다.
반드시 JSON 형식으로만 응답하세요."""


def review_summary_user(
    topic: str,
    week_number: int | None,
    script_text: str,
    transcript_text: str,
) -> str:
    week_str = f"{week_number}주차: " if week_number else ""

    sources = []
    if script_text:
        sources.append(f"[강의 자료 (앞 5000자)]\n{script_text[:5000]}")
    if transcript_text:
        sources.append(f"[수업 녹음 텍스트 (앞 4000자)]\n{transcript_text[:4000]}")

    sources_section = (
        "\n\n".join(sources)
        if sources
        else "[수업 자료 없음 — 강의 주제만으로 요약을 작성하세요]"
    )

    return f"""다음 수업의 복습 요약본을 작성해주세요.

강의: {week_str}{topic}

{sources_section}

다음 JSON 형식으로 응답하세요:
{{
  "key_points": ["핵심 포인트1", "핵심 포인트2", "..."],
  "content": "복습 요약 본문 (400~800자, 수업에서 다룬 내용을 학생이 이해하기 쉽게 정리)"
}}"""
