# 阶段 5A：Embedding Provider 与 Qdrant 向量索引生命周期

状态：已完成，并通过 Claude 最终独立验收。

本阶段在阶段 4 的 `KnowledgeDocument -> KnowledgeChunk` 基础上实现受控索引链路：规范化 Chunk 文本、OpenAI 兼容 Embedding、按 Profile 隔离的 Qdrant Collection、确定性 Point ID、写入验证、原子 active run 切换、旧 Point 清理及删除同步。

运行时仍使用 `backend/data/store.json` 保存文档、索引运行和 Point 元数据；绝不保存向量数组或密钥。Embedding/Qdrant 密钥仅来自服务端环境变量。仅 ADMIN 可调用索引接口。

不包含关键词或向量搜索、混合检索、RRF、Reranker、RAG 上下文/报告或 Agent。

验收命令：`node --check backend/server.js`、`corepack pnpm test`、`corepack pnpm build`。Docker 可用时额外执行 `corepack pnpm test:qdrant`；不可用时必须明确保留“真实 Qdrant Smoke Test 未验证”。
