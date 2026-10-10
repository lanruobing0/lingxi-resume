# 个人面试资料

用户在公共资料上传和实际 Qdrant 导入后，明确批准继续个人版；本次不引入新框架或第二套知识库。

## 实现

- KnowledgeDocument 添加 scope（PUBLIC/PRIVATE）、userId 与 aiConsent。旧未标 scope 的文档仍为 PUBLIC；未知 scope 不可读。个人写入不接受客户端 owner/scope，服务端强制 PRIVATE 和当前 userId。
- /api/personal-materials：owned 列表、新建、详情、PUT、DELETE；/extract、/:id/process、/:id/index 复用已有 worker 解析和处理/向量生命周期。个人与公共路由共享实现但不改变账号角色。公共管理 CRUD/切片/运行重试仅访问 PUBLIC，所有越权个人 ID 返回404。
- 个人数据写入前隐藏可识别的个人联系方式、账号与本人简历中的身份字段、URL、常见密钥格式。上传提取输出即显示处理后的文本与警告，核对后可保存。检测不是通用隐私识别器；用户仍需移除未识别的人名、私密信息和第三方隐私。
- aiConsent 默认false；仅保存不调用 Embedding。启用索引需确认向量/AI模型用途，未确认索引请求400。取消启用立即从检索范围移除；数据库仍保留资料及原索引，用户删除时同步清理实际向量。
- 仅新模拟面试的检索显式加入所属个人资料。岗位报告、Agent、管理员实验室和评测默认 PUBLIC；请求 body 中伪造的 personalUserId 被忽略。个人资料为 KNOWLEDGE，不成为候选人的简历事实。
- 关键词/混合召回同一范围；Qdrant 用当前可见 documentId 集合预过滤，并对结果再次核验本地文档归属、版本和 active run。Upstash 路径保留现有召回后本地过滤，不声称本次做过真实 Upstash 验证。
- sourceAvailability 按 owner 校验个人知识，题目与反馈显示所属用户的来源状态；公共报告引用拒绝 PRIVATE。ADMIN 检索运行列表/详情不展示个人检索审计。
- 文档/切片 ID 使用持久化单调计数器防删除后复用；同进程知识写入序列化，避免多个资料创建覆盖。此锁不声称解决整个既有 snapshot 系统的跨进程并发。
- UI 我的资料 / 公共资料库，ADMIN另有公共资料管理。上传 TXT/MD/PDF/DOCX，核对、编辑、搜索、删除确认、状态与重试；建索引时阻止切换资料范围。不展示 Collection/hash/provider 内部明细。

## 验证

- node --check backend/server.js 通过；corepack pnpm build 通过。
- corepack pnpm test 全量通过，原岗位报告/建议/面试/Agent/生产硬化与UI回归通过。最终隐私身份补充后再次 test:personal-materials 和 build 通过。
- personal-materials.integration：真实提取接口、伪造 owner/scope、跨用户读写处理索引删除404、ADMIN不能读取个人、未确认不调用模型、PII不进入mock模型、KEYWORD/VECTOR/HYBRID隔离、Qdrant预过滤及故意忽略过滤后的本地防线、公共工具只读公共、撤回启用、并发创建、变更失效、503失败重试、重启、删除和ID不复用均通过。
- rag-mock-interview.integration --personal-materials：实际 locked ResumeVersion/JD/报告 → owner PRIVATE检索 →问题/逐题反馈/事实边界校验/源可用性/其他用户不可见全链路通过，另一用户的 PRIVATE sentinel 未进入模型。公共模式也通过。
- Browser 隔离夹具端口5175/API8921，临时JSON + mock模型/Qdrant，真实文件选择器上传 AI-Agent开发面试资料.md → 未确认保存 → 编辑确认建立索引 → 编辑标题 → 公共库无个人资料 → 取消/确认删除，均通过。桌面1440×900与手机390×900人工截图，列表与表单 scrollWidth375<innerWidth390；修正手机刷新按钮换行。
- Browser 注入模型503：已存资料保留、持续alert、重试入口；恢复后重试通过。未使用个人账号测试数据或真实付费模型进行个人资料测试。

## 限制与验收

完成实现后停止，等待 Claude 独立验收。仅重载本地后端供用户试用，不推送或部署。真实公共向量与现有个人简历/面试数据不由测试修改。保留本次之前的 runtime交接文档和原创 Agent 面试资料，不删除无关 artifacts/快捷方式。
