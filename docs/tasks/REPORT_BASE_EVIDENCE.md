# 可引用报告基础事实引用（2026-10-10）

用户报告 REPORT_INVALID_RESPONSE。正式记录 #2/application #5/简历 #16 v7 的实际失败信息为“基础匹配事实没有引用已验证证据”。没有证实 JSON 解析失败；失败在 normalizeGroundedReport 的 BASE_MATCH_FACT 引用约束。原始模型回复未持久化，具体错引内容未知。

## 修复

- Prompt 明确列出与服务端 allowedBaseEvidence 同源的全部可选字符串，不再只给整份基础匹配让模型猜引用规则。
- 要求 BASE_MATCH_FACT 的 baseEvidence 使用完整白名单文本、citations 为空；没有支持就删除主张。知识引用与建议的事实边界不变。
- 原白名单已合并换行/空白，但模型引文仅 trim，可能拒绝正确多行引用；现在双方使用同一 normalizeBaseEvidence，仅规范布局空白，不放宽事实或文字匹配。
- 对已解析对象的 REPORT_INVALID_RESPONSE 提供一次完整重生成纠正。Provider 错误、截断、超时不进入该纠正；第二次仍不合格继续 FAILED，绝不伪造成功。
- Prompt version 改为 grounded-match-report-v2，输入/配置 hash 按既有版本字段审计。
- 前端对确定的基础事实引用错误显示具体原因，避免一概称为报告格式无效。

## 验证

- `node tests/grounded-match-report.integration.mjs` 通过。新增首轮坏基础证据/第二轮修正成功恰好两次调用、持续伪造恰好两次后失败、正确换行引文归一验证；已有截断、超时、知识事实边界、权限、隐私回归通过。
- `node --check backend/server.js`、`corepack pnpm build`、`git diff --check` 通过。
- 验证启动器后端 PID 和项目命令后，仅重启后端，前端与 Qdrant 复用，未重启 Docker。
- 未改写正式简历/报告，未请求真实模型重试；正式报告仍失败，需要用户在登录页面重新生成。不能宣称真实报告已通过所有生成和事实校验。

本轮完成，等待 Claude 独立验收。
