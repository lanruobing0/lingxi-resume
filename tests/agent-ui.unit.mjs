import assert from "node:assert/strict";
import {
  SAFE_AGENT_OBJECTIVE,
  agentActionLabel,
  agentApiRequest,
  agentFailureMessage,
  agentResultTypes,
  agentStatusLabel,
  safeAgentSource,
  safeAgentStepSummary,
  safeRetrievalSources,
} from "../src/agentUiState.js";

assert.equal(agentStatusLabel("PENDING"), "等待开始");
assert.equal(agentStatusLabel("RUNNING"), "分析中");
assert.equal(agentStatusLabel("COMPLETED"), "已完成");
assert.equal(agentStatusLabel("DEGRADED"), "降级可用");
assert.equal(agentStatusLabel("FAILED"), "分析失败");
assert.equal(agentStatusLabel("STOPPED_LIMIT"), "已达步骤上限");

assert.deepEqual([
  "READ_RESUME",
  "READ_JOB",
  "READ_MATCH_REPORT",
  "RETRIEVE_KNOWLEDGE",
  "SUMMARIZE_EVIDENCE",
  "PRODUCE_PLAN",
].map(agentActionLabel), ["读取锁定简历", "读取岗位信息", "读取匹配报告", "检索知识库", "汇总已有证据", "生成建议计划"]);
assert.equal(agentActionLabel("EXEC_SHELL"), "未授权步骤");

const unsafeSource = {
  sourceType: "KNOWLEDGE",
  sourceTitle: "缓存设计资料",
  quote: "缓存命中率与响应延迟需要结合观察。",
  availability: "AVAILABLE",
  sourceId: "KNOWLEDGE-secret",
  refId: "private-ref",
  contentHash: "private-hash",
  embedding: [0.1, 0.2],
  provider: { apiKey: "private-key" },
  hiddenPrompt: "private-prompt",
};
assert.deepEqual(safeAgentSource(unsafeSource), { title: "缓存设计资料", summary: "缓存命中率与响应延迟需要结合观察。", sourceType: "知识库", availability: "AVAILABLE" });
assert.deepEqual(safeRetrievalSources({ actionType: "READ_RESUME", sourceRefs: [unsafeSource] }), []);
assert.equal(safeRetrievalSources({ actionType: "RETRIEVE_KNOWLEDGE", sourceRefs: [unsafeSource] })[0].title, "缓存设计资料");

const summaries = safeAgentStepSummary({
  input: { query: "Redis 缓存", mode: "HYBRID", maxSteps: 100, toolName: "EXEC_SHELL", resumeContentHash: "private-hash" },
  output: { resultCount: 2, degraded: false, rawEmbedding: [0.1], hiddenPrompt: "private-prompt", categoryCounts: { RECOMMENDATION: 3 } },
});
assert.deepEqual(summaries.input, [{ label: "检索问题", value: "Redis 缓存" }, { label: "检索模式", value: "HYBRID" }]);
assert.deepEqual(summaries.output, [{ label: "检索结果", value: "2 条" }, { label: "是否降级", value: "否" }, { label: "计划条目", value: "3 条" }]);

const create = agentApiRequest("create", { applicationId: 7, matchReportId: 9 });
assert.equal(create.path, "/api/job-applications/7/agent-runs");
assert.deepEqual(JSON.parse(create.options.body), { matchReportId: 9, objective: SAFE_AGENT_OBJECTIVE, searchMode: "HYBRID" });
assert.equal(Object.hasOwn(JSON.parse(create.options.body), "maxSteps"), false);
assert.equal(/action|tool|shell|url/i.test(create.options.body), false);
assert.deepEqual(agentApiRequest("history", { applicationId: 7 }), { path: "/api/job-applications/7/agent-runs" });
assert.deepEqual(agentApiRequest("detail", { runId: 4 }), { path: "/api/agent-runs/4" });
assert.deepEqual(agentApiRequest("steps", { runId: 4 }), { path: "/api/agent-runs/4/steps" });

assert.equal(agentResultTypes.VERIFIED_RESUME_FACT.note, "来自已验证简历事实");
assert.equal(agentResultTypes.EXTERNAL_KNOWLEDGE.note, "外部知识，不代表用户经历");
assert.equal(agentResultTypes.MATCH_GAP.note, "岗位匹配缺口");
assert.equal(agentResultTypes.RECOMMENDATION.note, "AI 建议，不代表已执行");
assert.match(agentFailureMessage("AGENT_STEP_LIMIT_REACHED"), /最大步骤数并停止/);

console.log("agent UI state tests passed");
