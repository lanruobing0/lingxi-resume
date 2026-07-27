# AGENTS.md

This file is the durable handoff for Codex / AI agents working in this repo.
Read it before making changes.

## Project

Lingxi Resume is a real product, not a course-demo prototype.
It is an AI resume optimization and mock interview app for job seekers.

Core product flows:

- Resume editor with live A4 preview.
- Resume template gallery with actually different layouts.
- AI resume analysis.
- AI resume polishing.
- AI grammar / wording check.
- Mock interview feedback.
- History records and admin overview.

## Tech Stack

- React 18
- Vite
- Plain CSS in `src/styles.css`
- lucide-react icons
- Lightweight Node HTTP API in `backend/server.js`
- Local JSON persistence in `backend/data/store.json`
- MySQL schema/reference script in `database.sql`

## Commands

Use these from the project root:

```bash
pnpm install
pnpm dev
pnpm dev:api
pnpm build
```

Frontend:

```text
http://127.0.0.1:5173/
```

Backend:

```text
http://127.0.0.1:8787
```

Vite proxies `/api` to `http://127.0.0.1:8787`.

## Important Files

- `src/App.jsx`: Most UI and app logic currently lives here.
- `src/styles.css`: All visual styling and responsive layout.
- `backend/server.js`: API server, local persistence, real AI integration.
- `backend/data/store.json`: Local runtime data. Ignored by Git. May contain local AI config and API keys.
- `PRODUCT.md`: Product positioning and principles.
- `DESIGN.md`: Visual direction and UI constraints.
- `README.md`: Setup, API, and AI configuration notes.
- `database.sql`: MySQL schema and seed data reference.

## Do Not Do

- Do not treat this as a course-design mockup.
- Do not replace real AI calls with fake local results.
- Do not write API keys, tokens, or secrets into source files, README, screenshots, or commit messages.
- Do not print the full API key from `backend/data/store.json`.
- Do not commit `backend/data/store.json`.
- Do not remove the Vite `/api` proxy unless replacing it with a deliberate deployment strategy.
- Do not rewrite the whole app into a new framework without explicit user approval.
- Do not flatten the resume templates back into minor color variants.
- Do not add decorative gradients, blobs, glass cards, or marketing-style hero layouts inside the product workspace.
- Do not revert unrelated dirty files.

## Visual Style

The product should feel like a calm professional resume studio:

- Light product UI.
- Neutral surfaces.
- Thin borders.
- Compact controls.
- restrained blue only for active/primary state.
- realistic A4 resume preview.
- no noisy dashboard styling.
- no purple-gradient AI SaaS look.
- no oversized marketing sections inside the app shell.

For resume templates, structural difference matters more than color:

- ATS single-column.
- Executive two-column.
- Functional skill matrix.
- Chronological timeline.
- Minimal formal.
- Portfolio card layout.

Template cards must stay visually aligned:

- equal card heights,
- equal preview heights,
- bottom-aligned action buttons,
- no text overflow on desktop or mobile.

## AI Integration Rules

AI features are real product features.

Current backend supports OpenAI-compatible APIs:

- `GET /api/ai-config`
- `PUT /api/ai-config`
- `POST /api/resumes/:id/analyze`
- `POST /api/resumes/:id/optimize`
- `POST /api/resumes/:id/grammar-check`
- `POST /api/interviews/:id/answers`

For OpenAI official:

```text
Base URL: https://api.openai.com/v1
Model: a supported OpenAI model
```

For DeepSeek:

```text
Base URL: https://api.deepseek.com/v1
Model: deepseek-chat
```

The backend should fail visibly when AI is not configured or returns invalid content.
Do not silently substitute fake AI output as success.

## Verification Expectations

After behavior changes:

```bash
node --check backend/server.js
pnpm build
```

For UI changes, use browser verification when possible:

- desktop viewport around `1440 x 900`,
- mobile viewport around `390 x 900`,
- check for text overflow,
- check that buttons and cards align,
- check that real interactions update visible state.

## Current Caution

The repo has a dirty working tree with many existing local changes and generated screenshots.
Only edit files needed for the current task.
Do not clean, reset, or delete unrelated files unless the user explicitly asks.
