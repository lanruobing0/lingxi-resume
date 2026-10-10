import assert from "node:assert/strict";
import { containsMatchEvidence, matchEvidenceSources } from "../backend/match-evidence.js";

const source = { currentPosition: "AI Agent工程师", experience: { role: "开发工程师", startDate: "2022/07", endDate: "至今", highlights: ['实现 "Tool Calling"\n及轨迹审计', "使用 Python、RAG"] } };
const fields = matchEvidenceSources(source);
assert.equal(containsMatchEvidence(fields, '实现 "Tool Calling"\n及轨迹审计'), true, "decoded quotes must not be rejected due to JSON escaping");
assert.equal(containsMatchEvidence(fields, '实现 "Tool Calling" 及轨迹审计'), true, "layout whitespace is not a new fact");
assert.equal(containsMatchEvidence(fields, "Python、RAG"), true);
for (const quote of ["4 年开发经验", "2022/07 - 至今", "开发工程师 2022/07", "Python及RAG", "resumeEvidence", "React 前端研发", '实现 \\"Tool Calling\\"']) {
  assert.equal(containsMatchEvidence(fields, quote), false, `unsupported or joined quote must fail: ${quote}`);
}
assert.equal(containsMatchEvidence({ rawText: "要求 Python\n以及 RAG 开发" }, "要求 Python 以及 RAG 开发"), true);
assert.equal(containsMatchEvidence(fields, ""), false);
console.log("Match evidence passed: decoded quotes, whitespace, field isolation, fabricated years/date ranges and foreign facts rejected.");
