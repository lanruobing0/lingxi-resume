# Stage 7B：Resume Suggestion UI

状态：已通过 Claude 独立验收；Stage 7 正式完成；Stage 8 尚未开始。

## 已交付范围

- 在 MatchReport 下展示 SuggestionRun 当前结果与历史结果。
- 展示 ResumeSuggestion 的 `sectionType`、`suggestionType`、`rationale`、`before`、`after` 和状态。
- PENDING rewrite 提供基于服务端 `before` / `after` 的只读 diff；前端不构造 JSON Patch。
- Accept 调用既有 7A API 并刷新 SuggestionRun、Strategy A INVALIDATED 状态、当前 ResumeVersion 与只读版本历史；Reject 仅更新状态。
- FACT_REQUIRED 明确要求用户补充真实信息，且没有强制接受入口。
- ResumeVersion 历史显示版本号、创建时间、接受建议来源及只读快照。

## 安全与边界

- 不修改 7A 的 ownership、版本冲突、FACT_REQUIRED、INVALIDATED、patch 或 evidence validation 契约。
- 只允许逐条处理；不提供批量接受、自动应用、rebase、Agent 或 Stage 8 功能。
- 409/422 等服务端错误在界面中可理解地呈现，不会自行重试 Accept。

## 验收与后续

- 最终验收记录：`docs/reviews/STAGE_07B_FINAL_REVIEW.md`。
- L1-L4 为低优先级后续项，不属于本阶段阻断项。
- Stage 8 尚未开始，必须取得单独批准后才可实施。
