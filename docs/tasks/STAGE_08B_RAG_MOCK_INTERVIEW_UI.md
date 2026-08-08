# Stage 8B：RAG Mock Interview UI

状态：Stage 8 已正式完成；Stage 9 尚未开始。

## 范围

- 从 JobApplication 的 AI 岗位匹配报告创建 Stage 8A InterviewSession。
- 恢复当前 JobApplication 的历史 session、题目、用户回答与 AI feedback。
- 提供逐题回答、反馈、下一题、完成面试与只读回看闭环。
- 不修改 Stage 8A grounding/security，不实现 Stage 9 Agent，不提交或推送代码。

## UI 闭环

- 岗位匹配报告下新增 RAG 模拟面试工作区；独立“模拟面试”导航引导用户进入岗位 JD，避免继续使用旧版临时目标岗位链路。
- Session 状态覆盖 `PENDING`、`IN_PROGRESS`、`DEGRADED`、`FAILED`、`COMPLETED`。
- 四类题目展示 question、category、difficulty 与 rationale；来源入口只展示显式安全映射后的标题、摘要、来源类型与可用状态。
- 回答提交期间禁用按钮；已存在 `answerId` 的题目不再提供提交入口；409/422 使用稳定 failureCode 转换为可理解文案。
- Feedback 展示后端 score、strengths、weaknesses、missingPoints、improvedAnswer 与 followUpQuestion。所有反馈项均标注为 AI 反馈；improvedAnswer 明确标注为建议回答、不会写回简历且不代表新增或已验证经历。
- 全部反馈有效后调用后端 complete；averageScore 和每题 score 均读取后端结果，不在前端重算。

## 恢复与历史

- 进入或切换 JobApplication 时读取 `GET /api/job-applications/:id/interview-sessions`。
- 打开历史项时读取 `GET /api/interview-sessions/:id`，再依据每题 `answerId` 读取对应 answer/feedback。
- 刷新页面后的可见状态完全来自 backend，不依赖 localStorage 或前端临时成功状态。
- Stage 8A 已有纯读取 API 足够，本阶段未新增后端 endpoint。

## 安全边界

- UI 不复制 backend validator，也不尝试绕过 ownership、session state、duplicate answer、completed lock 或 grounding failure。
- `INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT` 只显示安全拦截文案，不回显 provider 返回的恶意 improvedAnswer。
- 知识来源通过 `safeKnowledgeSources` 白名单映射；不渲染 sourceId、prompt、provider config、向量、embedding、内部 evidence、content hash 或 API key。
- UserAnswer 仅作为当前 session/题目的后端输入；UI 不提供写回 Resume 的动作。

## 测试

- `tests/interview-ui.unit.mjs`：状态/类别文案、错误映射、恢复题号、feedback 文本与知识来源安全映射。
- `tests/interview-ui.render.mjs`：四类题目、answer/feedback、建议回答标识、FAILED/DEGRADED、409/422、completed/history、loading/empty/error 与私有来源字段不渲染。
- Stage 8A 集成测试继续作为真实 HTTP 创建、回答、grounding、失败、降级和跨用户边界回归。
