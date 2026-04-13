---
name: Code Conventions and Anti-Patterns
description: Patterns to follow and avoid in this codebase, based on architecture decisions
type: feedback
---

**Never bypass the backend API with direct Supabase client calls in the frontend.**
- `teacher-materials.tsx` currently does this (queries `preview_guides`/`review_summaries` tables directly). This is wrong.
- **Why:** The backend enforces auth, business logic, and correct data shapes. Direct DB calls bypass all of that and create tight coupling to schema.
- **How to apply:** All data fetching in frontend components must go through `lib/api.ts` request functions. Never import `supabase` in page or feature components for data queries (only auth operations via `auth-context.tsx` are acceptable).

**API functions belong in `lib/api.ts`, not inlined in components.**
- **Why:** Centralization makes URL changes (like the Phase 3 per-schedule endpoint fix) a single-file update.
- **How to apply:** Add new typed API functions to `api.ts`, export types alongside them, import in components.

**Status patterns for async AI operations:** Always use polling with `status` field (pending → processing → completed/failed), not WebSockets. Backend returns 202 for triggered async jobs.
