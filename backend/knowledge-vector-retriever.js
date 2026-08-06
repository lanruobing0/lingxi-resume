import { OpenAICompatibleEmbeddingProvider } from "./embedding-provider.js";
import { QdrantClient } from "./qdrant-client.js";
import { getVectorRuntimeStatus } from "./knowledge-vector-index.js";
import { currentKnowledge } from "./knowledge-keyword-retriever.js";

export async function vectorRetrieve(store, normalizedQuery, filters, limit, scoreThreshold = 0, env = process.env) {
  const runtime = getVectorRuntimeStatus(env);
  if (!runtime.embeddingConfig) throw Object.assign(new Error("Embedding provider is not configured"), { code: "EMBEDDING_NOT_CONFIGURED", status: 503 });
  if (!runtime.qdrantConfig) throw Object.assign(new Error("Qdrant is not configured"), { code: "QDRANT_NOT_CONFIGURED", status: 503 });
  const embedded = await new OpenAICompatibleEmbeddingProvider(runtime.embeddingConfig).embedTexts([normalizedQuery]); const vector = embedded.vectors?.[0];
  if (!Array.isArray(vector) || vector.length !== runtime.profile.dimension || !vector.every(Number.isFinite)) throw Object.assign(new Error("Embedding response is invalid"), { code: "EMBEDDING_INVALID_RESPONSE", status: 502 });
  const filter = { must: [{ key: "embeddingProfileId", match: { value: runtime.profile.profileId } }, ...payloadFilters(filters)] };
  const points = await new QdrantClient(runtime.qdrantConfig).searchPoints(runtime.collectionName, vector, { limit, scoreThreshold, filter });
  const valid = new Map(currentKnowledge(store, filters).map(({ chunk, document }) => [chunk.id, { chunk, document }]));
  const records = new Map(store.knowledgeVectorRecords.filter((record) => record.status === "ACTIVE").map((record) => [record.pointId, record]));
  const output = [];
  for (const point of points) { const record = records.get(String(point.id)); const local = valid.get(Number(point.payload?.chunkId)); if (!record || !local || record.chunkId !== local.chunk.id || record.documentId !== local.document.id || record.processingVersion !== local.document.processingVersion || record.indexRunId !== local.document.activeIndexRunId || record.embeddingProfileId !== runtime.profile.profileId || (point.payload?.documentId !== undefined && Number(point.payload.documentId) !== Number(record.documentId)) || Number(point.payload?.indexRunId) !== Number(local.document.activeIndexRunId)) continue; output.push({ ...local, vectorScore: Number(point.score), pointId: String(point.id) }); }
  return output.sort((a, b) => b.vectorScore - a.vectorScore || a.chunk.id - b.chunk.id).map((item, index) => ({ ...item, vectorRank: index + 1 }));
}
function payloadFilters(filters) { const rules = []; const matchAny = (key, values) => { if (values.length) rules.push({ key, match: { any: values } }); }; matchAny("documentType", filters.documentType); matchAny("jobFamily", filters.jobFamily); matchAny("seniority", filters.seniority); matchAny("language", filters.language); matchAny("skillTags", filters.skillTags); if (filters.documentIds.length) rules.push({ key: "documentId", match: { any: filters.documentIds } }); return rules; }
