# 移除重复 AI 工具页面（2026-10-09）

用户明确要求删除截图中的 AI 工具，因为功能重复。

- 移除侧栏 AI 工具、独立页面、简历编辑器的跳转卡片及页面专用样式。
- 旧 `#ai-tools` / `#grammar` 路由解析为我的简历；访客沿用已有模板页引导。
- 删除该页的独立语法检查 UI，未迁移或新增功能。保留现有诊断、润色、岗位和面试入口，后端语法检查 API 与历史记录未修改。
- `node --check backend/server.js`、`corepack pnpm build`、`corepack pnpm test`、`git diff --check` 均 exit 0。
- 本地浏览器访问旧链接，访客正常显示模板页，侧栏已无 AI 工具；未登录或修改个人记录，未做手机视口验证。

本次用户批准的调整完成，等待 Claude 独立验收。

## 完整退役旧功能（同日追加授权）

用户进一步要求：确认不影响现有功能后，完全删除旧功能。

- 核实生产调用：旧 analyze/optimize/grammar-check 仅供旧页面调用；当前基础匹配、grounded report、SuggestionRun、RAG InterviewSession 和 AgentRun 走独立链路。
- 删除旧诊断与润色页面、生成接口、三个 records 接口、对应 schema/prompt/结果校验、未使用的本地伪结果函数、旧工具 seed 记录及统计项。首页入口指向岗位 JD，并移除语法检查/旧诊断宣传；旧四种 hash 均兼容回简历入口。
- 历史页只请求保留的版本与面试记录。数据库参考脚本不再创建旧记录表；仅保留 reset 脚本中的旧表 DROP，以保证旧库重建时外键顺序兼容。未执行 SQL 或清空个人数据。既有 JSON 历史键作为未消费的存档由 persistence 原样保存，新 store 不再生成旧记录。
- 隔离测试移除旧生成的成功预期，改为验证三个生成接口及三个记录接口均 404，且不会调用 mock AI；保留现有 ownership、版本、隐私、JD/面试隔离及级联测试。其他 fixtures 不再初始化废弃集合。
- `corepack pnpm test` 全量 exit 0，包含真实业务实现的匹配报告、简历建议、面试、Agent、生产加固与 UI 回归；`node --check backend/server.js`、`corepack pnpm build`、`git diff --check` exit 0。
- 本地后端重启加载本次代码，`/health` 200，三个旧生成接口实测 404，未调用真实 AI。浏览器验证旧诊断 hash 不展示旧页面、首页建议入口进入岗位 JD 的正常访客引导。未做手机视口或真实 MySQL 复验。

完整退役完成，保存本地提交后等待 Claude 独立验收；不推送或部署。
