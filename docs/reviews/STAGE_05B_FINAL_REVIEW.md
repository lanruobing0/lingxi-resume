# 阶段 5B Claude 第三次独立验收

验收结论：**通过，全部发布门禁通过**。

## 已确认通过

- 生产代码、集成测试、黄金评测和生产构建均通过。
- 阶段 5B 功能范围符合批准边界；未发现高、中优先级代码缺陷。
- Reranker 正常、未配置和失败矩阵通过，包括 503、超时、无效 JSON、缺失/重复/越界/非整数 index、无效 score 与缺失候选；失败完整回退原 RRF 顺序。
- 关键词精确评分通过：标题、headingPath、skillTags、完整短语与正文覆盖率上限均有精确断言。
- 参数与过滤矩阵通过；KEYWORD、VECTOR、HYBRID 的过滤语义一致。
- RRF 去重、来源、1 起始排名、精确公式、单路候选与稳定排序断言通过。
- currentKnowledge 边界通过；仅当前有效 Point 返回，响应正文只来自本地 Chunk。
- RetrievalRun 的脱敏和 JSON 重启持久化通过。
- `useReranker` 严格 JSON boolean 契约通过。

## 真实 Qdrant 复验

- 执行时间：2026-08-06T10:54:42+08:00。
- 环境：Docker Desktop `desktop-linux`，Docker Server 29.4.1，Docker Compose v5.1.3；仓库 Compose 配置实际启动 Qdrant 容器。
- `corepack pnpm test:qdrant`：exit 0。验证真实 Point 写入、collection 维度、检索、payload 过滤、`with_vector:false` 与删除后不可再检索。
- `corepack pnpm test:qdrant-retrieval`：exit 0。验证真实向量写入、查询、document/version/indexRunId 过滤、`with_vector:false` 与删除后不再召回。
- 真实 Qdrant smoke 与本地 currentKnowledge 复核共同确认，伪造/陈旧 payload 不会绕过本地有效性边界。

## 非阻断观察
- 浏览器手工交互尚未执行，属于非阻断观察。
- `keywordScore` 为 0 时展示为 `null` 属于非阻断展示层观察，本轮不修改。

## 后续约束

阶段 5B 已完成真实 Qdrant 复验，全部发布门禁通过，允许合并 master 并创建 `rag-stage-5b-passed` 标签。
