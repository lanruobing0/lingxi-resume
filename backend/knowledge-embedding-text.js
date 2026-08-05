import { createHash } from "node:crypto";

export const knowledgeEmbeddingInputFormatVersion = "knowledge-embedding-v1";
export const knowledgeCollectionSchemaVersion = "v1";

export function buildKnowledgeEmbeddingText(document, chunk) {
  const headingPath = Array.isArray(chunk.headingPath) && chunk.headingPath.length
    ? chunk.headingPath.join(" > ")
    : "未识别章节";
  return `文档标题：${document.title}\n章节路径：${headingPath}\n正文：\n${chunk.content}`;
}

export function sha256(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

export function createEmbeddingInputHash(document, chunk) {
  return sha256(buildKnowledgeEmbeddingText(document, chunk));
}

export function createDeterministicPointId({ documentId, chunkIndex, embeddingInputHash, embeddingProfileId }) {
  const source = `${documentId}|${chunkIndex}|${embeddingInputHash}|${embeddingProfileId}|${knowledgeCollectionSchemaVersion}`;
  const bytes = Buffer.from(sha256(source).slice(0, 32), "hex");
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
