# Stage 9B：Bounded Agentic RAG UI

状态：Stage 9 正式完成；Stage 10 尚未开始。

## 范围

- 从当前 JobApplication 的 Stage 6 grounded MatchReport 启动 Stage 9A AgentRun。
- 恢复当前 JobApplication 的历史 Run，读取 Run 详情与 AgentStep 时间线。
- 展示检索来源的安全字段和四类最终结果语义。
- 不修改 Stage 9A Agent execution、grounding、tool allowlist、maxSteps 或 source validation；不实现 Stage 10、异步队列、写简历或自动接受建议。

## UI 闭环

- 岗位工作区新增 Agent 证据分析区，创建请求仅提交固定 objective、当前 `matchReportId` 和固定 `HYBRID` 搜索模式，不提交 action/tool name，也不提交或控制 `maxSteps`。
- 状态覆盖 `PENDING`、`RUNNING`、`COMPLETED`、`DEGRADED`、`FAILED`、`STOPPED_LIMIT`。`STOPPED_LIMIT` 使用独立安全停止提示；FAILED 不展示为成功结果；DEGRADED 保留可查看结果并明确不完整性。
- 六种服务端审计 action 转换为用户可理解名称；步骤展示 reason、状态、时间和字段白名单生成的输入/输出摘要，不渲染原始对象、内部 prompt 或 tool schema。
- `RETRIEVE_KNOWLEDGE` 来源只展示标题、摘要、来源类型与 availability；不展示 sourceId/refId、contentHash、embedding/vector、provider config、API key、hidden prompt 或原始 sourceRef JSON。
- 最终结果固定分为 `VERIFIED_RESUME_FACT`、`EXTERNAL_KNOWLEDGE`、`MATCH_GAP`、`RECOMMENDATION`，分别标注“来自已验证简历事实”“外部知识，不代表用户经历”“岗位匹配缺口”“AI 建议，不代表已执行”。

## 恢复与历史

- 新增最小只读 `GET /api/job-applications/:id/agent-runs`，仅返回历史列表所需摘要字段并复用 JobApplication ownership；跨用户仍返回 404。
- 进入或切换 JobApplication 时读取历史；打开 Run 时并行读取 `GET /api/agent-runs/:id` 与 `GET /api/agent-runs/:id/steps`。
- 刷新按钮重新读取后端历史并恢复最新 Run，不依赖 localStorage 或前端临时成功状态。

## 安全边界

- UI 不根据 JD、知识来源或页面文字动态执行 action，不包含任意 URL/shell/code/tool 执行入口。
- UI 没有修改 Resume、JobApplication 或 ACCEPT suggestion 的动作，且不复制任何 backend validator。
- 未知 action 只显示“未授权步骤”，不会直接回显或执行模型给出的任意工具名。

## 测试

- `tests/agent-ui.unit.mjs`：六类 action、六种 Run 状态、固定安全请求、来源过滤、步骤摘要字段白名单及四类结果语义。
- `tests/agent-ui.render.mjs`：历史恢复、时间线、来源展开、四类 finalResult、COMPLETED/DEGRADED/FAILED/STOPPED_LIMIT、loading/empty/error、refresh recovery 与敏感字段不渲染。
- `tests/bounded-agentic-rag.integration.mjs`：真实 HTTP 历史读取、ownership 404，并继续覆盖 Stage 9A 创建、bounded loop、retrieval/sourceRefs、grounding、prompt injection、provider/retrieval failure 与审计。
