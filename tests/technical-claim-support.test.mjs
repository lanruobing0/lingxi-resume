import assert from "node:assert/strict";
import { validateClaimSupport } from "../backend/claim-support-validator.js";
const quote = "工具必须在允许清单中；输入需满足类型、长度与枚举要求；资源需属于当前用户；写操作需要满足业务前置条件。";
const validate = text => validateClaimSupport({ claimText: text, citations: [{ sourceTitle: "AI Agent 开发资料", quote }], localQuotes: [quote] });
assert.equal(validate(quote).supported, true);
assert.equal(validate(`面试资料在工具调用要点中指出：${quote}`).supported, true);
assert.equal(validate(`AI Agent 开发资料在工具调用要点中指出：${quote}`).supported, true);
for (const text of ["面试资料在工具调用要点中指出：候选人已经精通工具调用。", "资源需属于当前用户；用户已经掌握系统开发。", "工具必须在允许清单中，因此候选人已具备生产开发能力。", "资源需属于其他用户"]) assert.equal(validate(text).supported, false);
const scale = "不编造百分比、用户规模、收入或耗时。";
assert.equal(validateClaimSupport({ claimText: scale, localQuotes: [scale] }).supported, true);
const traceability = "保留原始资料、章节、切片版本和来源标识；检索前执行用户或资料范围过滤；召回结果携带内容与来源；最终结论关联实际检索到的依据。";
const disclaimer = "本资料提供知识和回答组织方式，不代表候选人有相关项目经历。";
for (const text of [traceability, disclaimer]) {
  assert.equal(validateClaimSupport({ claimText: text, localQuotes: [text] }).supported, true);
  assert.equal(validateClaimSupport({ claimText: `${text}候选人已完成相关项目。`, localQuotes: [text] }).supportFailureCode, "UNSUPPORTED_USER_ATTRIBUTION");
  assert.equal(validateClaimSupport({ claimText: text, localQuotes: ["无关资料。"] }).supported, false);
}
assert.equal(validateClaimSupport({ claimText: disclaimer.replace("不代表", "代表"), localQuotes: [disclaimer] }).supported, false);
assert.equal(validateClaimSupport({ claimText: traceability.replace("用户或资料范围", "所有用户无需"), localQuotes: [traceability] }).supported, false);
console.log("Technical claims passed: source introduction, resource ownership and user metrics accepted; job-seeker attribution and changed ownership rejected.");
