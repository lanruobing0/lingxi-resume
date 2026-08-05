# 灵犀简历 RAG 阶段 5A 最终验收

## 验收结论

通过。

允许：

- 提交阶段 5A。
- 合并 master。
- 进入阶段 5B。

## 已完成功能

- OpenAI Compatible Embedding Provider 与 Embedding Profile。
- 稳定 `embeddingInputHash` 与确定性 Point ID。
- Qdrant REST Client、Collection 创建及配置校验。
- Cosine 与维度隔离。
- `KnowledgeIndexRun`、`KnowledgeVectorRecord` 和向量返回值严格校验。
- 幂等索引、原子 active run 切换，以及 Embedding/Qdrant/批次失败时保留旧索引。
- 文档重新处理后的 `STALE` 标记、旧 processingVersion Point 清理及可追踪 cleanup 失败。
- 删除索引同步与删除文档前的 Qdrant 清理。
- ADMIN 权限、管理员索引管理界面、Mock 集成测试和真实 Qdrant smoke test。

## 最终整改

1. 修复重新处理后重新索引造成的旧 Point 残留。
2. 补齐非法向量、Collection 冲突、多批次失败、cleanup、retry、双文档隔离和缺失配置测试。
3. Smoke test 使用生产 `createDeterministicPointId`。
4. 修复 `docker-compose.qdrant.yml` 健康检查：移除不可用的 `wget`，改用容器内 bash TCP 探测。

## 独立测试结果

- `docker version`：exit 0。
- `docker compose -f docker-compose.qdrant.yml config`：exit 0。
- `corepack pnpm test:qdrant`：exit 0。
- 相关 Node 语法检查：全部通过。
- `corepack pnpm test`：exit 0，五套集成测试全部通过。
- `corepack pnpm build`：exit 0。
- `git diff --check`：通过。

## 真实 Qdrant 验证

已确认 Collection 创建成功，维度为 4、distance 为 Cosine；生产确定性 Point ID 可被读取；Point 写入、读取与重复 upsert 均成功；payload 不含 `rawText`、密钥或向量副本；单 Point 删除不影响其他文档 Point，且 Collection 未被误删。

## 浏览器验证

管理员索引管理的真实浏览器交互尚未验证。构建通过不代表浏览器 UI 已完成验证。

## 已知低风险限制

1. 更换 Embedding Profile 后，旧同 processingVersion 的 ACTIVE 记录可能暂时保留，但可追踪且可由文档级删除清理。
2. `PENDING_DELETE` 补删失败后当前没有独立自动重试任务。
3. 同一文档并发双 `POST /index` 存在既有 `nextId` 竞争风险。

## 阶段边界

阶段 5A 未实现关键词检索、向量搜索、混合检索、RRF、Reranker、查询改写、RAG 或 Agentic RAG。
