---
name: Development Roadmap
description: Gap analysis, critical blockers, and phased milestones to reach 100% feature completion
type: project
---

**Current status (as of 2026-04-13):** Backend ~95% complete (83+ endpoints, 13 router files). Frontend ~65% complete. Main gaps: AI simulation page broken path, quiz comprehension report UI missing, post-script analysis UI missing, no notification/deadline settings pages.

**Critical blockers (P0):**
1. AI simulation page at `app/courses/[id/]/ai-simulation/` — broken directory name (`[id/]` instead of `[id]`). No actual page.tsx exists. Backend complete at `/api/courses/{id}/ai-student/*`.
2. Quiz comprehension report (5.3.x) — backend done (`quiz.router` has it), but `teacher-quiz.tsx` never calls `getQuizComprehension`. CLOSED quizzes show nothing.
3. Post-script analysis (6.6.x structure/concepts) — `analysis.py` router complete but zero frontend UI.
4. Email/SMTP not configured → `send_pending_reminders` scheduler runs but cannot send emails.
5. LMS API clients (`core/lms_client.py`) are stubs → LMS sync/distribution non-functional.

**Feature completion matrix:**
- Auth/profiles: ✅ done
- Course CRUD + schedules: ✅ done
- Student enrollment (invite, direct, Excel): ✅ done
- Script upload + 4.2.x analysis: ✅ done (Realtime could be improved)
- Script suggestions + 4.3.x report VIEW: ✅ backend / ❌ report view UI missing
- Quiz gen + submission: ✅ done
- Quiz comprehension report (5.3.x): ✅ backend / ❌ frontend
- Preview/review guides per schedule: ✅ done
- Announcements + LMS publish: ✅ backend / △ LMS distribution UI partial
- Audio upload + STT transcript: ✅ upload backend / ❌ STT API (Whisper) not wired
- AI Simulation (8.x): ✅ backend / ❌ frontend page broken/missing
- Deadlines + reminders pages: ✅ backend (`reminders.router` 587 lines) / ❌ no frontend pages
- Notification settings page: ✅ backend / ❌ no dedicated settings page
- Teacher dashboard: ✅ done
- Student dashboard: △ partial (quiz history wired, preview/review timeline weak)
- Email notifications: ❌ SMTP missing
- LMS real integration: ❌ stubs only

**Phase milestones:**
- Phase 0 (P0 bugs): Fix AI sim route, wire quiz comprehension report, wire post-analysis UI
- Phase 1 (1-2 weeks): AI simulation full page, quiz comprehension report, post-script analysis UI, courses/[id] navigation tabs
- Phase 2 (2-3 weeks): ✅ DONE (2026-04-13) — Notifications page (`/notifications`), deadlines page (`/deadlines`), reminder settings page (`/settings/reminders`), student dashboard wrong-answer review + materials timeline, teacher announcements LMS deploy button (`publishAnnouncement`). Header Bell icon + profile dropdown links added.
- Phase 3 (3-4 weeks): ✅ DONE (2026-04-13) — config.py SUPABASE_JWKS_URL/ISSUER 필드 추가, HTML 이메일 템플릿(_build_email_html), Realtime 훅(lib/hooks/use-realtime-subscription.ts) 생성 후 teacher-materials.tsx 폴링(setInterval) 교체, 테스트 53개 통과(test_ai_simulation.py 7개 + test_scheduler_smtp.py 8개 신규).
- Phase 4 (4-6 weeks): LMS real integration (Moodle first), Audio STT (Whisper/Google), Excel batch enrollment verification
- Phase 5: Small LLM hosting decision (Ollama vs API), dashboard_snapshots auto-refresh triggers, 30-day account deletion batch

**API functions in lib/api.ts that exist but have NO frontend UI:**
- `getQuizComprehension` (5.3.x)
- `getReminders`, `dismissReminder` (7.x - no reminders page)
- `getNotifications`, `markNotificationAsRead`, `getNotificationPreferences`, `updateNotificationPreferences` (10.x - no notifications page)
- `publishAnnouncement`, `createAnnouncement` (partial UI)
- AI simulation: ZERO api.ts functions exist — must be added

**How to apply:** Prioritize P0 fixes, then Phase 1 for AI simulation (flagship feature). Do not add new backend endpoints until frontend integration gaps are closed.
