# 当前任务

- 任务名称：阶段 3——基于真实简历与真实 JD 的基础岗位匹配
- 状态：待开发；阶段 1、2 已通过 Claude 二次验收，允许进入本阶段
- 完整任务文件：`docs/tasks/STAGE_03_BASE_MATCHING.md`
- 允许修改范围：与 ResumeVersion、JobApplication、JD 解析结果、基础匹配 API/报告 UI、测试和对应文档直接相关的增量改动
- 禁止范围：RAG、Qdrant、Embedding、Reranker、知识库、Agent、自动修改简历、后端框架迁移、MySQL 正式迁移、App.jsx 大规模拆分、页面重做
- 完成标准：完整任务文件的输入绑定、固定评分、证据校验、数据隔离、失败状态、前端真实状态与集成测试要求均满足
- 当前是否等待 Claude 验收：否；开发完成后必须停止并等待 Claude 独立验收
