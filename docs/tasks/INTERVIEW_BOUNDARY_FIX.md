# 面试题事实边界生成修复

日期：2026-10-09
状态：局部实现与回归完成，本地后端已加载；等待 Claude 独立验收。

## 诊断

用户报告 INTERVIEW_FACT_BOUNDARY_VIOLATION。只读取本地失败会话的 ID、状态、错误字段与任务绑定，确认 session 1 在 questions.0.question 的用户经历事实校验失败。失败记录未保存模型原文，因此不能断言具体是虚构经历还是过度改写。原生成流程在首个校验错误后直接失败，缺少有界的重新生成机会。

## 实现范围

- backend/mock-interview-service.js：题目提示版本升级至 v2。个人经历逐字引用 RESUME 来源；JD/MATCH_GAP/KNOWLEDGE 问题采用中性或假设问法；expectedPoints 写评价要点，不能把岗位要求归因给候选人。
- backend/server.js：仅 INTERVIEW_FACT_BOUNDARY_VIOLATION 允许最多一次重新生成，沿用相同锁定输入、来源、题数与严格 schema，并反馈安全的字段校验错误。第二次仍执行原 normalizeInterviewQuestions，任何失败均按既有机制标为 FAILED、移除题目，不改变 validator、ownership 或输入绑定。
- 不在第一次校验完成前写入题目，不把原始模型结果写入 store 或纠正提示，不对 Provider 失败进行新增自动重试。
- tests/rag-mock-interview.integration.mjs：增加用户事实与同类来源绑定的纠正成功场景，验证两次请求和原输入保留。持续虚构场景验证恰好两次请求后失败且无题目；原各分类攻击、反馈事实边界与隐私回归继续通过。

## 实际验证与边界

- node --check backend/server.js、node --check backend/mock-interview-service.js：exit 0。
- node tests/rag-mock-interview.integration.mjs：exit 0。
- corepack pnpm test、corepack pnpm build：exit 0。
- 通过既有启动器重启 8876 后端，检查重启前无待运行生成任务；复用前端和 Qdrant。
- 本轮没有向真实 Provider 发送个人输入，没有生成用户真实新会话；模型线上是否一次纠正成功需用户新建面试验证。不声称真实模型复验已通过。
- 保留旧失败历史、运行时数据及其他未提交改动；未提交或部署。完成后停止，等待 Claude 独立验收。

## 空知识库类别限制补充修复

用户再次失败，具体错误为“KNOWLEDGE 问题没有绑定同类可信来源”。本地只读核实：知识文档与切片均为 0，最新失败 session 2 的字段错误与截图一致。原提示未明确禁止无知识来源的 KNOWLEDGE 类题目，静态 schema 也允许四类题；有知识来源但只有三题时，提示还错误要求覆盖四类。

- 提示 v3 按本次来源列出 allowedCategories 和 requiredCategories，无 KNOWLEDGE 来源时明确禁止知识类题与知识引用，其余题从 RESUME/JD/MATCH_GAP 补足。有知识来源且至少四题才要求 KNOWLEDGE 类。
- 每次生成使用来源约束 schema：类别 enum 仅含实际可用类型，问题与 expectedPoints 的 sourceId enum 仅含本次来源，题数固定为请求题数。一次纠正也沿用相同 schema。
- 原同类来源、事实 grounding 和失败持久化校验不变；无知识来源时明确保留 DEGRADED / INTERVIEW_NO_KNOWLEDGE_EVIDENCE，不伪装完整 RAG，不自动补造或导入资料。
- 新测试使用真正空的隔离知识 store 覆盖首次合法生成、一次纠正成功、持续错误两次后 FAILED 且无题目，检查三类题和无知识引用；也检查三题不能要求四类。
- 补充修复后语法检查、专项集成、全量 pnpm test、pnpm build 和 git diff --check 均 exit 0。未向真实 Provider 发送个人输入，不声称真实模型复验通过。

## 实际问法误判复现与修复

用户再次报告 questions.0.question 失败。本次使用同一 owned JobApplication / ResumeHistory / JD ParseResult / MatchReport 的锁定脱敏输入进行真实 DeepSeek 只读复验；仅调用生产 buildAiResumeContext、提示、schema、Chat payload 和完整题目 validator，不写入个人 store。

- 真实请求复现中文分词误判：“你在”“写到”等提问引导语被作为未支持的经历词；开放问法“请说明你是如何……”也被当成已完成的个人经历。“通过”“过程中”的“过”又会错误触发过去经历标记。
- 在中文分词与 bigram 对照前一致剥离有限的归因引导语，不删除实际行为、技术实体或成果。过去经历识别排除通过/经过/过程/过渡/过滤中的非经历含义。
- 仅以“你如何/你是如何/请说明你如何”等开头、没有过去/当前经历标记、问法后没有第二个用户归因的句子，作为中性开放问题。问法里再嵌入“你主导 Kubernetes”等事实仍须校验；不整体跳过 RESUME 题，也不降低证据匹配阈值。
- 回归覆盖真实引导语、通过/过程中的中性问法，以及之前/已经/做过、无依据 Redis/Kubernetes、百人团队、50% 成果和中性问法夹带事实的拒绝。完整 API 场景验证合法问法无需纠正且原题保留；原攻击与隔离测试继续保留。
- 最终实际复验：HTTP 200、finish_reason=stop、1252 completion token，首次响应通过完整生产题目校验。另一次真实复验首次仍有字段错误，沿用生产一次纠正后通过；不保证随机模型每次首次都成功。
- 只输出 HTTP 状态、token 数、字段路径与经过隐私过滤的分词诊断，不打印密钥、联系方式、完整简历/JD/模型响应。没有将诊断结果保存为用户正常面试；用户新建会话才产生正常记录。
- 最终代码的语法检查、专项集成、全量 pnpm test、pnpm build、git diff --check 均 exit 0；已删除临时只读诊断脚本，并在确认无未完成生成任务后通过现有启动器重启后端。未提交或部署，等待独立验收。
