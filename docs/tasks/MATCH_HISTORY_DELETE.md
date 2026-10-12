# 匹配历史操作与删除（2026-10-12）

用户要求调整基础匹配历史重试按钮并添加删除功能。

- 记录选择区占剩余宽度，重试/删除为同行固定内容宽度的图标文字按钮。失败记录显示重试；删除沿用默认灰色、悬停/键盘焦点红色与浅红背景。生成/删除请求中禁用操作。
- 复用 ConfirmDialog 与分析历史删除状态，明确级联范围和失败提示。删除选中匹配后优先切换剩余成功匹配，否则选剩余项或清空；删除其关联的当前 AI 报告时清理路由/建议与快照选择，恢复剩余报告。
- owned DELETE /api/resume-job-matches/:id：匹配、报告、建议、面试、Agent 正在处理或队列中时 409 HISTORY_BUSY。加入 ANALYZING 状态保护。复用 deleteWorkspaceAnalysis 的 matchId 分支，删除该基础匹配及以它为依据的报告和关联产物，保留所属分析任务、其他匹配/报告、简历、JD、已接受修改和快照、共享检索审计。
- 最小 ID 墓碑避免复用；历史列表过滤，删除后详情/重试返回 404。不更改 AI 生成或证据校验。

验证：扩展 analysis-history-delete.integration.mjs，跨用户 404、删除后详情/重试/重复删除 404、历史/报告列表清理、级联、accepted provenance、任务保留、三种处理中状态、排队报告和建议应用锁保护通过。corepack pnpm test 全量 exit 0，node --check backend/server.js、corepack pnpm build、git diff --check 通过。

独立临时 JSON/API/Vite 会话浏览器验证两条失败匹配的重试/删除入口、确认范围和取消保留。1440×900 行宽约 1083px 时重试仅 60px；390×900 行宽约 311px、无行内横向溢出。未在浏览器提交最终删除或发起真实 AI 重试，删除持久化由隔离 API 测试验证。临时服务和页面关闭。

正式后端身份及无活跃任务确认后重启加载；/health 200、新 DELETE 未认证 401。未删除正式记录。完成待 Claude 独立验收；本地提交，不推送或部署。
