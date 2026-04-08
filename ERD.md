# KIT-FeedA ERD (Entity Relationship Diagram)

> **Stack**: Supabase (PostgreSQL) + FastAPI  
> **Auth**: Supabase Auth (`auth.users`) → DB 트리거로 `public.profiles` 자동 생성  
> **Storage**: 대용량 파일(스크립트, 오디오)은 Supabase Storage에 저장, DB에는 경로(path)만 보관  
> **Realtime**: AI 비동기 작업 완료 이벤트는 Supabase Realtime 채널로 클라이언트에 push

---

## 설계 원칙

| 원칙 | 내용 |
|------|------|
| CASCADE DELETE | 부모 삭제 시 연관된 모든 자식 행 자동 삭제 |
| UNIQUE 제약 | 비즈니스 규칙을 DB 레벨에서 강제 (스케줄당 퀴즈 1개 등) |
| 다중 교수자 | `course_instructors` 중간 테이블 + `is_primary` 플래그 |
| 익명 퀴즈 | `student_id` DB에는 저장하되, `anonymous_enabled=true`이면 API 응답에서 마스킹 |
| 폴리모픽 참조 | `lms_distributions.material_type` enum으로 자료 유형 식별 |
| AI 비동기 상태 | `status` 컬럼 (pending → processing → completed / failed) |

---

## Mermaid ERD

```mermaid
erDiagram
    %% ──────────────────────────────────────
    %% 1. 사용자 (Supabase Auth 위임)
    %% ──────────────────────────────────────
    profiles {
        uuid id PK "auth.users.id와 동일"
        text name
        text email
        text role "INSTRUCTOR | STUDENT | ADMIN"
        text title "직책 (교수 등)"
        text profile_image_path
        timestamptz created_at
        timestamptz updated_at
    }

    %% ──────────────────────────────────────
    %% 2. 강의 관리
    %% ──────────────────────────────────────
    courses {
        uuid id PK
        text course_name
        text semester "YYYY-N 형식 (2026-1)"
        text[] day_of_week "MON|TUE|WED|THU|FRI|SAT"
        time start_time
        time end_time
        int max_students "기본 50"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    course_instructors {
        uuid id PK
        uuid course_id FK
        uuid instructor_id FK
        bool is_primary "대표 교수자 여부"
        timestamptz assigned_at
    }

    course_enrollments {
        uuid id PK
        uuid course_id FK
        uuid student_id FK
        text join_method "FILE | DIRECT | INVITE"
        timestamptz joined_at
    }

    course_invites {
        uuid id PK
        uuid course_id FK
        uuid created_by FK "초대 링크 생성자"
        text token UK "초대 토큰"
        timestamptz expires_at
        timestamptz created_at
    }

    course_schedules {
        uuid id PK
        uuid course_id FK
        int week_number "1~16"
        text topic
        date date "수업 날짜"
        text description
        timestamptz created_at
        timestamptz updated_at
    }

    lms_syncs {
        uuid id PK
        uuid course_id FK
        text lms_type "MOODLE|CANVAS|BLACKBOARD"
        text lms_course_id
        int synced_students
        timestamptz synced_at
    }

    %% ──────────────────────────────────────
    %% 4. 스크립트 분석 (사전 분석)
    %% ──────────────────────────────────────
    scripts {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK "nullable"
        text title
        text file_name
        int file_size
        text mime_type
        text content_path "Supabase Storage 경로"
        text slides_path "nullable (PPTX인 경우)"
        int week_number
        timestamptz uploaded_at
    }

    script_analyses {
        uuid id PK
        uuid script_id FK
        text analysis_type "logic | terminology | prerequisites"
        text status "pending|processing|completed|failed"
        jsonb result "분석 결과 (완료 시)"
        text error_message "실패 시"
        timestamptz started_at
        timestamptz completed_at
    }

    script_suggestions {
        uuid id PK
        uuid script_id FK
        text suggestion_type "difficulty | supplements"
        text status "pending|processing|completed|failed"
        jsonb result
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    script_reports {
        uuid id PK
        uuid script_id FK UK "스크립트당 1개"
        jsonb slides "슬라이드별 리포트"
        float overall_score
        timestamptz generated_at
    }

    %% ──────────────────────────────────────
    %% 5. 수업 피드백 (퀴즈)
    %% ──────────────────────────────────────
    quizzes {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK UK "스케줄당 1개"
        text status "generating|DRAFT|PUBLISHED|CLOSED"
        text difficulty_level "EASY|MEDIUM|HARD|MIXED"
        bool anonymous_enabled "기본 true"
        timestamptz expires_at
        timestamptz created_at
        timestamptz updated_at
    }

    quiz_questions {
        uuid id PK
        uuid quiz_id FK
        text question_type "MULTIPLE_CHOICE|TRUE_FALSE|SHORT_ANSWER"
        text difficulty "EASY|MEDIUM|HARD"
        text content
        jsonb options "선택지 배열"
        text answer
        int order_num
    }

    quiz_submissions {
        uuid id PK
        uuid quiz_id FK
        uuid student_id FK "anonymous_enabled=true여도 DB에 저장"
        float score
        int correct_count
        int total_count
        timestamptz submitted_at
    }

    quiz_submission_answers {
        uuid id PK
        uuid submission_id FK
        uuid question_id FK
        text selected_option
        bool is_correct
    }

    quiz_response_analyses {
        uuid id PK
        uuid quiz_id FK UK "퀴즈당 1개"
        text status "pending|processing|completed|failed"
        jsonb analyses "문항별 오답 분석"
        text[] weak_concepts
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    quiz_improvement_suggestions {
        uuid id PK
        uuid quiz_id FK UK "퀴즈당 1개"
        text status "pending|processing|completed|failed"
        jsonb suggestions
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    %% ──────────────────────────────────────
    %% 6. 자료 자동 생성
    %% ──────────────────────────────────────
    preview_guides {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK UK "스케줄당 1개"
        text status "generating|completed|failed"
        text[] key_concepts
        jsonb reading_materials
        text summary
        text error_message
        timestamptz created_at
        timestamptz completed_at
    }

    review_summaries {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK UK "스케줄당 1개"
        text status "generating|completed|failed"
        text content
        text[] key_points
        text error_message
        timestamptz created_at
        timestamptz completed_at
    }

    announcements {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK "nullable"
        text status "generating|completed|failed"
        text template_type "PREVIEW|REVIEW|GENERAL"
        text title
        text content
        text custom_message
        text error_message
        timestamptz created_at
        timestamptz completed_at
    }

    lms_distributions {
        uuid id PK
        uuid course_id FK
        text material_type "preview_guide|review_summary|announcement"
        uuid source_id "material_type에 따라 참조 테이블 결정"
        text target_lms "MOODLE|CANVAS|BLACKBOARD"
        text lms_section
        text status "COMPLETED|FAILED"
        text lms_url
        text error_message
        uuid distributed_by FK
        timestamptz distributed_at
    }

    audios {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK "nullable"
        text file_name
        int file_size
        text mime_type
        text storage_path "Supabase Storage 경로"
        text status "PROCESSING|COMPLETED|FAILED"
        int estimated_seconds
        timestamptz uploaded_at
    }

    audio_transcripts {
        uuid id PK
        uuid audio_id FK UK "오디오당 1개"
        text transcript "전체 텍스트"
        jsonb segments "시간별 구간 [{startTime, endTime, text}]"
        timestamptz completed_at
    }

    script_post_analyses {
        uuid id PK
        uuid script_id FK
        text analysis_type "structure | concepts"
        text status "pending|processing|completed|failed"
        jsonb result
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    %% ──────────────────────────────────────
    %% 7. 마감일 / 리마인더
    %% ──────────────────────────────────────
    deadlines {
        uuid id PK
        uuid course_id FK
        uuid schedule_id FK "nullable"
        text deadline_type "QUIZ|MATERIAL|ASSIGNMENT|CUSTOM"
        text title
        text description
        timestamptz due_at
        uuid created_by FK
        timestamptz created_at
    }

    reminder_settings {
        uuid id PK
        uuid user_id FK UK "사용자당 1개"
        text[] channels "EMAIL|PUSH|IN_APP|KAKAO"
        int[] hours_before "마감 N시간 전 알림 [24, 2]"
        bool quiz_notifications
        bool material_notifications
        timestamptz updated_at
    }

    reminders {
        uuid id PK
        uuid deadline_id FK
        uuid user_id FK
        text channel "EMAIL|PUSH|IN_APP|KAKAO"
        int hours_before
        text status "PENDING|SENT|FAILED"
        timestamptz scheduled_at
        timestamptz sent_at
    }

    %% ──────────────────────────────────────
    %% 9. 대시보드 (집계 캐시)
    %% ──────────────────────────────────────
    dashboard_snapshots {
        uuid id PK
        uuid course_id FK
        float average_accuracy "전체 평균 정답률"
        text[] weak_topics "취약 토픽 목록"
        int uploaded_weeks "스크립트 업로드된 주차 수"
        int total_weeks "전체 주차 수"
        jsonb weekly_stats "주차별 통계 캐시"
        timestamptz refreshed_at
    }

    %% ──────────────────────────────────────
    %% 10. 알림
    %% ──────────────────────────────────────
    notifications {
        uuid id PK
        uuid user_id FK
        text notification_type "QUIZ_PUBLISHED|MATERIAL_READY|REMINDER|SYSTEM"
        text title
        text body
        jsonb metadata "관련 리소스 정보 {courseId, quizId 등}"
        bool is_read
        timestamptz created_at
        timestamptz read_at
    }

    notification_settings {
        uuid id PK
        uuid user_id FK UK "사용자당 1개"
        bool email_enabled
        bool push_enabled
        bool in_app_enabled
        bool quiz_published
        bool material_ready
        bool deadline_reminder
        timestamptz updated_at
    }

    %% ──────────────────────────────────────
    %% 8. 학생 AI 시뮬레이션
    %% ──────────────────────────────────────
    ai_sim_contexts {
        uuid id PK
        uuid course_id FK
        text[] script_ids "참조 스크립트 ID 배열"
        text model "사용 소형 LLM (phi-3-mini 등)"
        int loaded_documents
        int total_tokens
        timestamptz created_at
    }

    ai_sim_simulations {
        uuid id PK
        uuid context_id FK
        text status "READY|RUNNING|COMPLETED"
        text knowledge_scope "DOCUMENT_ONLY"
        timestamptz created_at
    }

    ai_sim_assessments {
        uuid id PK
        uuid course_id FK
        uuid context_id FK
        text[] question_types "CONCEPT|APPLICATION|REASONING|CONNECTION"
        int count
        text status "pending|processing|completed|failed"
        jsonb questions "생성된 문항"
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    ai_sim_answers {
        uuid id PK
        uuid assessment_id FK UK "평가당 1개"
        uuid simulation_id FK
        text status "pending|processing|completed|failed"
        jsonb answers
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    ai_sim_grades {
        uuid id PK
        uuid assessment_id FK UK "평가당 1개"
        text status "pending|processing|completed|failed"
        float total_score
        jsonb grades "문항별 채점"
        text[] strengths
        text[] weaknesses
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    ai_sim_quality_reports {
        uuid id PK
        uuid assessment_id FK UK "평가당 1개"
        text status "pending|processing|completed|failed"
        float coverage_rate
        text[] sufficient_topics
        jsonb insufficient_topics
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    ai_sim_qa_pairs {
        uuid id PK
        uuid assessment_id FK UK "평가당 1개"
        text status "pending|processing|completed|failed"
        jsonb qa_pairs
        text error_message
        timestamptz started_at
        timestamptz completed_at
    }

    %% ──────────────────────────────────────
    %% 관계 정의
    %% ──────────────────────────────────────

    profiles ||--o{ course_instructors : "담당"
    profiles ||--o{ course_enrollments : "수강"
    profiles ||--o{ course_invites : "생성"
    profiles ||--o{ quiz_submissions : "제출"
    profiles ||--o{ lms_distributions : "배포"
    profiles ||--o{ deadlines : "생성"
    profiles ||--o{ reminders : "수신"
    profiles ||--|| reminder_settings : "설정"
    profiles ||--o{ notifications : "수신"
    profiles ||--|| notification_settings : "설정"

    courses ||--o{ course_instructors : "포함"
    courses ||--o{ course_enrollments : "포함"
    courses ||--o{ course_invites : "포함"
    courses ||--o{ course_schedules : "포함"
    courses ||--o{ lms_syncs : "동기화"
    courses ||--o{ scripts : "보유"
    courses ||--o{ quizzes : "보유"
    courses ||--o{ preview_guides : "보유"
    courses ||--o{ review_summaries : "보유"
    courses ||--o{ announcements : "보유"
    courses ||--o{ audios : "보유"
    courses ||--o{ deadlines : "보유"
    courses ||--|| dashboard_snapshots : "집계"
    courses ||--o{ lms_distributions : "배포"

    course_schedules ||--o{ scripts : "연관"
    course_schedules ||--o| quizzes : "1개"
    course_schedules ||--o| preview_guides : "1개"
    course_schedules ||--o| review_summaries : "1개"
    course_schedules ||--o{ announcements : "연관"
    course_schedules ||--o{ deadlines : "연관"
    course_schedules ||--o{ audios : "연관"

    scripts ||--o{ script_analyses : "분석"
    scripts ||--o{ script_suggestions : "제안"
    scripts ||--o| script_reports : "리포트"
    scripts ||--o{ script_post_analyses : "사후분석"

    quizzes ||--o{ quiz_questions : "문항"
    quizzes ||--o{ quiz_submissions : "제출"
    quizzes ||--o| quiz_response_analyses : "오답분석"
    quizzes ||--o| quiz_improvement_suggestions : "개선제안"

    quiz_submissions ||--o{ quiz_submission_answers : "답변"
    quiz_questions ||--o{ quiz_submission_answers : "대상"

    audios ||--o| audio_transcripts : "변환"

    deadlines ||--o{ reminders : "알림"

    courses ||--o{ ai_sim_contexts : "보유"
    courses ||--o{ ai_sim_assessments : "보유"
    ai_sim_contexts ||--o{ ai_sim_simulations : "파생"
    ai_sim_contexts ||--o{ ai_sim_assessments : "기반"
    ai_sim_assessments ||--o| ai_sim_answers : "답변"
    ai_sim_assessments ||--o| ai_sim_grades : "채점"
    ai_sim_assessments ||--o| ai_sim_quality_reports : "품질진단"
    ai_sim_assessments ||--o| ai_sim_qa_pairs : "Q&A"
```

---

## 테이블 상세 설명

### Section 1 — 사용자 (`profiles`)

Supabase `auth.users` 트리거로 자동 생성. `id`는 `auth.users.id`(UUID)와 동일.  
FastAPI는 JWT에서 `sub` 클레임을 추출하여 `profiles.id`와 매핑.

---

### Section 2 — 강의 관리

| 테이블 | 설명 |
|--------|------|
| `courses` | 강의 기본 정보 |
| `course_instructors` | 교수자↔강의 N:M. `is_primary=true`인 행이 대표 교수자. 강의 생성자는 자동 등록. |
| `course_enrollments` | 학생↔강의 N:M. `join_method`로 등록 경로 추적. |
| `course_invites` | 초대 링크 토큰. `expires_at` 초과 시 410 Gone 반환. |
| `course_schedules` | 주차별 일정. `date` 타입은 `DATE` (시간 불필요). |
| `lms_syncs` | LMS 동기화 이력. |

**UNIQUE 제약**
- `course_enrollments(course_id, student_id)` — 중복 수강 방지
- `course_instructors(course_id, instructor_id)` — 중복 배정 방지
- `course_invites(token)` — 토큰 유일성
- `course_schedules(course_id, week_number)` — 주차 중복 방지

---

### Section 4 — 스크립트 분석 (사전 분석)

| 테이블 | 설명 |
|--------|------|
| `scripts` | 업로드된 스크립트 메타. 실제 파일은 Supabase Storage에 저장 (`content_path`). |
| `script_analyses` | 4.2.x 비동기 분석 (논리흐름/전문용어/전제지식). `analysis_type` enum으로 구분. |
| `script_suggestions` | 4.3.x 비동기 제안 (난이도설명/보완문장). `suggestion_type` enum으로 구분. |
| `script_reports` | 4.3.3 슬라이드별 리포트. 스크립트당 1개 (UNIQUE). |

**비동기 패턴**: `status` 컬럼이 `processing` → Supabase Realtime 이벤트 → `completed` 로 전환.

---

### Section 5 — 수업 피드백 (퀴즈)

| 테이블 | 설명 |
|--------|------|
| `quizzes` | 스케줄당 1개 (UNIQUE on `schedule_id`). 생성 시 `status=generating`, AI 완료 시 `DRAFT`. |
| `quiz_questions` | 문항 목록. `options`는 JSONB 배열. |
| `quiz_submissions` | 학생 제출. `(quiz_id, student_id)` UNIQUE → 중복 제출 방지. `student_id`는 항상 저장하되 API 응답에서 마스킹. |
| `quiz_submission_answers` | 문항별 답변. |
| `quiz_response_analyses` | 5.3.2 오답률 분석. 퀴즈당 1개 (UNIQUE). |
| `quiz_improvement_suggestions` | 5.3.3 개선 제안. 퀴즈당 1개 (UNIQUE). |

---

### Section 6 — 자료 자동 생성

| 테이블 | 설명 |
|--------|------|
| `preview_guides` | 예습 가이드. 스케줄당 1개 (UNIQUE). `status=generating` → Realtime → `completed`. |
| `review_summaries` | 복습 요약본. 스케줄당 1개 (UNIQUE). |
| `announcements` | 공지문. 과목당 N개 가능. |
| `lms_distributions` | LMS 배포 이력. `material_type + source_id` 조합으로 자료 식별 (폴리모픽). 참조 무결성은 앱 레이어에서 강제. |
| `audios` | 업로드된 오디오. 실제 파일은 Storage. |
| `audio_transcripts` | 오디오당 1개 (UNIQUE). `segments` JSONB로 타임스탬프별 텍스트 저장. |
| `script_post_analyses` | 6.6.x 사후 분석 (structure/concepts). `analysis_type` enum으로 구분. |

---

### Section 7 — 마감일 / 리마인더

| 테이블 | 설명 |
|--------|------|
| `deadlines` | 퀴즈 마감, 자료 제출, 과제 등 마감 일정. `deadline_type` enum. |
| `reminder_settings` | 사용자별 알림 채널 및 사전 알림 시간 설정. 사용자당 1행 (UNIQUE). |
| `reminders` | 발송 예약된 리마인더. `status: PENDING → SENT`. 백그라운드 작업(cron)이 `due_at - hours_before`에 발송. |

---

### Section 9 — 대시보드

| 테이블 | 설명 |
|--------|------|
| `dashboard_snapshots` | 과목별 집계 데이터 캐시. 퀴즈 제출/완료 이벤트마다 갱신. `weekly_stats` JSONB에 주차별 정답률, 업로드 현황 저장. |

> 실시간 집계 대신 캐시 테이블을 두어 대시보드 조회 성능 확보.  
> 퀴즈 `status = CLOSED` 이벤트 또는 자료 생성 완료 이벤트 트리거로 갱신.

---

### Section 10 — 알림

| 테이블 | 설명 |
|--------|------|
| `notifications` | 인앱 알림. `notification_type` enum. `metadata` JSONB에 딥링크용 리소스 ID 저장. |
| `notification_settings` | 사용자별 알림 채널 및 유형 ON/OFF. 사용자당 1행 (UNIQUE). |

---

## 주요 UNIQUE 제약 정리

| 테이블 | 컬럼 | 비즈니스 규칙 |
|--------|------|---------------|
| `course_enrollments` | `(course_id, student_id)` | 중복 수강 방지 |
| `course_instructors` | `(course_id, instructor_id)` | 중복 배정 방지 |
| `course_invites` | `token` | 토큰 유일성 |
| `course_schedules` | `(course_id, week_number)` | 주차 중복 방지 |
| `quizzes` | `schedule_id` | 스케줄당 퀴즈 1개 |
| `quiz_submissions` | `(quiz_id, student_id)` | 중복 제출 방지 |
| `quiz_response_analyses` | `quiz_id` | 퀴즈당 오답분석 1개 |
| `quiz_improvement_suggestions` | `quiz_id` | 퀴즈당 개선제안 1개 |
| `script_reports` | `script_id` | 스크립트당 리포트 1개 |
| `preview_guides` | `schedule_id` | 스케줄당 예습가이드 1개 |
| `review_summaries` | `schedule_id` | 스케줄당 복습요약 1개 |
| `audio_transcripts` | `audio_id` | 오디오당 변환결과 1개 |
| `reminder_settings` | `user_id` | 사용자당 설정 1개 |
| `notification_settings` | `user_id` | 사용자당 설정 1개 |
| `dashboard_snapshots` | `course_id` | 과목당 스냅샷 1개 |
| `ai_sim_answers` | `assessment_id` | 평가당 답변 1개 |
| `ai_sim_grades` | `assessment_id` | 평가당 채점 1개 |
| `ai_sim_quality_reports` | `assessment_id` | 평가당 품질진단 1개 |
| `ai_sim_qa_pairs` | `assessment_id` | 평가당 Q&A 1개 |

---

## CASCADE 삭제 체인

```
courses
├── course_instructors       (CASCADE)
├── course_enrollments       (CASCADE)
├── course_invites           (CASCADE)
├── course_schedules         (CASCADE)
│   ├── quizzes              (CASCADE)
│   │   ├── quiz_questions   (CASCADE)
│   │   ├── quiz_submissions (CASCADE)
│   │   │   └── quiz_submission_answers (CASCADE)
│   │   ├── quiz_response_analyses      (CASCADE)
│   │   └── quiz_improvement_suggestions (CASCADE)
│   ├── preview_guides       (CASCADE)
│   ├── review_summaries     (CASCADE)
│   └── deadlines            (CASCADE)
│       └── reminders        (CASCADE)
├── scripts                  (CASCADE)
│   ├── script_analyses      (CASCADE)
│   ├── script_suggestions   (CASCADE)
│   ├── script_reports       (CASCADE)
│   └── script_post_analyses (CASCADE)
├── audios                   (CASCADE)
│   └── audio_transcripts    (CASCADE)
├── announcements            (CASCADE)
├── lms_distributions        (CASCADE)
├── lms_syncs                (CASCADE)
├── dashboard_snapshots      (CASCADE)
└── ai_sim_contexts          (CASCADE)
    ├── ai_sim_simulations   (CASCADE)
    └── ai_sim_assessments   (CASCADE)
        ├── ai_sim_answers         (CASCADE)
        ├── ai_sim_grades          (CASCADE)
        ├── ai_sim_quality_reports (CASCADE)
        └── ai_sim_qa_pairs        (CASCADE)

profiles
├── reminder_settings        (CASCADE)
├── notification_settings    (CASCADE)
└── notifications            (CASCADE)
```

---

## 섹션별 테이블 매핑 요약

| API 섹션 | 주요 테이블 |
|----------|-------------|
| 1. 인증 | Supabase `auth.users` → `profiles` (트리거) |
| 2. 사용자 관리 | `profiles` |
| 3. 강의 관리 | `courses`, `course_instructors`, `course_enrollments`, `course_invites`, `course_schedules`, `lms_syncs` |
| 4. 스크립트 분석 | `scripts`, `script_analyses`, `script_suggestions`, `script_reports` |
| 5. 수업 피드백 | `quizzes`, `quiz_questions`, `quiz_submissions`, `quiz_submission_answers`, `quiz_response_analyses`, `quiz_improvement_suggestions` |
| 6. 자료 자동 생성 | `preview_guides`, `review_summaries`, `announcements`, `lms_distributions`, `audios`, `audio_transcripts`, `script_post_analyses` |
| 7. 마감일/리마인더 | `deadlines`, `reminder_settings`, `reminders` |
| 8. AI 시뮬레이션 | `ai_sim_contexts`, `ai_sim_simulations`, `ai_sim_assessments`, `ai_sim_answers`, `ai_sim_grades`, `ai_sim_quality_reports`, `ai_sim_qa_pairs` |
| 9. 대시보드 | `dashboard_snapshots` |
| 10. 알림 | `notifications`, `notification_settings` |
