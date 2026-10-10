# 公共面试资料上传

日期：2026-10-10。用户授权先做公共资料，个人资料下一阶段；用户选择首份方向「通用面试准备」。

## 实现边界

- ADMIN 上传 TXT/MD/PDF/DOCX，先提取与核对正文再保存。最大 6 MB、300000 字符、PDF 200 页；不支持扫描或加密 PDF。Worker 20 秒、128 MB old-gen、最多两个并发，DOCX ZIP 内容膨胀总量限制 24 MB、最多 2000 条目、关闭外部读取。纯文本严格编码校验，所有解析输出只作为文本。
- 复用 KnowledgeDocument CRUD/process/index/delete，新增 FILE_IMPORT 来源类型。保存后可自动处理/索引，或只存草稿。失败保留已存内容和明确状态，可重试。操作进行中禁止切换/编辑/删除，避免覆盖状态。
- 普通用户侧公共资料库按岗位族分类、搜索、安全摘要展示；仅当前 PROCESSED + INDEXED + 当前 processingVersion 的文档可见。未暴露 rawText、管理员身份、审计、provider 或向量。个人上传尚未开始。
- 公共资料进入原有检索范围，不将其当作用户经历，不另建 AI/检索链。准备原创通用项目复盘与技术面试表达指南，约 1864 字，9 个实际切片。

## 验证证据

- node --check backend/server.js：通过。
- corepack pnpm test：全量通过；含真实 PDF/DOCX/TXT/MD 提取、异常与超时恢复；扩展向量集成覆盖提取授权、大小、发布可见性、安全字段、上传正文检索。
- corepack pnpm test:materials：通过。
- corepack pnpm build：通过。
- Browser 5175 隔离夹具：真实原文件选择器上传首份 MD → 核对元数据 → 保存处理 → mock embedding/Qdrant 9 points → 普通用户列表；按分类展开、无结果搜索通过。1440×900 桌面和 390×900 手机截图人工核对，手机 scrollWidth 375 < innerWidth 390。
- 注入 mock embedding HTTP503：UI 持续显示部分失败，正文与切片保留且状态 FAILED；服务恢复后点击建立索引成功，最终 2 份文档 INDEXED、10 points（第二份仅临时故障检查数据）。
- 未配置本机 Embedding/Qdrant，未调用真实付费模型、未改生产 store 或真实向量库。真实发布仍需配置后另行验证，不能将 mock 通过视为实际 Qdrant 已填充。

## 验收与后续

实现完成待 Claude 独立验收；保留既有未跟踪 artifacts 和启动/停止快捷方式。停止当前阶段，不做个人用户上传、不推送、不部署。
