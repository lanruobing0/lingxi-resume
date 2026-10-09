# 岗位工作台与模拟面试页面分离（2026-10-09）

用户先要求讨论方案，随后明确批准实施：岗位 JD 承载分析；模拟面试独立展示记录与逐题练习，通过已有岗位报告衔接。

## 范围与实现

- 模拟面试侧栏进入 `#interview` 的独立记录首页。新组件 `src/InterviewLibrary.jsx` 从 owned JobApplication、InterviewSession、MatchReport 列表聚合真实历史，展示岗位、锁定简历版本、状态、进度、日期与继续/回看入口。
- 新建面试先选择 COMPLETED/DEGRADED 岗位报告。无报告引导完成岗位匹配；加载失败明确报错并允许重新读取，不展示假记录。选择报告只是进入准备页，点击开始后才调用原生成 API。
- 面试练习页只显示岗位、锁定版本、返回记录、查看岗位报告及已有逐题练习。隐藏 JD 编辑、重新解析、简历选择/创建任务和岗位工作台 tabs；岗位工作台仅显示岗位要求、匹配报告、简历建议、Agent 分析。
- AI 岗位报告提供“针对这个岗位练习”。路由增加可选 session/report ID，刷新精确恢复指定面试/报告；指定任务或面试无效时明确失败，不自动替换为其他记录。旧 interview tab 链接仍兼容。
- 继续面试优先使用 session 原始 matchReportId；生成成功更新场次路由，删除当前场次清除旧路由并选择剩余记录。保留原删除确认、运行保护、反馈重试及事实边界校验。
- 复用现有业务控制器和 MockInterviewWorkspace，渐进拆分界面，不复制生成逻辑或增加第二套后端。未提交回答按 session/question 保存在控制器内存，页面往返可恢复；浏览器刷新仍只恢复后端已保存回答。未写入 localStorage，不跨登录持久化；删除面试时清除对应草稿。
- 无后端 API、数据结构、Provider、Qdrant 或真实个人记录修改，无提交、部署。

## 验证

- node --check backend/server.js、corepack pnpm build、corepack pnpm test：exit 0。
- 隔离 Playwright/Edge 桌面 1440×900、手机 390×900 验证记录首页、报告选择、隐藏岗位控件、四个岗位 tabs、往返草稿、指定场次刷新、反馈重试、各类历史删除与无溢出。
- 补充生成请求契约、新建成功路由、删除当前面试后选中剩余记录、首页空状态、无报告引导及读取失败重试。
- 截图：`artifacts/interview-pages/`。测试只使用隔离 API fixture，没有生成、删除或修改个人真实记录。

本次批准的界面调整完成后停止，等待 Claude 独立验收。
