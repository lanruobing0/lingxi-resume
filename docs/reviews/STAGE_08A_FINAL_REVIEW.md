# Stage 8A Claude 最终独立验收

结论：A. 通过。

状态：Stage 8A RAG Mock Interview backend 已通过；Stage 8B UI 尚未开始。

## 验收结论

- Stage 8A 已完成 JobApplication、MatchReport、锁定 ResumeVersion、RAG RetrievalRun、InterviewSession、InterviewQuestion、UserAnswer 与 grounded AnswerFeedback 的后端闭环。
- RESUME、JD、MATCH_GAP、KNOWLEDGE 四类问题保留同类别 sourceRefs；question、expectedPoints 与 improvedAnswer 的用户事实归因边界已通过最终复验。
- improvedAnswer 的用户事实仅允许锁定 ResumeVersion 或当前题 UserAnswer 支持；外部 JD/Gap/Knowledge、其他回答和其他 session 不得证明用户经历，越界反馈不会作为成功内容落库。
- ownership、跨用户 404、Provider/RAG 失败审计、retrieval 降级、重复回答与完成态保护、隐私过滤及 Stage 5/6/7 回归均满足 Stage 8A 验收要求。

## 低优先级后续

- `strengths` / `weaknesses` / `missingPoints` 文本的 user-fact grounding 后续加固。
- retrieval `FAILED -> DEGRADED` 策略。
- `questionCount=3` 时的 KNOWLEDGE 覆盖。
- feedback retry。

以上项目不阻断 Stage 8A 通过，不在本次 Git 闭环中实施。Stage 8B UI 尚未开始。

## 发布门禁

feature 提交前门禁记录：

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

两项 Qdrant 命令均完成真实 smoke test，没有跳过。master 合并后必须再次运行同一门禁矩阵并全部 exit 0，才可推送 master 和 Stage 8A 标签。
