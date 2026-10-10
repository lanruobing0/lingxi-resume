# 报告引用链与技术语境校验（2026-10-10）

用户追问降级后如何处理，授权修复完整链路。实际报告 #3 六次检索全部 COMPLETED、36 候选，六条知识主张全被剔除：c23/c25 错配 retrievalRunId 与候选，c22/c27 技术语境用户词被认作个人归因，c24/c26 来源介绍前缀影响语义支持。保留正式旧报告作为审计，不改其状态或内容。

## 修复范围

- 每个 prompt 候选提供完整 citationIdentity（run/chunk/document/processingVersion），要求四字段整体复制，避免跨检索混配。
- 知识 claim 建议使用短连续原文，不增加“某资料在某节指出”等介绍性文字或额外结论。
- 校验仅剥离以已验证来源标题或固定“知识资料/面试资料”开头的“在…指出/提到/说明：”介绍，保留其后的全部事实校验。
- “资源需属于当前用户”“用户规模”只有原文确实支持同一技术表述时才不触发求职者归因。候选人/求职者能力、用户已经掌握等事实归因仍拒绝。claim-support-v5 保留数字、实体、否定、因果、跨引用与尾句检查。
- 将知识引用失败纳入同一个最多一次纠正预算，发送安全的 claimId/错误码；结构和知识校验共享该次数，不额外嵌套无限重试。
- 纠正仍不通过，按原规则剔除不合格知识主张并 DEGRADED；纠正 provider 失败时保留首轮可用报告，经原校验后保留安全部分，不丢弃已验证基础匹配。无伪造内容、无强制标记成功。
- Prompt version grounded-match-report-v3，保留版本及输入 hash 审计。

## 验证

- `node tests/technical-claim-support.test.mjs` 通过：技术资源归属、来源介绍、用户规模原文可过；候选人能力归因、改变资源归属、追加个人结论拒绝。
- `node tests/grounded-match-report.integration.mjs` 通过：错引用首轮失败后第二轮完成且覆盖率 1，恰好一次纠正；纠正服务故障安全回退 DEGRADED；原有语义/注入/权限/截断/超时/隐私回归保持通过。
- `node tests/rag-mock-interview.integration.mjs`、`node tests/bounded-agentic-rag.integration.mjs` 通过，共享引用校验消费者回归。
- `node --check backend/server.js`、`corepack pnpm build`、`git diff --check` 通过。
- 核对项目后端进程后仅重启后端，启动器确认就绪，前端/Qdrant 复用，无 Docker 重启。
- 本次未发起真实 AI 调用，不能声称正式新报告已 COMPLETED。已登录页面重新生成才能使用新策略，旧报告不自动更新。

本轮完成待 Claude 独立验收，不继续其他阶段。
