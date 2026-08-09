# Stage 10：Production Hardening & Evaluation

状态：Stage 10 已通过最终验收；真实 MySQL Integration 已验证；Lingxi Resume Agentic RAG 项目正式完成。

## 已完成范围

- 业务层统一经 persistence abstraction 访问 JSON 或 MySQL；`STORAGE_DRIVER=json` 保持现有本地测试行为，`mysql` 使用环境变量与非破坏性迁移。
- 有界 in-process Job worker 覆盖 grounded report、resume suggestions、mock interview generation 与 AgentRun；同步 API 默认路径保留兼容。
- 增加 `/health`、`/ready`、启动配置校验、AI timeout/failureCode、关闭时停止新 Job，以及不含敏感正文的结构化日志。
- 新增固定 deterministic mock 的 `test:rag-eval` 和 production hardening regression；不调用真实收费 AI。
- 最终整改统一透传 `AI_PROVIDER_TIMEOUT`，并用挂起的真实 HTTP mock 验证同步请求和异步 Job；retrieval evaluation 使用固定 corpus/query/expected refs 调用生产 `KnowledgeRetrievalService` 生成 actual results。

## 边界未改变

- 不新增业务功能、Stage 11、多 Agent、shell/browser Agent、自动修改 Resume 或自动 ACCEPT suggestion。
- Stage 5-9 的 ownership、ResumeVersion/hash、evidence grounding、interview facts、Agent allowlist/maxSteps、prompt injection isolation 与 source validation 不放宽。
- 本阶段完成后停止，等待 Claude 最终独立验收。
