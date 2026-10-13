export const suggestionStatusLabels = {
  PENDING: "待处理",
  ACCEPTED: "已接受",
  REJECTED: "已拒绝",
  INVALIDATED: "已失效",
  FACT_REQUIRED: "需要补充事实",
};

export function suggestionStatusLabel(status) {
  return suggestionStatusLabels[status] || status || "未知状态";
}

const suggestionSectionLabels = { title: "简历标题", targetPosition: "求职意向", selfEvaluation: "自我评价", work: "工作经历", projects: "项目经历", skills: "专业技能", education: "教育背景" };
export function suggestionSectionLabel(suggestion) {
  const key = suggestion?.targetPath?.split("/")[1] === "sections" ? suggestion.targetPath.split("/")[2] : suggestion?.targetPath?.split("/")[1];
  return suggestionSectionLabels[suggestion?.sectionType] || suggestionSectionLabels[key] || suggestion?.sectionType || "简历内容";
}

export function suggestionFactGuidance(suggestion) {
  const validationFailed = Boolean(suggestion?.failureCode);
  const section = suggestionSectionLabel(suggestion);
  const supplied = Array.isArray(suggestion?.factQuestions) ? suggestion.factQuestions.filter((value) => typeof value === "string" && value.trim()).slice(0, 4) : [];
  const checks = {
    简历标题: ["你希望应聘的岗位名称是什么？请确认标题是否准确表达求职方向。"],
    求职意向: ["你希望应聘什么岗位？求职方向可以调整，但不能据此声称已有相关工作经验。"],
    自我评价: ["哪些真实项目或工作经历能够支持这项能力？请补充你的职责和实际做法。"],
    工作经历: ["这项工作发生在哪段经历中？你实际承担了什么职责、采用了什么方法？"],
    项目经历: ["哪个真实项目支持这条建议？你负责什么、实际实现了哪些功能？"],
    专业技能: ["相关技术在哪个真实项目中使用过？请说明实际用途和掌握程度。"],
    教育背景: ["哪些真实教育经历或课程与建议相关？请核对已有记录。"],
  };
  return {
    validationFailed,
    title: validationFailed ? "改写证据未通过校验" : "需要补充真实信息",
    reason: validationFailed ? "这次 AI 改写未能提供充分的简历依据，不一定是你缺少经历。请先核对原文；已有事实无需重复补充，可重新生成建议。" : "AI 判断锁定版本中缺少支持这项修改的事实。请仅补充你实际做过的内容。",
    questions: supplied.length ? supplied : checks[section] || ["这条建议需要哪些实际经历支持？请核对原文，并补充具体职责或实际做法。"],
  };
}

export function suggestionFailureMessage(code) {
  const messages = {
    RESUME_VERSION_CONFLICT: "简历版本已变化。为保护你的后续修改，请刷新建议后重新选择。",
    SUGGESTION_ALREADY_DECIDED: "该建议已被处理，请刷新查看最新状态。",
    SUGGESTION_FACT_REQUIRED: "该建议需要你补充真实信息后才能应用。",
    SUGGESTION_EVIDENCE_INVALID: "该建议的事实依据已失效，不能直接应用。",
    SUGGESTION_EVIDENCE_MISSING: "该建议缺少可验证的简历事实，不能直接应用。",
    SUGGESTION_PROVIDER_NOT_CONFIGURED: "AI 服务尚未配置，暂时无法生成建议。",
    SUGGESTION_PROVIDER_UNAVAILABLE: "AI 服务暂时不可用，请稍后重试。",
    SUGGESTION_INVALID_OUTPUT: "生成结果未通过安全校验，未创建可应用建议。",
    SUGGESTION_INVALID_PATCH: "AI 返回的修改路径未通过校验，简历未被修改。请重新生成建议；若在接受建议时出现，请刷新当前状态。",
  };
  return messages[code] || "建议操作未完成，请查看当前状态后再试。";
}

export function suggestionActions(suggestion) {
  const isPending = suggestion?.status === "PENDING";
  const factRequired = suggestion?.suggestionType === "FACT_REQUIRED" || suggestion?.status === "FACT_REQUIRED";
  return {
    canPreview: isPending && !factRequired && Boolean(suggestion?.after),
    canAccept: isPending && !factRequired,
    canReject: isPending,
    factRequired,
    invalidated: suggestion?.status === "INVALIDATED",
  };
}

export function suggestionDecisionRequest(suggestion, action, expectedBaseResumeVersion) {
  const actions = suggestionActions(suggestion);
  if ((action === "accept" && !actions.canAccept) || (action === "reject" && !actions.canReject)) return null;
  return {
    path: `/api/resume-suggestions/${suggestion.id}/${action}`,
    body: action === "accept" ? { expectedBaseResumeVersion } : undefined,
  };
}

// This intentionally creates display fragments only. It never derives a JSON Patch.
export function buildSuggestionDiff(before = "", after = "") {
  const left = String(before);
  const right = String(after);
  let prefixLength = 0;
  const shortest = Math.min(left.length, right.length);
  while (prefixLength < shortest && left[prefixLength] === right[prefixLength]) prefixLength += 1;

  let suffixLength = 0;
  while (
    suffixLength < left.length - prefixLength
    && suffixLength < right.length - prefixLength
    && left[left.length - 1 - suffixLength] === right[right.length - 1 - suffixLength]
  ) suffixLength += 1;

  return [
    { type: "unchanged", text: left.slice(0, prefixLength) },
    { type: "removed", text: left.slice(prefixLength, left.length - suffixLength) },
    { type: "added", text: right.slice(prefixLength, right.length - suffixLength) },
    { type: "unchanged", text: left.slice(left.length - suffixLength) },
  ].filter((part) => part.text);
}

export function versionSourceLabel(version) {
  return version?.sourceSuggestion ? `来源建议 #${version.sourceSuggestion.id}` : "手动创建或既有版本";
}
