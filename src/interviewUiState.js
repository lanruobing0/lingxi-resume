export const interviewStatusLabels = {
  PENDING: "准备中",
  IN_PROGRESS: "进行中",
  DEGRADED: "降级可用",
  FAILED: "失败",
  COMPLETED: "已完成",
};

export const interviewCategoryLabels = {
  RESUME: "简历经历",
  JD: "岗位要求",
  MATCH_GAP: "匹配缺口",
  KNOWLEDGE: "知识拓展",
};

export const interviewDifficultyLabels = {
  EASY: "基础",
  MEDIUM: "进阶",
  HARD: "挑战",
};

export function interviewStatusLabel(status) {
  return interviewStatusLabels[status] || status || "未知状态";
}

export function interviewCategoryLabel(category) {
  return interviewCategoryLabels[category] || category || "综合问题";
}

export function interviewDifficultyLabel(difficulty) {
  return interviewDifficultyLabels[difficulty] || difficulty || "未标注";
}

export function interviewFailureMessage(code, fallback = "") {
  const messages = {
    INTERVIEW_SESSION_COMPLETED: "这场面试已经完成，不能再提交回答。",
    INTERVIEW_ANSWER_DUPLICATE: "这道题已经提交过回答，请刷新查看已保存的反馈。",
    INTERVIEW_SESSION_INCOMPLETE: "请先完成全部题目并取得有效反馈。",
    INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT: "AI 建议回答包含未经你简历或本题回答支持的经历事实，系统已拦截且不会展示该内容。",
    INTERVIEW_PROVIDER_NOT_CONFIGURED: "AI 服务尚未配置，暂时无法开始模拟面试。",
    INTERVIEW_PROVIDER_UNAVAILABLE: "AI 服务暂时不可用，本次未伪造成成功。",
    INTERVIEW_RETRIEVAL_FAILED: "岗位知识检索失败，请查看本次会话状态。",
    INTERVIEW_INVALID_RESPONSE: "AI 返回内容未通过校验，本次未创建可用结果。",
    FEEDBACK_GENERATION_FAILED: "AI 反馈生成失败，请查看本题保存状态。",
  };
  return messages[code] || fallback || "面试操作未完成，请刷新后查看后端保存的状态。";
}

export function safeKnowledgeSources(sourceRefs = []) {
  return sourceRefs
    .filter((source) => source?.sourceType === "KNOWLEDGE")
    .map((source) => ({
      title: String(source.sourceTitle || "岗位知识资料"),
      summary: String(source.quote || "").slice(0, 220),
      sourceType: "知识库",
      availability: source.availability === "UNAVAILABLE" ? "UNAVAILABLE" : "AVAILABLE",
    }));
}

export function nextInterviewQuestionIndex(questions = [], preferredIndex = 0) {
  if (!questions.length) return 0;
  const firstUnanswered = questions.findIndex((question) => !question.answerId);
  if (firstUnanswered >= 0) return firstUnanswered;
  return Math.min(Math.max(Number(preferredIndex) || 0, 0), questions.length - 1);
}

export function feedbackTextItems(items = []) {
  return items.map((item) => typeof item === "string" ? item : item?.text).filter(Boolean);
}

export function interviewApiRequest(kind, values = {}) {
  if (kind === "history") return { path: `/api/job-applications/${values.applicationId}/interview-sessions` };
  if (kind === "create") return { path: `/api/job-applications/${values.applicationId}/interview-sessions`, options: { method: "POST", body: JSON.stringify({ matchReportId: values.matchReportId, questionCount: 4, searchMode: "HYBRID", useReranker: false }) } };
  if (kind === "session") return { path: `/api/interview-sessions/${values.sessionId}` };
  if (kind === "feedback") return { path: `/api/interview-sessions/${values.sessionId}/answers/${values.answerId}/feedback` };
  if (kind === "answer") return { path: `/api/interview-sessions/${values.sessionId}/questions/${values.questionId}/answers`, options: { method: "POST", body: JSON.stringify({ answerText: values.answerText }) } };
  if (kind === "complete") return { path: `/api/interview-sessions/${values.sessionId}/complete`, options: { method: "POST", body: JSON.stringify({}) } };
  return null;
}
