"""퀴즈 생성 프롬프트."""

QUIZ_SYSTEM = """당신은 대학 강의 내용을 바탕으로 학생 이해도를 측정하는 퀴즈를 만드는 전문가입니다.
반드시 JSON 형식으로만 응답하세요."""


def quiz_user(
    script_text: str,
    question_count: int,
    question_types: list[str],
    difficulty_level: str,
    topic: str,
) -> str:
    types_str = ", ".join(question_types) if question_types else "MULTIPLE_CHOICE, TRUE_FALSE"
    return f"""다음 강의 내용을 바탕으로 퀴즈 문항을 생성해주세요.

[강의 토픽]
{topic}

[강의 내용 (앞 5000자)]
{script_text[:5000]}

[조건]
- 문항 수: {question_count}개
- 문항 유형: {types_str}
- 난이도: {difficulty_level} (EASY=개념 확인, MEDIUM=적용, HARD=추론, MIXED=혼합)

다음 JSON 형식으로 응답하세요:
{{
  "questions": [
    {{
      "order_num": 1,
      "question_type": "MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER",
      "difficulty": "EASY|MEDIUM|HARD",
      "content": "문제 내용",
      "options": ["선택지A", "선택지B", "선택지C", "선택지D"],
      "answer": "정답 (객관식은 선택지 텍스트, 주관식은 모범 답안)",
      "explanation": "정답 해설"
    }}
  ]
}}

주의:
- TRUE_FALSE는 options를 ["True", "False"]로 설정하세요.
- SHORT_ANSWER는 options를 빈 배열로 설정하세요.
- 강의 내용에 충실한 문항만 생성하세요."""


QUIZ_ANALYSIS_SYSTEM = """당신은 퀴즈 응답 데이터를 분석하여 학생들이 어떤 개념을 어려워하는지 진단하는 교육 전문가입니다.
반드시 JSON 형식으로만 응답하세요."""


def quiz_analysis_user(questions_with_wrong_rates: list[dict]) -> str:
    q_str = "\n".join(
        f"문항 {q['order_num']}: {q['content']} (오답률: {q['wrong_rate']:.1f}%)"
        for q in questions_with_wrong_rates
    )
    return f"""다음 퀴즈 문항별 오답률을 분석하여 학생들이 어려워하는 개념을 도출해주세요.

[문항별 오답률]
{q_str}

다음 JSON 형식으로 응답하세요:
{{
  "analyses": [
    {{
      "question_order": 1,
      "wrong_rate": 45.0,
      "concept": "어려워한 핵심 개념",
      "reason": "왜 어려워했을지 분석"
    }}
  ],
  "weak_concepts": ["개념1", "개념2"],
  "next_class_suggestions": [
    "다음 수업에서 보완해야 할 내용 1",
    "다음 수업에서 보완해야 할 내용 2"
  ]
}}"""
