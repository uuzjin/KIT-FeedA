---
name: Development Roadmap
description: Gap analysis, critical blockers, and phased milestones to reach 100% feature completion
type: project
---

**Current status (as of 2026-04-13):** Backend ~95% complete (83+ endpoints). Frontend ~70% complete. Main gap is frontend-backend integration correctness and a few unimplemented backend services (email SMTP, real LMS API clients).

**Critical blockers:**
1. `teacher-materials.tsx` queries Supabase directly instead of using backend API — violates architecture
2. Email/SMTP not configured → reminders can't send
3. LMS API clients are stubs → LMS sync/distribution non-functional
4. Excel batch enrollment: backend parsing not implemented
5. Several frontend pages may still use stale API patterns from before Phase 3

**Phase milestones:**
- Phase 1 (done): Auth, user management, course CRUD, student enrollment
- Phase 2 (done): Quiz generation/submission, script upload/analysis, materials generation
- Phase 3 (current): API URL integration fixes, per-schedule preview/review, courses listing page
- Phase 4 (next): Fix direct-Supabase pattern in teacher-materials, complete email notifications, audit all pages for API correctness
- Phase 5: LMS real integration, Excel enrollment, profile image signed URLs, analytics exports

**How to apply:** Prioritize Phase 4 integration fixes before adding new features.
