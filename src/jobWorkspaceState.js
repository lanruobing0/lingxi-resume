export const jobWorkspaceTabs = [
  ["requirements", "岗位要求"], ["match", "匹配报告"], ["suggestions", "简历建议"],
  ["interview", "模拟面试"], ["agent", "Agent 分析"],
];

// Display-only deduplication. Stored JD quotes and backend evidence stay intact.
export function collectJobGroupEvidence(items = []) {
  const comparable = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, "").trim();
  const displayed = new Set(items.map((item) => comparable(item?.text)).filter(Boolean));
  const quotes = new Map();
  for (const item of items) {
    const key = comparable(item?.evidence);
    if (!key || displayed.has(key)) continue;
    if (!quotes.has(key)) quotes.set(key, { evidence: item.evidence, subjects: [] });
    const subjects = quotes.get(key).subjects;
    if (item.text && !subjects.includes(item.text)) subjects.push(item.text);
  }
  return [...quotes.values()];
}
const positiveId = (value) => /^[1-9]\d*$/.test(String(value || "")) ? String(value) : "";
export function readJobWorkspaceRoute(hash = "") {
  const [page, query = ""] = hash.replace(/^#/, "").split("?");
  const params = new URLSearchParams(query);
  const requested = params.get("tab");
  return { page, jobId: positiveId(params.get("job")), applicationId: positiveId(params.get("application")),
    ...(positiveId(params.get("session")) ? { sessionId: positiveId(params.get("session")) } : {}),
    ...(positiveId(params.get("report")) ? { reportId: positiveId(params.get("report")) } : {}),
    tab: jobWorkspaceTabs.some(([id]) => id === requested) ? requested : page === "interview" ? "interview" : "requirements" };
}
export function jobWorkspaceHash({ jobId, applicationId, tab = "requirements", page, sessionId, reportId }) {
  const params = new URLSearchParams();
  if (positiveId(jobId)) params.set("job", jobId);
  if (positiveId(applicationId)) params.set("application", applicationId);
  if (positiveId(sessionId)) params.set("session", sessionId);
  if (positiveId(reportId)) params.set("report", reportId);
  params.set("tab", jobWorkspaceTabs.some(([id]) => id === tab) ? tab : "requirements");
  return `#${page || (tab === "interview" ? "interview" : "jobs")}?${params}`;
}
