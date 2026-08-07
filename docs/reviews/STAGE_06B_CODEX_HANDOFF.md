# 阶段 6B Codex 实施交接

状态：阶段 6A + 6B 已完成，Stage 6 基于 RAG 的岗位匹配报告已通过全部验收和发布门禁；Stage 7 尚未开始。

- 分支：`feat/rag-stage-6b-report-ui`。Claude 第一次独立验收已通过，允许完成 Git 收尾。
- UI 位于现有 `JobDescriptionWorkspace` 的已选 Application / 已完成基础 Match 流程中；报告生成显式绑定当前 Application 与 Match，发送 `matchId`、`searchMode: "HYBRID"` 与 JSON boolean `useReranker: false`。
- UI 使用 Stage 6A 的 `POST /api/job-applications/:id/reports`、`GET /api/match-reports/:id`，并新增受 owner 和 Application 限制的最小 `GET /api/job-applications/:id/reports` 历史摘要接口。摘要不含 `content`、向量、Qdrant payload 或密钥。
- `publicMatchReport` 仅以本地 Chunk/Document 安全地派生 citation 的 headingPath、documentType、jobFamily、seniority、skillTags、language 与 AVAILABLE/UNAVAILABLE；不使用 Qdrant payload，保留已保存 quote 快照。
- `GroundedMatchReport` 区分简历/JD 事实、知识资料与 AI 建议；`CitationDrawer` 支持 Escape/关闭按钮、移动端全宽适配与不可用来源提示。失败文案只映射稳定 failureCode，不显示原始内部错误。
- `tests/grounded-match-report.integration.mjs` 新增历史摘要 owner 隔离、摘要脱敏与 citation 安全元数据断言；原有成功、降级、失败、历史版本和撤回来源测试持续覆盖。

未覆盖风险：当前浏览器会话未登录且不应写入用户运行数据，因此只完成匿名页面和构建级视觉核验；带有真实报告内容的桌面/移动端最终手工交互需在已登录且已有 Application/Match/Report 的用户会话中复验。该限制不影响真实 HTTP 契约测试。
