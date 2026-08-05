import { EmbeddingProviderError, OpenAICompatibleEmbeddingProvider, createEmbeddingProfile, getEmbeddingConfig } from "./embedding-provider.js";
import { buildCollectionName, getQdrantConfig, QdrantClient, QdrantError } from "./qdrant-client.js";
import { buildKnowledgeEmbeddingText, createDeterministicPointId, createEmbeddingInputHash, sha256 } from "./knowledge-embedding-text.js";

export class KnowledgeVectorIndexError extends Error {
  constructor(code, message, status = 409) { super(message); this.name = "KnowledgeVectorIndexError"; this.code = code; this.status = status; }
}

const safeError = (error) => {
  if (error instanceof KnowledgeVectorIndexError || error instanceof EmbeddingProviderError || error instanceof QdrantError) return error;
  return new KnowledgeVectorIndexError("VECTOR_INDEX_FAILED", "Vector index operation failed", 502);
};

function validateVectors(vectors, expectedCount, dimension) {
  if (!Array.isArray(vectors) || vectors.length !== expectedCount) throw new KnowledgeVectorIndexError("EMBEDDING_COUNT_MISMATCH", "Embedding response count does not match chunk count", 502);
  vectors.forEach((vector) => {
    if (!Array.isArray(vector) || vector.length === 0) throw new KnowledgeVectorIndexError("EMBEDDING_EMPTY_VECTOR", "Embedding provider returned an empty vector", 502);
    if (vector.length !== dimension) throw new KnowledgeVectorIndexError("EMBEDDING_DIMENSION_MISMATCH", "Embedding vector dimension does not match configuration", 502);
    if (!vector.every((value) => typeof value === "number" && Number.isFinite(value))) throw new KnowledgeVectorIndexError("EMBEDDING_INVALID_NUMBER", "Embedding vector contains an invalid number", 502);
  });
}

function failureForDocument(document, error, now) {
  document.indexFailureCode = error.code || "VECTOR_INDEX_FAILED";
  document.indexFailureMessage = error.message || "Vector index operation failed";
  if (!document.activeIndexRunId) document.vectorStatus = "FAILED";
  document.updatedAt = now();
}

export function getVectorRuntimeStatus(env = process.env) {
  const embeddingConfig = getEmbeddingConfig(env); const qdrantConfig = getQdrantConfig(env);
  const profile = embeddingConfig ? createEmbeddingProfile(embeddingConfig) : null;
  return { embeddingConfig, qdrantConfig, profile, collectionName: profile && qdrantConfig ? buildCollectionName(qdrantConfig, profile) : null };
}

export class KnowledgeVectorIndexService {
  constructor({ env = process.env, persist, now = () => new Date().toISOString() } = {}) { this.env = env; this.persist = persist; this.now = now; }
  runtime() { return getVectorRuntimeStatus(this.env); }

  async status() {
    const runtime = this.runtime();
    let healthy = false; let healthCode = runtime.qdrantConfig ? "QDRANT_UNAVAILABLE" : "QDRANT_NOT_CONFIGURED";
    if (runtime.qdrantConfig) { try { await new QdrantClient(runtime.qdrantConfig).health(); healthy = true; healthCode = null; } catch (error) { healthCode = safeError(error).code; } }
    return { embedding: runtime.embeddingConfig ? { configured: true, provider: runtime.profile.provider, model: runtime.profile.model, dimension: runtime.profile.dimension, profileId: runtime.profile.profileId } : { configured: false }, qdrant: { configured: Boolean(runtime.qdrantConfig), healthy, failureCode: healthCode }, collectionName: runtime.collectionName };
  }

  async indexDocument(store, document, createdBy, { force = false } = {}) {
    if (document.status !== "PROCESSED") throw new KnowledgeVectorIndexError("DOCUMENT_NOT_PROCESSED", "Only processed knowledge documents can be indexed");
    const runtime = this.runtime();
    if (!runtime.embeddingConfig) throw new KnowledgeVectorIndexError("EMBEDDING_NOT_CONFIGURED", "Embedding provider is not configured", 503);
    if (!runtime.qdrantConfig) throw new KnowledgeVectorIndexError("QDRANT_NOT_CONFIGURED", "Qdrant is not configured", 503);
    const chunks = store.knowledgeChunks.filter((chunk) => chunk.documentId === document.id && chunk.processingVersion === document.processingVersion).sort((a, b) => a.chunkIndex - b.chunkIndex);
    if (!chunks.length || chunks.length !== document.chunkCount) throw new KnowledgeVectorIndexError("CURRENT_CHUNKS_MISSING", "Current processed chunks are unavailable");
    const prepared = chunks.map((chunk) => ({ chunk, text: buildKnowledgeEmbeddingText(document, chunk), embeddingInputHash: createEmbeddingInputHash(document, chunk) }));
    const inputHash = sha256(JSON.stringify(prepared.map(({ chunk, embeddingInputHash }) => [chunk.id, chunk.chunkIndex, embeddingInputHash])));
    const existing = document.activeIndexRunId && store.knowledgeIndexRuns.find((run) => run.id === document.activeIndexRunId && run.status === "COMPLETED" && run.processingVersion === document.processingVersion && run.embeddingProfileId === runtime.profile.profileId && run.inputHash === inputHash);
    if (existing && !force) return { idempotent: true, activeIndexRunId: existing.id, indexedChunkCount: document.indexedChunkCount, item: document, run: existing };
    const timestamp = this.now();
    const previousVectorStatus = document.vectorStatus;
    const run = { id: nextId(store.knowledgeIndexRuns), documentId: document.id, processingVersion: document.processingVersion, inputHash, embeddingProfileId: runtime.profile.profileId, provider: runtime.profile.provider, model: runtime.profile.model, dimension: runtime.profile.dimension, collectionName: runtime.collectionName, status: "PENDING", inputChunkCount: prepared.length, embeddedCount: 0, reusedCount: 0, upsertedCount: 0, removedCount: 0, cleanupStatus: "NOT_REQUIRED", failureCode: "", failureMessage: "", startedAt: timestamp, completedAt: null, createdBy };
    store.knowledgeIndexRuns.push(run); document.vectorStatus = "INDEXING"; document.indexFailureCode = ""; document.indexFailureMessage = ""; document.updatedAt = timestamp; await this.persist(store);
    let newPoints = [];
    try {
      const qdrant = new QdrantClient(runtime.qdrantConfig); await qdrant.health();
      run.status = "EMBEDDING"; await this.persist(store);
      const embedded = await new OpenAICompatibleEmbeddingProvider(runtime.embeddingConfig).embedTexts(prepared.map((item) => item.text));
      validateVectors(embedded.vectors, prepared.length, runtime.profile.dimension); run.embeddedCount = embedded.vectors.length;
      await qdrant.ensureCollection(runtime.collectionName, runtime.profile.dimension); run.status = "UPSERTING";
      newPoints = prepared.map((item, index) => ({ id: createDeterministicPointId({ documentId: document.id, chunkIndex: item.chunk.chunkIndex, embeddingInputHash: item.embeddingInputHash, embeddingProfileId: runtime.profile.profileId }), vector: embedded.vectors[index], payload: { documentId: document.id, chunkId: item.chunk.id, processingVersion: document.processingVersion, chunkIndex: item.chunk.chunkIndex, contentHash: item.chunk.contentHash, embeddingInputHash: item.embeddingInputHash, documentType: document.documentType, jobFamily: document.jobFamily || null, seniority: document.seniority || null, skillTags: document.skillTags || [], language: document.language, embeddingProfileId: runtime.profile.profileId, indexRunId: run.id, indexedAt: this.now() } }));
      for (let offset = 0; offset < newPoints.length; offset += 64) await qdrant.upsertPoints(runtime.collectionName, newPoints.slice(offset, offset + 64));
      const found = await qdrant.retrievePoints(runtime.collectionName, newPoints.map((point) => point.id));
      if (found.length !== newPoints.length) throw new KnowledgeVectorIndexError("QDRANT_WRITE_VERIFICATION_FAILED", "Qdrant did not confirm every written point", 502);
      run.upsertedCount = newPoints.length; run.status = "SWITCHING";
      const oldRecords = store.knowledgeVectorRecords.filter((record) => record.documentId === document.id
        && record.pointId
        && record.status !== "PENDING_DELETE"
        && (record.processingVersion < document.processingVersion || (force && record.status === "ACTIVE")));
      const activePointIds = new Set(newPoints.map((point) => point.id));
      oldRecords.forEach((record) => { record.status = "STALE"; record.updatedAt = this.now(); });
      const indexedAt = this.now();
      const records = prepared.map((item, index) => ({ id: nextId(store.knowledgeVectorRecords) + index, indexRunId: run.id, documentId: document.id, chunkId: item.chunk.id, processingVersion: document.processingVersion, contentHash: item.chunk.contentHash, embeddingInputHash: item.embeddingInputHash, embeddingProfileId: runtime.profile.profileId, collectionName: runtime.collectionName, pointId: newPoints[index].id, status: "ACTIVE", indexedAt, createdAt: indexedAt, updatedAt: indexedAt }));
      store.knowledgeVectorRecords.push(...records);
      Object.assign(document, { vectorStatus: "INDEXED", activeIndexRunId: run.id, indexedProcessingVersion: document.processingVersion, indexedChunkCount: records.length, embeddingProfileId: runtime.profile.profileId, vectorCollection: runtime.collectionName, indexedAt, indexFailureCode: "", indexFailureMessage: "", updatedAt: indexedAt });
      run.status = "COMPLETED"; run.completedAt = indexedAt;
      const obsolete = oldRecords.filter((record) => !activePointIds.has(record.pointId));
      if (obsolete.length) {
        run.cleanupStatus = "PENDING";
        await this.persist(store);
        try {
          let removedCount = 0;
          for (const [collectionName, group] of Object.entries(groupBy(obsolete, "collectionName"))) {
            const pointIds = [...new Set(group.map((record) => record.pointId))];
            await qdrant.deletePoints(collectionName, pointIds);
            removedCount += pointIds.length;
          }
          run.removedCount = removedCount;
          run.cleanupStatus = "COMPLETED";
        } catch (error) {
          run.cleanupStatus = "FAILED";
          run.failureCode = safeError(error).code;
          run.failureMessage = "New index is active; stale point cleanup requires retry";
        }
      }
      await this.persist(store); return { idempotent: false, activeIndexRunId: run.id, indexedChunkCount: records.length, item: document, run };
    } catch (error) {
      const safe = safeError(error);
      if (newPoints.length) { const records = newPoints.map((point, index) => ({ id: nextId(store.knowledgeVectorRecords) + index, indexRunId: run.id, documentId: document.id, chunkId: prepared[index]?.chunk.id || 0, processingVersion: document.processingVersion, contentHash: prepared[index]?.chunk.contentHash || "", embeddingInputHash: prepared[index]?.embeddingInputHash || "", embeddingProfileId: runtime.profile.profileId, collectionName: runtime.collectionName, pointId: point.id, status: "PENDING_DELETE", indexedAt: null, createdAt: this.now(), updatedAt: this.now() })); store.knowledgeVectorRecords.push(...records); try { await new QdrantClient(runtime.qdrantConfig).deletePoints(runtime.collectionName, newPoints.map((point) => point.id)); records.forEach((record) => { record.cleanupCompletedAt = this.now(); }); } catch { run.cleanupStatus = "FAILED"; } }
      run.status = "FAILED"; run.failureCode = safe.code; run.failureMessage = safe.message; run.completedAt = this.now(); failureForDocument(document, safe, this.now); if (document.activeIndexRunId) document.vectorStatus = previousVectorStatus === "INDEXING" ? "INDEXED" : previousVectorStatus; await this.persist(store); throw safe;
    }
  }

  async deleteDocumentIndex(store, document) {
    const records = store.knowledgeVectorRecords.filter((record) => record.documentId === document.id);
    if (!records.length) { Object.assign(document, { vectorStatus: "NOT_INDEXED", activeIndexRunId: null, indexedProcessingVersion: null, indexedChunkCount: 0, embeddingProfileId: null, vectorCollection: null, indexedAt: null, indexFailureCode: "", indexFailureMessage: "", updatedAt: this.now() }); return { deletedCount: 0 }; }
    const runtime = this.runtime(); if (!runtime.qdrantConfig) throw new KnowledgeVectorIndexError("QDRANT_NOT_CONFIGURED", "Qdrant is not configured; vector tracking is preserved", 503);
    try { const qdrant = new QdrantClient(runtime.qdrantConfig); await qdrant.health(); for (const [collectionName, group] of Object.entries(groupBy(records, "collectionName"))) await qdrant.deletePoints(collectionName, [...new Set(group.map((record) => record.pointId))]); } catch (error) { const safe = safeError(error); failureForDocument(document, safe, this.now); await this.persist(store); throw safe; }
    store.knowledgeVectorRecords = store.knowledgeVectorRecords.filter((record) => record.documentId !== document.id);
    Object.assign(document, { vectorStatus: "NOT_INDEXED", activeIndexRunId: null, indexedProcessingVersion: null, indexedChunkCount: 0, embeddingProfileId: null, vectorCollection: null, indexedAt: null, indexFailureCode: "", indexFailureMessage: "", updatedAt: this.now() }); await this.persist(store); return { deletedCount: records.length };
  }
}

function nextId(items) { return items.reduce((maximum, item) => Math.max(maximum, Number(item.id) || 0), 0) + 1; }
function groupBy(items, key) { return items.reduce((result, item) => { const value = item[key]; (result[value] ||= []).push(item); return result; }, {}); }
