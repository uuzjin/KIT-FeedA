---
name: KIT-FeedA Project Overview
description: Core facts about the FeedA (피다) project — purpose, team context, deployment, dev period
type: project
---

**FeedA (피다)**: AI-based course feedback system ("Feedback + Academy") for Korean higher education.

**Why:** Helps instructors detect lecture script gaps, auto-generate quizzes, preview/review guides, and simulate AI students to evaluate material quality.

**Stack:** Next.js 16 (frontend) + FastAPI (backend) + Supabase (PostgreSQL + Auth + Storage) deployed on Railway.

**Dev Period:** April 6-13, 2026 (1-week sprint). Live at https://frontend-production-90dc.up.railway.app

**Branch convention:** `feat/`, `fix/`, `refactor/`, `style/`, `chore/` prefixes. Issues tracked in GitHub.

**Current branch:** `feat/67-phase3-core-integration` — fixing frontend-backend API URL mismatches (preview-guide/review-summary per-schedule endpoint fix, new courses listing page).

**How to apply:** All future work should follow the existing branch/commit convention. Context from this sprint informs urgency of integration completeness.
