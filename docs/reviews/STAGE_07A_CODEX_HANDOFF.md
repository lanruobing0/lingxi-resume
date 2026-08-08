# 阶段 7A Codex 实施交接

状态：Stage 7A 已通过 Claude 最终独立验收；Stage 7B 尚未开始。

## 已实现

- JSON Store 新增 `suggestionRuns` 与 `resumeSuggestions`；运行绑定完整的用户、Application、Match、Report、ResumeVersion/Hash、JD、报告/Prompt、Provider/Model 和配置哈希。
- `POST /api/match-reports/:id/resume-suggestions` 仅使用该 owner 的已完成/降级报告及其固定输入；生成失败也持久化为 `FAILED` run。
- 建议生成调用使用 `backend/resume-suggestion-prompt.js` 的 `resume-suggestions-v2-evidence` 严格 JSON 契约，并仅发送 provider-safe Resume 文档、绑定 JD 与报告必要事实。
- JSON Patch 独立校验器限定单个 `replace` 或安全的 highlight 追加；路径使用 section/entry 稳定 ID，拒绝 metadata 和任意非简历字段。
- Evidence-backed Rewrite 取代中文关系启发式作为 REWRITE 授权边界：每个可执行建议均保存可审计的 `factEvidence[]`（fact、锁定 ResumeVersion sourcePath、真实连续 sourceQuote），服务端自行读取并在生成与 ACCEPT 时复验。无证据、伪造 quote、非法/跨版本路径、JD/知识来源或 fact/quote 不匹配均会转为无 patch 的 `FACT_REQUIRED`，不可 ACCEPT；数字、年份和完整技术 token 仍为额外确定性阻断。
- 中文 coverage tokenizer 保留完整连续 span，以全量 word-break 验证 generic token 覆盖；不再用单字/子串 split 修改事实片段。新增真实 HTTP 回归固定覆盖高并发、高可用、微服务、高性能、高可靠、可扩展、并行处理、partial evidence、已有事实合法 evidence 与持久化篡改后的 ACCEPT 二次阻断。
- ACCEPT 重验 optimistic base version/hash、目标 `before`、patch 和事实差异，创建新的不可变 ResumeHistory 版本，随后把同 run 其他 PENDING 建议置为 `INVALIDATED`。REJECT 不改简历。
- 新增 `tests/resume-suggestions.integration.mjs` 及 `test:resume-suggestions`；测试通过真实 HTTP 后端和 mock Provider，覆盖隔离、绑定、隐私、正常改写、FACT_REQUIRED、虚构 50%/Kubernetes、完整技术 token 攻击、未知/合成主体、12 种事实关系改写攻击、已有主体换关系词、普通中文改写、落盘篡改后 ACCEPT 二次校验、非法 metadata path、失败持久化、ACCEPT/REJECT、旧版本冲突、历史保留和失效策略。

## Claude 最终验收

Claude 第八次独立验收结论为 A. 通过。Evidence-backed Rewrite、中文 coverage tokenizer、ACCEPT 二次证据验证及全部 Stage 7A 回归均通过；未发现高、中优先级问题。允许完成 Git 闭环，Stage 7B 尚未开始。
