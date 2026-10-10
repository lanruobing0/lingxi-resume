const key = userId => `lingxi-interview-material-draft:${userId}`;
export const materialModeLabel = mode => ({ AUTO: "按岗位自动选择", MANUAL: "手动指定资料", NONE: "不使用资料" })[mode] || "旧记录：未保存资料选择";
export function readMaterialDraft(userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key(userId)));
    if (value && ["AUTO", "MANUAL", "NONE"].includes(value.mode) && Array.isArray(value.documentIds) && value.documentIds.every(id => Number.isInteger(id) && id > 0)) return value;
  } catch {}
  return { mode: "AUTO", documentIds: [] };
}
export function saveMaterialDraft(userId, selection) {
  try { sessionStorage.setItem(key(userId), JSON.stringify(selection)); } catch {}
}
export function selectionForApi(selection) {
  return { mode: selection.mode, documentIds: selection.mode === "MANUAL" ? selection.documentIds : [] };
}
