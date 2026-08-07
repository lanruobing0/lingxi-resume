# 阶段 6A：基于 RAG 的可引用岗位匹配报告后端闭环

状态：阶段 6A + 6B 已完成，Stage 6 基于 RAG 的岗位匹配报告已通过全部验收和发布门禁；Stage 7 尚未开始。

## 目标与边界

在既有阶段 3 `ResumeJobMatch` 和阶段 5B `KnowledgeRetrievalService` 上生成可审计的结构化岗位匹配报告。本阶段仅覆盖服务端生成、引用验证、JSON 持久化、API 与自动化测试；不实现报告 UI、简历修改、JSON Patch、Agent、通用聊天或用户自由检索。

## 不可变输入绑定

每次 `MatchReport` 都绑定 `userId`、`jobApplicationId`、`resumeJobMatchId`、`resumeId`、`resumeVersionId`、`resumeVersion`、`resumeContentHash`、`jobDescriptionId`、`jobDescriptionParseResultId`、JD 原文/规范化哈希、基础匹配算法版本、Prompt 版本、Provider/model、生成配置哈希和 RetrievalRun IDs。只接受具体已完成 `matchId`；绝不解析“当前”“最近”简历或 JD。每次生成产生递增 `reportVersion`，旧报告不被覆盖。

## 结构、状态与持久化

JSON Store 新增 `matchReports`，MySQL 参考表在 `database.sql` 的阶段 6A 注释迁移段。状态仅为 `PENDING`、`COMPLETED`、`DEGRADED`、`FAILED`。内容 JSON 包含 `executiveSummary`、六项 `dimensionReports`、`strengths`、`gaps`、`recommendations` 与 Claims。

Claim 必含 `claimId`、`sectionKey`、`text`、`claimType`、`citations`、`validationStatus`。`BASE_MATCH_FACT` 必须列出阶段 3 已验证的精确 `baseEvidence`，不得混入知识引用；`KNOWLEDGE_CLAIM` 必须有有效 Chunk 引用；`MODEL_SUGGESTION` 必须以“建议：”开头且不得伪装成事实。

## 检索、Prompt 与 JSON 契约

`backend/grounded-report-service.js` 从六项基础匹配维度、已锁定 JD ParseResult 和非敏感摘要按版本化模板确定性生成查询及元数据过滤，并直接调用生产 `KnowledgeRetrievalService`。不会复制关键词检索、RRF、Qdrant 或 currentKnowledge 检查。每个维度保存查询、hash、RetrievalRun ID 和候选 Chunk ID。HYBRID 是默认模式；`useReranker` 只接受 JSON boolean；向量不可用但关键词可用、或 Reranker 回退，均记录为 `DEGRADED`。

`backend/grounded-report-prompt.js` 提供 `grounded-match-report-v1` 和严格 JSON schema。生成调用复用既有 OpenAI-compatible Responses/chat fallback；本报告路径不接受 Markdown/正则猜测 JSON。Provider 无配置、不可用/超时、非法 JSON、空报告和非法枚举均持久化为失败。

## 引用验证

`backend/citation-validator.js` 逐条核验：引用 run 属于报告；Chunk 在该 run 的持久化 candidateRefs 中；本地 Chunk/Document 存在且 `PROCESSED`、`INDEXED`、processingVersion 与 activeIndexRun 一致；document/chunk/hash/version 对应；quote 是本地 Chunk 的连续子串。模型或 Qdrant payload 的正文从不可信任。

引用存在性通过后，`backend/claim-support-validator.js`（`claim-support-v4`）只使用已验证的本地 quote 执行确定性支持性校验。P1 在拆分显式并列 Claim 后剔除“知识资料/知识资料建议/建议/建议通过/建议使用/建议展示”等纯引导语，仅对真正实质单元要求至少一条 quote 支持；全局 `minimumSemanticCoverage = 0.55` 未降低。“共同”“并”仍是并列连接词，跨引用因果/结果拼接仍返回 `UNSUPPORTED_CROSS_CITATION_INFERENCE`。P2 将中英文逗号、句号、分号、冒号、问号、感叹号、空白和句首纳入他/她归因句界，并覆盖负责、掌握等人物事实谓词；普通“其他”不受影响。

## API 与稳定失败码

- `POST /api/job-applications/:id/reports`：body 为 `matchId`、可选 `searchMode`（默认 `HYBRID`）和可选严格 boolean `useReranker`。
- `GET /api/match-reports/:id`：仅报告所有者可读。

稳定失败码包括 `REPORT_INPUT_INVALID`、`REPORT_MATCH_NOT_FOUND`、`REPORT_MATCH_NOT_COMPLETED`、`REPORT_RETRIEVAL_FAILED`、`REPORT_PROVIDER_NOT_CONFIGURED`、`REPORT_PROVIDER_UNAVAILABLE`、`REPORT_INVALID_RESPONSE`、`REPORT_CITATION_INVALID`、`REPORT_NO_SUPPORTED_CLAIMS`。失败新建独立历史记录，不覆盖成功报告。

## 隐私

生成模型只接收 `buildAiResumeContext` 的非敏感版本、锁定 JD/解析结果、阶段 3 事实与本地 Chunk 正文。不得发送联系方式、profile fields、Cookie、Authorization、API key、完整请求头、向量、Qdrant payload 或其他用户数据。报告及 RetrievalRun 不保存向量、provider key、完整 provider 请求或堆栈。

## 自动化测试与 Claude 验收

`tests/grounded-match-report.integration.mjs` 通过真实 HTTP API 和临时 JSON Store，替换的仅是 Provider、Embedding、Qdrant 与 Reranker。它覆盖正常链、版本/重启、两用户隔离、无 PII/伪造 payload 泄漏、伪造/跨 run/其他文档/错误 quote/旧版本/重复/缺失引用、部分 Claim 降级、无知识证据、向量/重排降级、Provider 未配置/503/超时、非法 JSON/枚举/空报告、Match 未完成、输入错误以及撤回后旧报告可读和新报告不能引用撤回来源。固定攻击用例还验证用户事实归因、建议升级事实、虚构数字/年限/实体、否定扭曲、合法支持和多引用联合支持；测试捕获 backend 输出以检查 key、Authorization、Cookie、SECRET 和内部 payload 不泄漏。

Claude 应复核生产调用确实复用 `KnowledgeRetrievalService`，Claim 验证没有绕过本地 currentKnowledge 边界，失败记录与所有输入绑定完整，且 UI/简历改写/Agent 没有被引入。
