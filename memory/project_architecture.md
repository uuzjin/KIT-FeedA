---
name: Architecture and Tech Stack
description: Full stack details — DB, API, frontend, AI integrations, key architectural decisions
type: project
---

**Database:** 52 Supabase PostgreSQL tables. Key tables: profiles, courses, course_enrollments, course_invites, course_schedules, scripts/script_analyses, quizzes/quiz_questions/quiz_submissions, preview_guides, review_summaries, announcements, audios, notifications, reminders, dashboard_snapshots, ai_sim_* (7 tables).

**Backend (FastAPI):** 13 router files, 83+ endpoints. Located at `/backend/app/routers/`. Core modules: `ai.py` (Gemini/Claude), `storage.py` (Supabase Storage), `text_extract.py` (PDF/PPTX/DOCX), `scheduler.py` (APScheduler reminders), `lms_client.py` (stubbed LMS APIs).

**Frontend (Next.js):** App Router, 14 pages, 40+ components. Central API client at `frontend/lib/api.ts` (1332 lines). Auth via `contexts/auth-context.tsx` (Supabase Auth). Workspace state via `frontend/lib/course-workspace.ts`.

**AI Models:** Large (Gemini/Claude via google-genai) for quiz gen, analysis, grading. Small (Phi-3/TinyLlama) for AI student simulation context.

**Correct API URL patterns (critical):**
- Preview guides: `/api/courses/{courseId}/schedules/{scheduleId}/preview-guides`
- Review summaries: `/api/courses/{courseId}/schedules/{scheduleId}/review-summaries`
- NOT via `/api/courses/{courseId}/materials/preview` (old/wrong)

**How to apply:** Always route material generation through the backend API (not direct Supabase calls). Use per-schedule endpoints for preview/review content.
