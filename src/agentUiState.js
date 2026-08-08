export const SAFE_AGENT_OBJECTIVE = "基于已锁定的简历版本、岗位、匹配报告与可用知识证据，形成有边界、可审计的下一步建议计划。";

export const agentStatusLabels = {
  PENDING: "等待开始",
  RUNNING: "分析中",
  COMPLETED: "已完成",
  DEGRADED: "降级可用",
  FAILED: "分析失败",
  STOPPED_LIMIT: "已达步骤上限",
};

export const agentActionLabels = {
  READ_RESUME: "读取锁定简历",
  READ_JOB: "读取岗位信息",
  READ_MATCH_REPORT: "读取匹配报告",
  RETRIEVE_KNOWLEDGE: "检索知识库",
  SUMMARIZE_EVIDENCE: "汇总已有证据",
  PRODUCE_PLAN: "生成建议计划",
};

export const agentResultTypes = {
  VERIFIED_RESUME_FACT: { label: "已验证简历事实", note: "来自已验证简历事实" },
  EXTERNAL_KNOWLEDGE: { label: "外部知识", note: "外部知识，不代表用户经历" },
  MATCH_GAP: { label: "岗位匹配缺口", note: "岗位匹配缺口" },
  RECOMMENDATION: { label: "建议计划", note: "AI 建议，不代表已执行" },
};

const sourceTypeLabels = {
  KNOWLEDGE: "知识库",
  RESUME: "简历",
  JD: "岗位信息",
  MATCH_REPORT: "匹配报告",
};

const inputLabels = {
  query: "检索问题",
  mode: "检索模式",
  resumeVersion: "锁定简历版本",
  evidenceCount: "已有证据",
  matchReportId: "匹配报告",
};

const outputLabels = {
  lockedResumeVersion: "已读取版本",
  factCount: "读取证据",
  resultCount: "检索结果",
  evidenceCount: "汇总证据",
  degraded: "是否降级",
  failureCode: "检索状态码",
};

export function agentStatusLabel(status) {
  return agentStatusLabels[status] || status || "未知状态";
}

export function agentActionLabel(action) {
  return agentActionLabels[action] || "未授权步骤";
}

export function agentFailureMessage(code, fallback = "") {
  const messages = {
    AGENT_PROVIDER_NOT_CONFIGURED: "AI 服务尚未配置，本次分析没有生成成功结果。",
    AGENT_PROVIDER_UNAVAILABLE: "AI 服务暂时不可用，本次分析没有生成成功结果。",
    AGENT_ACTION_NOT_ALLOWED: "Agent 请求了服务器未授权的操作，系统已停止执行。",
    AGENT_UNSUPPORTED_RESUME_FACT: "结果包含未被锁定简历证据支持的用户事实，系统已拒绝。",
    AGENT_SOURCE_INVALID: "结果引用了不存在或无效的来源，系统已拒绝。",
    AGENT_FACT_BOUNDARY_VIOLATION: "结果跨越了用户事实边界，系统已拒绝。",
    AGENT_STEP_LIMIT_REACHED: "Agent 已达到服务器允许的最大步骤数并停止。",
  };
  return messages[code] || fallback || "Agent 分析未完成，请刷新后查看后端保存的状态。";
}

export function safeAgentSource(source = {}) {
  return {
    title: String(source.sourceTitle || "知识资料").slice(0, 160),
    summary: String(source.quote || "").replace(/[\r\n\t ]+/g, " ").trim().slice(0, 260),
    sourceType: sourceTypeLabels[source.sourceType] || "知识资料",
    availability: source.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
  };
}

export function safeRetrievalSources(step = {}) {
  if (step.actionType !== "RETRIEVE_KNOWLEDGE") return [];
  return (step.sourceRefs || []).filter((source) => source?.sourceType === "KNOWLEDGE").map(safeAgentSource);
}

function displayValue(key, value) {
  if (key === "resumeVersion" || key === "lockedResumeVersion") return `v${value}`;
  if (key === "evidenceCount" || key === "factCount" || key === "resultCount") return `${value} 条`;
  if (key === "degraded") return value ? "是" : "否";
  return String(value);
}

function summaryRows(value, labels) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(labels).flatMap(([key, label]) => value[key] === undefined || value[key] === null || value[key] === "" ? [] : [{ label, value: displayValue(key, value[key]) }]);
}

export function safeAgentStepSummary(step = {}) {
  const input = summaryRows(step.input, inputLabels);
  const output = summaryRows(step.output, outputLabels);
  if (step.output?.categoryCounts && typeof step.output.categoryCounts === "object") {
    const count = Object.values(step.output.categoryCounts).reduce((sum, value) => sum + (Number(value) || 0), 0);
    output.push({ label: "计划条目", value: `${count} 条` });
  }
  if (step.output?.countsByType && typeof step.output.countsByType === "object") {
    const count = Object.values(step.output.countsByType).reduce((sum, value) => sum + (Number(value) || 0), 0);
    output.push({ label: "证据分类", value: `${count} 条` });
  }
  return { input, output };
}

export function agentApiRequest(kind, values = {}) {
  if (kind === "history") return { path: `/api/job-applications/${values.applicationId}/agent-runs` };
  if (kind === "detail") return { path: `/api/agent-runs/${values.runId}` };
  if (kind === "steps") return { path: `/api/agent-runs/${values.runId}/steps` };
  if (kind === "create") return {
    path: `/api/job-applications/${values.applicationId}/agent-runs`,
    options: {
      method: "POST",
      body: JSON.stringify({ matchReportId: values.matchReportId, objective: SAFE_AGENT_OBJECTIVE, searchMode: "HYBRID" }),
    },
  };
  return null;
}
