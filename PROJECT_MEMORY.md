# PROJECT_MEMORY.md

Last updated: 2026-08-05

## Product Summary

Lingxi Resume is an AI-powered resume and mock interview product for job seekers.
It is now being treated as a real landing-to-product project, not a classroom demo.

The product helps users:

- edit a resume in a focused workspace,
- choose structurally different resume templates,
- run real AI resume analysis,
- polish resume content,
- check grammar and wording,
- practice interview answers,
- review history records and admin metrics.

## Current Directory Shape

```text
.
├─ backend/
│  ├─ server.js
│  └─ data/
│     └─ store.json        # local runtime data, ignored by Git
├─ src/
│  ├─ App.jsx             # main React app and page components
│  ├─ main.jsx
│  └─ styles.css          # app styling, responsive rules, resume templates
├─ .agents/
│  └─ skills/             # local design/UI skills
├─ PRODUCT.md
├─ DESIGN.md
├─ README.md
├─ database.sql
├─ vite.config.js
├─ package.json
└─ pnpm-lock.yaml
```

There are also many generated screenshots in the root. They are not the source of truth.

## Current Implementation State

### Per-user data isolation (2026-07-27)

- Authentication now issues a persistent server-side session token; the frontend stores it only in local storage and sends it as a Bearer token.
- Resumes, version history, AI analysis, optimization, grammar checks, interview sessions, answers, and history lists are filtered by the authenticated user on the backend.
- The frontend keeps using its primary-resume route, but the backend resolves it to the current user's own resume and creates a starter resume for a newly registered user.
- AI provider settings are scoped per user. The existing local DeepSeek configuration is preserved for the original seeded `linche` account only; it is not exposed to newly registered accounts.
- Do not restore global record queries or trust `userId` values supplied by the browser.
- Guests can browse the product workspace and templates in read-only mode. Any content-area edit, action, or drag interaction prompts for login; sidebar navigation and the login entry remain available.

### Frontend

The app is a Vite React single-page app.
Most page components are in `src/App.jsx`:

- Landing page.
- App shell with sidebar.
- Auth page.
- Resume editor.
- Template gallery.
- Grammar panel.
- Provider settings.
- Interview practice.
- History page.
- Admin panel.
- Analysis panel.
- Optimize panel.

Styling is centralized in `src/styles.css`.

### Backend

`backend/server.js` is a lightweight Node HTTP API.
It persists to `backend/data/store.json`.

Important endpoints:

- `GET /api/health`
- `GET /api/ai-config`
- `PUT /api/ai-config`
- `GET /api/resumes`
- `GET /api/resumes/:id`
- `PUT /api/resumes/:id`
- `POST /api/resumes/:id/analyze`
- `POST /api/resumes/:id/optimize`
- `POST /api/resumes/:id/grammar-check`
- `POST /api/interviews`
- `POST /api/interviews/:id/answers`
- `GET /api/records/analysis`
- `GET /api/records/optimize`
- `GET /api/records/grammar`
- `GET /api/admin/overview`

### AI

AI is wired through OpenAI-compatible HTTP APIs.
The backend first tries the Responses API shape and then falls back to `chat/completions`.

Current known working DeepSeek settings:

```text
Base URL: https://api.deepseek.com/v1
Model ID: deepseek-chat
```

Do not use `deepseek-v4-flash` as the default. It returned unstable or overly generic results in testing.

The app should show errors if AI is not configured or returns invalid output.
It should not claim local heuristic output as AI success.

`backend/data/store.json` may contain the user's locally saved API key.
It is ignored by Git and must remain uncommitted.

## Recent Work Completed

1. Template application bug fixed.
   Choosing a template now updates the resume page rather than only the gallery preview.

2. Resume templates redesigned.
   The six templates are now structurally distinct:
   ATS single-column, executive two-column, functional skill matrix, timeline, minimal formal, portfolio card.

3. Template gallery card layout aligned.
   Card heights, preview heights, copy rhythm, and bottom action buttons are fixed and consistent.

4. Auto-save button restyled.
   It is now a neutral compact action rather than a cramped blue square.

5. Real AI integration added.
   Backend stores AI config and calls OpenAI-compatible APIs for analysis, polishing, grammar checks, and interview feedback.

6. DeepSeek compatibility improved.
   DeepSeek sometimes wraps responses under the schema name, so the backend unwraps those payloads.
   Grammar checks now normalize `score` and `issues`.

7. Grammar page UX improved.
   It shows `检查中...` while loading and shows a clear no-issues state instead of looking blank.

## Known Risks / Debt

- `src/App.jsx` is large and mixes many pages. Future refactor should split pages/components gradually.
- `src/styles.css` is also large. Keep edits scoped and avoid random global overrides.
- AI config persisted in `backend/data/store.json` is okay for local development but not production. Production should use environment variables or a secret store.
- Authentication uses scrypt password hashes, a server-issued one-time image captcha, rate-limited login/registration, and server-held session hashes delivered through HttpOnly cookies. Legacy `admin` and `linche` accounts must update their old password in General Settings before private data and AI actions are available. Do not reintroduce browser-stored bearer tokens or plaintext passwords.
- Data persistence is local JSON, not production database wiring.
- API prompts are good enough for current DeepSeek/OpenAI-compatible testing but should be versioned and improved.
- Current frontend has no dedicated loading/error UI for every AI panel yet.

## Latest Delivery

- The public flow now starts in `简历模板`: every template carries the same sample-resume content for structural comparison. Guests who open `#resume` are redirected to templates; creating a personal resume requires login, and then opens the user's own empty resume workspace.
- Resume editor now supports a personal summary and sortable modules through `dnd-kit`; moving modules updates the A4 preview.
- AI keyword chips can be selected to append to the personal summary without duplicates.
- Mock interviews are real AI sessions: target role input, resume-based opening question, answer score and feedback, AI follow-up questions, final report, and persisted history records.
- Interview endpoints: `POST /api/interviews`, `POST /api/interviews/:id/answers`, `POST /api/interviews/:id/report`, and `GET /api/records/interviews`.

## RAG Upgrade Progress (Stage 5A accepted)

- Runtime persistence remains `backend/data/store.json`; `database.sql` is a production schema/migration reference only.
- Phase 1 normalizes editor data into `buildResumeDTO`. Provider prompts use PII-filtered `buildAiResumeContext`, while history retains full DTO snapshots. AI records bind `userId`, `resumeId`, `resumeVersion`, and `resumeContentHash`.
- New mock-interview snapshots use ResumeDTO and exclude `photoDataUrl`; legacy raw snapshots remain readable through the converter.
- Phase 2 stores user-owned JobDescription records, raw JD hashes, evidence-backed parse results, and JobApplication links that lock resume/JD parse versions. No RAG infrastructure has been added.
- Record endpoints accept an optional positive `resumeId`; invalid values return 400. `GET /api/resumes/:id/versions` lists owned snapshots and `GET /api/resumes/:id/versions/:versionId` returns one owned version.
- Regression suite: `pnpm test` uses temporary JSON stores and local mock AI servers only.
- Stage 3 adds immutable `resumeJobMatches`: every record binds the owner, explicit JobApplication, ResumeVersion snapshot/hash, JD, and successful current JD parse result. It never resolves a current/recent resume or JD. It is accepted and merged to `master`.
- Backend fixed weights are required skills 30, project relevance 25, keyword coverage 15, experience 10, education 10, and expression 10. It recomputes the total and ignores AI-provided totals.
- AI uses provider-safe `buildAiResumeContext`; evidence is validated against the locked resume snapshot and JD materials. Invalid evidence becomes a `FAILED` history record with no report. `NOT_FOUND` is normalized to `当前简历中未找到相关证据`.
- Stage 4 passed Claude's second independent review. It adds an ADMIN-only public knowledge-base pipeline: `KnowledgeDocument`, server-only `KnowledgeChunk`, and append-only `KnowledgeProcessingRecord`. It is JSON-backed, preserves normalized-source offsets and heading paths, uses a documented token estimate, and never sends content to AI.
- `rawText` remains exactly as submitted and is hashed in its original form; `normalizedText` is separately cleaned for processing. Short independent headings use context, so skills and responsibility rows are retained as content. Identical raw-text hash plus strategy is idempotent; a successful new process replaces chunks and a failed process retains the last successful chunks. `tests/knowledge-base.integration.mjs` uses a temporary store and real HTTP requests without AI.
- Stage 5A passed Claude's final independent review. It adds an OpenAI-compatible embedding provider, profile-isolated Qdrant collections, stable embedding-input hashes and deterministic Point IDs, verified upserts, atomic active-run switching, stale/old Point cleanup tracking, delete synchronization, and ADMIN index management. The runtime keeps only metadata, never vectors or secrets.
- Stage 5B completed its real Qdrant retest on Docker Desktop (Docker Server 29.4.1, Compose v5.1.3): both Qdrant smoke commands exited 0, and syntax checks, the full mock integration suite, golden evaluation, build, and diff checks passed. All release gates now pass; merging master and creating a `rag-stage-5b-passed` tag are allowed, but were not performed in this verification run. RAG generation and Agentic RAG remain out of scope.

## Design Memory

Keep the app calm, tool-like, and professional.
This should feel closer to Magic Resume / Notion / Linear than to a colorful AI SaaS landing page.

Preferred UI vocabulary:

- small-radius cards,
- light borders,
- white and near-white surfaces,
- dense but readable layouts,
- lucide icons,
- clear form labels,
- direct action buttons,
- no decorative clutter.

Avoid:

- purple-blue gradient domination,
- bokeh/orb decoration,
- nested cards,
- oversized hero sections inside the app,
- random font changes,
- text overflow,
- buttons that shift layout or wrap unexpectedly.

## Useful Verification Commands

```bash
node --check backend/server.js
pnpm build
```

If local servers are needed:

```bash
pnpm dev:api
pnpm dev
```

## Secrets Reminder

The user has previously pasted a DeepSeek API key into chat.
Do not repeat it back.
Do not place it in source code.
Recommend rotating it before public deployment or sharing the repository.

## Repository Memory System

## Stage 5A accepted

Stage 5A passed Claude's final independent review. The approved scope was knowledge-vector indexing lifecycle only: stable embedding input, profile-isolated Qdrant collections, verified upserts, atomic active-run switching, cleanup tracking, and delete synchronization. Stage 5B then passed its third independent code review and real Qdrant retest, adding ADMIN-only retrieval and reranking; all release gates pass, while RAG or agents do not exist.

The durable task workflow is now documented in `docs/CONTEXT_INDEX.md`, `docs/PROJECT_STATUS.md`, `docs/CURRENT_TASK.md`, `docs/DECISIONS.md`, `docs/tasks/`, and `docs/reviews/`. Read these before relying on this historical summary. Stages 1–5B are accepted; Stage 5B real Qdrant smoke also passed in a Docker/Qdrant-capable environment.
