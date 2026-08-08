# 项目上下文索引

项目：灵犀简历（技术项目名称：基于 Agentic RAG 的 AI 简历优化与岗位智能匹配平台）。

## 文档职责

- 长期开发规则：`AGENTS.md`
- 当前代码与阶段状态：`docs/PROJECT_STATUS.md`
- 当前任务边界：`docs/CURRENT_TASK.md`
- 已确定架构决策：`docs/DECISIONS.md`
- 阶段任务说明：`docs/tasks/`
- 当前任务：Stage 9A Bounded Agentic RAG backend 已通过；Stage 9B UI 尚未开始。
- 当前阶段状态：Stage 9A Bounded Agentic RAG backend 已通过；Stage 9B UI 尚未开始。
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
