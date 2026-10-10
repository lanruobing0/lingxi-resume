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
