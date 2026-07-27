# AI_HANDOFF.md

Last updated: 2026-07-27

This is the quick continuation note for the next AI/Codex session.

## Read First

1. `AGENTS.md`
2. `PROJECT_MEMORY.md`
3. `PRODUCT.md`
4. `DESIGN.md`
5. `README.md`

Then inspect the current dirty tree before editing:

```bash
git status --short
```

There are many local changes and generated screenshots. Do not reset or clean them without explicit approval.

## Current Runtime State

Expected local services:

```text
Frontend: http://127.0.0.1:5173/
Backend:  http://127.0.0.1:8787
```

## Account Isolation

- User-facing API routes require the `lingxi_session` HttpOnly cookie. The backend stores only a SHA-256 hash of each session token in `backend/data/store.json`; never print or commit that file.
- Personal resume and history routes resolve data from the authenticated user, never from a browser-provided `userId`.
- The old seeded resume and DeepSeek configuration remain associated with the seeded `linche` user. New users receive an empty starter resume and no AI key.
- The public template gallery is the sample-resume route: every template preview uses the same sample content. Do not use that content as a guest's personal workspace; guests who reach `#resume` are redirected to `#templates` after session verification.
- Browser sessions created before the security migration are deliberately invalidated and must sign in again. Passwords stored by earlier local versions are migrated to scrypt hashes during the first backend read.
- The legacy `admin` and `linche` accounts are marked `passwordUpdateRequired`; only `GET /api/users/me`, logout, and `POST /api/auth/change-password` are available until a strong replacement password is set.
- `GET /api/auth/captcha` issues a one-time server-side captcha challenge, and `GET /api/auth/captcha/:id` renders it. Login and registration require `captchaId` and `captchaCode`; challenges expire after 5 minutes, allow 5 tries, and are invalidated after a successful check.

Backend health:

```bash
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/health
```

AI config status:

```bash
Invoke-RestMethod -Uri http://127.0.0.1:8787/api/ai-config
```

The local backend was configured for DeepSeek during the previous work:

```text
Base URL: https://api.deepseek.com/v1
Model ID: deepseek-chat
```

Do not expose or print the full API key.

## What Was Just Fixed

The grammar check page looked like it had "no response".

Root cause:

- DeepSeek returned a wrapped payload like:

```json
{
  "resume_grammar_check": {
    "score": 100,
    "issues": []
  }
}
```

- The frontend expected `score` and `issues` at the top level.
- This made the page render only `分`.

Fix:

- `backend/server.js` now unwraps schema-name payloads.
- Grammar results now normalize `score` and `issues`.
- `src/App.jsx` now shows loading state and a clear no-issues message.

Verified:

- `POST /api/resumes/1/grammar-check` with content `你好` returns:

```json
{
  "score": 100,
  "issues": [],
  "aiMode": "live"
}
```

- `pnpm build` passes.
- `node --check backend/server.js` passes.

## Suggested Next Work

Highest priority:

1. Add visible AI status and error panels on all AI pages.
   Do not rely only on toast notifications.

2. Add per-button loading states for:
   - AI diagnosis,
   - AI optimize,
   - grammar check,
   - interview feedback.

3. Make AI provider settings safer:
   - Prefer environment variables for production.
   - Keep local storage of API key only for local development.
   - Add a "clear key" button.
   - Add a "test connection" button.

4. Split `src/App.jsx` into page components.
   Do this gradually, not as a giant rewrite.

5. Add robust prompt handling.
   Keep prompts versioned in backend helper functions or separate modules.

6. Replace local JSON persistence with production-ready storage when product direction is ready.

## Important Product Decisions Already Made

- This is a real product project, not a course demo.
- AI features must call real AI providers.
- If no key or provider call fails, show an error.
- Do not silently use local heuristic output as if it were AI.
- DeepSeek works with `deepseek-chat`.
- `deepseek-v4-flash` produced unstable output and should not be defaulted.
- Resume template differences must be structural, not just color changes.

## Safe Files To Edit For Common Tasks

AI/backend behavior:

- `backend/server.js`
- `README.md`

Frontend behavior:

- `src/App.jsx`
- `src/styles.css`

Design docs / memory:

- `AGENTS.md`
- `PROJECT_MEMORY.md`
- `AI_HANDOFF.md`
- `PRODUCT.md`
- `DESIGN.md`

Avoid touching unless necessary:

- generated screenshot PNGs,
- `dist/`,
- `node_modules/`,
- `backend/data/store.json`,
- unrelated dirty files.

## Final Reminder

Before final response after any change, report:

- files changed,
- what was verified,
- anything that could not be verified,
- whether local API/frontend servers were restarted.
