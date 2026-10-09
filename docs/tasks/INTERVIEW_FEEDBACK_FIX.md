# 本题反馈事实校验与失败重试修复

日期：2026-10-09
状态：实现、真实脱敏反馈复验与隔离回归完成，等待 Claude 独立验收。

## 诊断与范围

本地只读核实 feedback 1（session 4 / question 1 / answer 4）为 FAILED / INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT。使用同一 owned session、question、answer 与绑定 ResumeHistory 的 provider-safe 内容真实复现。原反馈生成没有事实纠正流程；失败答案已保存并禁止重复提交，因此用户无法恢复本题。

真实响应包含建议表达，但 numbered/bold 建议和逗号后的无主语指导被误作为隐含第一人称经历；同时模型会扩写示范细节，原严格校验会拒绝。不能整体跳过 suggested answer 的事实校验。

## 实现

- 反馈提示 v2：提供生产 buildAiResumeContext / interviewResumeFacts 的锁定事实，优先生成 2–4 句简短回答组织指导，不扩写第一人称示范经历；未知信息明确为建议/假设。
- 仅事实边界失败允许一次纠正，使用原锁定题目、本题回答与事实，第二次仍执行完整 normalizeAnswerFeedback。未校验的建议不会写入正常反馈，不伪造成功或评分。
- 校验先剥离有限 Markdown/list 前缀。建议范围仅在同一句逗号/分号中延续，对实际个人归因仍校验；出现“我负责……”即终止建议范围，其后的无主语成果仍校验。第二人称建议里的中性“你如何”问法受原过去/当前标记和第二归因限制。没有降低事实匹配阈值。
- POST `/api/interview-sessions/:sessionId/answers/:answerId/feedback/retry`：仅 owned、仍可回答的会话和最新 FAILED 反馈可重试，复用保存的 answerText，不接收覆盖答案。新建反馈记录，原失败记录保留；回答数不增加。
- GET feedback 取本题最新记录；complete 按每个回答的最新反馈计算，旧失败不阻塞已恢复的会话，也不计入分数。
- 前端失败区域新增“重新生成本题反馈”，调用期间禁用，成功更新当前题反馈，失败后从后端恢复。原回答保留，不必新建面试。

## 验证

- node --check backend/server.js、node --check backend/mock-interview-service.js：exit 0。
- 专项面试集成：一次反馈纠正成功、持续失败、跨用户/跨会话 404、原答案不被覆盖、不重复回答、旧失败历史保留、最新反馈 GET、成功反馈和已完成会话禁止重试、重试后 complete 成绩均通过。
- 针对编号/粗体、建议续句的正例，以及包装第一人称事实、无依据 Redis/Kubernetes、建议后已有事实续接 50% 的反例通过。
- corepack pnpm test、corepack pnpm build、UI render 测试、真实浏览器隔离 API 的反馈重试点击验证与 git diff --check：exit 0。
- 最终真实本题反馈：HTTP 200 / finish_reason stop / 797 completion token，首次返回通过生产反馈事实及 sourceId 校验；此前一次真实请求也在一次纠正后通过。未写入个人正常反馈，不保证模型每次首次都成功。
- 真实诊断中对本题回答和来源隐藏联系方式，未打印完整模型结果、简历、JD、答案或密钥；只输出状态、token 和有限结构/分词诊断。临时脚本完成后删除。

保留既有界面与其他未提交改动，不部署或提交。现有用户失败反馈由用户点击重试生成新记录，诊断不改其历史。完成后停止等待独立验收。
