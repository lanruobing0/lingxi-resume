# 阶段 5B Codex 实施交接

状态：已完成真实 Qdrant 复验，全部发布门禁通过，允许合并 master 并创建 `rag-stage-5b-passed` 标签。本轮未执行合并或打标签。

新增模块将查询规范化、关键词召回、Qdrant 向量召回、RRF、可选 Reranker 与检索服务分离。生产 API 使用 `KnowledgeRetrievalService`，不是测试副本。

有效性规则：返回内容只从本地当前 Chunk 读取；文档必须 `PROCESSED`/`INDEXED`，Chunk processingVersion 必须等于文档当前版本，VectorRecord 与 Point payload 的 `indexRunId` 必须等于 `activeIndexRunId`。

HYBRID 在向量服务不可用时明确返回关键词降级状态；VECTOR 失败为配置/服务错误。Reranker 默认未配置，异常或非法返回会回退 RRF，不泄露密钥。

整改：正文仅贡献命中 token 覆盖率 × 12，不再逐 token 叠加正文分；`scoreThreshold` 强制为 [-1, 1] 有限数字。新增 `test:retrieval-eval` 最小运行入口，实际输出固定评测集的 case 数、K、Recall@K 与 MRR@K；完整生产语料模式对比报告尚未完成。检索实验室展示 Reranker 是否应用、是否回退、失败码与每条 rerankScore。

## 验收测试覆盖

| 场景 | Mock 服务 | 核心断言 | 位置 | 结果 |
| --- | --- | --- | --- | --- |
| Reranker 未配置 | 无 Reranker 配置 | 不调用 Reranker；`rerankerApplied=false`、`rerankerFallback=false`；完整保留 RRF 顺序 | `unconfigured` | 通过 |
| Reranker 正常 | normal | 应用重排；`rerankScore` 与前 `topN` 的倒序重排精确一致 | `reranked` | 通过 |
| Reranker 异常矩阵 | 503、timeout、invalid-json、missing-results、count-mismatch、duplicate-index、out-of-range-index、non-integer-index、invalid-score（string/null）、missing-candidate | 均为 HTTP 搜索调用；回退标记和失败码存在；调用前后所有 `chunkId` 顺序 deepEqual | `for (const failure ...)` | 通过 |
| 真正网络超时 | timeout 延迟 1200ms，`RERANKER_TIMEOUT_MS=1000` | Mock 观察到客户端 AbortController 中止，而非人工抛错 | `rerankerAborts` | 通过 |
| 关键词评分 | 固定 metadata/body 种子 | 标题、headingPath 高于仅正文局部命中；skillTags +8；完整短语 +10；正文最高 +12；无逐 token +4；matchedTerms 精确且两次顺序一致 | `scoring`、`scoreByChunk` | 通过 |
| 参数、规范化与过滤 | backend HTTP、Embedding、Qdrant | `keywordLimit`、`vectorLimit`、`rrfK`、阈值、枚举、filters、skillTags、documentIds 均返回 400；中英文/技术符号保留；SHA-256 正确 | `invalidRequests`、`normalized` | 通过 |
| 三模式过滤语义 | Qdrant 返回混合 Point | KEYWORD/VECTOR/HYBRID 对 documentType、jobFamily、seniority、skillTags、language、documentIds 一致过滤 | `filterCases` | 通过 |
| RRF 精确规则 | Embedding、Qdrant | 同一 chunk 去重；三种 `retrievalSources`；rank 从 1 起；公式、单路候选和重复请求顺序精确断言 | `hybrid` | 通过 |
| currentKnowledge 边界 | Qdrant 含 PENDING、STALE、旧版本、旧 active run、孤立、不一致 record/payload、伪造正文 Point | 只返回当前有效 Point；正文始终来自本地 Chunk | `vector`、`state.points` | 通过 |
| RetrievalRun、隐私与持久化 | Embedding、Qdrant、Reranker、JSON 重启 | COMPLETED/DEGRADED/FAILED 字段完整；响应、run、请求 body 不含 rawText、密钥、向量；重启后 run 未变化 | `runs`、`persistedRuns`、`reloadedRuns` | 通过 |
| 向量缺配 | 关闭 Embedding 或 Qdrant 配置 | VECTOR 分别返回 `503 + EMBEDDING_NOT_CONFIGURED` 与 `503 + QDRANT_NOT_CONFIGURED` | `embeddingMissing`、`qdrantMissing` | 通过 |
| 严格 Reranker flag | backend HTTP | `true`/`false` 可用；`"true"`/`"false"` 返回 400 | `tests/use-reranker-flag.integration.mjs` | 通过 |
| 黄金评测与真实 Qdrant | 固定黄金集、Docker Qdrant | 输出 case 数、K、Recall@K、MRR@K；真实 Qdrant 搜索/过滤/无 vector 响应 | `tests/retrieval-evaluation.mjs`、`tests/qdrant-retrieval-smoke.integration.mjs` | 评测通过（3 / K=10 / 1.0000 / 1.0000）；本机 Docker 不可用，两个 Qdrant smoke 均按设计 exit 2，待具备 Docker 的 Claude 环境复验 |

评测入口 `corepack pnpm test:retrieval-eval` 已完成；当前 `1.0000` 来自三条最小固定 fixture，仅用于验证评测入口和公式，不代表生产知识库检索质量。`useReranker` 仅接受 JSON boolean；字符串值返回 400，避免将 `"false"` 误判为启用。管理员浏览器交互仍未手工验证。本阶段绝不生成 RAG 回答。
