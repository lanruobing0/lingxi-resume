# 项目状态

最后核实：2026-08-04（依据 `package.json`、`backend/server.js`、`src/App.jsx`、`tests/`、Git 最近提交与既有文档）。

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

## RAG 升级阶段

| 阶段 | 内容 | 验收状态 |
| --- | --- | --- |
| 1 | 简历数据链修复与 ResumeDTO/版本绑定 | 已通过 Claude 二次验收（既有交接记录） |
| 2 | 真实 JD 管理、解析与 JobApplication | 已通过 Claude 二次验收（既有交接记录） |
| 3 | 基于真实简历与真实 JD 的基础岗位匹配 | 允许开始，尚未实施 |

当前尚未接入 Qdrant、Embedding、Reranker、知识库检索或 RAG。

## 已有 API（摘要）

- 认证与账户：`/api/auth/*`、`/api/users/me`
- 简历：`/api/resumes`、`/api/resumes/:id`、`/api/resumes/:id/versions/*`
- AI：`/api/resumes/:id/{analyze,optimize,grammar-check}`、`/api/ai-config`
- JD 与申请：`/api/job-descriptions`、`/api/job-descriptions/:id/parse`、`/api/job-applications`
- 面试与记录：`/api/interviews`、`/api/records/*`

## 已有测试与验证命令

- `tests/job-description.integration.mjs`：隔离的本地 mock AI 与临时 JSON 数据目录。
- `tests/isolation.integration.mjs`：用户隔离、简历绑定、隐私过滤和删除级联。
- `corepack pnpm test`、`node --check backend/server.js`、`corepack pnpm build`。

## 尚未实现与技术债务

- 阶段 3 的基础岗位匹配报告及其测试。
- RAG 知识库、切片、向量检索、重排、Agent 工作流和生产级异步任务。
- `src/App.jsx` 与 `src/styles.css` 较大，应在已批准任务中渐进拆分。
- JSON 单文件存储不适用于生产并发；迁移 MySQL/worker 需单独批准。
