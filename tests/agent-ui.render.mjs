import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const { AgentRunWorkspace } = await vite.ssrLoadModule("/src/App.jsx");
  const handlers = { onCreate() {}, onSelectRun() {}, onRefresh() {} };
  const safeSource = { sourceType: "KNOWLEDGE", sourceTitle: "缓存设计资料", quote: "缓存命中率与响应延迟需要结合观察。", availability: "AVAILABLE", sourceId: "private-source-id", refId: "private-ref", contentHash: "private-hash", embedding: [0.1], providerConfig: "private-provider", apiKey: "private-key", hiddenPrompt: "private-prompt" };
  const actions = ["READ_RESUME", "READ_JOB", "READ_MATCH_REPORT", "RETRIEVE_KNOWLEDGE", "SUMMARIZE_EVIDENCE", "PRODUCE_PLAN"];
  const steps = actions.map((actionType, index) => ({
    id: index + 1,
    stepIndex: index + 1,
    actionType,
    reason: `执行第 ${index + 1} 个只读步骤`,
    input: actionType === "RETRIEVE_KNOWLEDGE" ? { query: "Redis 缓存", mode: "HYBRID", maxSteps: 100, toolName: "EXEC_SHELL", resumeContentHash: "private-input-hash" } : { resumeVersion: 3, hiddenPrompt: "private-step-prompt" },
    output: actionType === "RETRIEVE_KNOWLEDGE" ? { resultCount: 1, degraded: false, rawEmbedding: [0.1] } : { factCount: 2, contentHash: "private-output-hash" },
    sourceRefs: actionType === "RETRIEVE_KNOWLEDGE" ? [safeSource] : [],
    retrievalRunId: actionType === "RETRIEVE_KNOWLEDGE" ? 33 : null,
    status: "COMPLETED",
    startedAt: "2026-08-09T01:00:00.000Z",
    completedAt: "2026-08-09T01:00:02.000Z",
  }));
  const finalResult = {
    VERIFIED_RESUME_FACT: [{ text: "用户负责过 Redis 缓存模块开发。", sourceRefs: [{ sourceType: "RESUME", sourceId: "private-resume-id" }] }],
    EXTERNAL_KNOWLEDGE: [{ text: "缓存命中率可用于观察缓存效果。", sourceRefs: [safeSource] }],
    MATCH_GAP: [{ text: "岗位要求的容量规划证据仍不足。", sourceRefs: [{ sourceType: "MATCH_REPORT", sourceId: "private-report-id" }] }],
    RECOMMENDATION: [{ text: "建议补充可验证的容量规划案例。", sourceRefs: [{ sourceType: "MATCH_REPORT", sourceId: "private-recommendation-id" }] }],
  };
  const run = { id: 8, status: "COMPLETED", resumeVersion: 3, currentStep: 6, maxSteps: 6, createdAt: "2026-08-09T01:00:00.000Z", completedAt: "2026-08-09T01:01:00.000Z", finalResult };
  const html = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { id: 7, status: "COMPLETED" }, runs: [run], run, steps, ...handlers }));
  for (const label of ["读取锁定简历", "读取岗位信息", "读取匹配报告", "检索知识库", "汇总已有证据", "生成建议计划"]) assert.match(html, new RegExp(label));
  assert.match(html, /步骤时间线/);
  assert.match(html, /查看检索来源/);
  assert.match(html, /缓存设计资料/);
  assert.match(html, /缓存命中率与响应延迟需要结合观察/);
  assert.match(html, /知识库 · 可用/);
  assert.match(html, /来自已验证简历事实/);
  assert.match(html, /外部知识，不代表用户经历/);
  assert.match(html, /岗位匹配缺口/);
  assert.match(html, /AI 建议，不代表已执行/);
  assert.doesNotMatch(html, /private-source-id|private-ref|private-hash|private-input-hash|private-output-hash|private-provider|private-key|private-prompt|private-step-prompt|embedding|contentHash|sourceId|providerConfig|hiddenPrompt|EXEC_SHELL/);

  const loading = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [], run: null, steps: [], loading: true, ...handlers }));
  assert.match(loading, /正在从后端恢复 AgentRun/);
  const empty = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [], run: null, steps: [], ...handlers }));
  assert.match(empty, /尚未开始 Agent 分析/);
  const error = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [], run: null, steps: [], error: { code: "AGENT_PROVIDER_UNAVAILABLE", message: "raw provider error" }, ...handlers }));
  assert.match(error, /AI 服务暂时不可用/);
  assert.doesNotMatch(error, /raw provider error/);

  const running = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [{ ...run, status: "RUNNING" }], run: { ...run, status: "RUNNING", finalResult }, steps: steps.slice(0, 2), ...handlers }));
  assert.match(running, /Agent 正在执行有界分析/);
  assert.doesNotMatch(running, /最终计划与建议/);
  const degraded = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "DEGRADED" }, runs: [{ ...run, status: "DEGRADED" }], run: { ...run, status: "DEGRADED" }, steps, ...handlers }));
  assert.match(degraded, /部分检索或步骤已降级/);
  assert.match(degraded, /最终计划与建议/);
  const failed = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [{ ...run, status: "FAILED" }], run: { ...run, status: "FAILED", failureCode: "AGENT_PROVIDER_UNAVAILABLE" }, steps: steps.slice(0, 1), ...handlers }));
  assert.match(failed, /本次 Agent 分析失败/);
  assert.doesNotMatch(failed, /最终计划与建议/);
  const limited = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [{ ...run, status: "STOPPED_LIMIT" }], run: { ...run, status: "STOPPED_LIMIT", failureCode: "AGENT_STEP_LIMIT_REACHED" }, steps: steps.slice(0, 3), ...handlers }));
  assert.match(limited, /Agent 已达到服务器允许的最大步骤数并停止。/);
  assert.doesNotMatch(limited, /最终计划与建议/);

  const refreshRecovery = renderToStaticMarkup(React.createElement(AgentRunWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, runs: [run], run, steps, ...handlers }));
  assert.match(refreshRecovery, /历史 AgentRun/);
  assert.match(refreshRecovery, /Run #8/);
} finally {
  await vite.close();
}

console.log("agent UI render tests passed");
