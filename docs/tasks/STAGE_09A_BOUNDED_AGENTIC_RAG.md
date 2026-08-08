# Stage 9A：Bounded Agentic RAG Backend

状态：Stage 9A Bounded Agentic RAG backend 已通过；Stage 9B UI 尚未开始。

## 目标与范围

以用户拥有的 `JobApplication -> MatchReport` 为入口，同步执行一个只读、有限步数、逐步可审计的 Agentic RAG workflow。Agent 可根据锁定 ResumeVersion、当前 JD、Stage 6 grounded MatchReport 与 Stage 5B knowledge 决定下一步读取、检索、汇总或产出建议计划，但不得修改 Resume、Suggestion、JobApplication 或任何外部系统。

本阶段仅实现后端、JSON/MySQL 参考模型、真实 HTTP 集成测试和交接文档；不实现 Stage 9 UI、Stage 10 异步队列、多 Agent、recursive agent、shell/browser/code 工具或 autonomous write。

## AgentRun / AgentStep

- `AgentRun` 固化 `userId`、JobApplication、Resume/ResumeVersion/Hash、JD/ParseResult、MatchReport、objective、maxSteps/currentStep、provider/model、promptVersion、状态、失败码和完成时间。
- `AgentStep` 保存 stepIndex、actionType、reason、安全 tool input/output 摘要、sourceRefs、retrievalRunId、状态与起止时间。
- 状态覆盖 `PENDING`、`RUNNING`、`COMPLETED`、`DEGRADED`、`FAILED`、`STOPPED_LIMIT`。
- Agent 审计记录不保存 API key、Provider secret、隐藏 system prompt、raw embedding 或 vector。

## Tool policy 与 bounded loop

服务器唯一 allowlist：`READ_RESUME`、`READ_JOB`、`READ_MATCH_REPORT`、`RETRIEVE_KNOWLEDGE`、`SUMMARIZE_EVIDENCE`、`PRODUCE_PLAN`。

- Planner 每一步仅解析 `{ action, reason, query?, done? }`。
- 每步只执行一个 action；最大硬上限为 6，API 只能选择 1–6。
- 模型返回的 `maxSteps` 或其他字段不能修改服务器预算。
- 未知 action 以 `AGENT_ACTION_NOT_ALLOWED` 失败；不会动态解析 URL、代码、命令、函数名或 tool call。
- 达到限制仍未 `PRODUCE_PLAN` 时立即保存 `STOPPED_LIMIT` / `AGENT_STEP_LIMIT_REACHED`。
- Provider 只使用既有固定 Responses -> Chat protocol fallback，不存在 Agent retry loop 或递归。

## RAG 与 grounding

- `RETRIEVE_KNOWLEDGE` 直接调用 `KnowledgeRetrievalService.search()`，保存真实 `knowledgeRetrievalRuns.id` 与该 run 的 knowledge sourceRefs；没有第二套搜索。
- 完全失败的 retrieval 仍保留 FAILED RetrievalRun，Agent 可使用已有证据以 `DEGRADED` 继续；HYBRID/Reranker fallback 同样进入降级审计。
- 最终结果分为 `VERIFIED_RESUME_FACT`、`EXTERNAL_KNOWLEDGE`、`MATCH_GAP`、`RECOMMENDATION`。
- 用户已有经历只能由锁定 ResumeVersion 的 RESUME 来源支持；KNOWLEDGE/JD/MATCH_REPORT 不能升级为用户事实。
- 首验整改后，`VERIFIED_RESUME_FACT` 类型本身即触发完整授权校验，不再等待 action verb 命中。每条 claim 必须被其实际引用的 RESUME quote 通过 claim-support、技术实体、数字/年份和中文 coverage 支持；真实但无关的 RESUME sourceId 不能洗白 claim，失败码为 `AGENT_UNSUPPORTED_RESUME_FACT`。
- 外部知识只能引用本次真实检索返回的 KNOWLEDGE sourceId，并继续使用本地语义支持校验；伪造 sourceId 失败。
- 输出只形成建议计划，不写回 Resume、不自动 ACCEPT suggestion、不修改 JobApplication。

## Prompt Injection 防线

- Agent system policy、allowlist 和 maxSteps 完全由服务器构造。
- JD、MatchReport、Knowledge 和历史 tool output 均包装为 `untrustedData`。
- 其中出现“忽略规则”“调用隐藏工具”“输出 API key”“修改简历”“执行 shell”或 URL/函数名，不会进入任何动态执行路径。
- Provider 输入使用 `buildAiResumeContext`，不包含姓名、邮箱、电话、网站、城市、profile fields、会话或密钥。

## API

- `POST /api/job-applications/:id/agent-runs`
- `GET /api/agent-runs/:id`
- `GET /api/agent-runs/:id/steps`

所有入口和读取 API 均执行 owner 校验；跨用户读取返回 404。第一版同步完成整个 bounded run。

## 测试与门禁

- 专项测试：`tests/bounded-agentic-rag.integration.mjs` / `corepack pnpm test:bounded-agentic-rag`。
- 攻击覆盖：`EXEC_SHELL`、模型 `maxSteps=100`、恶意 knowledge/JD 指令、循环检索、伪造 sourceId、KNOWLEDGE 冒充 Kubernetes 经历、真实但无关 RESUME source laundering、无依据 Redis/Kafka/Docker/高并发/3 年/50% 用户事实、Provider failure、retrieval failure/degradation、跨用户读取与隐私泄漏；同时覆盖真实 Resume Redis 缓存开发与 30% 提升的合法对照。
- 完整门禁：`node --check backend/server.js`、`corepack pnpm test`、`corepack pnpm test:retrieval-eval`、`corepack pnpm build`、`corepack pnpm test:qdrant`、`corepack pnpm test:qdrant-retrieval`、`git diff --check`。
