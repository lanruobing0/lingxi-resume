# 基础岗位匹配响应截断修复

日期：2026-10-08
状态：实现、隔离回归与真实请求复验完成；等待 Claude 独立验收。

## 已复现原因

用户的基础匹配任务使用 DeepSeek。授权后，用生产 buildAiResumeContext 与锁定 ResumeVersion/JD/ParseResult 复现：HTTP 200，finish_reason=length，completion_tokens=4096，JSON 无效。原请求输出预算不足，错误被统一显示为“岗位匹配 AI 调用失败”。与 Qdrant 空知识库无关。

## 修复范围

- backend/server.js：基础匹配专用输出预算 8192 token、单次默认等待 60 秒。显式 AI_PROVIDER_TIMEOUT_MS 仍具有优先权，其他功能默认预算不变。
- Chat finish_reason=length / Responses status=incomplete + max_output_tokens 均作为 AI_OUTPUT_TRUNCATED 失败，不能保存为成功报告，即使截断响应中的内容仍可解析为 JSON。
- 非严格 JSON 解析错误使用 AI_INVALID_RESPONSE；匹配失败提示区分截断、格式、超时、未配置与服务不可用，不向界面转发原始 Provider 消息或密钥。
- 完整结果若未通过原有匹配校验，最多纠正一次；使用相同已锁定输入，要求引用逐字复制，缺失事实保持 NOT_FOUND。第二次仍执行完整 normalizeMatchReport，不放宽评分、引用和 ownership 边界。不对 Provider 失败或截断执行无限重试。
- tests/resume-job-match.integration.mjs：新增 Responses/Chat 截断、无效 JSON、两种输出预算、Chat 完整结果、一次证据纠正。原有跨用户、跨简历/JD 证据、失败历史保护和 PII 测试保留。

## 实际验证

- 原请求：4096 token 用满、JSON 被截断。
- 提高预算后的第一次真实复验：5706 completion token，finish_reason=stop，JSON 有效；学历证据不通过原校验，仍拒绝。
- 加入一次纠正后的真实复验：首次 5597 token、纠正请求 4416 token，均完整返回；最终通过生产六维评分及简历/JD 证据校验。
- 真实复验没有向个人 store 写入成功记录，没有打印或保存简历、JD、模型正文或 API key。用户在产品界面重试才创建新的真实历史记录。
- node --check backend/server.js：exit 0。
- node tests/resume-job-match.integration.mjs：exit 0。
- corepack pnpm test：exit 0，完整隔离回归通过。
- corepack pnpm build：exit 0。
- git diff --check：exit 0。

## 运行与交接

通过现有一键启动器重启了本地 8876 后端；重启前未完成 Job/Match 数量均为 0。复用了现有 5173 前端和本地 Qdrant。配置和历史失败记录保留，未部署或提交 Git。

既有 JD 工作台界面调整与其他 Upstash/Vercel/验证码本地改动仍在工作区，本轮只追加匹配修复与测试，不代表对既有未提交内容重新独立验收。

## 关键词 JD 证据缺失补充修复

用户随后报告 `matchedKeywords[0].jdEvidence` 缺少证据。原输出 schema 允许空证据数组，纠正提示只包含首个校验错误，可能遗漏其他字段问题。

- 七组技能与关键词 schema 均要求至少一条 JD 引用；匹配及部分匹配项要求简历引用，NOT_FOUND 项允许空简历证据。
- 提示明确关键词必须来自 JD，引用逐字复制；没有依据的条目不得补造。
- 一次纠正前收集多个字段校验错误，包括关键词证据问题；最终仍执行原完整校验，最多纠正一次。
- 隔离回归覆盖同时纠正评分维度引用与关键词缺证据，以及第二次仍缺证据时保持 FAILED、空报告与空分数。
- 同一授权真实任务返回完整 JSON（5624 completion token），通过生产六维评分及证据校验。此次 matchedKeywords 为空，不据此声称验证了非空关键词引用；非空与缺失场景由隔离回归覆盖。
- 补充修复后 node --check、匹配集成测试、完整 pnpm test 与 pnpm build 均 exit 0。本地后端已再次通过现有启动器重启，未完成任务数为 0；真实复验没有写入个人 store。
