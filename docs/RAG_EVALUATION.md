# RAG 评估、质量门与生产化指标

## 为什么需要单独评估

当前 AI 结果仅以 JSON schema 和页面成功状态校验；这只能证明“返回了结构”，不能证明 JD 解析正确、检索证据相关、报告可信或建议安全。RAG 上线前必须拥有版本化离线集合和线上可观察指标。

## 评估集

| 集合 | 样本与标注 | 通过标准（初版建议） |
| --- | --- | --- |
| JD 解析集 | 覆盖前端、后端、测试、运营等真实且获准 JD；人工标职责、必须/加分技能、经验、学历/地点、原文 span。 | 字段 F1/Span 支持率按字段分别报出；硬要求不允许只报总平均。 |
| 基础匹配集 | 固定 ResumeVersion + JD Parse 对；人工标每维度命中/缺失与双向证据。 | 维度分类准确率、分数与专家排序 Spearman、硬条件漏报率。 |
| 检索集 | query（岗位/技能/缺口/面试意图）→相关 KnowledgeChunk 相关性等级。 | Recall@k、MRR、nDCG@k；分别比较 keyword、vector、fusion、rerank。 |
| 报告引用集 | 人工审阅 claim、citation、引用是否实际支持。 | Citation precision、citation coverage、unsupported-claim rate。 |
| 建议集 | 原段、JD 缺口、允许事实边界、人工接受/拒绝。 | 定位正确率、事实保真率、接受率（仅作信号）、冲突/过期拒绝正确率。 |
| 面试集 | 申请上下文、题目蓝图、人工岗位相关性/重复率标注。 | 相关性、覆盖率、重复率、评分一致性。 |
| 安全集 | 提示注入 JD、恶意知识文档、越权 ID、撤回文档、空/超长输入。 | 无跨用户泄漏、无未授权检索、注入不改变工具/权限边界。 |

评估集只放脱敏、允许使用的数据；每个样本记录 schema/内容/标注版本，不能因模型升级悄悄改变基准。

## 分阶段质量门

- 阶段 1：100% 新记录可定位 `resumeId + resumeVersionId`；A/B 简历隔离回归为 0 串写。
- 阶段 2：解析 JSON schema 合法率、字段原文 span 覆盖率、人工复核采样；失败必须可见而不能使用岗位名假装成功。
- 阶段 3：每个 MatchDimension 都有 resume/JD evidence；评分重放一致。
- 阶段 4：chunk 重跑稳定，禁用资料不再可发布；source/license 完整率 100%。
- 阶段 5：Hybrid+rerank 必须在检索集上不低于当前最佳单路基线；发布前报告 Recall@k/nDCG 和 P95 延迟/成本。
- 阶段 6：报告 Citation coverage 与 precision 达到团队阈值；unsupported claim 由人工抽样审计并设置阻断阈值。
- 阶段 7：建议不能无确认修改；版本冲突/失败应用 0 静默覆盖。
- 阶段 8：题目来源、申请版本和 retrieval trace 完整；无跨用户数据。
- 阶段 9：Agent 步数、token、检索次数 100% 不超过预算；所有失败可解释。

## 在线观测与审计

每个 async task、RetrievalRecord、报告、Suggestion、AgentExecution 至少记录：请求/输入 hash、用户/应用 ID、版本 ID、schema/algorithm/provider/model 版本、时间、耗时、token/调用成本（若 provider 返回）、状态、错误码、trace IDs。日志和管理看板不展示原始 API Key、Cookie、完整隐私简历。

主要在线指标：解析成功率/重试率、索引积压和失败、检索零结果率、Reranker 增益、报告引用验证失败率、建议接受/拒绝/过期率、任务 P50/P95、Provider 错误率、每申请成本。接受率不得单独作为质量结论，因为它会受 UI、用户习惯和建议数量影响。

## 生产化策略

1. 将 JSON 单文件迁移至 MySQL 后再支持并发 worker；保留导出/备份和可验证迁移。
2. 使用 outbox/任务表保证 DB 提交与异步索引最终一致；task 应幂等，以 content hash 防止重复 embedding。
3. Qdrant 以 MySQL chunk 记录为可重建索引；提供按 embedding model/version 的重建、灰度和回滚。
4. 为 LLM、Embedding、Reranker 配置超时、限流、费用预算和断路器。失败显示“未生成/已降级”，而不是生成默认成功结果。
5. 对模型/提示词/权重/切片策略做版本化与灰度 A/B，升级前在固定评估集比较，升级后保留可回滚版本。
6. 设数据保留与删除策略：用户删除简历/JD 后删除事实记录、取消待处理任务，并清理关联私人向量；公共知识资料按许可和管理员审批流程撤回。

## 主要取舍

- 先用透明基础匹配，再用 RAG 增强。速度稍慢，但避免“向量+LLM 给了一个无法解释分数”。
- MySQL 做事实源、Qdrant 做派生索引。写入多一步，但可审计、可恢复、可删除。
- 限制 Agent 为状态机而不是开放式自治。能力范围较小，但能够预算、测试和解释。
- 延续 OpenAI-compatible LLM adapter。开发更快；Embedding/Reranker 另设 adapter，避免假定所有聊天模型 Provider 都提供可比较的向量/重排能力。
