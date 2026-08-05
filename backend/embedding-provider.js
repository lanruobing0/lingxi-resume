import { createHash } from "node:crypto";
import { knowledgeEmbeddingInputFormatVersion } from "./knowledge-embedding-text.js";

export class EmbeddingProviderError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.name = "EmbeddingProviderError";
    this.code = code;
    this.status = status;
  }
}

const positiveInt = (value, fallback) => Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;

export function getEmbeddingConfig(env = process.env) {
  const baseUrl = String(env.EMBEDDING_BASE_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(env.EMBEDDING_API_KEY || "").trim();
  const model = String(env.EMBEDDING_MODEL || "").trim();
  const dimension = positiveInt(env.EMBEDDING_DIMENSION, 0);
  if (!baseUrl || !apiKey || !model || !dimension) return null;
  return { baseUrl, apiKey, model, dimension, batchSize: positiveInt(env.EMBEDDING_BATCH_SIZE, 32), timeoutMs: positiveInt(env.EMBEDDING_TIMEOUT_MS, 30000), maxRetries: Number.isInteger(Number(env.EMBEDDING_MAX_RETRIES)) ? Math.max(0, Number(env.EMBEDDING_MAX_RETRIES)) : 2 };
}

export function createEmbeddingProfile(config) {
  const input = { provider: "openai-compatible", model: config.model, dimension: config.dimension, inputFormatVersion: knowledgeEmbeddingInputFormatVersion, distanceMetric: "Cosine" };
  const profileId = `ep_${createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 16)}`;
  return { ...input, profileId };
}

export class OpenAICompatibleEmbeddingProvider {
  constructor(config, { fetchImpl = fetch } = {}) { this.config = config; this.fetchImpl = fetchImpl; }

  async embedTexts(texts) {
    if (!Array.isArray(texts) || !texts.length) return { vectors: [], provider: "openai-compatible", model: this.config.model, dimension: this.config.dimension, usage: null, requestId: null };
    const vectors = [];
    let usage = null;
    let requestId = null;
    for (let start = 0; start < texts.length; start += this.config.batchSize) {
      const batch = texts.slice(start, start + this.config.batchSize);
      const result = await this.#embedBatch(batch);
      vectors.push(...result.vectors);
      usage = result.usage || usage;
      requestId = result.requestId || requestId;
    }
    return { vectors, provider: "openai-compatible", model: this.config.model, dimension: this.config.dimension, usage, requestId };
  }

  async #embedBatch(input) {
    let lastError;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await this.fetchImpl(`${this.config.baseUrl}/embeddings`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.config.apiKey}` }, body: JSON.stringify({ model: this.config.model, input }), signal: controller.signal });
        if (!response.ok) throw new EmbeddingProviderError("EMBEDDING_PROVIDER_UNAVAILABLE", `Embedding provider returned HTTP ${response.status}`, response.status === 429 || response.status >= 500 ? 503 : 502);
        const payload = await response.json();
        if (!Array.isArray(payload?.data)) throw new EmbeddingProviderError("EMBEDDING_INVALID_RESPONSE", "Embedding provider returned an invalid response");
        const ordered = [...payload.data].sort((a, b) => Number(a.index) - Number(b.index));
        return { vectors: ordered.map((item) => item.embedding), usage: payload.usage || null, requestId: response.headers.get("x-request-id") || response.headers.get("request-id") || null };
      } catch (error) {
        lastError = error instanceof EmbeddingProviderError ? error : new EmbeddingProviderError(error?.name === "AbortError" ? "EMBEDDING_TIMEOUT" : "EMBEDDING_PROVIDER_UNAVAILABLE", error?.name === "AbortError" ? "Embedding provider timed out" : "Embedding provider is unavailable", 503);
        if (attempt >= this.config.maxRetries || !["EMBEDDING_PROVIDER_UNAVAILABLE", "EMBEDDING_TIMEOUT"].includes(lastError.code)) break;
        await new Promise((resolve) => setTimeout(resolve, Math.min(800, 100 * (2 ** attempt))));
      } finally { clearTimeout(timer); }
    }
    throw lastError;
  }
}
