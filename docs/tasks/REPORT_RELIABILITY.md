# 报告反复降级根因与修复（2026-10-12）

用户要求查明报告反复降级，修复完整链路，不再以一次局部通过代表稳定。

## 已确认根因

1. 正式 #14/#15（application #16 / 基础匹配 #19 / 简历 #16 v7）六次检索均 EMBEDDING_NOT_CONFIGURED。#14 知识 6/6 通过仍因检索降级；#15 没有输出知识主张，coverage 0，无被剔除的主张。之前 Codex 直接 Start-Process node 重启没有带启动器加载的 .env.local，造成配置回归，已向用户说明。
2. Qdrant 有 37 points、连接可用，但抽查公共与私人 point 均为 1024 维全零向量，正常阈值下查询返回 0；原先只检查 point 数量，未检查实际向量。全零向量的最初形成原因没有审计证据，本轮不推测。旧 QDRANT_PORT_RECOVERY 交接中的默认阈值 0 命中已是同类异常。
3. 恢复配置/向量后真实报告仍可能把知识改写成不受支持的断言，触发语义校验。逐字保留的指导原文也可能因为同时含“建议”和“提升/完成”等词被当成语气升级。单次修正某个措辞不能消除模型自由改写的波动。

## 实现

- backend/runtime-env.js：后端自己按 .env → .env.local 读取配置，进程明确 env 优先。默认 LINGXI_DATA_DIR 隔离运行不加载本地凭据；可通过 LINGXI_LOAD_LOCAL_ENV 显式控制。README 说明。无需依赖某一种启动方式。
- /ready 将 embedding 配置加入就绪条件，不再把只有向量数据库健康当成完整检索就绪。
- Provider embedding 与 Qdrant 写后向量均验证维度、有限数字及非零；索引写后读取真实向量。零向量不能标记成功。
- 使用现有索引生命周期真实重建 PUBLIC document #1 的 9 条向量，activeIndexRunId 变为 #4，检索恢复。只处理该公共资料，没有读取/重建私人资料正文或替用户生成面试。
- grounded-match-report-v5：从本次真实候选原文提取至多 12 个完整短句选项，经过现有通用知识语义检查后提供 text/citationIdentity，模型根据 JD 选择真实引文。动态 schema 约束 KNOWLEDGE_CLAIM 文本为选项；不在后端代填引用或替代 AI 成功。无相关候选时仍允许诚实不输出，保持降级。
- 有候选却漏掉全部知识时加入原共享一次纠正预算；没有新增无限重试。最终仍执行完整 ownership/来源版本/原文/语义校验。
- claim-support-v8：在主体归因、实体/数字、跨引用推断、追加内容检查之后，完整逐字同源引用保持其自身语气，不再被“指导里含结果词”误判。新增事实、否定反转、来源错配、用户事实洗白的攻击测试继续拒绝。
- 报告输出安全 retrievalFailureCodes；旧报告从原检索审计派生，不改旧历史。界面区分缺 embedding 配置、模型服务异常、向量数据库异常等，取消误导性“知识库更新后再生成”通用建议。

## 实际验证

- 修复过程中两次真实复验仍降级，因此没有提前宣称完成；最终版本连续 3 次真实 HYBRID + Provider + 生产报告校验全部 COMPLETED。
- 三次知识引用分别 5/5、3/3、5/5，通过率 100%；每次六次 RetrievalRun 各有 9 个向量候选、36 个最终候选，failure/validation codes 为空。前两次使用既有一次纠正，第三次首次输出通过。
- 连续真实验证采用生产函数、内存 store 与无落盘 persist，验证前后正式 store SHA256 相同。没有保存模拟或诊断报告到用户历史、没有重写 #14/#15。没有打印/保存 API key、简历、JD、私人资料或模型正文。
- 正式后端两次直接启动 /ready 均 200，embedding configured=true、Qdrant healthy=true，证明重启不会再次漏掉文件配置。
- runtime-env 单元覆盖文件优先级/明确 env/重复加载/隔离凭据；报告回归新增完整原文语气保留、原文用户归因仍拒绝、漏知识仅纠正一次；向量回归新增 Provider 零向量与存储读回零向量拒绝。
- corepack pnpm test 全量 exit 0；最终追加零向量读回测试、就绪条件与选项数量上限后，再分别运行 vector-index、grounded-match-report、production-hardening 均通过。node --check backend/server.js、corepack pnpm build、git diff --check 通过。
- 本轮页面仅改原因文案，经构建检查，未做新的浏览器截图。核心实际验证如上。

旧报告保留当时状态，新生成走修复后的链路。实现完成，待 Claude 独立验收；本地提交，不推送或部署。
