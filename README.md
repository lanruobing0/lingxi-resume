# 灵犀简历

灵犀简历是面向求职者的 AI 简历优化与模拟面试产品。技术项目名为「基于 Agentic RAG 的 AI 简历优化与岗位智能匹配平台」。它不是演示型本地规则应用：未配置 AI Provider 或 Provider 返回非法内容时，接口会明确失败，不会伪造成功结果。

## 架构与核心流程

- 前端：React 18、Vite、plain CSS。
- API：轻量 Node HTTP 服务。
- 持久化：本地 JSON（默认，开发/测试）或 MySQL（`STORAGE_DRIVER=mysql`）。
- 知识检索：Qdrant + 关键词检索 + 确定性 RRF Hybrid Retrieval；Reranker 可选。
- AI：OpenAI-compatible Provider；RAG grounded report、evidence-backed resume suggestion、RAG mock interview、bounded Agentic RAG。

核心数据链是：

`JD 解析 → Hybrid RAG → Grounded Match Report → Evidence-backed Resume Optimization → RAG Mock Interview → Bounded Agentic RAG`

每一步均绑定拥有者、显式 `resumeId`、`resumeVersion` 与 `resumeContentHash`；岗位流程还绑定 JD 和成功的解析结果。系统不会根据“当前”或最近数据推断输入。

## 本地启动

```bash
corepack pnpm install
corepack pnpm dev:api
corepack pnpm dev
```

前端为 `http://127.0.0.1:5173/`，API 默认为 `http://127.0.0.1:8787/`。复制 `.env.example` 为 `.env` 后按需设置环境变量；`.env` 不应提交。

## 配置

`STORAGE_DRIVER=json` 是默认值，使用 `LINGXI_DATA_DIR` 可指定本地测试/开发数据目录。`STORAGE_DRIVER=mysql` 时必须设置：

- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_DATABASE`、`MYSQL_USER`、`MYSQL_PASSWORD`

MySQL 运行时会使用迁移后的 `lingxi_store_snapshot` 和受审计的实体投影，覆盖 RetrievalRun、MatchReport、SuggestionRun/ResumeSuggestion、ResumeVersion、Interview Session/Question/Answer/Feedback、AgentRun/AgentStep/Job。生产迁移见 [010_production_hardening.sql](database/migrations/010_production_hardening.sql)，完整关系模型参考 [database.sql](database.sql)。真实 MySQL integration 已在 MySQL 8.x 环境验证通过：MySQL 8.4.11、隔离测试库 `lingxi_resume_test`，已验证 migration 重复执行、事务 commit/rollback、核心实体投影、全链路和后端重启恢复；密码未写入仓库。

AI 使用 `OPENAI_BASE_URL`、`OPENAI_API_KEY`、`OPENAI_MODEL` 和 `AI_PROVIDER_TIMEOUT_MS`。Embedding 使用 `EMBEDDING_*`，Qdrant 使用 `QDRANT_URL`、`QDRANT_API_KEY` 与 `QDRANT_*`。所有 secret 仅可放在环境变量或本地运行时配置中。

Qdrant 可用 Docker 启动：

```bash
docker compose -f docker-compose.qdrant.yml up -d
```

`GET /health` 仅说明进程存活；`GET /ready` 还检查 persistence 和 Qdrant，响应不会回显连接串或 secret。

## 生产行为

Grounded report、resume suggestions、mock interview generation 和 AgentRun 可以在原有同步 API 路径外，通过请求体 `async: true` 入队。作业状态为 `PENDING`、`RUNNING`、`COMPLETED` 或 `FAILED`，可经 `GET /api/jobs/:id` 查询。第一版是 bounded in-process worker：不无限重试，收到关闭信号后不再接收新作业。

对 AI、embedding 和 Qdrant 的外部调用均有 timeout/AbortController 和稳定 failureCode。日志只有 requestId、资源 ID、operation、耗时、状态和 failureCode；不会记录 API key、简历正文、用户回答全文、prompt 或 embedding/vector。

## 安全边界

- 所有读写都经 ownership 校验；跨用户资源返回不可见结果。
- 只向第三方 AI 发送 provider-safe Resume context；姓名、邮箱、电话、网站、城市、照片、会话和无关 profile 字段被排除。
- Match Report 的知识 claim 必须有本地可验证 citation；Suggestion 必须被事实证据支持，不能自动应用或自动 ACCEPT。
- 面试问题与 improved answer 不得把外部资料冒充为用户经历。
- Agent 只执行服务端 allowlist 中的只读 action，受 `maxSteps` 硬限制；prompt injection 被隔离，`VERIFIED_RESUME_FACT` 必须由实际 Resume quote 支持。

## 测试与门禁

测试全部使用 deterministic local mock Provider，不调用真实收费 AI：

```bash
node --check backend/server.js
corepack pnpm test
corepack pnpm test:mysql
corepack pnpm test:rag-eval
corepack pnpm test:retrieval-eval
corepack pnpm build
corepack pnpm test:qdrant
corepack pnpm test:qdrant-retrieval
git diff --check
```

`test:mysql` 只接受真实 MySQL 环境变量；缺少配置时明确以 exit 2 跳过，不会 mock MySQL。两项 Qdrant smoke 必须严格串行运行。`test:rag-eval` 输出固定 golden cases 的 Retrieval Recall@K/MRR、grounded claim、suggestion safety、interview grounding 与 Agent safety 汇总；安全指标必须为 100%。
