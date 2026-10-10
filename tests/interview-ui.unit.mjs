import assert from "node:assert/strict";
import { recoverInterruptedInterviews } from "../backend/interview-recovery.js";
import { resolveMaterialSelection, verifyMaterialSelection } from "../backend/interview-material-selection.js";
import { interviewGenerationConfigHash } from "../backend/mock-interview-service.js";
import {
  feedbackTextItems,
  interviewApiRequest,
  interviewCategoryLabel,
  interviewFailureMessage,
  interviewStatusLabel,
  nextInterviewQuestionIndex,
  safeKnowledgeSources,
} from "../src/interviewUiState.js";

assert.equal(interviewStatusLabel("DEGRADED"), "降级可用");
assert.equal(interviewCategoryLabel("MATCH_GAP"), "匹配缺口");
assert.match(interviewFailureMessage("INTERVIEW_ANSWER_DUPLICATE"), /已经提交/);
assert.match(interviewFailureMessage("INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT"), /已拦截/);
assert.equal(nextInterviewQuestionIndex([{ id: 1, answerId: 9 }, { id: 2, answerId: null }]), 1);
assert.deepEqual(feedbackTextItems([{ text: "结构清晰" }, "表达具体", null]), ["结构清晰", "表达具体"]);
assert.deepEqual(safeKnowledgeSources([{
  sourceType: "KNOWLEDGE", sourceTitle: "高并发面试指南", quote: "缓存设计需要说明一致性与失效策略。", availability: "AVAILABLE", sourceId: "KNOWLEDGE-1", retrievalRunId: 7, contentHash: "private",
}]), [{ title: "高并发面试指南", summary: "缓存设计需要说明一致性与失效策略。", sourceType: "知识库", availability: "AVAILABLE" }]);
assert.deepEqual(safeKnowledgeSources([{ sourceType: "RESUME", quote: "用户经历" }]), []);
assert.deepEqual(interviewApiRequest("history", { applicationId: 5 }), { path: "/api/job-applications/5/interview-sessions" });
assert.deepEqual(interviewApiRequest("session", { sessionId: 8 }), { path: "/api/interview-sessions/8" });
assert.equal(JSON.parse(interviewApiRequest("create", { applicationId: 5, matchReportId: 7 }).options.body).matchReportId, 7);
assert.equal(JSON.parse(interviewApiRequest("answer", { sessionId: 8, questionId: 2, answerText: "真实回答" }).options.body).answerText, "真实回答");
assert.equal(interviewApiRequest("complete", { sessionId: 8 }).path, "/api/interview-sessions/8/complete");

const selectionStore = { knowledgeDocuments: [{ id: 1, title: "资料", scope: "PUBLIC", status: "PROCESSED", vectorStatus: "INDEXED", processingVersion: 1, indexedProcessingVersion: 1, activeIndexRunId: 7 }], knowledgeChunks: [] };
const confirmed = resolveMaterialSelection(selectionStore, 1, { mode: "MANUAL", documentIds: [1] });
verifyMaterialSelection(selectionStore, 1, confirmed);
selectionStore.knowledgeDocuments[0].activeIndexRunId = 8;
assert.throws(() => verifyMaterialSelection(selectionStore, 1, confirmed), error => error.status === 409);
assert.equal(confirmed.documents[0].indexRunId, 7);
assert.notEqual(interviewGenerationConfigHash({ materialSelection: confirmed }), interviewGenerationConfigHash({ materialSelection: { mode: "NONE", documents: [], documentIds: [] } }));
assert.deepEqual(JSON.parse(interviewApiRequest("create", { applicationId: 5, matchReportId: 7, materialSelection: { mode: "NONE", documentIds: [] } }).options.body).materialSelection, { mode: "NONE", documentIds: [] });
console.log("interview UI state tests passed");
const recoveryStore = { interviewSessions: [{ id: 1, status: "PENDING" }, { id: 2, status: "IN_PROGRESS" }, { id: 3, status: "COMPLETED" }, { id: 4, status: "RUNNING" }, { id: 5, status: "PENDING", deletedAt: "deleted" }] };
assert.equal(recoverInterruptedInterviews(recoveryStore, "restarted"), true);
assert.equal(recoveryStore.interviewSessions[0].failureCode, "INTERVIEW_GENERATION_INTERRUPTED");
assert.equal(recoveryStore.interviewSessions[0].completedAt, "restarted");
assert.equal(recoveryStore.interviewSessions[1].status, "IN_PROGRESS");
assert.equal(recoveryStore.interviewSessions[2].status, "COMPLETED");
assert.equal(recoveryStore.interviewSessions[3].status, "FAILED");
assert.equal(recoveryStore.interviewSessions[4].status, "PENDING");
assert.equal(recoverInterruptedInterviews(recoveryStore), false);
