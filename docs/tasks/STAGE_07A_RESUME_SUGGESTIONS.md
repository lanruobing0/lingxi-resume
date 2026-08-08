# 阶段 7A：Resume Suggestions & Versioning Backend

状态：Stage 7A 已通过 Claude 最终独立验收；Stage 7B 尚未开始。

## 目标与边界

以一个已完成或降级的、用户拥有的 `MatchReport` 为唯一入口，建立 `MatchReport -> SuggestionRun -> ResumeSuggestion[] -> ACCEPT / REJECT -> ResumeVersion`。本阶段只实现服务端 API、JSON 持久化、Patch/事实校验与真实 HTTP 集成测试。不实现 Stage 7B UI、批量接受、自动覆盖、rebase、Agent、聊天、面试或 Stage 8。

## 不可变绑定与状态

每个 `SuggestionRun` 保存 `userId`、`jobApplicationId`、`resumeJobMatchId`、`matchReportId`、`resumeId`、`baseResumeVersionId`、`baseResumeVersion`、`baseResumeContentHash`、`jobDescriptionId`、`reportVersion`、`promptVersion`、`provider`、`model`、`generationConfigHash`、`inputHash` 与创建时间。状态为 `PENDING`、`COMPLETED`、`FAILED`；失败使用稳定码，例如 `SUGGESTION_PROVIDER_NOT_CONFIGURED`、`SUGGESTION_PROVIDER_UNAVAILABLE`、`SUGGESTION_INVALID_OUTPUT` 与 `SUGGESTION_INVALID_PATCH`。

每个 `ResumeSuggestion` 保存稳定 ID、`suggestionRunId`、`sectionType`、`targetPath`、`suggestionType`、`rationale`、`before`、`after`、`patch`、报告 `sourceClaimIds` / `recommendationRefs`、状态、决定时间、应用后的版本号与版本 ID。状态只允许 `PENDING`、`ACCEPTED`、`REJECTED`、`INVALIDATED`。

## 安全契约

- 不使用 current/latest resume、report 或 match。生成从报告锁定的 ResumeHistory 快照和同一 JD/解析绑定解析。
- Provider 只接收无联系方式/资料字段的 resume suggestion document、所需 JD 和报告事实；不会接收 Cookie、Authorization、密钥、向量或检索内部数据。
- 可应用 patch 仅允许 `replace`，或在一个已存在经历的 `highlights/-` 上单项 `add`。目标仅限 title、目标岗位、自我评价和以稳定 section/entry ID 定位的经历内容字段；禁止 metadata、身份、版本、所有权、报告和 match 字段。
- Patch 的最大操作数为 1，文本长度受限，JSON Pointer 转义、allowlist、`before`、`after` 和应用前目标内容均由服务端重新验证。
- 可执行 REWRITE 必须携带 `factEvidence[]`；每项含 `fact`、锁定 ResumeVersion 的允许内容 `sourcePath` 与真实连续 `sourceQuote`。服务端自行读取 base Resume 内容，校验 quote 与 fact 同时存在于 source 和 after；缺失或无效 evidence 转为 `FACT_REQUIRED`、清空 patch，并返回 `SUGGESTION_EVIDENCE_MISSING` 或 `SUGGESTION_EVIDENCE_INVALID`。JD、报告、知识 Claim 或模型推断不能证明用户经历。`FACT_REQUIRED` 不可 ACCEPT。
- 中文 evidence coverage 先提取完整连续 span，再以全量 word-break 判断是否完全由 generic token 构成；不对原 span 执行单字或 substring 删除。只要完整 span 既不在 base/evidence 中、也不能被 generic token 全量覆盖，就转为 `FACT_REQUIRED`，避免“并/可/服务”等局部词吞掉高并发、高可用、微服务、高性能、高可靠、可扩展或并行处理。
- factual-delta 保留数字/百分比/年限与完整技术实体的确定性 defense-in-depth；中文关系/角色启发式不再作为 REWRITE 的授权或拒绝依据。
- ACCEPT 要求 `expectedBaseResumeVersion`，重验 suggestion 所有权/状态、当前 Resume 版本和哈希、锁定版本、Patch、`factEvidence`、事实差异和 `before`。任一过期或变化返回 `RESUME_VERSION_CONFLICT`，证据问题返回稳定 evidence failure code，均不覆盖手工修改。
- ACCEPT 创建新的 ResumeVersion，保留原快照；同一 run 的其余 PENDING 建议按策略 A 自动 `INVALIDATED`。REJECT 只改变建议状态，不创建版本。

## API

- `POST /api/match-reports/:id/resume-suggestions`
- `GET /api/match-reports/:id/resume-suggestions`
- `GET /api/suggestion-runs/:id`
- `POST /api/resume-suggestions/:id/accept`（`expectedBaseResumeVersion`）
- `POST /api/resume-suggestions/:id/reject`

所有读写均以服务端用户所有权过滤。

## 验收命令

`node --check backend/server.js`、`corepack pnpm test:resume-suggestions`、`corepack pnpm test`、`corepack pnpm test:retrieval-eval`、`corepack pnpm build`、`corepack pnpm test:qdrant`、`corepack pnpm test:qdrant-retrieval` 与 `git diff --check`。
