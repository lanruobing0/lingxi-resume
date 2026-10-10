# 基础匹配工作经验证据校验（2026-10-10）

用户报告 `dimensions.experience.resumeEvidence` 无法验证。正式记录只读确认：基础匹配 #3 FAILED，绑定简历 #16 v7，错误与用户一致；不同于前一轮 v1 快照问题。生成流程已有一次纠正，纠正后的引用仍不能通过。原始模型回复没有持久化，无法确定本次具体引文，不将以下校验缺陷推断为已经证实的唯一原因。

## 修复

原校验对 `JSON.stringify(buildAiResumeContext(...))` 搜索证据，真实字符串中的引号/换行被 JSON 转义，可能拒绝正确原文，同时 JSON 键/跨字段结构不应该成为经历依据。

- 新增 `match-evidence.js`，在 provider-safe 原文的单个解码字符串字段中核对引用，只规范空白字符。
- 不允许合并分散字段、拼接日期范围、推算工作年限、改写标点或引用其他简历事实。
- resume/JD 验证和纠正阶段的错误收集统一使用此规则，继续拒绝不存在的证据。
- Prompt 明确工作经验引用必须来自单独职位/日期/职责原文；计算或推断只能放入解释，没有可核实引文可返回空数组。
- 沿用最多一次模型纠正、FAILED 状态和历史保护，不增加无限重试，不替代真实 AI 输出。

## 验证及运行

- `node tests/match-evidence.test.mjs`：通过，引号/换行/空白正确引用、伪造年限、拼接日期、跨字段、其他事实等边界。
- `node tests/resume-job-match.integration.mjs`：通过；真实临时 API + mock provider 的 Java 简历和模型引文加入引号/换行，仍完成匹配；跨简历/JD、纠正次数、伪造引文拒绝等回归保留。
- `node --check backend/server.js`、`corepack pnpm build`：通过。
- 验证正式监听进程确为本项目 backend/server.js 后，仅重启此后端并由已有启动器恢复；前端与 Qdrant 复用，未重启 Docker。健康检查成功。
- 正式简历及失败报告未修改，未调用真实 AI 重试。因此不能宣称该真实失败报告已经成功生成，用户需重新生成/重试检查模型新引文。

完成待 Claude 独立验收，停止本轮。
