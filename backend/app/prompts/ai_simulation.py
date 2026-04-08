"""Phase 5 — 학생 AI 시뮬레이션 프롬프트.

5-2  문항 생성     : assessment_user       (대형 LLM)
5-3  AI 학생 답변  : student_answer_user   (소형 LLM, DOCUMENT_ONLY)
5-4a 채점          : grading_user          (대형 LLM)
5-4b 품질 진단     : quality_report_user   (대형 LLM)
5-5  Q&A 생성      : qa_pairs_user         (대형 LLM)
"""

# ── 5-2. 문항 생성 (대형 LLM) ────────────────────────────────────────────────

ASSESSMENT_SYSTEM = """당신은 대학 강의 자료를 기반으로 학생의 학습 목표 달성 여부를 평가하는 문항을 만드는 교육 전문가입니다.
제공된 강의 자료에 있는 내용만을 근거로 문항을 생성하고, 반드시 JSON 형식으로만 응답하세요."""


def assessment_user(script_text: str, question_types: list[str], count: int) -> str:
    types_str = ", ".join(question_types) if question_types else "CONCEPT, APPLICATION, REASONING, CONNECTION"
    return f"""다음 강의 자료를 바탕으로 학생 이해도 평가 문항 {count}개를 생성해주세요.

[강의 자료]
{script_text[:15000]}

[문항 유형 설명]
- CONCEPT     : 핵심 개념의 정의·설명·특징 확인
- APPLICATION : 개념을 실제 상황·예시에 적용
- REASONING   : 원인-결과, 비교·대조, 논리적 추론
- CONNECTION  : 여러 개념 간 연결 및 통합적 이해

[요청 유형]
{types_str}

다음 JSON 형식으로 응답하세요:
{{
  "questions": [
    {{
      "questionId": "q_1",
      "type": "CONCEPT|APPLICATION|REASONING|CONNECTION",
      "content": "문항 내용 (서술형 질문)",
      "expectedAnswer": "모범 답안 (핵심 내용 포함 서술)"
    }}
  ]
}}

주의:
- 반드시 강의 자료에 근거한 문항만 생성하세요.
- questionId는 q_1, q_2, q_3 … 형식으로 순서대로 부여하세요.
- 요청한 유형을 고르게 배분하세요 (유형 수보다 문항 수가 많으면 균등 반복)."""


# ── 5-3. AI 학생 답변 (소형 LLM, DOCUMENT_ONLY) ──────────────────────────────

STUDENT_ANSWER_SYSTEM = """당신은 아래에 제공되는 강의 자료만을 학습한 학생입니다.
다음 규칙을 반드시 준수하세요:
1. 오직 [강의 자료] 섹션의 내용만을 근거로 답변하세요.
2. 강의 자료에 없는 배경 지식, 상식, 또는 추론은 사용하지 마세요.
3. 자료에서 관련 내용을 찾을 수 없으면 "자료에 해당 내용이 없습니다."라고 답하세요.
4. 반드시 JSON 형식으로만 응답하세요."""


def student_answer_user(script_text: str, questions: list[dict]) -> str:
    questions_str = "\n".join(
        f"문항 {q.get('questionId', f'q_{i+1}')}: {q.get('content', '')}"
        for i, q in enumerate(questions)
    )
    return f"""[강의 자료 — 이 자료만을 참조하여 답변하세요]
{script_text[:20000]}

[답변할 문항]
{questions_str}

다음 JSON 형식으로 답변하세요:
{{
  "answers": [
    {{
      "questionId": "q_1",
      "answer": "자료에 근거한 답변",
      "confidence": "HIGH|MEDIUM|LOW",
      "referencedSection": "답변의 근거가 된 자료 구절 (원문 인용 또는 요약)"
    }}
  ]
}}

주의: confidence는 자료에서 근거를 얼마나 명확히 찾을 수 있는지를 기준으로 설정하세요."""


# ── 5-4a. 채점 (대형 LLM) ────────────────────────────────────────────────────

GRADING_SYSTEM = """당신은 AI 학생의 답변을 모범 답안과 비교하여 공정하게 채점하는 교육 전문가입니다.
채점 결과를 통해 AI 학생(= 강의 자료)이 어떤 개념을 잘 설명하고 어떤 개념이 부족한지 진단합니다.
반드시 JSON 형식으로만 응답하세요."""


def grading_user(questions: list[dict], answers: list[dict]) -> str:
    answer_map = {a.get("questionId", ""): a for a in answers}
    items = []
    for q in questions:
        qid = q.get("questionId", "")
        a = answer_map.get(qid, {})
        items.append(
            f"─── {qid} ───\n"
            f"문항    : {q.get('content', '')}\n"
            f"모범답안: {q.get('expectedAnswer', '')}\n"
            f"AI답변  : {a.get('answer', '(답변 없음)')}\n"
            f"근거구절: {a.get('referencedSection', '(없음)')}"
        )
    items_str = "\n\n".join(items)

    return f"""다음 문항별 모범 답안과 AI 학생 답변을 비교하여 채점하세요.

{items_str}

[채점 기준]
- 90~100점: 핵심 개념 완전 이해, 모범 답안과 일치
- 70~89점 : 대체로 이해, 일부 표현 누락
- 40~69점 : 부분적 이해, 중요 내용 누락
-  0~39점 : 이해 부족 또는 오류

다음 JSON 형식으로 응답하세요:
{{
  "total_score": 75.0,
  "grades": [
    {{
      "questionId": "q_1",
      "score": 80,
      "feedback": "채점 피드백 (구체적으로)",
      "is_correct": true
    }}
  ],
  "strengths": ["강의 자료가 잘 설명한 개념1", "개념2"],
  "weaknesses": ["강의 자료에서 부족하거나 불명확했던 개념1", "개념2"]
}}

주의: strengths/weaknesses는 AI 학생이 아닌 강의 자료 품질을 기준으로 작성하세요."""


# ── 5-4b. 품질 진단 리포트 (대형 LLM) ───────────────────────────────────────

QUALITY_REPORT_SYSTEM = """당신은 강의 자료의 학습 충분성을 진단하는 교육 품질 전문가입니다.
AI 학생의 채점 결과를 분석하여, 이 강의 자료만으로 학생이 이해할 수 있는 범위와 부족한 부분을 보고합니다.
반드시 JSON 형식으로만 응답하세요."""


def quality_report_user(
    script_text: str,
    grades: list[dict],
    weaknesses: list[str],
) -> str:
    weakness_str = (
        "\n".join(f"- {w}" for w in weaknesses)
        if weaknesses
        else "- (채점 결과 없음 — 자료 자체를 분석하여 판단)"
    )
    grades_summary = "\n".join(
        f"  {g.get('questionId', '?')}: {g.get('score', '?')}점 — {g.get('feedback', '')}"
        for g in grades
    ) if grades else "  (채점 결과 없음)"

    return f"""강의 자료와 AI 학생 채점 결과를 바탕으로 자료 품질을 진단해주세요.

[강의 자료 (앞 6000자)]
{script_text[:6000]}

[채점 결과 요약]
{grades_summary}

[AI 학생이 어려워한 개념 (= 자료 취약 부분)]
{weakness_str}

다음 JSON 형식으로 응답하세요:
{{
  "coverage_rate": 72.5,
  "sufficient_topics": [
    "이 자료만으로 충분히 이해 가능한 주제1",
    "주제2"
  ],
  "insufficient_topics": [
    {{
      "topic": "자료가 부족하거나 불명확한 주제",
      "reason": "왜 부족한지 (설명 누락, 예시 없음 등)",
      "suggestion": "보완을 위한 구체적 제안"
    }}
  ]
}}

coverage_rate: AI 학생이 자료만으로 답변 가능했던 문항 비율(%) 추정치."""


# ── 5-5. 핵심 Q&A 생성 (대형 LLM) ───────────────────────────────────────────

QA_PAIRS_SYSTEM = """당신은 강의 자료를 분석하여 학생들이 가장 궁금해할 핵심 질문과 모범 답변을 생성하는 교육 전문가입니다.
특히 AI 학생 채점에서 취약한 것으로 판정된 개념에 집중하여 보완적 Q&A를 제공하세요.
반드시 JSON 형식으로만 응답하세요."""


def qa_pairs_user(script_text: str, weaknesses: list[str]) -> str:
    weakness_str = (
        "\n".join(f"- {w}" for w in weaknesses)
        if weaknesses
        else "- (취약 개념 정보 없음 — 강의 핵심 내용 전반을 다루세요)"
    )
    return f"""다음 강의 자료와 취약 개념 목록을 바탕으로 핵심 Q&A를 생성해주세요.

[강의 자료]
{script_text[:10000]}

[보완이 필요한 취약 개념]
{weakness_str}

취약 개념을 우선적으로 다루되, 강의 전반의 핵심 내용을 포괄하는 Q&A를 생성하세요.
최소 5개 이상 생성하세요.

다음 JSON 형식으로 응답하세요:
{{
  "qa_pairs": [
    {{
      "question": "예측 질문 (학생 관점)",
      "answer": "모범 답변 (강의 자료 기반)",
      "topic": "관련 주제",
      "importance": "HIGH|MEDIUM|LOW"
    }}
  ]
}}

importance: HIGH = 취약 개념·핵심 내용, MEDIUM = 중요 내용, LOW = 심화·보충 내용."""
