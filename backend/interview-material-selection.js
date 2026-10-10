import { isPublicKnowledge, isOwnedKnowledge } from "./knowledge-access.js";

const fail = (status, message) => Object.assign(new Error(message), { status, code: "INTERVIEW_MATERIAL_SELECTION_INVALID" });
export function materialReady(document) {
  return document.status === "PROCESSED" && document.vectorStatus === "INDEXED" && Boolean(document.activeIndexRunId)
    && document.indexedProcessingVersion === document.processingVersion;
}
export function interviewMaterialOptions(store, userId) {
  return store.knowledgeDocuments.filter(document => isPublicKnowledge(document) ? materialReady(document) : isOwnedKnowledge(document, userId))
    .map(document => ({ id: document.id, title: document.title, scope: isPublicKnowledge(document) ? "PUBLIC" : "PRIVATE",
      description: document.description || "", jobFamily: document.jobFamily || "", skillTags: document.skillTags || [],
      summary: String(document.description || store.knowledgeChunks.find(chunk => chunk.documentId === document.id && chunk.processingVersion === document.processingVersion)?.content || "暂无摘要").slice(0, 280),
      available: materialReady(document) && (isPublicKnowledge(document) || document.aiConsent === true),
      characterCount: (document.rawText || "").length, updatedAt: document.updatedAt }));
}
export function resolveMaterialSelection(store, userId, input = { mode: "AUTO" }) {
  if (!input || typeof input !== "object" || Array.isArray(input) || !["AUTO", "MANUAL", "NONE"].includes(input.mode)) throw fail(400, "请选择自动、手动或不使用资料。");
  const ids = input.documentIds ?? [];
  if (!Array.isArray(ids) || ids.length > 100 || ids.some(id => !Number.isInteger(id) || id < 1) || new Set(ids).size !== ids.length) throw fail(400, "资料 ID 必须是不重复的正整数数组，最多 100 份。");
  if (input.mode !== "MANUAL" && ids.length) throw fail(400, "只有手动选择可以指定资料 ID。");
  if (input.mode === "MANUAL" && !ids.length) throw fail(400, "请至少选择一份资料，或改为不使用资料。");
  const available = interviewMaterialOptions(store, userId).filter(item => item.available);
  const selected = input.mode === "NONE" ? [] : input.mode === "AUTO" ? available : ids.map(id => {
    const item = available.find(item => item.id === id);
    if (!item) throw fail(404, "所选资料不存在或当前不可用，请重新确认。");
    return item;
  });
  return { mode: input.mode, documentIds: selected.map(item => item.id), documents: selected.map(item => {
    const document = store.knowledgeDocuments.find(document => document.id === item.id);
    return { id: item.id, title: item.title, scope: item.scope, processingVersion: document.processingVersion, indexRunId: document.activeIndexRunId };
  }), usedDocumentIds: [] };
}
export function verifyMaterialSelection(store, userId, selection) {
  const available = new Set(interviewMaterialOptions(store, userId).filter(item => item.available).map(item => item.id));
  for (const snapshot of selection.documents) {
    const document = store.knowledgeDocuments.find(document => document.id === snapshot.id);
    if (!available.has(snapshot.id) || document.processingVersion !== snapshot.processingVersion || document.activeIndexRunId !== snapshot.indexRunId) throw fail(409, "资料已变更或停用，请重新确认本次面试资料。");
  }
}
