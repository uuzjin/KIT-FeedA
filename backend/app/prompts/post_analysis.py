"""수업 사후 분석 프롬프트 (기능명세 6.6).

analysis_type:
  structure  — 수업 흐름 구조 분석 (소형 LLM)
  concepts   — 필수 개념어 전달 여부 확인 (소형 LLM)
"""

# ── 수업 흐름 구조 분석 (Gemini Flash Lite) ───────────────────────────────────

STRUCTURE_SYSTEM = """당신은 교육 전문가입니다.
강의 스크립트를 분석하여 수업의 흐름 구조를 파악하고 개선점을 제안합니다.
반드시 JSON 형식으로만 응답하세요."""


def structure_user(script_text: str) -> str:
    return f"""다음 강의 스크립트의 수업 흐름 구조를 분석해주세요.
도입 → 전개 → 마무리 구조가 명확한지, 각 단계 간 연결이 자연스러운지 평가하세요.

[스크립트]
{script_text[:8000]}

다음 JSON 형식으로 응답하세요:
{{
  "structure_map": [
    {{
      "phase": "도입|전개|마무리|기타",
      "description": "이 부분에서 다루는 내용",
      "strength": "잘 된 점",
      "weakness": "개선이 필요한 점 (없으면 null)"
    }}
  ],
  "flow_score": 0~100,
  "overall_comment": "전체 흐름에 대한 종합 평가 (2~3문장)"
}}"""


# ── 필수 개념어 전달 확인 (Gemini Flash Lite) ─────────────────────────────────

CONCEPTS_SYSTEM = """당신은 교육 전문가입니다.
강의 스크립트를 분석하여 수업 목표 달성에 필요한 핵심 개념들이 충분히 전달되었는지 확인합니다.
반드시 JSON 형식으로만 응답하세요."""


def concepts_user(script_text: str) -> str:
    return f"""다음 강의 스크립트에서 핵심 개념어들이 제대로 설명되었는지 확인해주세요.
각 개념이 정의되었는지, 예시가 제공되었는지, 학생이 이해할 수 있는 수준으로 설명되었는지 평가하세요.

[스크립트]
{script_text[:8000]}

다음 JSON 형식으로 응답하세요:
{{
  "covered_concepts": [
    {{
      "concept": "개념명",
      "coverage": "충분|부족|누락",
      "note": "구체적인 평가 (1문장)"
    }}
  ],
  "missing_concepts": ["빠진 핵심 개념1", "빠진 핵심 개념2"],
  "coverage_score": 0~100,
  "overall_comment": "개념 전달 수준에 대한 종합 평가 (2~3문장)"
}}"""
