import assert from "node:assert/strict";
import { buildSuggestionDiff, suggestionActions, suggestionDecisionRequest, suggestionFailureMessage, suggestionStatusLabel, versionSourceLabel } from "../src/suggestionUiState.js";

assert.equal(suggestionStatusLabel("PENDING"), "待处理");
assert.equal(suggestionStatusLabel("INVALIDATED"), "已失效");
assert.deepEqual(suggestionActions({ status: "PENDING", suggestionType: "REWRITE", after: "new" }), { canPreview: true, canAccept: true, canReject: true, factRequired: false, invalidated: false });
assert.deepEqual(suggestionActions({ status: "PENDING", suggestionType: "FACT_REQUIRED" }), { canPreview: false, canAccept: false, canReject: false, factRequired: true, invalidated: false });
assert.deepEqual(suggestionActions({ status: "INVALIDATED", suggestionType: "REWRITE" }), { canPreview: false, canAccept: false, canReject: false, factRequired: false, invalidated: true });
assert.deepEqual(suggestionDecisionRequest({ id: 11, status: "PENDING", suggestionType: "REWRITE", after: "new" }, "accept", 4), { path: "/api/resume-suggestions/11/accept", body: { expectedBaseResumeVersion: 4 } });
assert.deepEqual(suggestionDecisionRequest({ id: 11, status: "PENDING", suggestionType: "REWRITE" }, "reject", 4), { path: "/api/resume-suggestions/11/reject", body: undefined });
assert.equal(suggestionDecisionRequest({ id: 12, status: "PENDING", suggestionType: "FACT_REQUIRED" }, "accept", 4), null);
assert.deepEqual(buildSuggestionDiff("负责接口开发", "负责高并发接口开发"), [
  { type: "unchanged", text: "负责" },
  { type: "added", text: "高并发" },
  { type: "unchanged", text: "接口开发" },
]);
assert.match(suggestionFailureMessage("RESUME_VERSION_CONFLICT"), /版本已变化/);
assert.equal(versionSourceLabel({ sourceSuggestion: { id: 18 } }), "来源建议 #18");
assert.equal(versionSourceLabel({}), "手动创建或既有版本");

console.log("suggestion UI state tests passed");
