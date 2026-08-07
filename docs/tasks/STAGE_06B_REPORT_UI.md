# 阶段 6B：Grounded Match Report UI

状态：阶段 6A + 6B 已完成，Stage 6 基于 RAG 的岗位匹配报告已通过全部验收和发布门禁；Stage 7 尚未开始。

## 目标与边界

将阶段 6A 已完成的可引用岗位匹配报告接入用户侧的岗位 JD / 求职分析任务页面。报告入口必须绑定已选择的 `jobApplicationId` 与已完成的 `resumeJobMatchId`，不使用 current resume、最近简历或其他 Match。

本阶段只实现报告 UI、最小历史摘要读取 API、响应式交互与测试；不重写检索、RRF、报告生成、引用验证或 `claim-support-v4`，不修改简历，不实施 JSON Patch、Agent、模拟面试、自由问答或 MySQL 迁移。

## 实现内容

- 在基础岗位匹配区后增加“生成 AI 岗位匹配报告”入口；请求固定发送真实接口支持的 `{ matchId, searchMode: "HYBRID", useReranker: false }`，其中 `useReranker` 为 JSON boolean。
- 客户端生成中显示明确 loading/skeleton 并禁用重复提交；`COMPLETED` 显示完整报告，`DEGRADED` 显示保守降级提示，`FAILED` 显示稳定 failureCode 的用户文案与重新生成入口，绝不以默认样例充当报告。
- 报告展示锁定的简历版本、基础匹配分、报告版本、生成时间和 evidenceCoverage；展示综合结论、按后端 `dimensionReports` 顺序的六维分析、strengths、gaps、recommendations，以及 Claim 类型。
- `BASE_MATCH_FACT` 显示为“来自简历/JD 的事实”，`KNOWLEDGE_CLAIM` 显示为“来自知识资料”，`MODEL_SUGGESTION` 显示为“AI 建议”，不把建议呈现为事实。
- Citation 抽屉使用 API 的 quote 快照与本地安全元数据；显示文档标题、章节、文档类型、岗位/技能标签与当前 `AVAILABLE` / `UNAVAILABLE` 状态。历史引用不可用时保留 quote 并明确说明“该来源生成报告时有效，目前已不可用。”
- 新增最小只读 `GET /api/job-applications/:id/reports`：仅返回当前用户、当前 Application 的报告摘要（版本、状态、模型、证据覆盖、时间、失败码），不返回 report body、向量、Qdrant payload、检索内部字段或密钥。详情继续使用既有 `GET /api/match-reports/:id`。

## 验证范围

`tests/grounded-match-report.integration.mjs` 覆盖真实 HTTP 的报告生成、Application/Match 绑定、跨用户隔离、历史摘要、完成/降级/失败持久化、历史版本、AVAILABLE/UNAVAILABLE 引用及敏感字段不泄漏。前端以这些真实 API 响应渲染，不复制或伪造报告契约。

验收前需运行相关 `node --check`、报告集成测试、`corepack pnpm test`、`corepack pnpm test:retrieval-eval`、`corepack pnpm build`、双 Qdrant smoke 与 `git diff --check`。
