# 阶段 3：基于真实简历与真实 JD 的基础岗位匹配

## 目标与边界

用户选择一份明确的简历版本和一份已成功解析、仍有效的 JD，通过 JobApplication 生成结构化基础匹配报告。仅实现不依赖知识库或向量检索的匹配；不接入 Qdrant、Embedding、Reranker、RAG 或 Agent。

## 必须绑定的输入

每次匹配必须明确保存：`userId`、`resumeId`、`resumeVersion`、`resumeContentHash`、`jobDescriptionId`、`jobDescriptionParseResultId`、`jobApplicationId`。禁止使用“当前”“最近”或“最新解析结果”进行模糊推断。

以下情形必须拒绝执行：资源不存在或不属于当前用户；简历版本/内容哈希不一致；JD 未成功解析；JD 原文改变导致解析失效；或 JobApplication 固化的版本、快照、解析结果不完整。

## 报告内容

报告应回答整体匹配度、已证实要求、部分证据、必备项未找到的证据、未覆盖加分项、最支持岗位的经历、优先修改建议，并区分“当前简历未体现”与“用户不具备”。

六个维度必须都有：`key`、`label`、`score`（0-100）、`weight`、`weightedScore`、`summary`、`resumeEvidence`、`jdEvidence`、`missingEvidence`、`suggestions`。

固定维度和权重：

| key | 权重 |
| --- | --- |
| required_skills | 30 |
| project_relevance | 25 |
| keyword_coverage | 15 |
| experience | 10 |
| education | 10 |
| expression | 10 |

后端必须以六个 `score * weight / 100` 的和计算并四舍五入 `totalScore`；模型不得决定总分。后端还必须校验分数范围、结构、证据与固化简历快照/JD 原文或解析结果的对应关系；伪造证据、缺字段或非法分数必须失败，不能保存为成功报告。

报告另含：`matchedRequiredSkills`、`partiallyMatchedRequiredSkills`、`missingRequiredSkills`、`matchedPreferredSkills`、`missingPreferredSkills`、`matchedKeywords`、`missingKeywords`、`strongestResumeEvidence`、`risks`、`prioritizedSuggestions`。每项技能至少含 `skillName`、`matchStatus`、`resumeEvidence`、`jdEvidence`、`explanation`、`confidence`；状态只能是 `MATCHED`、`PARTIALLY_MATCHED`、`NOT_FOUND`、`NOT_APPLICABLE`。

## 数据与状态

新增/完善 `ResumeJobMatch`：ID、上述关联字段、`status`、分数与报告字段、`modelProvider`、`modelId`、`failureCode`、`failureMessage`、创建/更新时间。状态为 `PENDING`、`ANALYZING`、`COMPLETED`、`FAILED`。失败不得用旧成功报告冒充本次结果；相同输入可产生新历史记录，不能覆盖旧报告。

## API

- `POST /api/job-applications/:id/matches`：创建一次匹配。
- `GET /api/job-applications/:id/matches`：读取该申请的匹配历史。
- `GET /api/resume-job-matches/:matchId`：读取完整报告。
- `POST /api/resume-job-matches/:matchId/retry`：仅重试失败任务，或按既有设计创建新任务。

所有接口必须按当前会话用户授权，跨用户资源统一返回无权限/不存在响应，并保持响应结构和错误码明确。

## 隐私与前端

必须复用现有 `buildAiResumeContext`；第三方 AI 不接收姓名、邮箱、电话、网站、照片、Session、API Key 或无关隐私字段。前端在既有 JD 工作区完成：选择简历和明确版本、选择已解析 JD、创建/选择 JobApplication、生成报告、显示真实加载/错误状态、六维结果、技能与关键词、双方证据、建议及历史。初始不得显示假分数；失败要清除临时报告；0 分和缺失字段要正确展示；不直接改简历，不做一键应用建议。

## 测试与完成

新增使用真实 `backend/server.js`、本地 mock AI 和临时 JSON 目录的集成测试，覆盖正常报告、固定总分、忽略模型总分、0 分、NOT_FOUND 表述、简历/JD 证据验证、伪造证据失败、JD 未解析/失效、跨用户隔离、不同简历/JD 不串写、版本/哈希/解析 ID、AI 隐私、未配置 AI、失败历史与删除关联处理。运行：

```bash
node --check backend/server.js
corepack pnpm test
corepack pnpm build
```

可顺手修复 GrammarPanel 重复 React key；JD 删除和更复杂的规范化若明显扩大范围，只记录在文档。完成后更新项目文档，停止并等待 Claude 独立验收。
