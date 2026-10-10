# 面试准备中空白修复（2026-10-10）

用户截图面试 #7 长期准备中无题目。只读核查该 session 为 PENDING、retrievalStatus=PENDING，没有保存题目、没有对应后台生成 job，创建时间早于当前服务进程。同步生成被此前重启中断，持久化中间态没有恢复。

启动监听前仅将此前 PENDING/RUNNING 的非删除 interviewSessions 标记 FAILED/INTERVIEW_GENERATION_INTERRUPTED，保存完成时间与可读原因；不伪造题目、不调用真实 AI 自动重试，不修改正常 IN_PROGRESS/COMPLETED 或删除记录。页面准备中显示生成说明和状态刷新；中断显示原因与重新创建指引；其他异常无题目状态也有刷新提示。

`node --check backend/server.js`、`corepack pnpm build`、`corepack pnpm test:interview-ui`、`node tests/rag-mock-interview.integration.mjs` 通过。恢复测试覆盖 pending/running、正常/完成不变、墓碑不变及幂等；渲染覆盖准备中与中断说明。初次这些检查通过后追加明确渲染断言并复验。正式重启前核对 launcher backend PID/entry/startTime，并确认无当前进程新建的生成任务；重启后 #7 实际为 FAILED/INTERVIEW_GENERATION_INTERRUPTED，前端和 Qdrant 复用。

需用户重新确认资料并创建新的真实面试，旧 #7 保留失败记录可删除。没有付费 AI 验证，不声称题目已经恢复。保存本地提交，待 Claude 独立验收。
