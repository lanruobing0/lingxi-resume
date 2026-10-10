# 可引用报告输出截断（2026-10-10）

用户报告 REPORT_PROVIDER_UNAVAILABLE。正式存储只读确认 MatchReport #1 FAILED，绑定简历 #16 v7/application #5，failureMessage 明确为“AI 输出达到长度上限，报告未生成完整”。基础匹配 #4 已 COMPLETED。不是证实的服务连接故障。

## 原因与修复

- 报告生成没有显式 maxOutputTokens；Chat Completions 默认 4096，Responses 依赖 provider 默认。复杂报告可能截断。
- runAiJson 已正确识别 AI_OUTPUT_TRUNCATED，但 mappedAiFailureCode 将其归成 REPORT_PROVIDER_UNAVAILABLE，页面只显示通用故障。
- 报告明确输出预算 8192，生成超时 60000ms；不改变全局 provider 配置。
- 映射保留 AI_OUTPUT_TRUNCATED，前端明确显示报告被截断和重新生成；加入超时提示。
- 对历史记录的同一确定性截断错误文字提供显示兼容，旧记录无需改写即可正确展示原因。
- 不接受残缺 JSON，不伪造或静默降级成功，不进行无限自动重试。

## 验证和运行

- `node tests/grounded-match-report.integration.mjs` 通过：新增 Responses incomplete 和 Chat finish_reason=length 模拟，均 502/AI_OUTPUT_TRUNCATED，FAILED 历史保存；验证两种协议预算均为 8192。已有引用、权限、隐私、同步/异步超时回归保持通过。
- `node --check backend/server.js`、`corepack pnpm build` 通过。
- 核对启动器 backend 记录及进程命令后，仅重启本项目后端，启动器确认就绪，前端与 Qdrant 复用，未重启 Docker。
- 临时正式页浏览器没有登录会话，未能在该临时页提交真实重试；标签已关闭。未修改实际失败记录，未发起真实模型调用，不能保证新预算必然足够或报告已生成。

用户可在已登录页面点击重新生成，仍使用已成功的 v7 基础匹配。完成待 Claude 独立验收，停止本轮。
