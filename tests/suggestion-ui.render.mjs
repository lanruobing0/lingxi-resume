import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const { ResumeSuggestionWorkspace, SuggestionDiff } = await vite.ssrLoadModule("/src/App.jsx");
  const handlers = { onGenerate() {}, onSelectRun() {}, onDecision() {}, onRefresh() {}, onSelectVersion() {}, onSupplement() {} };
  const rewrite = { id: 1, status: "PENDING", sectionType: "工作经历", suggestionType: "REWRITE", rationale: "表达更贴近岗位要求", before: "负责接口开发", after: "负责高并发接口开发" };
  const factRequired = { id: 2, status: "PENDING", sectionType: "projects", suggestionType: "FACT_REQUIRED", rationale: "缺少真实项目规模", factQuestions: ["哪个真实项目实现了异常恢复？"], before: "已有项目原文" };
  const evidenceFailed = { id: 4, status: "REJECTED", sectionType: "skills", suggestionType: "FACT_REQUIRED", failureCode: "SUGGESTION_EVIDENCE_INVALID", rationale: "仅调整措辞" };
  const invalidated = { id: 3, status: "INVALIDATED", sectionType: "个人总结", suggestionType: "REWRITE", rationale: "基础版本已变化", before: "后端工程师", after: "高级后端工程师" };
  const run = { id: 8, status: "COMPLETED", baseResumeVersion: 3, createdAt: "2026-08-08T00:00:00.000Z", completedAt: "2026-08-08T00:01:00.000Z", resumeId: 6, suggestions: [rewrite, factRequired, invalidated, evidenceFailed] };
  const html = renderToStaticMarkup(React.createElement(ResumeSuggestionWorkspace, {
    report: { id: 5, status: "DEGRADED", reportVersion: 2, resumeVersion: 3 },
    runs: [run], selectedRun: run, loading: false, working: false, error: null, success: "已生成新简历版本 v4。", versions: [{ id: 22, resumeId: 6, resumeVersion: 4, createdAt: "2026-08-08T00:02:00.000Z", sourceSuggestion: { id: 1 } }], versionLoading: false, versionError: null, selectedVersion: { id: 22, resumeVersion: 4, summary: "接受岗位匹配报告简历建议", snapshot: { targetPosition: "后端工程师" } }, ...handlers,
  }));
  assert.match(html, /生成简历优化建议/);
  assert.match(html, /工作经历/);
  assert.match(html, /接受并生成新版本/);
  assert.match(html, /哪个真实项目实现了异常恢复/);
  assert.match(html, /去简历核对补充/);
  assert.match(html, /已有项目原文/);
  assert.match(html, /重新生成本报告的建议仍使用旧版 v3/);
  assert.match(html, /不一定是你缺少经历/);
  assert.match(html, /已拒绝/);
  assert.doesNotMatch(html.match(/专业技能[\s\S]*?<\/article>/)?.[0] || "", /暂不采纳|去简历核对补充/);
  assert.doesNotMatch(html.match(/项目经历[\s\S]*?<\/article>/)?.[0] || "", /接受并生成新版本/);
  assert.match(html, /原基础版本不再可安全应用/);
  assert.match(html, /来源建议 #1/);
  assert.match(html, /只读/);

  const diffHtml = renderToStaticMarkup(React.createElement(SuggestionDiff, { before: rewrite.before, after: rewrite.after }));
  assert.match(diffHtml, /删除/);
  assert.match(diffHtml, /新增/);
  assert.match(diffHtml, /高并发/);

  const loadingHtml = renderToStaticMarkup(React.createElement(ResumeSuggestionWorkspace, { report: { status: "COMPLETED" }, runs: [], selectedRun: null, loading: true, working: false, error: null, success: "", versions: [], versionLoading: false, versionError: null, selectedVersion: null, ...handlers }));
  assert.match(loadingHtml, /正在读取建议记录/);
  const emptyHtml = renderToStaticMarkup(React.createElement(ResumeSuggestionWorkspace, { report: { status: "COMPLETED" }, runs: [], selectedRun: null, loading: false, working: false, error: null, success: "", versions: [], versionLoading: false, versionError: null, selectedVersion: null, ...handlers }));
  assert.match(emptyHtml, /尚未生成简历优化建议/);
  const errorHtml = renderToStaticMarkup(React.createElement(ResumeSuggestionWorkspace, { report: { status: "COMPLETED" }, runs: [], selectedRun: null, loading: false, working: false, error: { code: "RESUME_VERSION_CONFLICT", message: "冲突" }, success: "", versions: [], versionLoading: false, versionError: null, selectedVersion: null, ...handlers }));
  assert.match(errorHtml, /简历版本已变化/);
} finally {
  await vite.close();
}

console.log("suggestion UI render tests passed");
