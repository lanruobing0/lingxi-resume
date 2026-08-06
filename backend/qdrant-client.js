export class QdrantError extends Error {
  constructor(code, message, status = 503) { super(message); this.name = "QdrantError"; this.code = code; this.status = status; }
}

const positiveInt = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
export function getQdrantConfig(env = process.env) {
  const url = String(env.QDRANT_URL || "").trim().replace(/\/$/, "");
  if (!url) return null;
  return { url, apiKey: String(env.QDRANT_API_KEY || "").trim(), prefix: String(env.QDRANT_COLLECTION_PREFIX || "lingxi_knowledge").replace(/[^a-zA-Z0-9_-]/g, "_") || "lingxi_knowledge", timeoutMs: positiveInt(env.QDRANT_TIMEOUT_MS, 10000) };
}

export function buildCollectionName(config, profile) { return `${config.prefix}_${profile.profileId}_${profile.dimension}_v1`.toLowerCase(); }

export class QdrantClient {
  constructor(config, { fetchImpl = fetch } = {}) { this.config = config; this.fetchImpl = fetchImpl; }
  async health() { await this.#request("/healthz"); return true; }
  async ensureCollection(name, dimension) {
    let response = await this.#request(`/collections/${encodeURIComponent(name)}`, { allow404: true });
    if (response.status === 404) {
      await this.#request(`/collections/${encodeURIComponent(name)}`, { method: "PUT", body: { vectors: { size: dimension, distance: "Cosine" } } });
      response = await this.#request(`/collections/${encodeURIComponent(name)}`);
    }
    const vectors = response.body?.result?.config?.params?.vectors;
    const vectorConfig = vectors?.size ? vectors : vectors?.default || Object.values(vectors || {})[0];
    if (!vectorConfig || Number(vectorConfig.size) !== Number(dimension)) throw new QdrantError("COLLECTION_DIMENSION_MISMATCH", "Qdrant collection dimension does not match the embedding profile", 409);
    if (String(vectorConfig.distance || "").toLowerCase() !== "cosine") throw new QdrantError("COLLECTION_DISTANCE_MISMATCH", "Qdrant collection distance must be Cosine", 409);
  }
  async upsertPoints(name, points) { await this.#request(`/collections/${encodeURIComponent(name)}/points?wait=true`, { method: "PUT", body: { points } }); }
  async retrievePoints(name, ids) { const response = await this.#request(`/collections/${encodeURIComponent(name)}/points`, { method: "POST", body: { ids, with_payload: false, with_vector: false } }); return response.body?.result || []; }
  async searchPoints(name, vector, { limit = 10, scoreThreshold = 0, filter } = {}) { const response = await this.#request(`/collections/${encodeURIComponent(name)}/points/search`, { method: "POST", body: { vector, limit, score_threshold: scoreThreshold, filter, with_payload: true, with_vector: false } }); return response.body?.result || []; }
  async deletePoints(name, ids) { if (ids.length) await this.#request(`/collections/${encodeURIComponent(name)}/points/delete?wait=true`, { method: "POST", body: { points: ids } }); }
  async #request(path, { method = "GET", body, allow404 = false } = {}) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.config.url}${path}`, { method, headers: { "Content-Type": "application/json", ...(this.config.apiKey ? { "api-key": this.config.apiKey } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      let parsed = null; try { parsed = await response.json(); } catch { /* health endpoint may be empty */ }
      if (allow404 && response.status === 404) return { status: 404, body: parsed };
      if (!response.ok) throw new QdrantError("QDRANT_UNAVAILABLE", `Qdrant returned HTTP ${response.status}`, response.status >= 500 ? 503 : 502);
      return { status: response.status, body: parsed };
    } catch (error) { if (error instanceof QdrantError) throw error; throw new QdrantError(error?.name === "AbortError" ? "QDRANT_UNAVAILABLE" : "QDRANT_UNAVAILABLE", error?.name === "AbortError" ? "Qdrant timed out" : "Qdrant is unavailable", 503); } finally { clearTimeout(timer); }
  }
}
