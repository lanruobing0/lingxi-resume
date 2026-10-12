# 项目上下文索引

- 最新任务：`docs/tasks/RESUME_VERSION_DELETE.md`，简历版本历史确认删除，完成待独立验收。

- 最新任务：`docs/tasks/ANALYSIS_HISTORY_DELETE.md`，报告版本与分析任务删除，完成待独立验收。
- 最新运行修复：`docs/tasks/QDRANT_PORT_RECOVERY.md`，Windows 保留端口导致 Qdrant 无法启动，已切换 16333 并恢复就绪。


项目：灵犀简历（技术项目名称：基于 Agentic RAG 的 AI 简历优化与岗位智能匹配平台）。

## 文档职责

- 最新界面修复：`docs/tasks/LANDING_ALIGNMENT.md`，首页预览居中与手机布局，待独立验收。

- 最新修复：`docs/tasks/REPORT_CITATION_CHAIN.md`，报告完整引用编号、技术语境误判和统一一次纠正，待独立验收。

- 最新修复：`docs/tasks/REPORT_BASE_EVIDENCE.md`，报告基础事实证据白名单与一次纠正，待独立验收。

- 最新修复：`docs/tasks/REPORT_OUTPUT_LIMIT.md`，报告输出截断额度与错误归类，待独立验收。

- 最新修复：`docs/tasks/MATCH_EVIDENCE_VALIDATION.md`，匹配原文证据解码校验与经历引用约束，待独立验收。

- 最新修复：`docs/tasks/REPORT_RESUME_VERSION_BINDING.md`，Agent 简历旧 v1 报告提示与选择绑定保护，待独立验收。

- 最新修复：`docs/tasks/RESUME_AUTOSAVE.md`，简历编辑器真正自动保存、串行请求与失败重试，完成待独立验收。

- 最新界面调整：`docs/tasks/JD_LIST_DELETE.md`，岗位 JD 列表确认删除，完成待独立验收。

- 最新修复：`docs/tasks/REPORT_MATERIAL_RETRIEVAL_FIX.md`，报告检索排除公共面试资料，待独立验收。

- 最新修复：`docs/tasks/INTERVIEW_INTERRUPTED_RECOVERY.md`，重启遗留面试准备中恢复与空白提示，待独立验收。

- 最新追加：独立面试记录列表删除，交接 `docs/tasks/WORKSPACE_HISTORY_DELETE.md`，待独立验收。

- 当前任务：`docs/tasks/INTERVIEW_MATERIAL_SELECTION.md`，每次面试资料确认、检索范围限制和历史快照，完成待独立验收。

- 最新界面调整：`docs/tasks/MATERIALS_UI_POLISH.md`，面试资料页布局收紧，待独立验收。

- 当前运行修复：`docs/tasks/DOCKER_STARTUP_FIX.md`（2026-10-10）；项目启动器新增 Docker 冷启动 socket 残留保护，真实冷/热启动验证完成，待独立验收。

- 长期开发规则：`AGENTS.md`
- 当前代码与阶段状态：`docs/PROJECT_STATUS.md`
- 当前任务边界：`docs/CURRENT_TASK.md`
- 已确定架构决策：`docs/DECISIONS.md`
- 阶段任务说明：`docs/tasks/`
- 当前任务：个人面试资料；交接 `docs/tasks/PERSONAL_INTERVIEW_MATERIALS.md`，实现完成待独立验收。
- 当前阶段状态：Stage 10 已通过最终验收；真实 MySQL Integration 已验证；Lingxi Resume Agentic RAG 项目正式完成。
- Claude 独立验收记录：`docs/reviews/`
- RAG 长期路线：`docs/RAG_UPGRADE_PLAN.md`
- RAG 数据模型：`docs/RAG_DATA_MODEL.md`
- 快速运行交接：`AI_HANDOFF.md`、`PROJECT_MEMORY.md`

## 新 Codex 窗口推荐阅读顺序

1. `AGENTS.md`
2. 本文件
3. `docs/PROJECT_STATUS.md`
4. `docs/CURRENT_TASK.md`
5. `docs/DECISIONS.md`
6. 当前阶段的 `docs/tasks/` 文件
7. 最近的 `docs/reviews/` 验收报告
8. 与任务相关的代码、测试与 Git diff

## 新 Claude 窗口推荐审查顺序

1. 本文件、`docs/PROJECT_STATUS.md`、`docs/CURRENT_TASK.md`
2. 当前阶段任务文件和最近的验收记录
3. `git status --short`、`git log --oneline -10`、本阶段 diff
4. 相关 API、数据模型、隐私过滤与授权校验
5. 本阶段测试及其真实运行结果

不要把本索引当作事实来源；状态结论必须以代码、测试和 Git 记录核实。
