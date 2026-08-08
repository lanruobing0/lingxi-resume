# 项目状态

最后核实：2026-08-09（Stage 9A Bounded Agentic RAG backend 已通过；Stage 9B UI 尚未开始）。

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
- 阶段 5A 向量索引生命周期：OpenAI Compatible Embedding Provider、Profile 隔离的 Qdrant Collection、稳定 embedding 输入哈希及 Point ID、写入验证、原子 active run 切换、旧 Point 清理追踪、删除同步和 ADMIN 索引管理。失败不会激活半成品索引；尚无检索或 RAG。
- 阶段 5B ADMIN 知识检索闭环：稳定查询规范化、关键词与当前有效向量召回、服务端一致过滤、确定性 RRF、可选且可回退的 Reranker、可持久化的 RetrievalRun、最小黄金集评测入口和真实 Qdrant smoke。仅供管理员检索实验室使用，不生成 RAG 回答。
- Stage 7 已正式完成：7A 的锁定 MatchReport 后端闭环、Evidence-backed Rewrite、受限 JSON Patch、乐观并发校验和策略 A 失效，已由 7B 的 Resume Suggestion UI 闭环呈现。UI 支持 SuggestionRun 历史、逐条 before/after diff、Accept/Reject、FACT_REQUIRED 限制、INVALIDATED 原因和只读 ResumeVersion 历史；7A 的 ownership、版本冲突、patch/evidence validation 安全边界未削弱。Claude 独立验收结论为 A. 通过，无高/中问题，全部发布门禁 exit 0；L1-L4 作为低优先级后续项保留。
- Stage 8A RAG Mock Interview backend 已通过 Claude 最终独立验收：JobApplication/MatchReport/锁定 ResumeVersion 输入绑定、四类可追溯问题、Stage 5B RetrievalRun 复用、逐题回答、grounded feedback、失败/降级审计、跨用户 404，以及 question/expectedPoints/improvedAnswer 用户事实 grounding 均已完成。
- Stage 8B RAG Mock Interview UI 已通过 Claude 最终独立验收，结论 A：从岗位报告创建/恢复 session、四类逐题展示、answer/feedback、建议回答事实边界提示、安全知识来源、FAILED/DEGRADED、后端完成分数与当前 JobApplication 历史回看均已接通；未修改 Stage 8A grounding/security。Stage 8 已正式完成。
- Stage 9A Bounded Agentic RAG backend 已通过 Claude 第二次独立验收，结论 A，无高/中问题。`VERIFIED_RESUME_FACT` 已改为 unconditional claim-support，实际引用的锁定 Resume quote 必须实质支持 claim，真实但无关的 RESUME source laundering 已关闭；原有 allowlist、bounded loop、Stage 5B RetrievalRun、Prompt Injection、其他 finalResult 类型及 Stage 5–8 边界保持不变。全部发布门禁和真实 Qdrant 双 smoke exit 0；Stage 9B UI 尚未开始。

## RAG 升级阶段

| 阶段 | 内容 | 验收状态 |
| --- | --- | --- |
| 1 | 简历数据链修复与 ResumeDTO/版本绑定 | 已通过 Claude 二次验收（既有交接记录） |
| 2 | 真实 JD 管理、解析与 JobApplication | 已通过 Claude 二次验收（既有交接记录） |
| 3 | 基于真实简历与真实 JD 的基础岗位匹配 | 已完成，并通过 Claude 二次独立验收 |
| 4 | 岗位知识库与文档处理链路 | 已完成，并通过 Claude 二次独立验收 |
| 5A | Embedding Provider 与 Qdrant 向量索引生命周期 | 已完成，并通过 Claude 最终独立验收 |
| 5B | 管理员关键词/向量混合检索与可选重排序 | 已完成真实 Qdrant 复验，全部发布门禁通过；允许合并 master 并创建 `rag-stage-5b-passed` 标签 |
| 6A | 可引用岗位匹配报告后端闭环 | 已通过 Claude 最终独立验收及全部发布门禁，已合并 master 并创建 `rag-stage-6a-passed` 标签 |
| 6B | Grounded Match Report UI | 阶段 6A + 6B 已完成，Stage 6 基于 RAG 的岗位匹配报告已通过全部验收和发布门禁。 |
| 7A | Resume Suggestions & Versioning Backend | 已通过 Claude 最终独立验收。 |
| 7B | Resume Suggestion UI | 已通过 Claude 独立验收；Stage 7 正式完成。 |
| 8A | RAG Mock Interview Backend | 已通过 Claude 最终独立验收。 |
| 8B | Mock Interview UI | 已通过 Claude 最终独立验收；Stage 8 正式完成。 |
| 9A | Bounded Agentic RAG Backend | 已通过 Claude 第二次独立验收，结论 A；无高/中问题，全部门禁及真实 Qdrant 双 smoke exit 0。 |

阶段 5B 只新增 ADMIN 知识检索，不提供用户侧检索、RAG Prompt、生成式回答、引用式回答、简历修改或 Agent 工作流。

## 已有 API（摘要）

- 认证与账户：`/api/auth/*`、`/api/users/me`
- 简历：`/api/resumes`、`/api/resumes/:id`、`/api/resumes/:id/versions/*`
- AI：`/api/resumes/:id/{analyze,optimize,grammar-check}`、`/api/ai-config`
- JD 与申请：`/api/job-descriptions`、`/api/job-descriptions/:id/parse`、`/api/job-applications`
- 基础匹配：`POST/GET /api/job-applications/:id/matches`、`GET /api/resume-job-matches/:matchId`、`POST /api/resume-job-matches/:matchId/retry`
- 面试与记录：旧版兼容 `/api/interviews`、`/api/records/*`；Stage 8 `/api/job-applications/:id/interview-sessions`、`/api/interview-sessions/:id/*`
- 知识库管理（仅 ADMIN）：`/api/admin/knowledge-documents`、`/api/admin/knowledge-chunks/*`
- 知识检索（仅 ADMIN）：`/api/admin/knowledge-retrieval/{status,search,runs}`
- 可引用报告：`POST /api/job-applications/:id/reports`、`GET /api/match-reports/:id`
- Bounded Agentic RAG：`POST /api/job-applications/:id/agent-runs`、`GET /api/agent-runs/:id`、`GET /api/agent-runs/:id/steps`

## 已有测试与验证命令

- `tests/job-description.integration.mjs`：隔离的本地 mock AI 与临时 JSON 数据目录。
- `tests/isolation.integration.mjs`：用户隔离、简历绑定、隐私过滤和删除级联。
- `tests/resume-job-match.integration.mjs`：固定加权评分、快照/哈希绑定、证据校验、失败记录与匹配隔离。
- `tests/knowledge-base.integration.mjs`：管理员权限、清洗/章节/切片、幂等、版本、失败保护、级联删除、隔离与 JSON 重启持久化。
- `tests/hybrid-retrieval.integration.mjs`：Reranker 正常/故障矩阵、关键词精确计分、参数与过滤矩阵、RRF、currentKnowledge 边界、RetrievalRun 脱敏与重启持久化。
- `tests/use-reranker-flag.integration.mjs`：严格 JSON boolean `useReranker` 契约。
- `tests/retrieval-evaluation.mjs`：固定黄金集的 Recall@K 与 MRR@K 评测入口。
- `tests/grounded-match-report.integration.mjs`：报告输入绑定、生产检索、严格 JSON、引用攻击、降级/失败、权限、重启、撤回与隐私。
- `tests/resume-suggestions.integration.mjs`：SuggestionRun 绑定、所有权、最小 Provider 输入、事实差异阻断、Patch allowlist、ACCEPT/REJECT、冲突、失效、失败持久化与 ResumeVersion 语义。
- `tests/rag-mock-interview.integration.mjs`：Session/ResumeVersion 绑定、四类问题、RetrievalRun/sourceRefs、回答、grounded feedback、Provider 失败、retrieval 降级、跨用户 404、四类 question/expectedPoints 伪造归因、improvedAnswer 虚构事实、当前 UserAnswer 合法支持与跨 session 隔离。
- `tests/bounded-agentic-rag.integration.mjs`：AgentRun/AgentStep 固定输入、tool allowlist、maxSteps、Stage 5B retrieval reuse/sourceRefs、Prompt Injection、未知 action、循环检索、伪造 sourceId、外部知识冒充经历、Provider/检索失败、ownership、隐私与逐步审计。
- `corepack pnpm test`、`corepack pnpm test:retrieval-eval`、`corepack pnpm test:qdrant`、`corepack pnpm test:qdrant-retrieval`、`node --check backend/server.js`、`corepack pnpm build`。

## 尚未实现与技术债务

- Stage 9 UI、异步队列/worker、恢复中断 run、多 Agent 与任何 autonomous write 均未实现；需后续单独批准，Stage 10 前不生产化。
- Stage 9A 低优先级后续：个别合法中文句式可能因 bigram 阈值被保守误拒；“百万级”等中文数字目前由技术实体/ngram coverage 兜底，尚未进入独立数值解析。
- Stage 8A 低优先级后续：`strengths/weaknesses/missingPoints` 文本 user-fact grounding 加固、retrieval `FAILED -> DEGRADED`、`questionCount=3` KNOWLEDGE 覆盖、feedback retry。
- Stage 8B 低优先级后续：duplicate code 映射 `INTERVIEW_ANSWER_DUPLICATE` / `EXISTS` 不一致；submit 成功后 refresh 失败可能显示 retrieval failed；缺少真实点击交互测试；completed 隐藏提交按钮缺显式断言；history 切换缺独立测试。
- 阶段 5B 已完成真实 Qdrant 复验，全部发布门禁通过，允许合并 master 并创建 `rag-stage-5b-passed` 标签；本轮未执行合并或打标签。
- `src/App.jsx` 与 `src/styles.css` 较大，应在已批准任务中渐进拆分。
- JSON 单文件存储不适用于生产并发；迁移 MySQL/worker 需单独批准。
- 阶段 4 已知非阻断限制：没有正文的显式标题不会单独生成 Chunk；编辑岗位/标签后，旧 chunks 中的元数据副本会在下一次成功处理时更新；`knowledgeMinLength` 目前仅保留为策略参数，未参与合并规则；开发环境未对内部 `HttpError` 日志做脱敏格式化。
