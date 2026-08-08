# 架构决策

| 决定 | 原因 | 影响 | 日期/阶段 |
| --- | --- | --- | --- |
| RAG MVP 完成前不迁移 Spring Boot | 当前 Node HTTP API 已承载现有功能，迁移会扩大风险 | 继续以 `backend/server.js` 为 API 边界 | 阶段 1-3 |
| 阶段 3 不使用 RAG | 先建立可复算、可审计的基础匹配基线 | 不引入 Qdrant、Embedding、Reranker、知识库或 Agent | 阶段 3 |
| AI 负责语义判断与证据提取，后端负责最终评分 | 防止不可解释的模型总分 | 使用固定权重重新计算并校验证据 | 阶段 3 |
| 第三方 AI 不接收联系方式和照片 | 保护求职者隐私 | 只使用 `buildAiResumeContext` 的岗位相关字段 | 阶段 1 起 |
| 运行时数据继续使用本地 JSON | 当前实现与测试均围绕 JSON 隔离存储 | `backend/data/store.json` 不提交；MySQL 仅作参考 | 当前 |
| `database.sql` 是生产迁移参考 | 当前未接入 MySQL 运行时 | 禁止把它误当作本地服务的实际数据层 | 阶段 1 起 |
| Codex 开发，Claude 独立只读验收 | 分离实现与验收职责 | 每阶段完成后停止，等待验收 | 当前流程 |
| 阶段通过验收后单独提交并打标签 | 保留可回溯的交付基线 | 建议阶段 2 标签 `rag-stage-2-passed`；阶段 3 通过后再建 `rag-stage-3-passed` | 当前流程 |
| 阶段 4 先采用管理员维护的 JSON 知识库 | 先建立可测试、可追溯的文本与元数据链路，避免过早接入检索基础设施 | 运行时保存 Document、Chunk 和不可覆写 ProcessingRecord；后续检索只能消费成功 chunks | 阶段 4 |
| 知识资料重处理采用成功后替换 | 防止错误处理清空已可用的资料 | 原文/策略不变时幂等返回；新处理失败保留上一版 chunks，并记录失败原因 | 阶段 4 |
| 知识库管理接口只允许 ADMIN | 公共岗位资料不应被普通用户随意读取或修改 | 后端每个 `/api/admin/knowledge-*` 路由执行服务端角色校验，前端只隐藏入口 | 阶段 4 |
| 阶段 5A 按 Embedding Profile 隔离 Qdrant Collection | 模型、维度或输入格式不同的向量不可混用 | Collection 名由受控前缀、profileId、维度和 schema 版本计算；配置不匹配拒绝写入 | 阶段 5A |
| 本地 activeIndexRunId 是有效向量的权威来源 | 外部 Point 可能在清理失败后暂留 | 只有写入验证完成后才切换；旧 Point 残留不得被后续检索视为有效 | 阶段 5A |
| 阶段 5B 以本地当前状态复核 Qdrant 命中 | Qdrant payload 可能陈旧或孤立 | 仅返回当前 PROCESSED/INDEXED 文档、当前 Chunk 版本且 Point `indexRunId` 等于 `activeIndexRunId` 的结果 | 阶段 5B |
| 混合检索默认使用确定性 RRF | 关键词分数与 cosine 分数不可直接相加 | 保留两路排名/贡献，Reranker 默认关闭且失败回退 RRF | 阶段 5B |
| Stage 9A Agent tool policy 完全由服务器持有 | 检索内容和模型输出都可能包含 Prompt Injection 或任意工具名 | 只执行六项固定只读 action；模型只返回 action/reason/query/done，未知 action 以 `AGENT_ACTION_NOT_ALLOWED` 停止 | 阶段 9A |
| Stage 9A 同步 run 最多执行 6 个单 action step | 第一版需要可审计、可预测地终止，不能由模型扩大预算或递归 | maxSteps 由 API 校验并受服务器硬上限约束；超限状态为 `STOPPED_LIMIT`，不做无限 retry 或 recursive agent | 阶段 9A |
| Agent 最终输出按四类事实边界持久化且只读 | JD、MatchReport 和 Knowledge 不能证明用户已有经历 | VERIFIED_RESUME_FACT 只能引用锁定 ResumeVersion；外部知识、匹配缺口和建议分层保存，禁止自动写回 Resume 或 JobApplication | 阶段 9A |
| Stage 9A 检索只复用 Stage 5B KnowledgeRetrievalService | 避免第二套检索逻辑和不可追溯 sourceId | AgentStep 保存真实 retrievalRunId 与候选 sourceRefs；失败/降级 RetrievalRun 仍保留审计 | 阶段 9A |
| VERIFIED_RESUME_FACT 类型本身触发完整 Resume claim-support | 真实 RESUME sourceId 可能引用无关 quote，sourceType 不能自动授权用户事实 | 每条 claim 必须由其实际引用的锁定 Resume quote 支持；不依赖 action verb，失败使用 `AGENT_UNSUPPORTED_RESUME_FACT` | 阶段 9A 首验整改 |
| Stage 9B UI 只消费服务器保存的 Agent 审计状态 | 前端不能成为第二个 planner 或放大 Agent 权限 | 创建请求不提交 action/tool/maxSteps；历史、详情、步骤均从 9A API 恢复，来源与摘要按显示字段白名单映射 | 阶段 9B |
