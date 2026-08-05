# 阶段 4：岗位知识库与文档处理链路

## 目标与边界

建立管理员维护的公共岗位知识库，支持文本资料录入、编辑、查看、删除、清洗、章节识别、语义切片、元数据保存、切片浏览和重新处理。运行时继续使用本地 JSON；`database.sql` 仅补充生产迁移参考。

本阶段不接入 Qdrant、Embedding、Reranker、向量或混合检索、RAG 报告、Agentic RAG、文件上传、PDF/DOCX/网页解析、AI 改写或自动应用简历建议。

## 数据模型

- `KnowledgeDocument`：资料原文、来源和岗位元数据、原文/清洗文本 hash、状态、当前处理版本、切片计数和失败信息。
- `KnowledgeChunk`：由服务端生成，绑定 `documentId`、版本、章节路径、正文、原文偏移、内容 hash、近似 token 数与文档元数据。
- `KnowledgeProcessingRecord`：不可覆写的处理审计历史，记录输入 hash、策略、状态、切片数和失败信息。

状态为 `DRAFT`、`PROCESSING`、`PROCESSED`、`FAILED`。重新处理成功后原子替换当前 chunks；失败保留上一次成功 chunks 和处理记录。

## 处理策略

`rawText` 是用户提交的原始审计文本：保存时只校验类型和最大长度，不 trim、不改写；`rawTextHash` 始终由该原始字符串计算。空/纯空白资料可暂存为 DRAFT，但不得处理。`normalizedText` 是独立的清洗后处理文本，只统一换行、去除多余空格/空行和行首尾空白，保留标题、段落、技术符号和原文语言，不调用 AI 或改写内容。

标题识别支持 Markdown、中文序号、阿拉伯数字、`一、`、`【标题】` 和满足上下文条件的独立短行。短行只有位于段首且后续为明显正文时才作为标题；技能列表、连续短句和职责行不会仅因较短而被误判。切片按章节、段落、句子、最后长度兜底的顺序完成，目标约 600–900 个字符，最大 1200、最小 100（短文档和章节末尾可保留较短切片）。`tokenEstimate` 为 `ceil(CJK 字符数 + 非 CJK 连续词数 / 4)` 的近似值，不代表模型真实 token 计数。

相同 `rawTextHash`、策略和版本会返回既有成功结果，不生成重复 chunks。每次需要重新生成的成功处理递增 `processingVersion`。

## 权限与 API

仅 `ADMIN` 可访问下列端点；普通用户统一 403：

- `GET/POST /api/admin/knowledge-documents`
- `GET/PUT/DELETE /api/admin/knowledge-documents/:id`
- `POST /api/admin/knowledge-documents/:id/process`
- `GET /api/admin/knowledge-documents/:id/chunks`
- `GET /api/admin/knowledge-documents/:id/processing-records`
- `GET /api/admin/knowledge-chunks/:chunkId`

客户端不能提交 Chunk。所有字段按长度、枚举和类型校验；空原文不得处理。

## 前端与验收

后台管理页增加“知识库管理”区域：筛选、空状态、创建/编辑、处理状态、切片与章节路径、处理历史、失败原因和删除确认。普通用户不显示后台入口。

新增 `tests/knowledge-base.integration.mjs`，使用真实 HTTP API 和临时 JSON 数据目录，覆盖管理员权限、清洗/切片、章节、hash、幂等、重处理版本、失败保护、级联删除、输入校验和重启持久化。完成后运行 `node --check backend/server.js`、`corepack pnpm test`、`corepack pnpm build` 和两个 diff check，随后停在本阶段等待 Claude 独立验收。
