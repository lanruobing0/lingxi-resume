export class UpstashVectorError extends Error {
  constructor(code, message, status = 503) { super(message); this.name = "UpstashVectorError"; this.code = code; this.status = status; }
}

const positiveInt = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function getUpstashVectorConfig(env = process.env) {
  const url = String(env.UPSTASH_VECTOR_REST_URL || "").trim();
  const token = String(env.UPSTASH_VECTOR_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  return {
    url,
    token,
    model: String(env.UPSTASH_VECTOR_MODEL || "BAAI/bge-m3").trim() || "BAAI/bge-m3",
    dimension: positiveInt(env.UPSTASH_VECTOR_DIMENSION, 1024),
    namespacePrefix: String(env.UPSTASH_VECTOR_NAMESPACE || "lingxi_knowledge").replace(/[^a-zA-Z0-9_-]/g, "_") || "lingxi_knowledge",
  };
}

export function buildUpstashNamespace(config, profile) { return `${config.namespacePrefix}_${profile.profileId}`.toLowerCase(); }

export class UpstashVectorClient {
  constructor(config) { this.config = config; this.index = null; }
  async #index() {
    if (!this.index) {
      const { Index } = await import("@upstash/vector").catch(() => { throw new UpstashVectorError("UPSTASH_VECTOR_DRIVER_UNAVAILABLE", "@upstash/vector is required for the Upstash vector store"); });
      this.index = new Index({ url: this.config.url, token: this.config.token });
    }
    return this.index;
  }
  async health() {
    try { await (await this.#index()).info(); return true; }
    catch (error) { if (error instanceof UpstashVectorError) throw error; throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector is unavailable"); }
  }
  async ensureCollection(_name, dimension) {
    try {
      const info = await (await this.#index()).info();
      if (info?.dimension && Number(info.dimension) !== Number(dimension)) throw new UpstashVectorError("COLLECTION_DIMENSION_MISMATCH", "Upstash Vector index dimension does not match the embedding profile", 409);
    } catch (error) { if (error instanceof UpstashVectorError) throw error; throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector is unavailable"); }
  }
  async upsertData(name, points) {
    try {
      const namespace = (await this.#index()).namespace(name);
      await namespace.upsert(points.map((point) => ({ id: point.id, data: point.data, metadata: point.payload })));
    } catch { throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector write failed"); }
  }
  async retrievePoints(name, ids) {
    try {
      const rows = await (await this.#index()).namespace(name).fetch(ids, { includeMetadata: false, includeData: false });
      return (rows || []).filter(Boolean).map((row) => ({ id: String(row.id) }));
    } catch { throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector verification failed"); }
  }
  async searchData(name, data, { limit = 10, scoreThreshold = 0 } = {}) {
    try {
      const rows = await (await this.#index()).namespace(name).query({ data, topK: limit, includeMetadata: true, includeData: false });
      return (rows || []).filter((row) => Number(row.score) >= Number(scoreThreshold || 0)).map((row) => ({ id: String(row.id), score: Number(row.score), payload: row.metadata || {} }));
    } catch { throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector query failed"); }
  }
  async deletePoints(name, ids) {
    if (!ids.length) return;
    try { await (await this.#index()).namespace(name).delete(ids); }
    catch { throw new UpstashVectorError("UPSTASH_VECTOR_UNAVAILABLE", "Upstash Vector delete failed"); }
  }
}
