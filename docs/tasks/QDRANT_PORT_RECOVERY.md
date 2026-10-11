# Qdrant 本地端口恢复（2026-10-12）

用户报告 v3 仍降级：报告 #10 七条知识引用全部通过（100%），但六次 RetrievalRun 92–97 均为 QDRANT_UNAVAILABLE，退回关键词检索。Docker web-qdrant-1 已停止，6333 落入 Windows 排除端口段 6321–6420，重新启动失败于端口绑定权限。

- Compose 主机端口支持 QDRANT_HTTP_PORT，容器内仍为 6333、原 .qdrant-data 不变。
- 启动器传递本地 env 给 Compose，同步使用配置端口进行 readiness 检查，检查合法范围、前后端冲突和自定义端口不一致。
- 本地 ignored .env.local 同步改为 16333；重建该 Qdrant 容器并仅重启本项目后端，前端复用。未重置 Docker、删除知识库或处理其他项目容器。
- launcher 配置专项、Docker guard 专项、混合检索/报告集成、后端和启动器语法及构建已通过。
- 真实 Qdrant collection 可读，37 points；/ready HTTP 200。公共技术查询只读验证：默认阈值的 VECTOR 完成但返回 0，HYBRID 完成并返回关键词候选；诊断阈值 -1 时向量返回 23 个有效本地片段。只在内存记录检索，不写正式 store。该验证证明连接和有效向量访问，不代表任意查询都命中，也未改检索阈值。
- 旧报告保持生成时状态。用户随后截图 v4 已完成、证据覆盖 100%；本轮未主动生成新的真实 AI 报告。

实现完成，待 Claude 独立验收。
