# 公共面试资料被报告检索排除（2026-10-10）

用户导入知识并重新生成后仍看到降级。实际最新 report #4 为 FAILED/REPORT_INVALID_RESPONSE（基础匹配事实无已验证引用），页面仍显示旧降级报告；#4 对应六个 retrieval run 32–37 全部 COMPLETED 但 returnedCount=0。公共文档 #1/#2 是 INTERVIEW_QUESTION、jobFamily 通用面试准备/研发；报告查询 allowlist 未包含该类型，同时把 JD 完整职位名和技能句当作精确 metadata filters，导致全部排除。

修复：检索 enum 和 report document types 加入 INTERVIEW_QUESTION；报告按实际职位名/维度/技能文本检索，仅保留 documentType/language 硬过滤，分类/年限/技能句不作严格相等限制。公共 scope、当前版本、安全引用校验不放宽。retrievalPlanVersion 升为 v2。报告降级提示按未形成知识引用、检索降级、引用校验失败区分，不再笼统说证据不可用。

验证：后端语法、构建、grounded-match-report integration、hybrid retrieval integration 全部通过。新增真实 parser + keyword 测试覆盖不同 jobFamily、完整职位名与技能句、INTERVIEW_QUESTION 可召回且私人文档排除。对正式本地数据做只读 KEYWORD 验证，新六个维度各返回 6 个片段，documentIds=[2]，不打印简历/JD/密钥，不调用 provider。

正式后端核对 PID/entry/startTime 且无活跃新生成任务后重启加载，前端/Qdrant 复用。没有重新付费生成报告，不宣称真实报告 COMPLETED；#4 的模型 baseEvidence 校验错误仍需后续真实生成检验，原校验保持。旧历史状态不改写。保存本地提交待独立验收。
