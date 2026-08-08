# AI_HANDOFF.md

Last updated: 2026-08-06

This is the quick continuation note for the next AI/Codex session.

## Read First

1. `AGENTS.md`
2. `docs/CONTEXT_INDEX.md`
3. `docs/PROJECT_STATUS.md`
4. `docs/CURRENT_TASK.md`
5. `docs/DECISIONS.md`
6. current stage file under `docs/tasks/`
7. latest Claude review under `docs/reviews/`
8. `PROJECT_MEMORY.md`, `PRODUCT.md`, `DESIGN.md`, and `README.md`

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

## Stage 4 and 5A delivery — accepted

- Stage 3 has been accepted, merged to `master`, and tagged `rag-stage-3-passed`.
- Stage 4 passed Claude's second independent review and is merged to `master`.
- `KnowledgeDocument`, server-generated `KnowledgeChunk`, and append-only `KnowledgeProcessingRecord` persist in the local JSON runtime. Every `/api/admin/knowledge-*` route verifies `ADMIN` server-side.
- `rawText` is saved exactly as submitted and its hash is calculated from that original string. `normalizedText` is the independent LF/whitespace-cleaned processing text. Heading paths recognize Markdown, Chinese numerals, numeric headings, `一、`, brackets, and conservative context-qualified short headings; skills and responsibility rows remain body content.
- Same input hash and strategy are idempotent. A new successful run atomically replaces the document's chunks; a failed run appends a FAILED record while preserving the previous successful chunks.
- Added the admin knowledge-base section to the existing backend page and `tests/knowledge-base.integration.mjs`. The integration entry uses the real HTTP server plus an isolated JSON directory; `pnpm test` runs all four test files without external AI calls.
- Known low-risk limitations: headings without body do not create a Chunk; edited document metadata is copied to existing chunks on next successful processing; `knowledgeMinLength` is not an active merge rule; development logs may print internal `HttpError` details; adjacent body-less short headings may deliberately remain body content.
- Stage 5A passed Claude's final independent review and is ready for release commit, merge to `master`, and `rag-stage-5a-passed` tagging. It provides only controlled Embedding/Qdrant index lifecycle; retrieval, reranking, and RAG remain absent.

## Stage 6A accepted – Git closure authorized

- Stage 6A 已在 `master` 完成 Git 闭环并创建 `rag-stage-6a-passed`；后续实现位于 `feat/rag-stage-6b-report-ui`。
- `POST /api/job-applications/:id/reports` requires a completed owned `matchId`; it creates a new immutable `matchReports` history item. `GET /api/match-reports/:id` is owner-only and annotates historic citations as `AVAILABLE` or `UNAVAILABLE` without changing their snapshots.
- `backend/grounded-report-service.js` deterministically derives six retrieval plans from the locked stage 3 match/JD and calls production `KnowledgeRetrievalService`. `backend/grounded-report-prompt.js` declares `grounded-match-report-v1` and strict JSON; `backend/citation-validator.js` validates local Chunk/run/version/active-index/quote integrity.
- Only valid `KNOWLEDGE_CLAIM` citations enter completed output. Invalid citations are dropped with persisted reasons and cause `DEGRADED`; no valid Claims causes `FAILED`. Model suggestions must begin `建议：`; base facts must refer to exact stage 3 evidence.
- Run `node tests/grounded-match-report.integration.mjs`, then the complete stage command set in `docs/tasks/STAGE_06A_GROUNDED_REPORT.md`. The report test uses real HTTP backend and mocks only external Provider/Embedding/Qdrant/Reranker.
- 阶段 6A 已通过 Claude 最终独立验收及全部发布门禁，并已完成 master 合并与 rag-stage-6a-passed 标签。`claim-support-v4` 从并列拆分单元中剔除纯引导语，保留每个实质单元至少一条本地 quote 的要求；“共同”“并”仍不视为因果。中英文逗号等句界后的明确他/她归因已拒绝，普通“其他”不误伤。真实 HTTP 报告断言、连续 5 次集成测试和双 Qdrant smoke 均通过。

## Stage 7A evidence-backed rewrite – accepted

- Stage 7A 已通过 Claude 最终独立验收；Stage 7B 尚未开始。Evidence-backed Rewrite 实现位于 `backend/server.js` 和 `backend/resume-suggestion-prompt.js`，测试为 `tests/resume-suggestions.integration.mjs`，最终验收记录为 `docs/reviews/STAGE_07A_FINAL_REVIEW.md`。
- 入口是 `POST /api/match-reports/:id/resume-suggestions`，只接受 owner 的 COMPLETED/DEGRADED Report，并从其固定 ResumeHistory、JD、Match 和 Report 绑定生成独立 `SuggestionRun`。
- `POST /api/resume-suggestions/:id/accept` 需要 `expectedBaseResumeVersion`，重验 version/hash/before/patch 后创建新 ResumeVersion；同 run 其他 PENDING 项按策略 A 变为 INVALIDATED。`reject` 不创建版本。FACT_REQUIRED 永远不可直接 accept。
- Patch 只允许单一 replace 或追加 highlight，路径使用稳定 entry ID；每个可执行建议必须携带服务端从锁定 ResumeVersion 自行读取、验证 sourcePath/sourceQuote/fact 的 `factEvidence[]`，并在 ACCEPT 时再次验证。factual-delta 仅保留数字、年份和完整规范化技术 token（`C++`、`C#`、`.NET`、Node/Vue/Next.js、Objective-C、React Native、Spring Cloud）作为 defense-in-depth，不再以中文关系句式或品牌/实体名单授权 REWRITE。
- Stage 7B 尚未开始；应在单独批准的任务中实施。

## Historical Stage 3 delivery

- Branch: `feat/rag-stage-3-base-matching`, created from `master` at `a14d449`; no merge, tag, or push was performed.
- `ResumeJobMatch` is immutable per run and binds `userId`, `jobApplicationId`, `resumeId`, `resumeVersionId`, `resumeVersion`, `resumeContentHash`, `jobDescriptionId`, and `jobDescriptionParseResultId`.
- Creating an application now requires an explicit `resumeVersionId`; matching reads its locked snapshot, never a current/recent resume, and rejects an invalidated JD parse.
- The six fixed weights are server-calculated. AI contributes semantic matching, evidence and explanation only; any AI `totalScore` is ignored. Unverifiable evidence fails, and `NOT_FOUND` is normalized to `当前简历中未找到相关证据`.
- Added matching APIs, JD-workspace loading/error/report/history states, MySQL reference comment, and `tests/resume-job-match.integration.mjs`.
- Verified locally: `node --check backend/server.js`, `corepack pnpm test`, and `corepack pnpm build` all passed.

Do not begin Stage 4 until Claude independently accepts Stage 3.

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

## 阶段 5A（已通过最终验收）

阶段 5A 已通过 Claude 最终独立验收：知识 Chunk 的 Embedding/Qdrant 索引生命周期与 ADMIN 管理已完成。Embedding/Qdrant 配置只读取服务器环境变量；Profile 隔离模型/维度，`activeIndexRunId` 是有效索引权威。新 run 完成验证与切换后会按 Collection 清理同文档旧 processingVersion Point；清理失败时旧记录可追踪，而新 active run 保持有效。

模块位置：`backend/embedding-provider.js`、`backend/knowledge-embedding-text.js`、`backend/knowledge-vector-index.js`、`backend/qdrant-client.js` 与 `backend/server.js`。测试入口：`corepack pnpm test`（Mock 集成测试）和 `corepack pnpm test:qdrant`（真实 Qdrant smoke）。运行环境变量与 API、数据模型、Collection/Point payload 和生命周期规则以 `README.md`、`docs/RAG_DATA_MODEL.md` 与 `docs/tasks/STAGE_05A_VECTOR_INDEX.md` 为准。

阶段 5B 已完成真实 Qdrant 复验，全部发布门禁通过，允许合并 master 并创建 `rag-stage-5b-passed` 标签。本轮未执行合并或打标签。仅增加 ADMIN 检索实验室与可复用检索服务：关键词/向量两路使用相同服务端过滤，并以本地 `activeIndexRunId`、processingVersion 和当前 Chunk 复核 Qdrant 命中；RRF 默认融合，Reranker 默认关闭且失败回退；不得将此范围扩展为 RAG 或 Agent。

## RAG Phase 1-2 Handoff

- Keep `backend/server.js` as the current API boundary; do not introduce RAG infrastructure until its approved phase.
- AI prompts must receive `buildAiResumeContext(resume)`, never a raw resume object. The AI context excludes real name, email, phone, website, city, and profile fields.
- ResumeDTO is retained locally for version history and new interview snapshots; snapshots intentionally omit `photoDataUrl` and editor-only fields.
- JobDescription, parse result, and application records are all scoped by `userId`. An application requires a successful current JD parse result.
- `GET /api/records/{analysis,optimize,grammar,interviews}` accepts no `resumeId` or a positive integer only. Preserve this 400-vs-unfiltered contract.
- `database.sql` remains a production MySQL migration reference. The local Node runtime uses JSON persistence.
- Completed: phases 1 and 2. Pending: non-RAG matching, knowledge documents/chunking, retrieval, RAG reports, suggestion/version loop, RAG interview, agentic workflow, and production evaluation.
- Verification: run `node --check backend/server.js`, `pnpm build`, and `pnpm test`; integration tests use isolated mock AI servers and temporary data directories.

## Repository Memory System

- `docs/PROJECT_STATUS.md` is the code-verified status summary.
- `docs/CURRENT_TASK.md` only records the active phase boundary; read its linked task file for requirements.
- `docs/DECISIONS.md` records stable architecture choices. Do not silently reverse one during an unrelated task.
- Stage 1-2 acceptance is summarized in `docs/reviews/STAGE_01_02_FINAL_REVIEW.md`; its original Claude report still needs user-provided archival text.

Before final response after any change, report:

- files changed,
- what was verified,
- anything that could not be verified,
- whether local API/frontend servers were restarted.
