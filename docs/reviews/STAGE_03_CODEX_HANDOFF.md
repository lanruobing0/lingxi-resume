# 阶段 3 Codex 开发交接报告

开发状态：已完成代码与本地验证，**等待 Claude 独立验收**。本报告不是 Claude 验收结论。

## 1. 阶段目标

阶段 3 实现了基于一份明确 ResumeVersion 与一份真实、已成功解析且仍有效 JD 的基础岗位匹配。不使用知识库、向量检索或 RAG；每次报告都从显式 JobApplication 读取锁定输入。

## 2. 完成功能

- `resumeJobMatches` 新增 `ResumeJobMatch` 运行时数据结构；每次发起匹配都新建记录，历史报告不会被覆盖。
- JobApplication 是匹配入口，创建时强制指定 `resumeId`、`resumeVersionId` 和 `jobDescriptionId`；Application 保存其版本、内容 hash、JD parse result 和 JD 原文 hash。
- 匹配执行只读取 Application 固化的 ResumeVersion snapshot；版本、snapshot 或 `resumeContentHash` 不一致时拒绝执行。
- 匹配只读取 Application 固化的 `jobDescriptionParseResultId`；JD 原文变更、解析失效、非成功结果或 current parse ID 不一致时拒绝执行。
- 报告包含六个固定维度：`required_skills`、`project_relevance`、`keyword_coverage`、`experience`、`education`、`expression`。
- AI 负责语义匹配、双方证据与解释；服务端验证后以固定权重计算总分。
- 简历证据逐项在 provider-safe Resume context 中检索；JD 证据逐项在锁定 JD 原文或 parse result 中检索。伪造/缺失/非法证据使本次记录转为 `FAILED`，不会保存成功报告。
- 技能项具有 `MATCHED`、`PARTIALLY_MATCHED`、`NOT_FOUND`、`NOT_APPLICABLE` 状态；`NOT_FOUND` 服务端统一规范为“当前简历中未找到相关证据”。
- 支持匹配历史、完整报告读取，以及仅对失败任务创建新记录的重试。
- 所有 Application/Match/Resume/JD 读取按当前会话 userId 授权；跨用户统一返回 404。
- 匹配复用 `buildAiResumeContext`，不向 AI 发送个人联系方式、照片或会话/密钥。
- 既有 JD 工作区支持选择简历与明确版本、创建/选择 Application、真实加载和错误状态、六维报告、双方证据、建议与历史；不会修改简历或提供一键应用。

## 3. API

| 方法 | 路径 | 请求参数 | 返回结构 | 权限与错误 |
| --- | --- | --- | --- | --- |
| POST | `/api/job-applications`（修改） | `resumeId`、**`resumeVersionId`**、`jobDescriptionId` | `201 { item: JobApplication }` | 当前用户必须拥有全部资源；缺少/非法版本为 400，快照/hash/JD parse 不可用为 409，跨用户/不存在为 404。 |
| POST | `/api/job-applications/:id/matches` | 无；输入完全来自锁定 Application | `201 { item: ResumeJobMatch }` | 当前用户拥有 Application；失效输入为 409，AI 未配置为 400，AI/报告/证据无效为 422，失败记录仍会保存。 |
| GET | `/api/job-applications/:id/matches` | 无 | `200 { items: MatchSummary[] }`，不含完整 report | 当前用户拥有 Application；跨用户/不存在为 404。 |
| GET | `/api/resume-job-matches/:matchId` | 无 | `200 { item: ResumeJobMatch }`，含完整 report | 当前用户拥有 Match；跨用户/不存在为 404。 |
| POST | `/api/resume-job-matches/:matchId/retry` | 无 | `201 { item: NewResumeJobMatch }` | 仅 `FAILED` 可重试；其它状态为 409，原 Application 不可用为 409，跨用户/不存在为 404。 |

删除 Resume 或 JD 时，关联 JobApplication 与 ResumeJobMatch 一并清理，避免留下可读取的孤立报告。

## 4. 数据结构

`ResumeJobMatch` 字段：

- `id`、`userId`、`jobApplicationId`
- `resumeId`、`resumeVersionId`、`resumeVersion`、`resumeContentHash`
- `jobDescriptionId`、`jobDescriptionParseResultId`、`jobDescriptionRawTextHash`
- `algorithmVersion`（当前 `base-match-v1`）
- `status`、`totalScore`、`report`
- `modelProvider`、`modelId`
- `failureCode`、`failureMessage`、`createdAt`、`updatedAt`

状态流转为 `PENDING → ANALYZING → COMPLETED`，或 `PENDING → ANALYZING → FAILED`。失败记录的 `totalScore` 和 `report` 为 `null`；重试创建新的 Match，不修改旧记录。

关联关系：`User → Resume / JobDescription`；`ResumeVersion + JobDescriptionParseResult → JobApplication`；`JobApplication → ResumeJobMatch[]`。Match 冗余保存所有输入绑定，便于审计和失效校验。

## 5. 评分规则

| 维度 | 权重 |
| --- | ---: |
| 必备技能 `required_skills` | 30 |
| 项目相关性 `project_relevance` | 25 |
| 关键词覆盖 `keyword_coverage` | 15 |
| 经验 `experience` | 10 |
| 教育背景 `education` | 10 |
| 表达质量 `expression` | 10 |

每维 `score` 必须为 0–100 整数。服务端计算 `weightedScore = score × weight / 100`，再以 `Math.round(Σ weightedScore)` 写入 `totalScore`。AI 虽可在响应结构中返回 `totalScore`，但该值被忽略，永不直接存为最终总分。

## 6. 证据校验

- 简历证据：将每条 `resumeEvidence` 与 Application 锁定 ResumeVersion 的 `buildAiResumeContext(snapshot)` 串行化文本比对；非 `NOT_FOUND`/`NOT_APPLICABLE` 技能必须带有效简历证据。
- JD 证据：将每条 `jdEvidence` 与锁定 JD 原文及锁定 parse result 串行化文本比对；非 `NOT_APPLICABLE` 技能必须带有效 JD 证据。
- 无法验证、结构缺字段、分数越界或维度顺序/key 不正确时，调用失败，报告不会以成功状态保存。
- 不把缺失证据推断为用户能力缺失。`NOT_FOUND` 的 explanation 和维度缺失项由后端统一为“当前简历中未找到相关证据”。

## 7. 隐私

匹配复用既有 `buildAiResumeContext`。发送给 AI 的是锁定、岗位相关的 Resume context、JD 原文和 JD parse result；不会发送姓名、邮箱、电话、网站、城市、`profileFields`、照片、Session、API Key 或其他无关私密字段。

## 8. 测试

| 测试文件 | 覆盖场景 |
| --- | --- |
| `tests/job-description.integration.mjs` | JD 保存/解析、显式 ResumeVersion 创建 Application、JD 证据、解析失败与修复。 |
| `tests/isolation.integration.mjs` | 用户隔离、AI PII 过滤、版本快照、JD/Application 授权、删除级联。 |
| `tests/resume-job-match.integration.mjs` | 正常报告、固定总分、忽略模型总分、0 分、NOT_FOUND 文案、简历/JD 证据、伪造证据失败、JD 失效、跨用户隔离、版本/parse ID、AI 隐私、AI 未配置、失败历史/重试、删除级联。 |

实际执行（2026-08-04）：

| 命令 | 退出码 | 通过/失败 |
| --- | ---: | --- |
| `node --check backend/server.js` | 0 | 语法检查通过。 |
| `corepack pnpm test` | 0 | 3 个集成测试脚本通过，0 失败。 |
| `corepack pnpm build` | 0 | Vite 生产构建通过，0 失败。 |

未验证内容：未使用真实第三方 AI 密钥进行端到端调用；集成测试使用真实 `backend/server.js`、临时 JSON 数据目录和本地 mock AI。受登录保护的匹配页面未以真实账户在浏览器中提交测试，后端行为和前端构建由上述测试/构建覆盖。

## 9. 修改文件

- `backend/server.js`：Match 模型、输入锁定、AI prompt、证据/评分校验、API、失败记录、删除级联。
- `src/App.jsx`、`src/styles.css`：既有 JD 工作区的版本选择、Application/Match 流程、报告、加载/错误/历史 UI。
- `tests/resume-job-match.integration.mjs`：阶段 3 专项集成测试。
- `tests/job-description.integration.mjs`、`tests/isolation.integration.mjs`：适配 Application 显式 ResumeVersion 合约。
- `package.json`：将阶段 3 集成测试加入 `pnpm test`。
- `database.sql`、`docs/RAG_DATA_MODEL.md`：阶段 3 MySQL 参考与数据模型说明。
- `README.md`、`docs/PROJECT_STATUS.md`、`docs/CURRENT_TASK.md`、`AI_HANDOFF.md`、`PROJECT_MEMORY.md`：API、状态和持续交接信息。

## 10. Claude 验收整改（2026-08-04）

- 修复前端失败状态：`createMatch` 发起时清空当前报告和错误状态；失败后仅刷新历史，不再调用会自动选中旧成功报告的流程。刷新结果只会把本次 `FAILED` 记录及其 `failureMessage` 显示在主区域；历史成功报告仍保留，且只能由用户手动点击打开。
- 补齐加分技能展示：报告新增“已覆盖加分项”（`matchedPreferredSkills`）和“未覆盖加分项”（`missingPreferredSkills`）两个独立分组。每个项目显示技能名、状态、置信度、解释、简历证据和 JD 证据；空列表显示“暂无相关项”，不生成假数据。
- 新增 `src/matchState.js` 这一最小纯函数模块，区分“刷新历史但不自动选择”和“选择 Application 时自动选择最近完成报告”。`tests/resume-job-match.integration.mjs` 对失败后历史列表断言前一种行为，避免回归。
- 扩展真实 HTTP 集成测试：Java/React 两份简历匹配同一 Java JD、同一 Java 简历匹配 Java/React 两份 JD、故意返回跨简历或跨 JD 证据并断言 `FAILED`、JD 删除级联、以及同一 Application 首次成功后第二次失败而保留旧成功报告。测试继续使用 `backend/server.js`、本地 mock AI 和 `mkdtemp` 临时 JSON 数据目录，不调用收费模型。
- 前端状态的自动选择决策由上述纯函数测试覆盖，组件编译由 Vite 构建覆盖；本轮未用登录态浏览器逐项手工操作 DOM，因此失败提示与加分项面板的视觉渲染仍应由 Claude 二次验收时手工确认，未在此报告中声称浏览器端到端已通过。

实际复验（2026-08-04）：

| 命令 | 退出码 | 结果 |
| --- | ---: | --- |
| `node --check backend/server.js` | 0 | 后端语法检查通过。 |
| `corepack pnpm test` | 0 | 3 个集成测试脚本通过，0 失败：JD、隔离和 ResumeJobMatch。 |
| `corepack pnpm build` | 0 | Vite 生产构建通过，1597 个模块完成转换。 |
| `git diff --check master...HEAD` | 0 | 无空白错误。 |

阶段 3 仍未进入阶段 4；本次整改未引入 RAG、Qdrant、Embedding、Reranker、知识库、Agentic RAG 或自动应用简历建议，且未合并或推送。

## 11. 已知限制

当前尚未实现知识库、Qdrant、Embedding、Reranker、RAG、Agentic RAG 或自动应用简历建议。当前运行时仍是本地 JSON 持久化，`database.sql` 仅为未来 MySQL 迁移参考。阶段 3 完成后必须等待 Claude 独立验收，不能自动进入阶段 4。
