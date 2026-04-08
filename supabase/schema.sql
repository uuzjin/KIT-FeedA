-- ============================================================
-- FeedA — Supabase PostgreSQL Schema
-- Supabase SQL Editor에서 순서대로 실행하세요.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 0. 확장
-- ────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────────────────────
-- 1. 사용자 (Supabase Auth 위임)
-- ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
    id               uuid primary key references auth.users(id) on delete cascade,
    name             text not null,
    email            text not null,
    role             text not null check (role in ('INSTRUCTOR', 'STUDENT', 'ADMIN')),
    title            text,
    profile_image_path text,
    deleted_at       timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

-- auth.users 생성 시 profiles 자동 생성 트리거
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    insert into public.profiles (id, name, email, role)
    values (
        new.id,
        coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
        new.email,
        coalesce(new.raw_user_meta_data->>'role', 'STUDENT')
    );
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────────────────────
-- 2. 강의 관리
-- ────────────────────────────────────────────────────────────
create table if not exists public.courses (
    id           uuid primary key default uuid_generate_v4(),
    course_name  text not null,
    semester     text not null,
    day_of_week  text[] not null default '{}',
    start_time   time,
    end_time     time,
    max_students integer not null default 50,
    description  text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create table if not exists public.course_instructors (
    id            uuid primary key default uuid_generate_v4(),
    course_id     uuid not null references public.courses(id) on delete cascade,
    instructor_id uuid not null references public.profiles(id) on delete cascade,
    is_primary    boolean not null default false,
    assigned_at   timestamptz not null default now(),
    unique (course_id, instructor_id)
);

create table if not exists public.course_enrollments (
    id          uuid primary key default uuid_generate_v4(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    student_id  uuid not null references public.profiles(id) on delete cascade,
    join_method text not null check (join_method in ('FILE', 'DIRECT', 'INVITE')),
    joined_at   timestamptz not null default now(),
    unique (course_id, student_id)
);

create table if not exists public.course_invites (
    id          uuid primary key default uuid_generate_v4(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    created_by  uuid not null references public.profiles(id) on delete cascade,
    token       text not null unique,
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now()
);

create table if not exists public.course_schedules (
    id          uuid primary key default uuid_generate_v4(),
    course_id   uuid not null references public.courses(id) on delete cascade,
    week_number integer not null check (week_number between 1 and 16),
    topic       text not null,
    date        date,
    description text,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (course_id, week_number)
);

create table if not exists public.lms_syncs (
    id              uuid primary key default uuid_generate_v4(),
    course_id       uuid not null references public.courses(id) on delete cascade,
    lms_type        text not null check (lms_type in ('MOODLE', 'CANVAS', 'BLACKBOARD')),
    lms_course_id   text not null,
    synced_students integer not null default 0,
    synced_at       timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 4. 스크립트 분석
-- ────────────────────────────────────────────────────────────
create table if not exists public.scripts (
    id            uuid primary key default uuid_generate_v4(),
    course_id     uuid not null references public.courses(id) on delete cascade,
    schedule_id   uuid references public.course_schedules(id) on delete set null,
    title         text not null,
    file_name     text not null,
    file_size     integer not null,
    mime_type     text not null,
    content_path  text not null,
    slides_path   text,
    week_number   integer,
    uploaded_at   timestamptz not null default now()
);

create table if not exists public.script_analyses (
    id            uuid primary key default uuid_generate_v4(),
    script_id     uuid not null references public.scripts(id) on delete cascade,
    analysis_type text not null check (analysis_type in ('logic', 'terminology', 'prerequisites')),
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    result        jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

create table if not exists public.script_suggestions (
    id              uuid primary key default uuid_generate_v4(),
    script_id       uuid not null references public.scripts(id) on delete cascade,
    suggestion_type text not null check (suggestion_type in ('difficulty', 'supplements')),
    status          text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    result          jsonb,
    error_message   text,
    started_at      timestamptz,
    completed_at    timestamptz
);

create table if not exists public.script_reports (
    id           uuid primary key default uuid_generate_v4(),
    script_id    uuid not null references public.scripts(id) on delete cascade unique,
    slides       jsonb not null default '[]',
    overall_score float,
    generated_at timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 5. 수업 피드백 (퀴즈)
-- ────────────────────────────────────────────────────────────
create table if not exists public.quizzes (
    id               uuid primary key default uuid_generate_v4(),
    course_id        uuid not null references public.courses(id) on delete cascade,
    schedule_id      uuid references public.course_schedules(id) on delete set null unique,
    status           text not null default 'generating' check (status in ('generating', 'DRAFT', 'PUBLISHED', 'CLOSED')),
    difficulty_level text not null default 'MIXED' check (difficulty_level in ('EASY', 'MEDIUM', 'HARD', 'MIXED')),
    anonymous_enabled boolean not null default true,
    expires_at       timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists public.quiz_questions (
    id            uuid primary key default uuid_generate_v4(),
    quiz_id       uuid not null references public.quizzes(id) on delete cascade,
    question_type text not null check (question_type in ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER')),
    difficulty    text not null check (difficulty in ('EASY', 'MEDIUM', 'HARD')),
    content       text not null,
    options       jsonb not null default '[]',
    answer        text not null,
    order_num     integer not null
);

create table if not exists public.quiz_submissions (
    id            uuid primary key default uuid_generate_v4(),
    quiz_id       uuid not null references public.quizzes(id) on delete cascade,
    student_id    uuid not null references public.profiles(id) on delete cascade,
    score         float not null default 0,
    correct_count integer not null default 0,
    total_count   integer not null default 0,
    submitted_at  timestamptz not null default now(),
    unique (quiz_id, student_id)
);

create table if not exists public.quiz_submission_answers (
    id              uuid primary key default uuid_generate_v4(),
    submission_id   uuid not null references public.quiz_submissions(id) on delete cascade,
    question_id     uuid not null references public.quiz_questions(id) on delete cascade,
    selected_option text,
    is_correct      boolean not null default false
);

create table if not exists public.quiz_response_analyses (
    id            uuid primary key default uuid_generate_v4(),
    quiz_id       uuid not null references public.quizzes(id) on delete cascade unique,
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    analyses      jsonb,
    weak_concepts text[],
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

create table if not exists public.quiz_improvement_suggestions (
    id            uuid primary key default uuid_generate_v4(),
    quiz_id       uuid not null references public.quizzes(id) on delete cascade unique,
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    suggestions   jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 6. 자료 자동 생성
-- ────────────────────────────────────────────────────────────
create table if not exists public.preview_guides (
    id            uuid primary key default uuid_generate_v4(),
    course_id     uuid not null references public.courses(id) on delete cascade,
    schedule_id   uuid references public.course_schedules(id) on delete set null unique,
    title         text,
    status        text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
    key_concepts  text[] not null default '{}',
    reading_materials jsonb not null default '[]',
    summary       text,
    error_message text,
    created_at    timestamptz not null default now(),
    completed_at  timestamptz
);

create table if not exists public.review_summaries (
    id            uuid primary key default uuid_generate_v4(),
    course_id     uuid not null references public.courses(id) on delete cascade,
    schedule_id   uuid references public.course_schedules(id) on delete set null unique,
    title         text,
    status        text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
    content       text,
    key_points    text[] not null default '{}',
    error_message text,
    created_at    timestamptz not null default now(),
    completed_at  timestamptz
);

create table if not exists public.announcements (
    id             uuid primary key default uuid_generate_v4(),
    course_id      uuid not null references public.courses(id) on delete cascade,
    schedule_id    uuid references public.course_schedules(id) on delete set null,
    status         text not null default 'generating' check (status in ('generating', 'completed', 'failed')),
    template_type  text not null check (template_type in ('PREVIEW', 'REVIEW', 'GENERAL')),
    title          text,
    content        text,
    custom_message text,
    error_message  text,
    created_at     timestamptz not null default now(),
    completed_at   timestamptz
);

create table if not exists public.lms_distributions (
    id             uuid primary key default uuid_generate_v4(),
    course_id      uuid not null references public.courses(id) on delete cascade,
    material_type  text not null check (material_type in ('preview_guide', 'review_summary', 'announcement')),
    source_id      uuid not null,
    target_lms     text not null check (target_lms in ('MOODLE', 'CANVAS', 'BLACKBOARD')),
    lms_section    text,
    status         text not null check (status in ('COMPLETED', 'FAILED')),
    lms_url        text,
    error_message  text,
    distributed_by uuid not null references public.profiles(id) on delete cascade,
    distributed_at timestamptz not null default now()
);

create table if not exists public.audios (
    id               uuid primary key default uuid_generate_v4(),
    course_id        uuid not null references public.courses(id) on delete cascade,
    schedule_id      uuid references public.course_schedules(id) on delete set null,
    file_name        text not null,
    file_size        integer not null,
    mime_type        text not null,
    storage_path     text not null,
    status           text not null default 'PROCESSING' check (status in ('PROCESSING', 'COMPLETED', 'FAILED')),
    estimated_seconds integer not null default 120,
    uploaded_at      timestamptz not null default now()
);

create table if not exists public.audio_transcripts (
    id           uuid primary key default uuid_generate_v4(),
    audio_id     uuid not null references public.audios(id) on delete cascade unique,
    transcript   text not null,
    segments     jsonb not null default '[]',
    completed_at timestamptz not null default now()
);

create table if not exists public.script_post_analyses (
    id            uuid primary key default uuid_generate_v4(),
    script_id     uuid not null references public.scripts(id) on delete cascade,
    analysis_type text not null check (analysis_type in ('structure', 'concepts')),
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    result        jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 7. 마감일 / 리마인더
-- ────────────────────────────────────────────────────────────
create table if not exists public.deadlines (
    id            uuid primary key default uuid_generate_v4(),
    course_id     uuid not null references public.courses(id) on delete cascade,
    schedule_id   uuid references public.course_schedules(id) on delete set null,
    deadline_type text not null check (deadline_type in ('QUIZ', 'MATERIAL', 'ASSIGNMENT', 'CUSTOM')),
    title         text not null,
    description   text,
    due_at        timestamptz not null,
    created_by    uuid not null references public.profiles(id) on delete cascade,
    created_at    timestamptz not null default now()
);

create table if not exists public.reminder_settings (
    id                    uuid primary key default uuid_generate_v4(),
    user_id               uuid not null references public.profiles(id) on delete cascade unique,
    channels              text[] not null default '{"EMAIL"}',
    hours_before          integer[] not null default '{24}',
    quiz_notifications    boolean not null default true,
    material_notifications boolean not null default true,
    updated_at            timestamptz not null default now()
);

create table if not exists public.reminders (
    id           uuid primary key default uuid_generate_v4(),
    deadline_id  uuid not null references public.deadlines(id) on delete cascade,
    user_id      uuid not null references public.profiles(id) on delete cascade,
    channel      text not null check (channel in ('EMAIL', 'PUSH', 'IN_APP', 'KAKAO')),
    hours_before integer not null,
    status       text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
    scheduled_at timestamptz not null,
    sent_at      timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 8. 학생 AI 시뮬레이션
-- ────────────────────────────────────────────────────────────
create table if not exists public.ai_sim_contexts (
    id               uuid primary key default uuid_generate_v4(),
    course_id        uuid not null references public.courses(id) on delete cascade,
    script_ids       text[] not null default '{}',
    model            text not null,
    loaded_documents integer not null default 0,
    total_tokens     integer not null default 0,
    created_at       timestamptz not null default now()
);

create table if not exists public.ai_sim_simulations (
    id              uuid primary key default uuid_generate_v4(),
    context_id      uuid not null references public.ai_sim_contexts(id) on delete cascade,
    status          text not null default 'READY' check (status in ('READY', 'RUNNING', 'COMPLETED')),
    knowledge_scope text not null default 'DOCUMENT_ONLY',
    created_at      timestamptz not null default now()
);

create table if not exists public.ai_sim_assessments (
    id             uuid primary key default uuid_generate_v4(),
    course_id      uuid not null references public.courses(id) on delete cascade,
    context_id     uuid not null references public.ai_sim_contexts(id) on delete cascade,
    question_types text[] not null default '{}',
    count          integer not null default 5,
    status         text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    questions      jsonb,
    error_message  text,
    started_at     timestamptz,
    completed_at   timestamptz
);

create table if not exists public.ai_sim_answers (
    id            uuid primary key default uuid_generate_v4(),
    assessment_id uuid not null references public.ai_sim_assessments(id) on delete cascade unique,
    simulation_id uuid not null references public.ai_sim_simulations(id) on delete cascade,
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    answers       jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

create table if not exists public.ai_sim_grades (
    id            uuid primary key default uuid_generate_v4(),
    assessment_id uuid not null references public.ai_sim_assessments(id) on delete cascade unique,
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    total_score   float,
    grades        jsonb,
    strengths     text[] not null default '{}',
    weaknesses    text[] not null default '{}',
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

create table if not exists public.ai_sim_quality_reports (
    id                 uuid primary key default uuid_generate_v4(),
    assessment_id      uuid not null references public.ai_sim_assessments(id) on delete cascade unique,
    status             text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    coverage_rate      float,
    sufficient_topics  text[] not null default '{}',
    insufficient_topics jsonb,
    error_message      text,
    started_at         timestamptz,
    completed_at       timestamptz
);

create table if not exists public.ai_sim_qa_pairs (
    id            uuid primary key default uuid_generate_v4(),
    assessment_id uuid not null references public.ai_sim_assessments(id) on delete cascade unique,
    status        text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
    qa_pairs      jsonb,
    error_message text,
    started_at    timestamptz,
    completed_at  timestamptz
);

-- ────────────────────────────────────────────────────────────
-- 9. 대시보드 (집계 캐시)
-- ────────────────────────────────────────────────────────────
create table if not exists public.dashboard_snapshots (
    id               uuid primary key default uuid_generate_v4(),
    course_id        uuid not null references public.courses(id) on delete cascade unique,
    average_accuracy float not null default 0,
    weak_topics      jsonb not null default '[]',
    uploaded_weeks   integer not null default 0,
    total_weeks      integer not null default 16,
    weekly_stats     jsonb not null default '[]',
    refreshed_at     timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 10. 알림
-- ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
    id                uuid primary key default uuid_generate_v4(),
    user_id           uuid not null references public.profiles(id) on delete cascade,
    notification_type text not null check (notification_type in ('QUIZ_PUBLISHED', 'MATERIAL_READY', 'REMINDER', 'SYSTEM')),
    title             text not null,
    body              text not null,
    metadata          jsonb not null default '{}',
    is_read           boolean not null default false,
    created_at        timestamptz not null default now(),
    read_at           timestamptz
);

create table if not exists public.notification_settings (
    id                  uuid primary key default uuid_generate_v4(),
    user_id             uuid not null references public.profiles(id) on delete cascade unique,
    email_enabled       boolean not null default true,
    push_enabled        boolean not null default true,
    in_app_enabled      boolean not null default true,
    kakao_enabled       boolean not null default false,
    kakao_verified_at   timestamptz,
    quiz_published      boolean not null default true,
    material_ready      boolean not null default true,
    deadline_reminder   boolean not null default true,
    updated_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- RLS (Row Level Security)
-- ────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.course_instructors enable row level security;
alter table public.course_enrollments enable row level security;
alter table public.course_schedules enable row level security;
alter table public.scripts enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_submissions enable row level security;
alter table public.preview_guides enable row level security;
alter table public.review_summaries enable row level security;
alter table public.announcements enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_settings enable row level security;

-- profiles: 본인만 조회/수정
create policy "profiles: 본인 조회" on public.profiles
    for select using (auth.uid() = id);
create policy "profiles: 본인 수정" on public.profiles
    for update using (auth.uid() = id);

-- courses: 수강 중이거나 담당 강사인 경우 조회
create policy "courses: 관련자 조회" on public.courses
    for select using (
        exists (select 1 from public.course_instructors where course_id = courses.id and instructor_id = auth.uid())
        or
        exists (select 1 from public.course_enrollments where course_id = courses.id and student_id = auth.uid())
    );
create policy "courses: 강사 생성" on public.courses
    for insert with check (
        exists (select 1 from public.profiles where id = auth.uid() and role = 'INSTRUCTOR')
    );
create policy "courses: 담당 강사 수정" on public.courses
    for update using (
        exists (select 1 from public.course_instructors where course_id = courses.id and instructor_id = auth.uid())
    );
create policy "courses: 담당 강사 삭제" on public.courses
    for delete using (
        exists (select 1 from public.course_instructors where course_id = courses.id and instructor_id = auth.uid() and is_primary = true)
    );

-- notifications: 본인 알림만 조회
create policy "notifications: 본인 조회" on public.notifications
    for select using (user_id = auth.uid());
create policy "notifications: 본인 수정(읽음 처리)" on public.notifications
    for update using (user_id = auth.uid());

-- notification_settings: 본인 설정만
create policy "notification_settings: 본인 조회" on public.notification_settings
    for select using (user_id = auth.uid());
create policy "notification_settings: 본인 수정" on public.notification_settings
    for all using (user_id = auth.uid());

-- quiz_submissions: 학생 본인 제출 + 담당 강사 조회
create policy "quiz_submissions: 학생 본인 조회" on public.quiz_submissions
    for select using (student_id = auth.uid());
create policy "quiz_submissions: 학생 제출" on public.quiz_submissions
    for insert with check (student_id = auth.uid());
