"""스크립트 분석 프롬프트."""

# ── 1단계: 구조 분석 (Claude Haiku) ──────────────────────────────────────────

LOGIC_SYSTEM = """당신은 교육 전문가입니다. 강의 스크립트를 읽고 논리적 흐름의 문제를 탐지합니다.
반드시 JSON 형식으로만 응답하세요."""

def logic_user(script_text: str) -> str:
    return f"""다음 강의 스크립트의 논리적 흐름을 분석하고, 설명이 갑자기 끊기거나 인과관계가 불명확한 부분을 찾아주세요.

[스크립트]
{script_text[:8000]}

다음 JSON 형식으로 응답하세요:
{{
  "gaps": [
    {{
      "location": "발견된 위치 설명 (예: 3번째 단락)",
      "issue": "문제점 설명",
      "severity": "HIGH|MEDIUM|LOW"
    }}
  ],
  "overallFlowScore": 0~100
}}"""


TERMINOLOGY_SYSTEM = """당신은 교육 전문가입니다. 강의 스크립트에서 처음 등장하는 전문용어 중 정의나 설명이 없는 것을 찾습니다.
반드시 JSON 형식으로만 응답하세요."""

def terminology_user(script_text: str) -> str:
    return f"""다음 강의 스크립트에서 처음 등장하는 전문용어 중 정의나 설명 없이 사용된 용어를 찾아주세요.

[스크립트]
{script_text[:8000]}

다음 JSON 형식으로 응답하세요:
{{
  "undefined_terms": [
    {{
      "term": "용어명",
      "location": "등장 위치",
      "recommended_definition": "권장 정의"
    }}
  ]
}}"""


PREREQUISITES_SYSTEM = """당신은 교육 전문가입니다. 강의 스크립트에서 설명에 필요한 사전 지식이 전제되어 있지만 언급되지 않은 부분을 찾습니다.
반드시 JSON 형식으로만 응답하세요."""

def prerequisites_user(script_text: str) -> str:
    return f"""다음 강의 스크립트에서 학생이 이해하려면 알아야 하는데 설명되지 않은 사전 지식을 찾아주세요.

[스크립트]
{script_text[:8000]}

다음 JSON 형식으로 응답하세요:
{{
  "missing_prerequisites": [
    {{
      "concept": "필요한 사전 지식",
      "why_needed": "왜 필요한지",
      "suggested_coverage": "어디서 다루면 좋은지"
    }}
  ]
}}"""


# ── 2단계: 보완 제안 (Claude Sonnet) ─────────────────────────────────────────

DIFFICULTY_SYSTEM = """당신은 학습자 관점에서 강의 내용의 어려운 점을 설명하고 개선 방안을 제안하는 교육 전문가입니다.
반드시 JSON 형식으로만 응답하세요."""

def difficulty_user(script_text: str, analyses: list[dict]) -> str:
    analyses_str = "\n".join(
        f"- {a.get('analysis_type', '')}: {a.get('result', {})}"
        for a in analyses
    )
    return f"""다음 강의 스크립트와 분석 결과를 바탕으로, 학습자 관점에서 왜 어려운지 설명하고 개선 제안을 해주세요.

[스크립트 요약 (앞 3000자)]
{script_text[:3000]}

[분석 결과]
{analyses_str}

다음 JSON 형식으로 응답하세요:
{{
  "difficulty_explanations": [
    {{
      "topic": "어려운 개념/부분",
      "why_difficult": "학습자 관점에서 왜 어려운지",
      "student_level": "초급|중급|고급"
    }}
  ],
  "improvement_suggestions": [
    {{
      "target": "개선 대상",
      "suggestion": "구체적인 개선 방안",
      "example": "예시 문장이나 비유 (있으면)"
    }}
  ]
}}"""


REPORT_SYSTEM = """당신은 강의 자료를 슬라이드 단위로 분석하여 교수자에게 개선 리포트를 제공하는 전문가입니다.
반드시 JSON 형식으로만 응답하세요."""

def report_user(script_text: str, all_results: dict) -> str:
    return f"""다음 스크립트와 분석 결과를 종합하여 슬라이드(또는 섹션)별 개선 리포트를 작성해주세요.

[스크립트 (앞 4000자)]
{script_text[:4000]}

[분석 결과 요약]
논리 흐름 점수: {all_results.get('flowScore', 'N/A')}
미정의 용어: {len(all_results.get('terms', []))}개
누락 전제지식: {len(all_results.get('prerequisites', []))}개

다음 JSON 형식으로 응답하세요:
{{
  "overall_score": 0~100,
  "summary": "전체 요약 (2~3문장)",
  "slides": [
    {{
      "section": "섹션/슬라이드 설명",
      "issues": ["문제점1", "문제점2"],
      "suggestions": ["개선안1", "개선안2"],
      "score": 0~100
    }}
  ]
}}"""
