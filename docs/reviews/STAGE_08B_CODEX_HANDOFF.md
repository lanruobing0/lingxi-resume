# Stage 8B Codex Handoff

状态：Stage 8 已正式完成；Stage 9 尚未开始。

## 验收重点

1. 从已完成或降级可用的 AI 岗位匹配报告创建 InterviewSession，且创建请求只使用 Stage 8A API。
2. 刷新/切换 JobApplication 后，历史 session、题目、answer 和 feedback 均从 backend 恢复。
3. 四类题目、难度与 rationale 可见；内部 sourceRef 结构不可见。
4. duplicate/completed/grounding/provider/retrieval 失败不被前端包装成成功。
5. improvedAnswer 明确是建议回答，不写回简历；strengths/weaknesses/missingPoints 明确标为 AI 反馈，不包装成已验证用户事实。
6. 完成操作调用 backend complete，averageScore 与逐题 score 不在前端计算。
7. Stage 8A grounding/security 文件与逻辑未修改。

## 主要文件

- `src/App.jsx`
- `src/styles.css`
- `src/interviewUiState.js`
- `tests/interview-ui.unit.mjs`
- `tests/interview-ui.render.mjs`
- `package.json`
- `docs/tasks/STAGE_08B_RAG_MOCK_INTERVIEW_UI.md`

## 门禁

| 命令 | Exit code |
| --- | ---: |
| `node --check backend/server.js` | 0 |
| `corepack pnpm test` | 0 |
| `corepack pnpm build` | 0 |
| `corepack pnpm test:retrieval-eval` | 0 |
| `corepack pnpm test:qdrant` | 0 |
| `corepack pnpm test:qdrant-retrieval` | 0 |
| `git diff --check` | 0 |

两项 Qdrant 命令均真实启动 smoke 环境并分别输出 `Real Qdrant smoke test passed.` 与 `Real Qdrant retrieval smoke test passed.`，未跳过。

浏览器层检查启动真实 Vite 页面并确认控制台无 error/warning；登录态之外的 Stage 8B 细节由 SSR render 测试覆盖桌面 DOM 结构，响应式断点由 CSS 实现并纳入生产构建。本轮未使用或写入 `backend/data/store.json` 来伪造面试成功状态。
