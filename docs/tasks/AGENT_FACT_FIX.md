# Agent 最终计划事实校验修复（2026-10-09）

用户截图显示第六步 PRODUCE_PLAN 失败。只读核实 AgentRun 1：FAILED / AGENT_UNSUPPORTED_RESUME_FACT，verifiedResumeFacts.0 未被其引用的锁定 ResumeVersion 支持。前五步完成，知识检索 0 条且降级。

## 真实诊断

- 用同一 owned run/report/resumeVersion/hash 和 SUMMARIZE_EVIDENCE 保存的来源做只读 Provider 诊断，不再次运行工具、修改用户数据或伪造检索。
- 首先收紧提示后真实结果仍失败：模型逐字复制 RESUME quote，完整引用的 38 字正文 semanticCoverage=1，但 validateClaimSupport 的用户归因启发式将“用户体验”当作求职者归因，返回 UNSUPPORTED_USER_ATTRIBUTION。
- 最终修正后的真实请求 HTTP 200 / finish_reason stop / 1052 completion tokens，首次结果通过生产 normalizeAgentFinalPlan：12 VERIFIED_RESUME_FACT、0 EXTERNAL_KNOWLEDGE、11 MATCH_GAP、5 RECOMMENDATION。没有写入正常 AgentRun，不保证模型每次首次成功；原失败记录保留。
- 诊断仅打印状态/token/数量与有限校验指标，不输出正文、key、完整来源；provider 输入来源中的联系方式隐藏，临时脚本删除。

## 修改边界

- Prompt v2：verifiedResumeFacts 精确引用单条 RESUME quote，externalKnowledge 精确引用单条 KNOWLEDGE quote，知识为空则外部知识空数组；建议只描述未来操作，不扩写用户经历。
- 动态 final schema 限制四类来源 ID，以及 verified/external 的 quote 文本和单来源规则；取与 Provider prompt 相同的前 80 个安全来源。
- validateVerifiedResumeFactSupport 保留完整原校验。仅 UNSUPPORTED_USER_ATTRIBUTION 且 claim 与实际引用的 RESUME quote 按空白规范化完全相同时认可完整引用；新增尾部、错误引用、无关 quote 仍拒绝。通用知识来源校验未放宽，语义匹配阈值、数字、实体和来源类型检查不变。
- 最终计划事实/知识 grounding 失败仅允许一次纠正，仍在同一个 PRODUCE_PLAN action 内，不新增工具、不扩大 6 步预算、不重复检索。两次均完整 normalize，持续失败仍 FAILED/finalResult null。步骤 input 记录 finalPlanAttempts；generation config hash 包含最多 2 次参数。
- 不改变 planner allowlist、读取绑定、知识降级状态或前端成功/失败语义，不自动修改简历。

## 验证

- 专项覆盖完整“用户体验”引用可通过、附加虚构 Kubernetes 仍失败、错误引用失败、外部知识不能证明用户事实；原九类 RESUME source laundering 攻击保持失败。
- 一次纠正可恢复；持续失败只发生两次 final provider 调用，工具步骤仍为 6，失败不保存正常计划。
- node --check backend/server.js、node --check backend/agentic-rag-service.js、corepack pnpm test、corepack pnpm build、git diff --check：通过。

不提交或部署，保留其他 dirty 代码。完成后加载本地后端，并等待 Claude 独立验收。
