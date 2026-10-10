# 本次面试资料选择（2026-10-10）

用户批准四项功能：公共库勾选与摘要；创建面试确认公共/个人资料；按岗位自动选择、手动指定或不使用；记录保存当次选择以回看来源。

## 实现

- 公共库提供 native checkbox 和可展开摘要。摘要来自实际 description 或当前处理版本的首个 chunk，最多 280 字。勾选草稿以服务端 userId 为键，仅在 sessionStorage 保存方式和 ID。
- 点击开始面试先读取 owned `/api/interview-material-options`，展示公共资料及本人的个人资料。未启用/未完成索引的个人资料不可选择。读取失败、手动空选、失效草稿均阻止提交，并有重试/清空入口。
- AUTO 固定创建时可用的公共和已启用个人资料范围，沿用简历/岗位/匹配缺口查询召回；MANUAL 仅检索明确 ID；NONE 跳过检索，仅由简历、JD 和缺口生成真实题目，不因主动跳过资料而标记知识缺失降级。
- 后端在请求入口验证选择权限/可用性/ID 格式，在异步执行时再次核对处理版本和索引版本。服务端内部 allowedDocumentIds 同时约束关键词和向量的本地复查，不信任客户端检索过滤字段。
- Session 保存方式、资料 ID/名称/范围/处理版本/索引 run、实际召回 ID。generationConfigHash/inputHash 包含选择；历史详情及刷新恢复展示快照，逐题保留原有真实来源。资料后来删除不会抹掉当次快照。旧记录明确说明未保存资料选择。
- 不改变简历/JD ownership、隐私脱敏、题目事实边界或反馈校验；个人资料仍须先启用。使用已有 React/CSS/native controls，无新增依赖。

## 验证

- `node --check backend/server.js` 通过。
- `corepack pnpm test` 全量通过（临时 JSON 与本地 mock AI/embedding/vector），包含新增无效选择/跨用户与未授权个人资料拦截、AUTO/MANUAL/NONE、历史重启快照，以及 KEYWORD/VECTOR/HYBRID 对未选资料排除。即使 mock vector 忽略过滤也会在本地排除；空 allowed ID 不会扩大为全库。
- 随后新增处理/索引变更 409、配置 hash 随选择变化、create payload 和历史新旧记录渲染校验；`corepack pnpm test:interview-ui` 通过。
- 最终 `corepack pnpm build` 通过。
- 隔离 fixture：5176/API8924、真实 Node API、临时 owned 简历/JD/岗位报告/资料及 mock provider。浏览器验证公共摘要/勾选传递、确认个人与公共资料、三种方式实际创建、刷新后历史仍保留名称/版本/实际召回。1440×900/390×900 检查，手机 scrollWidth=375、innerWidth=390，无横向溢出。发现并修复全局 input 宽高影响 checkbox/radio 的布局。
- 隔离测试没有使用真实用户资料、付费模型或写入正式个人历史。未运行真实 MySQL 专项；对应 ready fixture 已同步补齐 indexedProcessingVersion。
- 正式后端仅重启已核对 entry/startTime 的 launcher-owned PID，复用前端和 Qdrant；启动器确认 5173/8876 readiness。未启动/重置 Docker Desktop。
- 截图在未跟踪 `artifacts/materials-selection/`。browser fixture 可用 `node tests/rag-mock-interview.integration.mjs --browser` 启动，专用停止端点 `/api/fixture/stop` 仅清理该临时环境。

保存本地提交后停止，等待 Claude 独立验收，不推送或部署。

## 分组摘要折叠展示（用户追加，2026-10-10）

公共库改为默认收起的单列分组卡片：箭头、标题、数量和实际资料摘要常显；点击标题/箭头展开本组全部资料，各条摘要直接显示并保留勾选，去掉二次“查看摘要”折叠。分组概览去重后截取最多 240 字，不生成虚构摘要。沿用浅色产品样式。

`node --check backend/server.js` 和 `corepack pnpm build` 通过。隔离真实 API fixture 浏览器验证默认收起摘要可见、点击展开、勾选计数、Enter 收起后选择保留；1440×900 和 390×900 检查，手机 scrollWidth=375/innerWidth=390。仅展示改动，不修改检索或历史数据链。截图 `artifacts/materials-selection/overview-expanded.jpg`。本地保存待独立验收。

## 展开完整正文（用户纠正，2026-10-10）

上一版展开仍是摘要，未满足完整内容要求。本次增加登录用户只读 `GET /api/interview-materials/:id`：仅当前有效索引的公共资料可读，返回 id/title/content/processingVersion 四字段；个人资料、未发布草稿及缺失 ID 返回 404。content 使用实际 normalizedText/rawText，不截断。分组展开后按需加载每份正文，保留换行、勾选及元数据；加载/错误/重试可见，收起后取消未完成 UI 更新。内容仅 React text 渲染，不执行上传 HTML。

后端语法检查、构建、个人资料 integration 通过，新增正文完整相等、返回字段白名单、未登录 401、个人及草稿 404 检查。隔离浏览器验证摘要之外的正文末尾实际可见、手机正文无溢出（375/390）及勾选可用，截图 `artifacts/materials-selection/full-content.jpg`。正式后端已按 PID/entry/startTime 核对后重启加载，前端与 Qdrant 复用。未使用真实 AI。保存本地提交，待独立验收。
