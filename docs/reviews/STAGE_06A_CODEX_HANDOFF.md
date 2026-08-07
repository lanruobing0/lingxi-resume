# 阶段 6A Codex 实施交接

最终状态：阶段 6A 已通过 Claude 最终独立验收及全部发布门禁；允许合并 master 并创建 rag-stage-6a-passed。Stage 6B 尚未开始。

## 实际架构

- `backend/server.js` 保持 API 与 JSON Store 边界；新增 `matchReports` 和 JobApplication 的 JD 规范化文本哈希。
- `backend/grounded-report-service.js` 从阶段 3 六个维度确定性构造检索计划，直接调用生产 `KnowledgeRetrievalService`，保存每维度 query/hash、RetrievalRun ID 和候选 Chunk IDs；未复制关键词、RRF、向量或 Qdrant 逻辑。
- `backend/grounded-report-prompt.js` 提供 `grounded-match-report-v1` 严格 JSON schema/Prompt；`backend/citation-validator.js` 用 RetrievalRun candidateRefs 和本地 Chunk/Document 重验引用。
- RetrievalRun 新增无正文 `candidateRefs`（Chunk/Document/version/indexRun/hash/rank/source），不保存向量、密钥或 provider 请求体。

## 数据、API 与契约

MatchReport 绑定 owner、Application/Match、ResumeVersion/hash、JD/ParseResult/原文与规范化哈希、基础规则、Prompt、Provider/model、生成配置 hash 和 RetrievalRun IDs。每次 POST 增加 `reportVersion`，内容为结构化摘要、六维报告、优缺点/建议、Claims 与引用状态。

- `POST /api/job-applications/:id/reports`：必须提供 owned completed `matchId`；默认 `HYBRID`；`useReranker` 仅接受 JSON boolean。
- `GET /api/match-reports/:id`：仅 owner；历史 quote 不变，返回实时 `AVAILABLE`/`UNAVAILABLE`。

Claim 类型为 `BASE_MATCH_FACT`、`KNOWLEDGE_CLAIM`、`MODEL_SUGGESTION`。基础事实只可引用阶段 3 的精确已验证证据；知识主张要有连续本地 quote；模型建议必须以“建议：”开头。报告路径不从 Markdown 或正则猜测 JSON。

## 引用、降级与隐私

验证器先检查报告 Run 所有权、candidateRefs 成员、本地 Document/Chunk 存在、`PROCESSED`/`INDEXED`、processingVersion/activeIndexRun、一致 document/chunk/hash/version，以及 quote 是本地连续子串。Qdrant payload 正文永不作为来源。

随后 `backend/claim-support-validator.js` 执行版本化 `claim-support-v4`。P1 从拆分后的并列单元去除纯引导语，再要求每个实质单元至少有一条 quote 支持；“共同”“并”作为并列而非因果，0.55 全局阈值没有降低。P2 为他/她加入中英文逗号等句界与“负责/掌握”等谓词，同时保持“其他”通用表达不受影响。真实 HTTP 报告精确断言三个合法并列 Claim 均为 `COMPLETED`、零丢弃、覆盖率 1，并对中文逗号后的归因断言 `DEGRADED`、正确失败码及最终 Claims。

非法知识 Claim 会删除并记录原因；部分删除、无知识、向量关键词回退或 Reranker 回退为 `DEGRADED`；无可保留 Claim、Provider/JSON/检索错误为 `FAILED` 并保留新历史。

实现的稳定码：`REPORT_INPUT_INVALID`、`REPORT_MATCH_NOT_FOUND`、`REPORT_MATCH_NOT_COMPLETED`、`REPORT_RETRIEVAL_FAILED`、`REPORT_PROVIDER_NOT_CONFIGURED`、`REPORT_PROVIDER_UNAVAILABLE`、`REPORT_INVALID_RESPONSE`、`REPORT_CITATION_INVALID`、`REPORT_NO_SUPPORTED_CLAIMS`。

模型只接收 `buildAiResumeContext`、锁定 JD/ParseResult、阶段 3 事实和本地候选 Chunk。测试断言 prompt/报告记录不会泄漏联系方式、Cookie、API Key 或伪造 Qdrant 正文；既有本地 AI 配置持久化机制未改动。

## 测试与命令

`tests/grounded-match-report.integration.mjs` 走真实 HTTP API，Mock 仅替代 Provider、Embedding、Qdrant、Reranker。覆盖成功/重启/版本、两用户隔离、Application 不存在和跨用户 POST、伪造/历史其他 run/其他文档/错误 quote/旧版本/重复/缺失引用、部分 Claim、无知识、向量及重排降级、Provider 未配置/503/超时、非法 JSON/枚举/空报告、Match 状态、撤回后历史可读且新报告不能引用撤回来源、成功正文不被失败覆盖、输入哈希/Prompt/provider/model/config hash 与 backend 输出脱敏。

固定支持性攻击表：

| 场景 | 预期 |
| --- | --- |
| 同关键词但归因给用户 | `UNSUPPORTED_USER_ATTRIBUTION`，Claim 删除 |
| 建议升级为已完成事实 | `POLARITY_MISMATCH` |
| 虚构 50% 或 5 年 | `UNSUPPORTED_NUMBER` |
| 虚构 Redis/Kafka/Kubernetes | `UNSUPPORTED_ENTITY` |
| 否定/限定语义扭曲 | `POLARITY_MISMATCH` |
| Java 项目结果通用建议 | `SUPPORTED` |
| 吞吐量 + 响应延迟双引用 | `SUPPORTED`，`citationCount=2` |
| MODEL_SUGGESTION | 不进入知识事实支持校验 |

以下均为 exit 0：

- `node --check backend/server.js` 及所有新增/修改 6A 模块
- `node tests/grounded-match-report.integration.mjs`
- `corepack pnpm test`
- `corepack pnpm test:retrieval-eval`
- `corepack pnpm build`
- `corepack pnpm test:qdrant`
- `corepack pnpm test:qdrant-retrieval`
- `git diff --check`

真实 Qdrant smoke 和 retrieval smoke 均 exit 0。未启动持久化前端/后端服务；测试自启后端并停止。

## 风险与验收请求

JSON 单文件不适用于生产并发；MySQL 仅更新参考结构。基础事实的语义忠实性由精确证据引用约束，仍应由 Claude 人工审查 Claim 文本边界。没有报告 UI、简历修改、建议接受、Agent 或用户自由检索。

未跟踪交付物 `Lingxi-Resume-delivery.zip`、`Lingxi-Resume-submission.zip` 和 `deliverables/` 必须保持未改动、未暂存。分支为 `feat/rag-stage-6a-grounded-report`；阶段 6A 已通过 Claude 最终独立验收及全部发布门禁；允许合并 master 并创建 rag-stage-6a-passed。Stage 6B 尚未开始。

未覆盖风险：确定性规则有意保守，面对同义改写、复杂跨句因果或中文专有名词时可能删除原本合理的通用 Claim；它不会调用另一个模型裁决，也不会放宽为模型自证。生产并发与 MySQL 迁移仍不在本阶段范围。

第五次 Claude 独立验收已通过；阶段 6A 已通过 Claude 最终独立验收及全部发布门禁；允许合并 master 并创建 rag-stage-6a-passed。Stage 6B 尚未开始。
