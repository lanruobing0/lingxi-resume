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
  };
  return messages[code] || "建议操作未完成，请查看当前状态后再试。";
}

export function suggestionActions(suggestion) {
  const isPending = suggestion?.status === "PENDING";
  const factRequired = suggestion?.suggestionType === "FACT_REQUIRED" || suggestion?.status === "FACT_REQUIRED";
  return {
    canPreview: isPending && !factRequired && Boolean(suggestion?.after),
    canAccept: isPending && !factRequired,
    canReject: isPending && !factRequired,
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
