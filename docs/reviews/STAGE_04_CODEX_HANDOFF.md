# 阶段 4 Codex 实现交接：岗位知识库与文档处理链路

## 状态与范围

阶段 4 经 Claude 独立验收后为“有条件通过”。本次仅完成两项验收整改，当前状态为“阶段 4 验收整改完成，等待 Claude 二次验收”。当前分支为 `feat/rag-stage-4-knowledge-base`，基线是已验收的 `master@8f6f497`。不要合并回 `master`、不要创建 `rag-stage-4-passed` 标签、不要开始阶段 5。

本阶段仅建立管理员维护的文本知识库管线：资料 CRUD、规范化、章节路径、语义优先切片、元数据、处理历史、重新处理与级联删除。未实现 Qdrant、Embedding、Reranker、任何检索/RAG、文件上传、PDF/DOCX/网页解析、AI 改写或自动应用建议。

## 实现摘要

- JSON runtime 新增 `knowledgeDocuments`、`knowledgeChunks`、`knowledgeProcessingRecords`；旧 store 缺失字段会安全补为空数组。
- Document 包含任务要求的来源、类型、岗位、标签、原文/hash、清洗文本、状态、版本、计数、创建者、时间和失败字段。
- Chunk 由服务端唯一生成，保存 documentId、chunkIndex、headingPath、标题、正文/hash、近似 token、`normalizedText` 偏移、完整元数据和 processingVersion。
- ProcessingRecord 只追加不覆盖，记录 input hash、策略、处理版本、状态、计数、失败信息和时间。
- `normalizeKnowledgeText` 仅处理 CRLF/LF、空行、空白，不改写原文。标题支持 Markdown、中文序号、阿拉伯数字、`一、`、`【标题】` 和短独立行。
- 切片优先章节、段落、句子，最后按最大 1200 字符拆分；目标约 760 字符。`tokenEstimate = ceil(CJK字符数 + 非CJK连续词数 / 4)`，是近似值而非模型 token。
- 相同原文 hash 与固定策略返回已有成功记录及 chunks。新处理先完整生成，成功后才替换当前 chunks；失败保存 FAILED record 并保留上一版有效 chunks。
- 验收整改 1：短独立行改为上下文启发式。只有段首短行且后续为明显正文时才识别为标题；连续技能行、普通短句和职责行保留为 Chunk 正文。Markdown、中文编号、数字编号和 `【标题】` 仍按明确结构识别。
- 验收整改 2：`rawText` 不再经过通用 `trim()`。它原样持久化并以原始字符串计算 SHA-256；`normalizedText` 仍是单独的 LF/空白规范化处理文本。
- 所有 `/api/admin/knowledge-*` 端点调用服务端 `requireAdmin`。普通用户不能创建、修改、删除、处理或读取 chunks。
- 既有后台页新增资料筛选、真实空状态、录入/编辑表单、处理、chunk 展开、章节路径、历史、失败信息和删除确认；前端不产生任何伪造资料或客户端 chunks。

## API

- `GET/POST /api/admin/knowledge-documents`
- `GET/PUT/DELETE /api/admin/knowledge-documents/:id`
- `POST /api/admin/knowledge-documents/:id/process`
- `GET /api/admin/knowledge-documents/:id/chunks`
- `GET /api/admin/knowledge-documents/:id/processing-records`
- `GET /api/admin/knowledge-chunks/:chunkId`

输入校验覆盖正整数 id、合法 `documentType`、合法 `sourceType`、URL、文本长度和非重复的 `skillTags` 文本数组。空 `rawText` 可先保存为 DRAFT，但处理返回 400、`failureCode=EMPTY_RAW_TEXT`。

## 测试

新增 `tests/knowledge-base.integration.mjs`：真实 `backend/server.js`、临时 JSON 存储与真实 HTTP 请求，不调用 AI 或任何收费服务。覆盖：

1. ADMIN 创建、普通用户 403、普通用户读取 chunk 403；
2. 非法类型、标签、ID 和不存在资源；
3. 空原文失败；
4. 清洗、标题路径、documentId、内容 hash、最大长度和单 chunk 查询；
5. 无变化幂等，不生成重复 chunks；
6. 原文改动后的新版本；
7. 失败重处理保留上一版 chunks；
8. 处理历史留存与时间顺序；
9. 两位管理员创建的两份资料不串写；
10. JSON 服务重启后的可读性；
11. 删除 Document 级联删除自身 chunks/records，且不影响另一份资料。

已运行并通过：

```text
node --check backend/server.js                         exit 0
node tests/knowledge-base.integration.mjs              exit 0
corepack pnpm build                                    exit 0
```

整改新增回归：技能列表、连续普通短句、明确标题层级、项目名称/职责行、原始 CRLF/行首空白/末尾换行保存、原始 hash、同原文幂等、首尾空白变化 hash 与重启持久化。待本阶段完成前最终复跑：`corepack pnpm test`、`git diff --check master...HEAD`、`git diff --check`。浏览器已确认非管理员导航不会显示后台入口；因未修改或读取本地管理员会话，管理员知识库的真实浏览器视觉流程仍留给验收环境。

## 已知非阻断限制

- 没有正文的显式标题不会单独创建 Chunk。
- 编辑 `jobFamily`、`skillTags` 后，已有 Chunk 的元数据副本在下一次成功处理前不会变更。
- `knowledgeMinLength` 目前保留为策略参数，尚未用于合并规则。
- 开发日志可能直接打印内部 `HttpError`。

## 修改文件

- `backend/server.js`
- `src/App.jsx`
- `src/styles.css`
- `tests/knowledge-base.integration.mjs`
- `package.json`
- `database.sql`
- `README.md`
- `AI_HANDOFF.md`
- `PROJECT_MEMORY.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_TASK.md`
- `docs/DECISIONS.md`
- `docs/RAG_UPGRADE_PLAN.md`
- `docs/RAG_DATA_MODEL.md`
- `docs/tasks/STAGE_04_KNOWLEDGE_BASE.md`
