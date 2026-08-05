# 阶段 5A Codex 实施交接

待 Claude 独立验收，非验收结论。

## 验收整改（二次验收前）

已修复文档重处理后旧 `STALE` VectorRecord 未参与 cleanup 的问题：新 processingVersion 的 Point 完成写入与验证、切换 active run 后，服务按 `collectionName` 分组删除同文档旧 processingVersion 的可追踪 Point。成功时记录准确的 `removedCount` 与 `COMPLETED`；删除失败时新 run 仍有效，旧 Point/Record 保留追踪且 run 为 `cleanupStatus=FAILED`。

Mock 集成测试已补充非法 Embedding、Collection 冲突、后续批次失败、upsert 失败、FAILED retry、COMPLETED retry 冲突、旧 Point cleanup 成功/失败、双文档隔离和缺失配置场景。真实 Qdrant smoke 使用生产 `createDeterministicPointId`。

### Compose 健康检查复验

`qdrant/qdrant:v1.13.2` 不包含 `wget`/`curl`，Compose 健康检查已改为容器内 `bash -c 'exec 3<>/dev/tcp/127.0.0.1/6333'` TCP 探测，`start_period` 为 10 秒。实际执行 `docker compose -f docker-compose.qdrant.yml config` 成功，`corepack pnpm test:qdrant` 退出码为 0：确认 Collection 创建、4 维 Cosine 配置、生产确定性 Point ID、写入/读取、重复 upsert、无 rawText payload、单 Point 删除、其他 Point 保留，以及 Collection 未被删除。

实现范围：`backend/embedding-provider.js`、`backend/qdrant-client.js`、`backend/knowledge-embedding-text.js`、`backend/knowledge-vector-index.js` 与既有 Node HTTP 路由。新 API 均为 ADMIN：状态、建立/重建/删除索引、索引历史、VectorRecord 元数据、失败运行重试。

关键不变量：只有当前 `activeIndexRunId` 是有效索引权威；外部写入验证完成前不切换；失败保留旧 active run；旧 Point 清理失败记录在 run；删除文档先删除 Qdrant Point 再级联本地记录；Qdrant payload 不含正文、简历、JD、联系方式、会话或密钥。

测试：`tests/vector-index.integration.mjs` 启动真实 backend 和本地 Mock Embedding/Qdrant，覆盖权限、幂等、稳定 Point ID、隐私 payload、失败保护、STALE、删除和重启持久化。`tests/qdrant-smoke.integration.mjs` 是 Docker 可用时的真实 Qdrant REST smoke。

审查重点：Mock 覆盖中的不配置/Collection 不匹配/部分失败分支，以及 Docker 可用环境的 smoke 结果；本阶段不得验收搜索或 RAG。
