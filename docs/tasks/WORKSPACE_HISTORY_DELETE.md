# 建议与面试历史删除（2026-10-09）

用户授权为截图中的 SuggestionRun 历史和当前任务历史面试增加删除功能。范围只包含这两类历史，不删除简历版本、岗位报告或 Agent 历史。

后续用户另行授权 Agent 历史删除，追加范围与验证见末节；简历版本和岗位报告仍不属于删除范围。

## 实现

- 每条建议运行/面试历史提供独立删除按钮，与选择按钮为同级元素；复用 ConfirmDialog 二次确认。生成、反馈、接受建议及删除处理中禁用冲突操作。
- 建议历史改为“建议生成历史”。删除确认明确已接受修改和简历版本保留；面试确认说明题目、回答、反馈一并删除。
- DELETE `/api/suggestion-runs/:id`、DELETE `/api/interview-sessions/:id`：requireUser + owned ID 校验，跨用户/不存在/重复删除均 404；PENDING/RUNNING、正在应用建议、正在生成反馈返回 409 HISTORY_BUSY。
- 建议运行标记 deletedAt，非 ACCEPTED 建议清除内容，仅留 ID/owner/run/deletedAt 墓碑，防止旧建议 ID 被复用。ACCEPTED 记录保留为简历版本来源；不撤销修改或改变 ResumeHistory。
- 面试复用 deleteInterviewSessions 清理 Question/Answer/Feedback，包括旧失败反馈；只留 session ID/owner/application/deletedAt 墓碑，避免会话 ID 被复用。
- 历史列表及详情过滤删除标记；已删除会话的 questions、answer、feedback、retry、complete 均不可访问。删除建议的 accept/reject 不可操作。
- 删除成功后立即移除列表项并读取最新列表；删除当前项自动选择剩余首条，无剩余项清空详情/本题反馈。删除其他项保留当前选择，失败保持原记录并提示，不伪装成功。
- 紧凑中性按钮、独立 hover/focus 与 disabled 状态，沿用产品样式和响应式布局。

## 验证

- node --check backend/server.js、corepack pnpm build、corepack pnpm test：exit 0。
- 建议专项：跨用户、重复删除、列表和详情隐藏、删除建议不可接受、已接受来源/简历/版本不变、重启保持删除；PENDING 删除返回 409。
- 面试专项：跨用户、关联题目/回答/反馈级联清除、详情/反馈/complete 404、列表隐藏、简历与版本不变、重启保持删除；反馈 PENDING 删除返回 409。
- Playwright/Edge 隔离 API 浏览器验证：取消不发 DELETE、非选中删除保留当前面试、当前删除清空原回答与反馈、建议当前删除切换剩余条目、删空显示空状态；1440/390 宽度无页面溢出，无浏览器异常。实际个人历史未被测试删除。
- 本次不修改 persistence 或数据库结构，没有额外执行真实 MySQL smoke；继续使用既有 JSON/MySQL 实体投影。

不提交、不部署，不清理其他 dirty 文件。实现完成后停止，等待 Claude 独立验收。

## Agent 历史删除补充（2026-10-09）

- 用户截图明确要求历史 AgentRun 也可删除。沿用同级删除按钮与 ConfirmDialog，确认说明本次分析步骤/结果清除，简历/岗位报告保留。
- DELETE `/api/agent-runs/:id` 检查 owned run，跨用户、不存在、重复删除返回 404；run 或 step 为 PENDING/RUNNING 返回 409 HISTORY_BUSY。
- 复用 deleteAgentRuns 清理全部 AgentStep 与最终结果，仅留 ID/owner/application/deletedAt 墓碑防止 run ID 被复用；列表、详情、步骤 API 均过滤删除标记。保留 shared KnowledgeRetrievalRun 和引用的 resume/history/application/report。
- 删除未选中项保持当前详情；删除当前项清空步骤/结果并选择剩余首条，删空显示空状态。删除失败保留记录并提示，处理期间禁用冲突操作。
- Agent 专项覆盖跨用户、重复删除、steps/详情 404、列表隐藏、关联步骤清除、简历/历史/报告/application/retrieval 不变、运行保护和重启持久化；全量 pnpm test、node --check、build、diff --check 通过。
- 浏览器隔离 API 验证取消不删除、未选中删除保持当前项、删空清空详情，desktop/mobile 无页面溢出，无浏览器异常；个人真实历史未被测试删除。

补充完成后停止等待 Claude 独立验收，不提交或部署。

## 独立面试记录首页删除（2026-10-10）

用户截图要求在独立模拟面试列表添加删除。InterviewLibrary 每行的继续/反馈入口与删除是两个相邻按钮，无嵌套 button。复用 App 的 ConfirmDialog，说明题目/回答/反馈删除不可恢复；取消不删除，提交时阻止重复删除，失败保留列表并提示真实原因，成功移除并重新加载列表。PENDING/RUNNING 按钮禁用，既有后端 HISTORY_BUSY/ownership/级联与墓碑保留。没有修改真实个人历史或后端删除逻辑。

后端语法、`corepack pnpm build` 通过。隔离真实 Node API fixture + mock 生成一份 NONE 面试，实际 UI 验证列表删除入口、取消保留、确认后删空、刷新后仍为空；1440/390 布局检查，手机 scrollWidth=390/innerWidth=390。截图 `artifacts/materials-selection/library-delete.jpg`。前端正式 Vite 自动加载改动。按现行 DECISIONS 保存本地提交，待独立验收，不推送或部署。
