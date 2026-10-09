# JD 工作台与模拟面试入口调整

日期：2026-10-08
状态：实现完成，等待 Claude 独立验收。

## 用户批准范围

JD 详情页过长：原文、结构化结果、匹配、建议、Agent 与模拟面试全部纵向铺开。模拟面试入口原先仅展示进入 JD 页的跳转，用户难以直接开始或恢复面试。

本轮只调整前端信息结构与导航，不改变已验收后端的 ownership、ResumeVersion/hash、JD parse result、报告依赖、事实 grounding 或 AI 调用逻辑。

## 改动

- `src/App.jsx`：同一岗位工作台按岗位要求、匹配报告、简历建议、模拟面试与 Agent 分析分视图显示；简历版本和任务选择位于上方。
- JD 原文、各条原文依据和匹配历史默认折叠；元数据集中展示；未明确字段合并为提示；长职责/技能列表展示前四项，其余可展开；技术关键词紧凑排列。
- 模拟面试入口直接显示岗位选择或当前岗位面试；既有 session 从后端恢复，无报告时提供去分析岗位按钮。
- `src/jobWorkspaceState.js`：hash 携带显式 job/application/tab，ID 严格为正整数。刷新与任务历史导航恢复绑定；岗位/面试入口共享组件实例，标签切换不丢失面试草稿。
- `src/styles.css`：任务控制区换行、按钮不收缩为竖排、响应式单列与可横向滚动的标签导航。
- `tests/job-workspace.browser.mjs`：隔离 API fixture 的真实浏览器验证。fixture 只用于测试，不参与产品运行。

## 验证结果

- `node --check backend/server.js`：exit 0。
- `corepack pnpm build`：exit 0。
- `corepack pnpm test`：exit 0，全部既有隔离回归通过。
- 新浏览器测试：exit 0。覆盖岗位标签切换、原文/证据折叠、长列表展开、模拟面试侧栏与直接入口、草稿保留、刷新恢复、任务切换、返回导航、1440×900 与 390×900 下无整页横向溢出、创建任务按钮横排。
- 桌面和手机截图已实际查看。截图来自隔离测试 fixture，位于 `artifacts/jd-workspace/`。
- `git diff --check`：exit 0。

浏览器测试需要 Playwright 模块与浏览器。可使用本机安装的 Edge，通过 `PLAYWRIGHT_CHANNEL=msedge`；`PLAYWRIGHT_MODULE` 可指定 Playwright 的 file URL。调用：`node tests/job-workspace.browser.mjs`。可选 `UI_SCREENSHOT_DIR` 输出截图。

## 运行状态与边界

未重启用户现有 API/前端服务；验证使用独立的临时 Vite 服务与隔离 API 响应。未调用真实收费 AI、未读取个人 runtime store、未部署、未提交 Git。

repo 原本已有 Vercel、Upstash、验证码等未提交改动。本轮保留这些改动；当前与 HEAD 的整体 diff 不等于本轮范围。新增测试和界面检查不构成这些既有部署改动的独立验收。

面试草稿仅在同一工作台的标签切换中保留；刷新后恢复的是后端保存的 session/answer，不持久化未提交回答。

## 基础匹配报告长度补充调整（2026-10-08）

用户生成实际报告后指出内容仍过长，本轮继续同一界面调整范围。

- 基础匹配报告增加“匹配概览 / 技能与关键词 / 优势与风险”内容切换。切换匹配记录时回到概览。
- 概览保留真实总分、完整结论和六维评分，评分分析与简历/JD 引用按需展开；默认显示前三条优先建议，其余可展开。
- 技能/关键词按组折叠并显示数量，空组为单行；条目判断与原文依据可逐条展开。补齐原界面未展示的 missingKeywords、risks 和维度 suggestions，内容不被删除。
- 移除评分卡片嵌套边框，并用 align-items:start 避免两栏空白被拉伸；同一维度的重复缺失文案去重展示，原报告数据不修改。
- 浏览器测试增加完成报告 fixture，验证六维依据、九项缺口、关键词、风险、剩余建议及桌面/手机无溢出。fixture 不写入个人 store，不代表真实 AI 成功结果。
- node --check backend/server.js、corepack pnpm build、corepack pnpm test、浏览器测试均 exit 0。实际查看 `artifacts/jd-workspace/match-1440.png` 和 `match-390.png`。
- 本轮只改界面、浏览器测试及交接文档，没有调用 AI、修改后端或个人数据。现有 Vite 热更新加载界面。继续等待 Claude 独立验收。
