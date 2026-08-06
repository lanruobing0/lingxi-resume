# 阶段 5B：关键词检索、向量检索、融合与可选重排序

状态：第三次独立代码验收已通过；等待具备 Docker/Qdrant 的环境完成真实 Qdrant smoke 复验。复验完成前不得合并 master、创建 `rag-stage-5b-passed` 标签或开始阶段 6。

目标是在当前有效知识 Chunk 上提供 ADMIN 专用、可追溯的关键词/向量混合检索。检索仅消费 `PROCESSED` 文档当前版本、`INDEXED` 文档及其 `activeIndexRunId` 对应的 Point；旧版本、STALE、孤立或不可追溯 Point 必须丢弃。

实现包括稳定查询规范化、服务端元数据过滤、确定性关键词评分、Profile 兼容向量召回、RRF 融合、默认关闭且可回退的 Reranker、检索运行记录、黄金集评测和真实 Qdrant 检索 smoke。

不包含 RAG Prompt、回答生成、引用式回答、简历修改、用户侧搜索、聊天界面或 Agent。

关键词评分不是 BM25：标题 12、headingPath 8、skillTags 8、jobFamily 5、完整短语 10、正文仅按命中 token 覆盖率最高 12（没有逐 token 正文额外加分）；英文大小写不敏感，技术符号作为完整 token 保留。`scoreThreshold` 必须为 [-1, 1] 内的有限数字。
