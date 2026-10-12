# 基础匹配再次输出截断（2026-10-12）

用户明确要求修复截图里的 AI 输出达到长度上限，而非新增删除入口或调整重试样式。

## 诊断与修复

- 正式基础匹配 #15/#16 属于 application #15，绑定简历 #16 v7，均为 FAILED / AI_OUTPUT_TRUNCATED。配置使用 DeepSeek deepseek-v4-flash。当前基础匹配原输出预算为 8192，保留的失败记录不含 Provider token usage 或正文。
- 基础匹配专用预算提高至 16384 token、默认单次超时由 60s 调整为 90s；显式 AI_PROVIDER_TIMEOUT_MS 仍优先，其他 AI 功能设置不变。
- 要求紧凑 JSON、简短结论/解释、仅引用支持结论的最短原文，通常 1–2 条引用，避免重复整段简历和 JD。不同必需/加分技能及 JD 关键词不能因长度目标被丢弃，证据不能改写；未新增 schema 截取或验证放宽。
- 原六维评分、内容哈希/版本/JD 绑定、证据验证、最多一次证据纠正以及截断显式失败机制保持。没有自动无限重试或伪造成功记录。

## 实际验证

- 用户授权后使用 application #15 的生产 resolveResumeJobMatchContext/buildAiResumeContext/generateAiResumeJobMatch 做内存真实复验。只发送脱敏岗位相关输入，未写入个人 store，未打印或保存密钥、简历/JD/模型正文。临时模块移除。
- 两次真实请求均 HTTP 200 / finish_reason=stop：初次 3921 completion token、18102ms，原有一次证据纠正后 4645 token、18919ms。最终通过生产 normalizeMatchReport：六维、37 个技能/关键词条目、服务端重算 72 分。该结果用于验证，未替换旧失败历史或保存新报告。
- 两种 API 的预算断言更新至 16384。node tests/resume-job-match.integration.mjs 通过，含截断不保存成功、格式、一次纠正、跨用户/跨简历/JD、PII 与历史保护。
- 最终 corepack pnpm test 全量 exit 0；node --check backend/server.js、corepack pnpm build、git diff --check 均通过。
- 已核实本项目正式后端身份且无活跃任务后重启加载，/health 200；前端无需更改。用户可在页面点击“重试”生成新历史记录，旧失败记录保留。

参考 Provider 的 finish_reason/max_tokens 语义：[DeepSeek 官方 Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。实际完成结论以本次真实请求及生产校验为依据。

本轮完成，等待 Claude 独立验收；仅本地提交，不推送或部署。
