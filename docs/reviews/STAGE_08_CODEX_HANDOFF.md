# Stage 8 Codex 实施交接

状态：Stage 8A RAG Mock Interview backend 已通过；Stage 8B UI 尚未开始。

## 实施摘要

- 新增 Stage 8 四层持久化数据链和 MySQL 参考表，所有任务绑定创建时的 JobApplication、MatchReport、ResumeVersion/Hash 与 JD ParseResult。
- 新增基于 JobApplication 的 session 创建、详情/问题读取、单题回答、feedback 读取和 session 完成 API；旧 `/api/interviews` 保留兼容。
- 新增 `backend/mock-interview-service.js`，集中管理问题/反馈严格 JSON schema、promptVersion、检索请求、source allowlist、类别和事实边界验证。
- 生产检索直接调用 Stage 5B `KnowledgeRetrievalService.search()`；正常、降级和失败 RetrievalRun 都可审计。HYBRID vector fallback 会令 session `DEGRADED`，不会伪装为完整成功。
- 问题覆盖 RESUME、JD、MATCH_GAP、KNOWLEDGE；每题 rationale/sourceRefs/expectedPoints 均落盘。模型未知引用、跨类别引用会失败；即使使用真实 Resume sourceId，未被引用文本支持的候选人数字、技术实体或经历归因也会被事实边界校验拒绝。
- Answer 在 feedback Provider 调用前落盘。Provider/grounding 失败时 Answer 和 FAILED Feedback 均保留，响应返回 answerId/feedbackId 供审计。
- Feedback 的 strengths/weaknesses/missingPoints 逐项绑定 question evidence 或 USER_ANSWER；知识来源在读取时显示 AVAILABLE/UNAVAILABLE。improvedAnswer 明确为 suggestion，未接入任何 Resume 写路径。
- Session/question/answer/feedback 的 owner 校验均在服务端执行，跨用户返回 404；输出不含 prompt、provider key、向量或内部 Provider 请求。

## Claude 首次验收定点整改

- 新增共享 `validateUserFactGrounding`，统一识别候选人既有经历陈述，并校验数字/年份、完整技术实体与中文事实关系的证据覆盖；没有维护 Redis、Kubernetes、字节跳动等品牌黑名单。
- improvedAnswer 的用户事实证据集严格等于锁定 ResumeVersion 全部 provider-safe 事实加当前题 UserAnswer。JD、MATCH_GAP、KNOWLEDGE、其他 answer 和其他 session 均不进入该集合。
- unsupported improvedAnswer 使用稳定码 `INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT`；Answer 保留，Feedback 标记 `FAILED`，恶意 improvedAnswer 不写入正常 feedback 内容。
- 用户主动回答“使用 Redis 做过缓存模块”后，当前题允许将其优化为“使用 Redis 构建过缓存模块”；若额外加入未被支持的 50% 仍失败。同一事实不能跨 session 复用。
- 用户事实归因校验扩展到 RESUME、JD、MATCH_GAP、KNOWLEDGE 全部 question 文本和 expectedPoints。假设式“你会如何设计”与纯知识性“请解释”不被误判为既有经历。
- 真实 HTTP 测试新增六组非 RESUME question/expectedPoints 攻击、三组合法外部知识问题、恶意 improvedAnswer、Resume 支持、UserAnswer 支持、未支持百分比与跨 session 隔离。

## 验收重点

- 检查 `tests/rag-mock-interview.integration.mjs` 的锁定版本、四类问题、RAG sourceRefs、answer/feedback、provider failure、degraded retrieval、cross-user、fabricated fact 和 privacy 断言。
- 检查 session 失败是否在 `interviewSessions` 审计留痕，以及 feedback 失败是否保留已提交的 UserAnswer。
- 检查 Stage 7 相关文件和行为未被修改。
- 按任务文件记录复跑全部门禁并核对 exit code。

## 最终门禁记录

| 命令 | Exit code |
| --- | ---: |
| `node --check backend/server.js` | 0 |
| `node --check backend/mock-interview-service.js` | 0 |
| `node --check tests/rag-mock-interview.integration.mjs` | 0 |
| `corepack pnpm test` | 0 |
| `corepack pnpm test:retrieval-eval` | 0 |
| `corepack pnpm build` | 0 |
| `corepack pnpm test:qdrant` | 0 |
| `corepack pnpm test:qdrant-retrieval` | 0 |
| `git diff --check` | 0 |

两项 Qdrant 命令均实际完成真实 smoke test，没有以 Docker 缺失状态跳过。
