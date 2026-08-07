# 灵犀简历：Agentic RAG 升级计划

## 阶段 5A 已批准范围（实施中）

本阶段只实现知识 Chunk 的 Embedding 与 Qdrant 向量索引生命周期，不实现检索。Embedding Profile（provider、model、dimension、输入格式版本、Cosine）决定独立 Collection；Point ID 是由文档、切片、输入 hash、Profile 与 schema 稳定计算的 UUID。写入验证后才切换本地 `activeIndexRunId`，旧 Point 清理失败不得成为当前索引。

## 审查基线（2026-08-04）

本计划以当前仓库为基线，不新建前后端、不替换 React/Vite/原生 Node HTTP 服务，也不在本阶段安装依赖或接入向量库。实际 API 位于 `backend/server.js`（仓库根目录没有 `server.js`）。运行时以 `backend/data/store.json` 为主，`database.sql` 是尚未接线的 MySQL 参考结构。

已经可复用的真实能力：Cookie Session 与按用户数据隔离、简历 CRUD、多简历库、编辑器结构化工作/项目经历、版本号、OpenAI 兼容 JSON 输出、AI 诊断/润色/语法检查、真实 AI 驱动的模拟面试、历史记录与管理员统计。

必须先处理的事实：

- 编辑器的保存请求已带 `resumeId`，但诊断、润色、语法检查和历史页使用 `/resumes/current`；服务端的 `current` 是“该用户最近更新时间的一份简历”，不是页面当前选中的简历。
- 模拟面试前端直接提交 `resumeId: 1`；这对新用户或非 1 号简历均不正确。
- `targetPosition` 是自由文本，`targetPositionId` 只从前端内置三项岗位方向推导；服务端分析只取岗位名称以及种子 `jobPositions` 的关键词，不能保存或理解完整 JD。
- 简历写入可接受任意 body 字段，版本历史只保存 version/summary/createdAt，未保存不可变 snapshot；因此不能可靠复盘“哪一版简历”生成了某次 AI 结果。
- 语法与润色页面展示了默认样例；分析页初态也有默认分数/建议。它们不是实时数据，只有操作成功后的响应才是真实 AI 结果。

## 分期与独立验收

### 阶段 1：现有简历数据链修复

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 建立一个显式、可追溯的“当前选中简历”上下文；保证每个个人动作、AI 记录、版本记录都绑定 `resumeId` 和输入版本。 |
| 前置依赖 | 无；保留 JSON 持久化与现有 Cookie Session。 |
| 修改范围 | `src/App.jsx`（或逐步抽出的 resume context/页面组件）、`backend/server.js`、`database.sql` 的增量迁移、测试文档。 |
| 数据结构 | Resume 规范化字段；`ResumeVersion.snapshotJson`、`contentHash`；每个 AI/面试记录加 `resumeVersionId`（迁移期可为空）与输入快照 hash。 |
| API | 列表/详情/保存均使用 `/api/resumes/:resumeId`；新增 `GET /api/resumes/:id/versions`、`GET /api/resumes/:id/versions/:versionId`。现有 `current` 只作为向后兼容别名并标记废弃。 |
| 前端页面 | ResumeLibrary 选择后写入一个 React 状态上下文；编辑器、诊断、润色、语法、面试、历史均从它取 `activeResumeId`，未选择时明确阻断。 |
| 验收条件 | 两份简历交替操作 20 次，不会读写另一份；所有新 AI/面试记录可追溯到 `resumeId + resumeVersionId + snapshot hash`；删除简历前检查并按外键/级联策略处理。 |
| 测试方法 | API 集成测试：A/B 两简历、两用户、过期 current 别名；前端手工验证 1440/390 视口；`node --check backend/server.js`、`pnpm build`。 |
| 不属于本阶段 | JD、匹配算法、知识库、Embedding、Qdrant、Agent。 |
| 主要风险 | 旧 JSON 字段与编辑器字段并存；用适配器和一次性迁移保留旧内容，禁止直接覆盖。 |

### 阶段 2：真实 JD 管理与解析

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 用户能粘贴、保存、查看并重新解析完整 JD；岗位名称只是从 JD 得到的一个字段。 |
| 前置依赖 | 阶段 1 的显式 `resumeId` 与版本追溯。 |
| 修改范围 | 后端新增 JobDescription API/解析 helper；前端新增“岗位 JD”工作区与简历详情中的关联入口；MySQL 增量表。 |
| 数据结构 | `job_descriptions`、`job_description_parse_results`、版本化 `raw_text`、`normalized_text`、`parse_status`、`parser_version`。 |
| API | `POST/GET/PUT /api/job-descriptions`、`GET /api/job-descriptions/:id`、`POST /api/job-descriptions/:id/parse`。解析请求返回任务/结果，绝不以岗位名称代替 JD。 |
| 前端页面 | JD 列表、粘贴编辑、解析结果（职责、必须/加分技能、年限、级别、地点、语言）和解析置信度/人工纠正。 |
| 验收条件 | 同一用户可保存多个真实 JD；原文不可变保存；解析失败可见；修改 JD 会生成新的 parse result。 |
| 测试方法 | 中英文 JD、空文本、超长文本、重复标题、无经验要求；授权隔离与数据完整性测试。 |
| 不属于本阶段 | 向量检索、Reranker、最终匹配报告。 |
| 主要风险 | LLM 解析会有幻觉；采用 JSON schema、字段级来源片段、可编辑确认和 parser version。 |

### 阶段 3：不依赖 RAG 的基础匹配

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 基于简历快照与已确认 JD 解析结果生成可解释、可复算的基础匹配，而不是只让模型给总分。 |
| 前置依赖 | 阶段 1、2。 |
| 修改范围 | `match` service/helper、数据表/API、匹配报告 UI。 |
| 数据结构 | `job_applications`、`resume_job_matches`、`match_dimensions`；保存权重、规则版本、证据 span。 |
| API | `POST /api/job-applications`、`POST /api/job-applications/:id/matches`、`GET /api/matches/:id`。 |
| 前端页面 | 选择“简历版本 + JD 版本”创建申请，展示技能、经历、量化结果、硬条件、风险项。 |
| 验收条件 | 每一维度都有 `resume evidence` 与 `JD evidence`；规则重跑结果可复现；总分不是模型未解释的数字。 |
| 测试方法 | 固定基准样本断言命中/缺失技能和评分边界；回归现有分析页。 |
| 不属于本阶段 | 知识库增强与 RAG 引用。 |
| 主要风险 | 关键词同义词/否定语义；先用透明规则与人工校准，不虚构“技能已掌握”。 |

### 阶段 4：岗位知识库与文档切片

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 已实现管理员可审核的岗位技能、优秀案例、STAR 表达、面试题文本管道；等待 Claude 验收。 |
| 前置依赖 | 阶段 3 已验收；资料治理由管理员录入时承担。 |
| 修改范围 | 管理端资料录入/编辑/删除、JSON 文档清洗与切片服务、MySQL 生产参考表。 |
| 数据结构 | `knowledgeDocuments`、`knowledgeChunks`、`knowledgeProcessingRecords`；保留来源、领域、岗位、技能、语言、状态、版本、hash 与失败信息。 |
| API | 管理员 `GET/POST/PUT/DELETE /api/admin/knowledge-documents`、处理、chunk 与处理历史查询。 |
| 前端页面 | 既有后台中的资料筛选、录入、处理、chunk 展开、失败信息与删除确认。 |
| 验收条件 | 标题+语义边界切片、无变化幂等、成功后替换、失败保留旧 chunks；用户 JD 不混入公共知识库。 |
| 测试方法 | Markdown/纯文本、超长段落、中文标题、权限、重复处理、失败保护、级联删除与重启持久化。 |
| 不属于本阶段 | Qdrant 写入、Embedding、在线检索。 |
| 主要风险 | 资料质量与授权；只允许可追溯、可撤回的来源进入生产索引。 |

### 阶段 5：向量检索、混合检索和重排序

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 在阶段 4 的受控 chunks 上引入 Qdrant，得到可观察、可回退的 Hybrid Retrieval。 |
| 前置依赖 | 阶段 4；已选定 Embedding/Reranker Provider；Qdrant 部署。 |
| 修改范围 | 独立 RAG 服务/worker、Qdrant collection、Embedding/Reranker adapter、检索 trace API。 |
| 数据结构 | Qdrant payload 保存 `chunkId/documentId/version/metadata`; MySQL `retrieval_records` 保存 query、候选、分数、rerank、过滤条件、provider/version。 |
| API | 内部 `POST /retrieve`；业务侧只暴露按 application/match 查询的 retrieval trace。 |
| 前端页面 | 管理端检索调试（仅管理员）：查询、筛选、候选、最终证据。 |
| 验收条件 | 关键词 BM25/全文与向量结果融合；Reranker 后的每段可追溯；Qdrant 不可用时显式降级为关键词检索并记录。 |
| 测试方法 | 标注检索集计算 Recall@k、MRR、nDCG；空结果、越权 metadata、embedding 版本变更。 |
| 不属于本阶段 | 把检索结果直接用于用户报告。 |
| 主要风险 | 召回偏差、成本和索引漂移；保存 model/version，采用异步重建和离线评估门槛。 |

阶段 5B 已完成真实 Qdrant 复验，全部发布门禁通过：已交付 ADMIN 调试检索、确定性关键词规则、Profile 兼容向量召回、服务端过滤、RRF、可回退 Reranker 和检索运行审计；不生成任何 RAG 回答。允许合并 master 并创建 `rag-stage-5b-passed` 标签（本轮未执行）。

### 阶段 6：基于 RAG 的岗位匹配报告

状态：阶段 6A 已通过 Claude 最终独立验收及全部发布门禁；允许合并 master 并创建 rag-stage-6a-passed。Stage 6B 尚未开始。

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 将阶段 3 的基础匹配与阶段 5 的证据融合，输出带引用、可审计的报告。 |
| 前置依赖 | 阶段 3、5。 |
| 修改范围 | 报告 orchestrator、引用验证器、报告 UI、记录/版本表。 |
| 数据结构 | match report 的生成配置、检索 record IDs、chunk 引用、证据覆盖率、模型版本。 |
| API | `POST /api/job-applications/:id/reports`、`GET /api/match-reports/:id`。 |
| 前端页面 | 匹配总览、各维度、证据引用抽屉、生成失败/降级状态。 |
| 验收条件 | 每个外部知识主张至少一条有效 chunk 引用；无证据结论显式标为模型建议或不输出。 |
| 测试方法 | 引用完整性、错误引用、撤回 chunk 后报告重生、人工盲评。 |
| 不属于本阶段 | 自动改简历或 Agent 自主执行。 |
| 主要风险 | 引用看似存在但不支持结论；采用 claim-to-citation 校验和人工抽检。 |

### 阶段 7：简历逐段建议与版本闭环

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 对具体简历路径给出差异建议，用户逐条接受/拒绝，接受后创建新 ResumeVersion。 |
| 前置依赖 | 阶段 1、6。 |
| 修改范围 | suggestion generator、JSON Patch/apply service、编辑器建议侧栏、版本对比。 |
| 数据结构 | `resume_suggestions`：targetPath、before/after、reason、evidence、status、decision、appliedVersionId。 |
| API | 建议生成、列表、accept/reject；accept 必须带 optimistic concurrency 的 base version。 |
| 前端页面 | 段落定位、高亮 diff、接受/拒绝、批量应用前预览、新版本对比。 |
| 验收条件 | 不自动覆盖用户文本；拒绝保留原因；冲突时不应用；接受建立不可变版本。 |
| 测试方法 | 多建议冲突、过期 base version、数组条目移动、撤销和审计。 |
| 不属于本阶段 | 自动大面积重写、无确认发布。 |
| 主要风险 | JSON path 随编辑失效；使用稳定 section/entry ID，不能使用数组下标作为唯一定位。 |

### 阶段 8：基于 RAG 的模拟面试

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 从“简历版本 + JD + 匹配缺口 + 检索证据”生成问题、追问和反馈。 |
| 前置依赖 | 阶段 2、6、7。 |
| 修改范围 | interview orchestrator、问题来源记录、现有 InterviewPractice 改为显式 application/resumeVersion。 |
| 数据结构 | InterviewSession 绑定 application/match/report/version；问题和反馈存 retrieval IDs/citations。 |
| API | 创建面试要求 `jobApplicationId`；报告读取 session 的不可变输入。 |
| 前端页面 | 启动页选择申请；每题显示考察点和报告级引用，不向候选人暴露内部答案库全文。 |
| 验收条件 | 题目覆盖 JD 硬要求与真实简历经历；追问不会引用已撤回知识。 |
| 测试方法 | 重复题率、岗位相关度人工评分、答案评分一致性、越权检查。 |
| 不属于本阶段 | Agent 自主循环。 |
| 主要风险 | 题目泛化；通过 question blueprint 和检索 trace 调试。 |

### 阶段 9：有限步骤、可解释的 Agentic RAG

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 只编排固定上限的计划、检索、验证、生成步骤，所有工具调用可审计、可终止。 |
| 前置依赖 | 阶段 5-8 的稳定工具和评估基线。 |
| 修改范围 | Agent orchestrator、工具契约、AgentExecution 表/管理页。 |
| 数据结构 | `agent_executions`、step trace、budget、input/output hashes、retrieval IDs、failure code。 |
| API | `POST /api/agent-executions`、查询/取消；业务 API 只触发预定义任务。 |
| 前端页面 | 进度、步骤、证据与失败原因；不显示不可控“思维链”。 |
| 验收条件 | 最大步骤/检索/Token/耗时预算被强制；无写操作工具，除建议 accept 的用户确认路径。 |
| 测试方法 | 循环、超时、空检索、恶意 JD 提示注入、provider 失败。 |
| 不属于本阶段 | 开放式自治 Agent、自动投递/外部操作。 |
| 主要风险 | 不可预测性；坚持状态机、allowlist、schema 校验和人工决策门。 |

### 阶段 10：评估、异步任务和生产化

| 项目 | 设计 |
| --- | --- |
| 阶段目标 | 让解析、索引、报告和 Agent 能可靠扩展、监控、回归和恢复。 |
| 前置依赖 | 阶段 1-9。 |
| 修改范围 | Job queue/worker、MySQL 迁移与备份、监控、评估集、权限和限流。 |
| 数据结构 | task/job、评估 run、provider usage、审计事件与数据保留策略。 |
| API | 任务状态/重试、管理员评估与索引状态 API。 |
| 前端页面 | 异步状态、失败重试、管理员质量看板。 |
| 验收条件 | 幂等任务、可重试、DLQ/人工恢复、质量门槛、备份恢复演练、P95/成本指标。 |
| 测试方法 | 并发、崩溃恢复、索引重建、权限渗透、负载与红队提示注入。 |
| 不属于本阶段 | 无限制地域/规模的企业级多租户承诺。 |
| 主要风险 | 当前 JSON 单文件无法承载并发；生产化前迁移 MySQL 和异步 worker 是硬前提。 |

## 第一阶段拟改文件（尚未执行）

- `src/App.jsx`：先把 active resume context 传给分析、润色、语法、面试、历史；替换所有业务请求中的 `current` 与 `resumeId: 1`。
- `backend/server.js`：将所有业务记录写入显式 resume/version 关联；为版本保存深拷贝 snapshot 与 hash；保留 current 兼容层但禁止新页面依赖。
- `database.sql`：增加不破坏现有表的迁移段和索引，补 resume version snapshot、record version references；不执行 drop/recreate。
- `docs/RAG_DATA_MODEL.md` 与 API/迁移说明：同步明确兼容和回填策略。
