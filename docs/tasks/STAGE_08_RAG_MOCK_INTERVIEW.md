# Stage 8：RAG Mock Interview Backend

状态：Stage 8A RAG Mock Interview backend 已通过；Stage 8B UI 尚未开始。

## 目标与范围

以用户拥有的 `JobApplication -> MatchReport` 为入口，建立 `InterviewSession -> InterviewQuestion[] -> UserAnswer -> AnswerFeedback` 后端闭环。问题基于锁定 ResumeVersion、JD、Stage 6 MatchReport 缺口与 Stage 5B RAG knowledge；本阶段不实现 Stage 9 Agent、自动循环 Agent、大规模 UI，也不修改 Stage 7 Evidence-backed Rewrite。

## 数据与状态

- JSON Store 新增 `interviewSessions`、`interviewSessionQuestions`、`answerFeedbacks`；`interviewAnswers` 同时兼容旧面试记录和 Stage 8 的 `sessionId` 记录。
- Session 固化 `userId`、JobApplication、Resume/ResumeVersion/Hash、JD/ParseResult、MatchReport、provider/model、问题/反馈 promptVersion、配置哈希、RetrievalRun、创建/完成时间。
- Session 状态覆盖 `PENDING`、`IN_PROGRESS`、`COMPLETED`、`FAILED`、`DEGRADED`。Provider、输出校验和 retrieval 的失败/降级均保存稳定 failureCode/message，不伪造成功。
- Question 独立保存 question、category、difficulty、rationale、sourceRefs、expectedPoints 和顺序。Feedback 独立保存 score、strengths、weaknesses、missingPoints、improvedAnswer、followUpQuestion、grounded sourceRefs 和 Provider 审计字段。

## RAG 与事实边界

- 通过既有 `KnowledgeRetrievalService.search()` 执行 KEYWORD/VECTOR/HYBRID 检索并复用 `knowledgeRetrievalRuns`，不实现第二套 retrieval。
- 查询由岗位、provider-safe 锁定简历、MatchReport 缺口和当前问题方向构成；问题引用保存 RetrievalRun/chunk/document/version/hash。
- RESUME/JD/MATCH_GAP/KNOWLEDGE 问题必须引用同类别 allowlist 来源；未知 sourceId、跨类别来源、缺少必需类别或伪造 Resume 来源会使 Session 持久化为 `FAILED`。四类 question 及其 expectedPoints 中的用户既有经历归因都只能由完整锁定 ResumeVersion 支持；数字/年份、技术实体和中文事实关系执行统一内容支持校验。外部来源可以形成假设式或知识性问题，但不能证明用户做过某事。
- 用户经历只能由锁定 ResumeVersion 的 provider-safe 内容证明。JD、Gap、RAG 和用户本次回答均不能证明候选人“做过某事”。Provider 不接收姓名、邮箱、电话、网站、城市、profile fields、Cookie、密钥或向量。
- Feedback 只允许引用当前 Question sourceRefs 与服务端加入的 `USER_ANSWER` 来源；评分输入包含问题、回答、expectedPoints 和 RAG evidence。improvedAnswer 中的用户经历事实只允许由锁定 ResumeVersion 或当前题 UserAnswer 支持，不消费 JD/MATCH_GAP/KNOWLEDGE 作为用户事实证据；越界时 Feedback 以 `INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT` 失败，恶意 improvedAnswer 不作为正常内容落库。`improvedAnswerIsSuggestion=true`，不写回 Resume，也不跨 session 传播 UserAnswer。

## API

- `POST/GET /api/job-applications/:id/interview-sessions`
- `GET /api/interview-sessions/:id`
- `GET /api/interview-sessions/:id/questions`
- `POST /api/interview-sessions/:id/questions/:questionId/answers`
- `GET /api/interview-sessions/:id/answers/:answerId/feedback`
- `POST /api/interview-sessions/:id/complete`

所有 session/question/answer/feedback 路由均以服务端登录用户执行 ownership 校验；跨用户访问返回 404。

## 测试与门禁

- 专项测试：`tests/rag-mock-interview.integration.mjs` / `corepack pnpm test:rag-mock-interview`。
- 完整门禁：`node --check backend/server.js`、`corepack pnpm test`、`corepack pnpm test:retrieval-eval`、`corepack pnpm build`、`corepack pnpm test:qdrant`、`corepack pnpm test:qdrant-retrieval`、`git diff --check`。
