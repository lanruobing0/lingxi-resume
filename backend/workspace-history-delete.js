// Preserve identifiers and accepted-edit provenance while removing user-visible history.
export function deleteWorkspaceAnalysis(store, userId, { reportId, applicationId }, decisionLocks = new Set()) {
  const owned = item => item.userId === userId;
  const reports = store.matchReports.filter(item => owned(item) && !item.deletedAt && (applicationId ? item.jobApplicationId === applicationId : item.id === reportId));
  const reportIds = new Set(reports.map(item => item.id));
  const related = item => owned(item) && !item.deletedAt && (applicationId ? item.jobApplicationId === applicationId : reportIds.has(item.matchReportId));
  const runs = store.suggestionRuns.filter(related);
  const runIds = new Set(runs.map(item => item.id));
  const sessions = store.interviewSessions.filter(related);
  const sessionIds = new Set(sessions.map(item => item.id));
  const agents = store.agentRuns.filter(related);
  const agentIds = new Set(agents.map(item => item.id));
  const busy = item => ["PENDING", "RUNNING"].includes(item.status);
  const jobsBusy = (store.jobs || []).some(job => owned(job) && busy(job) && (
    (job.type === "RESUME_SUGGESTIONS" && reportIds.has(job.resourceId)) ||
    (job.type === "GROUNDED_MATCH_REPORT" && applicationId && job.resourceId === applicationId) ||
    (["AGENT_RUN", "MOCK_INTERVIEW_GENERATION"].includes(job.type) && (applicationId ? job.resourceId === applicationId : reportIds.has(job.payload?.matchReportId)))
  ));
  if (jobsBusy || [...reports, ...runs, ...sessions, ...agents].some(busy) ||
    (applicationId && store.resumeJobMatches.some(item => owned(item) && item.jobApplicationId === applicationId && busy(item))) ||
    store.agentSteps.some(item => agentIds.has(item.agentRunId) && busy(item)) ||
    store.answerFeedbacks.some(item => sessionIds.has(item.sessionId) && busy(item)) ||
    store.resumeSuggestions.some(item => runIds.has(item.suggestionRunId) && decisionLocks.has(item.id))) return false;
  const deletedAt = new Date().toISOString();
  const tombstone = item => Object.fromEntries(["id", "userId", "jobApplicationId", "resumeJobMatchId", "reportVersion", "matchReportId", "resumeId", "resumeVersion", "resumeVersionId", "resumeContentHash", "jobDescriptionId", "jobDescriptionParseResultId"].filter(key => item[key] !== undefined).map(key => [key, item[key]]).concat([["deletedAt", deletedAt]]));
  for (const [key, predicate] of [["matchReports", item => reportIds.has(item.id)], ["suggestionRuns", item => runIds.has(item.id)], ["interviewSessions", item => sessionIds.has(item.id)], ["agentRuns", item => agentIds.has(item.id)]]) {
    store[key] = store[key].map(item => predicate(item) ? tombstone(item) : item);
  }
  store.resumeSuggestions = store.resumeSuggestions.map(item => runIds.has(item.suggestionRunId) && item.status !== "ACCEPTED" ? { id: item.id, userId: item.userId, suggestionRunId: item.suggestionRunId, deletedAt } : item);
  store.agentSteps = store.agentSteps.filter(item => !agentIds.has(item.agentRunId));
  store.interviewSessionQuestions = store.interviewSessionQuestions.filter(item => !sessionIds.has(item.sessionId));
  store.interviewAnswers = store.interviewAnswers.filter(item => !sessionIds.has(item.sessionId));
  store.answerFeedbacks = store.answerFeedbacks.filter(item => !sessionIds.has(item.sessionId));
  if (applicationId) {
    store.jobApplications = store.jobApplications.map(item => owned(item) && item.id === applicationId ? tombstone(item) : item);
    store.resumeJobMatches = store.resumeJobMatches.map(item => owned(item) && item.jobApplicationId === applicationId ? tombstone(item) : item);
  }
  return true;
}
