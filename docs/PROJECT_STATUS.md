# 项目状态

最后核实：2026-08-05（阶段 4 已完成，并通过 Claude 二次独立验收；依据代码、测试、生产构建和最终验收记录）。

## 当前技术栈与数据层

- React 18、Vite、plain CSS、lucide-react、dnd-kit。
- Node 原生 HTTP API：`backend/server.js`。
- 当前运行时持久化：本地 JSON `backend/data/store.json`；该文件是运行时数据，不纳入 Git。
- `database.sql` 是 MySQL 结构和增量迁移参考，当前 Node 服务不会执行它。

## 已完成能力

- 登录、会话、用户数据隔离与 AI 配置管理。
- 简历库、编辑器、A4 预览、多个结构化简历模板与版本快照。
- 真实 AI 简历诊断、润色、语法检查、模拟面试和历史记录。
- 真实 JD 的保存、编辑、AI 解析、原文证据校验及 JobApplication 关联。
- 阶段 3 基础岗位匹配：基于固化 ResumeVersion 与 JD ParseResult 的七项输入绑定、六维固定权重评分与后端 `totalScore` 重算、简历/JD 双向证据校验、匹配历史及 FAILED 状态、多用户权限隔离、AI Prompt 隐私过滤，以及必备技能、加分技能和关键词展示。
- 阶段 3 回归覆盖：A/B 简历匹配同一 JD、同一简历匹配双 JD、JD 删除级联和同一 Application 成功后失败的历史保护。
- 阶段 4 岗位知识库：管理员专用的文本资料 CRUD、来源/岗位元数据、原始 rawText 审计保存、标题路径识别、语义优先切片、hash 与近似 token 记录、处理历史、幂等重试、失败保留旧 chunks 与删除级联。短行标题采用上下文启发式，不将技能/职责短行一概视为标题。

## RAG 升级阶段

| 阶段 | 内容 | 验收状态 |
| --- | --- | --- |
| 1 | 简历数据链修复与 ResumeDTO/版本绑定 | 已通过 Claude 二次验收（既有交接记录） |
| 2 | 真实 JD 管理、解析与 JobApplication | 已通过 Claude 二次验收（既有交接记录） |
| 3 | 基于真实简历与真实 JD 的基础岗位匹配 | 已完成，并通过 Claude 二次独立验收 |
| 4 | 岗位知识库与文档处理链路 | 已完成，并通过 Claude 二次独立验收 |

当前尚未接入 Qdrant、Embedding、Reranker、知识库检索或 RAG；阶段 4 仅完成受控文本与 chunk 数据链路。

## 已有 API（摘要）

- 认证与账户：`/api/auth/*`、`/api/users/me`
- 简历：`/api/resumes`、`/api/resumes/:id`、`/api/resumes/:id/versions/*`
- AI：`/api/resumes/:id/{analyze,optimize,grammar-check}`、`/api/ai-config`
- JD 与申请：`/api/job-descriptions`、`/api/job-descriptions/:id/parse`、`/api/job-applications`
- 基础匹配：`POST/GET /api/job-applications/:id/matches`、`GET /api/resume-job-matches/:matchId`、`POST /api/resume-job-matches/:matchId/retry`
- 面试与记录：`/api/interviews`、`/api/records/*`
- 知识库管理（仅 ADMIN）：`/api/admin/knowledge-documents`、`/api/admin/knowledge-chunks/*`

## 已有测试与验证命令

- `tests/job-description.integration.mjs`：隔离的本地 mock AI 与临时 JSON 数据目录。
- `tests/isolation.integration.mjs`：用户隔离、简历绑定、隐私过滤和删除级联。
- `tests/resume-job-match.integration.mjs`：固定加权评分、快照/哈希绑定、证据校验、失败记录与匹配隔离。
- `tests/knowledge-base.integration.mjs`：管理员权限、清洗/章节/切片、幂等、版本、失败保护、级联删除、隔离与 JSON 重启持久化。
- `corepack pnpm test`、`node --check backend/server.js`、`corepack pnpm build`。

## 尚未实现与技术债务

- Qdrant/Embedding、向量检索、重排、RAG 报告、Agent 工作流和生产级异步任务。
- `src/App.jsx` 与 `src/styles.css` 较大，应在已批准任务中渐进拆分。
- JSON 单文件存储不适用于生产并发；迁移 MySQL/worker 需单独批准。
- 阶段 4 已知非阻断限制：没有正文的显式标题不会单独生成 Chunk；编辑岗位/标签后，旧 chunks 中的元数据副本会在下一次成功处理时更新；`knowledgeMinLength` 目前仅保留为策略参数，未参与合并规则；开发环境未对内部 `HttpError` 日志做脱敏格式化。
