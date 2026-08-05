export function selectHistoryMatch(items, { autoSelectCompleted = false } = {}) {
  if (!autoSelectCompleted || !Array.isArray(items)) return null;
  return items.find((item) => item?.status === "COMPLETED") || null;
}

export function selectLatestFailedMatch(items) {
  if (!Array.isArray(items)) return null;
  return items.find((item) => item?.status === "FAILED") || null;
}
