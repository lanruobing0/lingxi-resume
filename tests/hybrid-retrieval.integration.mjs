import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createEmbeddingProfile } from "../backend/embedding-provider.js";

const root = path.resolve(import.meta.dirname, "..");
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

async function main() {
  const state = { embeddingCalls: 0, qdrantCalls: 0, qdrantBodies: [], qdrantHeaders: [], rerankerCalls: 0, rerankerBodies: [], rerankerAborts: 0, reranker: "normal", vectorDown: false, points: [] };
  const embedding = createServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part;
    state.embeddingCalls++; state.embeddingBodies ||= []; state.embeddingBodies.push(body);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ index: 0, embedding: [1, 0, 0, 0] }] }));
  });
  const qdrant = createServer(async (req, res) => {
    if (req.url === "/healthz") return res.end("{}");
    let body = ""; for await (const part of req) body += part;
    state.qdrantCalls++; state.qdrantBodies.push(body); state.qdrantHeaders.push(req.headers);
    if (state.vectorDown) return res.writeHead(503).end("{}");
    if (req.url?.includes("/points/search")) return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result: state.points }));
    res.writeHead(404).end();
  });
  const reranker = createServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part;
    state.rerankerCalls++; state.rerankerBodies.push(body);
    let closedEarly = false; res.on("close", () => { if (!res.writableEnded) closedEarly = true; });
    const documents = JSON.parse(body).documents;
    if (state.reranker === "timeout") { await wait(1200); if (closedEarly) state.rerankerAborts++; return res.end(JSON.stringify({ results: [] })); }
    if (state.reranker === "503") return res.writeHead(503).end();
    if (state.reranker === "invalid-json") return res.writeHead(200, { "Content-Type": "application/json" }).end("{");
    let results = documents.map((_, index) => ({ index, score: index }));
    if (state.reranker === "missing-results") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({}));
    if (state.reranker === "count-mismatch") results = results.slice(0, -1);
    if (state.reranker === "duplicate-index") results = results.map((row) => ({ ...row, index: 0 }));
    if (state.reranker === "out-of-range-index") results[results.length - 1].index = documents.length;
    if (state.reranker === "non-integer-index") results[0].index = 0.5;
    if (state.reranker === "invalid-score-string") results[0].score = "bad";
    if (state.reranker === "invalid-score-null") results[0].score = null;
    if (state.reranker === "missing-candidate") results[0] = { score: 0.9 };
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ results }));
  });
  const embeddingPort = await listen(embedding), qdrantPort = await listen(qdrant), rerankerPort = await listen(reranker);
  const embeddingConfig = { baseUrl: `http://127.0.0.1:${embeddingPort}/v1`, apiKey: "embedding-SECRET-key", model: "mock", dimension: 4 };
  const profile = createEmbeddingProfile(embeddingConfig);
  const adminToken = randomBytes(20).toString("hex"), userToken = randomBytes(20).toString("hex");
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-hybrid-"));
  const probe = createServer(); const apiPort = await listen(probe); probe.close();
  const document = (id, title, overrides = {}) => ({ id, title, status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: id + 100, documentType: "ROLE_SKILL_DESCRIPTION", jobFamily: "研发", seniority: "中级", skillTags: ["Java"], language: "zh-CN", sourceName: `source-${id}`, rawText: "SECRET-RAW-TEXT", ...overrides });
  const documents = [
    document(1, "Fusionneedle Filterneedle Java"),
    document(2, "Fusionneedle Filterneedle Java", { documentType: "STAR_CASE", jobFamily: "产品", seniority: "高级", skillTags: ["Node.js"], language: "mixed" }),
    document(3, "Vector only reference", { documentType: "OTHER", jobFamily: "测试", seniority: "初级", skillTags: ["Python"], language: "en" }),
    document(4, "Non processed", { status: "PENDING" }),
    document(5, "Stale vector", { vectorStatus: "STALE" }),
    document(11, "Java reference title", { activeIndexRunId: 111 }),
    document(12, "Heading reference", { activeIndexRunId: 112 }),
    document(13, "Skill reference", { skillTags: ["Java"], activeIndexRunId: 113 }),
    document(14, "Phrase reference", { activeIndexRunId: 114, skillTags: [] }),
    document(15, "Body partial reference", { activeIndexRunId: 115, skillTags: [] }),
    document(16, "Body coverage reference", { activeIndexRunId: 116, skillTags: [] }),
  ];
  const chunk = (id, documentId, content, overrides = {}) => ({ id, documentId, processingVersion: 1, chunkIndex: 0, title: `chunk-${id}`, headingPath: [], content, contentHash: `hash-${id}`, ...overrides });
  const chunks = [
    chunk(101, 1, "Fusionneedle Filterneedle Java"), chunk(102, 2, "Fusionneedle Filterneedle Java"), chunk(103, 3, "vector-only"),
    chunk(104, 4, "invalid document"), chunk(105, 5, "stale document"),
    chunk(111, 11, "unrelated"), chunk(112, 12, "unrelated", { headingPath: ["Java"] }), chunk(113, 13, "unrelated"),
    chunk(114, 14, "Java performance tuning"), chunk(115, 15, "Java"), chunk(116, 16, "Java tuning performance"),
  ];
  const record = (id, pointId, chunkId, documentId, overrides = {}) => ({ id, pointId, chunkId, documentId, processingVersion: 1, indexRunId: documentId + 100, embeddingProfileId: profile.profileId, status: "ACTIVE", ...overrides });
  const records = [
    record(1, "valid-1", 101, 1), record(2, "valid-3", 103, 3),
    record(3, "non-processed", 104, 4), record(4, "stale-vector", 105, 5),
    record(5, "old-version", 101, 1, { processingVersion: 0 }), record(6, "wrong-run", 101, 1, { indexRunId: 1 }),
    record(7, "missing-chunk", 999, 1), record(8, "record-document-mismatch", 101, 2),
  ];
  state.points = [
    { id: "valid-3", score: .95, payload: { chunkId: 103, documentId: 3, indexRunId: 103, rawText: "FORGED-SECRET-PAYLOAD" } },
    { id: "valid-1", score: .9, payload: { chunkId: 101, documentId: 1, indexRunId: 101, rawText: "FORGED-SECRET-PAYLOAD" } },
    { id: "non-processed", score: .9, payload: { chunkId: 104, documentId: 4, indexRunId: 104 } },
    { id: "stale-vector", score: .9, payload: { chunkId: 105, documentId: 5, indexRunId: 105 } },
    { id: "old-version", score: .9, payload: { chunkId: 101, documentId: 1, indexRunId: 101 } },
    { id: "wrong-run", score: .9, payload: { chunkId: 101, documentId: 1, indexRunId: 101 } },
    { id: "missing-chunk", score: .9, payload: { chunkId: 999, documentId: 1, indexRunId: 101 } },
    { id: "record-document-mismatch", score: .9, payload: { chunkId: 101, documentId: 2, indexRunId: 101 } },
    { id: "valid-1", score: .88, payload: { chunkId: 101, documentId: 999, indexRunId: 101 } },
    { id: "valid-1", score: .87, payload: { chunkId: 101, documentId: 1, indexRunId: 999 } },
  ];
  await writeFile(path.join(dataDir, "store.json"), JSON.stringify({ users: [{ id: 1, username: "hybrid-admin", passwordHash: "x", role: "ADMIN", status: 1 }, { id: 2, username: "hybrid-user", passwordHash: "x", role: "USER", status: 1 }], sessions: [{ id: 1, userId: 1, tokenHash: hash(adminToken), expiresAt: new Date(Date.now() + 60000).toISOString() }, { id: 2, userId: 2, tokenHash: hash(userToken), expiresAt: new Date(Date.now() + 60000).toISOString() }], knowledgeDocuments: documents, knowledgeChunks: chunks, knowledgeVectorRecords: records, knowledgeRetrievalRuns: [] }));

  let child;
  const start = (extra = {}) => {
    child = spawn(process.execPath, ["backend/server.js"], { cwd: root, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dataDir, EMBEDDING_BASE_URL: embeddingConfig.baseUrl, EMBEDDING_API_KEY: embeddingConfig.apiKey, EMBEDDING_MODEL: embeddingConfig.model, EMBEDDING_DIMENSION: "4", QDRANT_URL: `http://127.0.0.1:${qdrantPort}`, QDRANT_API_KEY: "qdrant-SECRET-key", RERANKER_ENABLED: "true", RERANKER_BASE_URL: `http://127.0.0.1:${rerankerPort}`, RERANKER_API_KEY: "reranker-SECRET-key", RERANKER_MODEL: "mock", RERANKER_TIMEOUT_MS: "1000", RERANKER_TOP_N: "3", ...extra }, stdio: "ignore" });
  };
  const stop = async () => { if (child?.exitCode === null) { child.kill(); await new Promise((resolve) => child.once("exit", resolve)); } };
  const ready = async () => { for (let index = 0; index < 80; index++) { try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok) return; } catch {} await wait(25); } throw new Error("API did not start"); };
  const call = async (token, body) => { const response = await fetch(`http://127.0.0.1:${apiPort}/api/admin/knowledge-retrieval/search`, { method: "POST", headers: { Cookie: token ? `lingxi_session=${token}` : "", "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: response.status, body: await response.json() }; };
  const get = async (pathname) => { const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, { headers: { Cookie: `lingxi_session=${adminToken}` } }); return { status: response.status, body: await response.json() }; };

  try {
    start(); await ready();
    assert.equal((await call("", { query: "Java" })).status, 401);
    assert.equal((await call(userToken, { query: "Java" })).status, 403);
    const invalidRequests = [
      { query: " " }, { query: "Java", mode: "bad" }, { query: "Java", keywordLimit: 0 }, { query: "Java", vectorLimit: 101 }, { query: "Java", rrfK: 19 },
      { query: "Java", scoreThreshold: -1.01 }, { query: "Java", scoreThreshold: 1.01 }, { query: "Java", filters: [] }, { query: "Java", filters: { documentType: ["bad"] } },
      { query: "Java", filters: { seniority: ["bad"] } }, { query: "Java", filters: { language: ["bad"] } }, { query: "Java", filters: { skillTags: "Java" } },
      { query: "Java", filters: { documentIds: [-1] } }, { query: "Java", filters: { documentIds: ["1"] } },
    ];
    for (const body of invalidRequests) assert.equal((await call(adminToken, body)).status, 400, JSON.stringify(body));
    const normalized = await call(adminToken, { query: "  Java 高并发 C++ C# Node.js React 18  ", mode: "KEYWORD" });
    assert.equal(normalized.status, 200); assert.equal(normalized.body.normalizedQuery, "java 高并发 c++ c# node.js react 18");
    assert.equal(normalized.body.queryHash, createHash("sha256").update(normalized.body.normalizedQuery).digest("hex"));

    const keyword = await call(adminToken, { query: "fusionneedle", mode: "KEYWORD" });
    assert.equal(keyword.status, 200); assert.deepEqual(keyword.body.results.map((item) => item.chunkId), [101, 102]);
    assert.equal(state.embeddingCalls, 0); assert.equal(state.qdrantCalls, 0);
    const vector = await call(adminToken, { query: "boundaryneedle", mode: "VECTOR" });
    assert.equal(vector.status, 200, JSON.stringify(vector.body)); assert.deepEqual(vector.body.results.map((item) => item.chunkId), [103, 101]);
    assert.equal(vector.body.results.some((item) => item.content.includes("FORGED")), false);
    const hybrid = await call(adminToken, { query: "fusionneedle", mode: "HYBRID" });
    assert.equal(hybrid.status, 200); assert.deepEqual(hybrid.body.results.map((item) => item.chunkId), [101, 103, 102]);
    assert.deepEqual(hybrid.body.results.map((item) => item.retrievalSources), ["KEYWORD_AND_VECTOR", "VECTOR", "KEYWORD"]);
    assert.deepEqual(hybrid.body.results.map((item) => [item.keywordRank, item.vectorRank]), [[1, 2], [null, 1], [2, null]]);
    assert.equal(hybrid.body.results[0].rrfScore, 1 / 61 + 1 / 62);
    assert.equal(hybrid.body.results[1].rrfScore, 1 / 61);
    assert.equal(hybrid.body.results[2].rrfScore, 1 / 62);
    assert.deepEqual((await call(adminToken, { query: "fusionneedle", mode: "HYBRID" })).body.results.map((item) => item.chunkId), hybrid.body.results.map((item) => item.chunkId));

    const scoring = await call(adminToken, { query: "Java performance tuning", mode: "KEYWORD", keywordLimit: 20 });
    const scoreByChunk = new Map(scoring.body.results.map((item) => [item.chunkId, item]));
    assert.ok(scoreByChunk.get(111).keywordScore > scoreByChunk.get(115).keywordScore, "title hit outranks body-only partial hit");
    assert.ok(scoreByChunk.get(112).keywordScore > scoreByChunk.get(115).keywordScore, "headingPath hit outranks body-only partial hit");
    assert.equal(scoreByChunk.get(113).keywordScore, 8, "skillTags bonus is exact");
    assert.equal(scoreByChunk.get(114).keywordScore, 22, "complete phrase adds 10 and body coverage is capped at 12");
    assert.equal(scoreByChunk.get(115).keywordScore, 4, "one body token only contributes coverage, not +4 per token");
    assert.equal(scoreByChunk.get(116).keywordScore, 12, "body coverage never exceeds 12");
    assert.deepEqual(scoreByChunk.get(114).keywordMatchedTerms, ["java", "performance", "tuning"]);
    assert.deepEqual((await call(adminToken, { query: "Java performance tuning", mode: "KEYWORD", keywordLimit: 20 })).body.results.map((item) => item.chunkId), scoring.body.results.map((item) => item.chunkId));

    const filterCases = [{ documentType: ["ROLE_SKILL_DESCRIPTION"] }, { jobFamily: ["研发"] }, { seniority: ["中级"] }, { skillTags: ["Java"] }, { language: ["zh-CN"] }, { documentIds: [1] }];
    for (const mode of ["KEYWORD", "VECTOR", "HYBRID"]) for (const filters of filterCases) {
      const filtered = await call(adminToken, { query: "filterneedle", mode, filters });
      assert.equal(filtered.status, 200, `${mode} ${JSON.stringify(filters)}`);
      assert.deepEqual(filtered.body.results.map((item) => item.documentId), [1], `${mode} ${JSON.stringify(filters)}`);
    }

    const baseOrder = hybrid.body.results.map((item) => item.chunkId);
    const callWithReranker = async (mode) => call(adminToken, { query: "fusionneedle", mode: "HYBRID", useReranker: true });
    state.reranker = "normal";
    const reranked = await callWithReranker("normal");
    assert.equal(reranked.body.rerankerApplied, true); assert.equal(reranked.body.rerankerFallback, false);
    assert.deepEqual(reranked.body.results.map((item) => item.chunkId), [...baseOrder].reverse());
    assert.deepEqual(reranked.body.results.map((item) => item.rerankScore), [2, 1, 0]);
    const rerankerFailureCodes = new Map([["503", "RERANKER_UNAVAILABLE"], ["timeout", "RERANKER_UNAVAILABLE"], ["invalid-json", "RERANKER_UNAVAILABLE"], ["missing-results", "RERANKER_INVALID_RESPONSE"], ["count-mismatch", "RERANKER_INVALID_RESPONSE"], ["duplicate-index", "RERANKER_INVALID_RESPONSE"], ["out-of-range-index", "RERANKER_INVALID_RESPONSE"], ["non-integer-index", "RERANKER_INVALID_RESPONSE"], ["invalid-score-string", "RERANKER_INVALID_RESPONSE"], ["invalid-score-null", "RERANKER_INVALID_RESPONSE"], ["missing-candidate", "RERANKER_INVALID_RESPONSE"]]);
    for (const [failure, expectedFailureCode] of rerankerFailureCodes) {
      state.reranker = failure;
      const fallback = await callWithReranker(failure);
      assert.equal(fallback.status, 200, failure); assert.equal(fallback.body.rerankerApplied, false, failure); assert.equal(fallback.body.rerankerFallback, true, failure);
      assert.equal(fallback.body.rerankerFailureCode, expectedFailureCode, failure); assert.deepEqual(fallback.body.results.map((item) => item.chunkId), baseOrder, `${failure} must restore the entire RRF order`);
    }
    await wait(300); // Allow the delayed mock to observe the client-side AbortController close.
    assert.ok(state.rerankerAborts > 0, "timeout must abort the actual reranker HTTP request");
    const callsBeforeDisabled = state.rerankerCalls; await stop(); start({ RERANKER_ENABLED: "false" }); await ready();
    const unconfigured = await call(adminToken, { query: "fusionneedle", mode: "HYBRID", useReranker: true });
    assert.equal(unconfigured.body.rerankerApplied, false); assert.equal(unconfigured.body.rerankerFallback, false); assert.deepEqual(unconfigured.body.results.map((item) => item.chunkId), baseOrder); assert.equal(state.rerankerCalls, callsBeforeDisabled);
    await stop(); start(); await ready();

    state.vectorDown = true;
    const degraded = await call(adminToken, { query: "fusionneedle", mode: "HYBRID" });
    assert.equal(degraded.status, 200); assert.equal(degraded.body.degraded, true); assert.equal(degraded.body.degradedReason, "QDRANT_UNAVAILABLE");
    const failed = await call(adminToken, { query: "fusionneedle", mode: "VECTOR" });
    assert.equal(failed.status, 503); assert.equal(failed.body.failureCode, "QDRANT_UNAVAILABLE"); state.vectorDown = false;
    await stop(); start({ EMBEDDING_BASE_URL: "" }); await ready();
    const embeddingMissing = await call(adminToken, { query: "fusionneedle", mode: "VECTOR" }); assert.equal(embeddingMissing.status, 503); assert.equal(embeddingMissing.body.failureCode, "EMBEDDING_NOT_CONFIGURED");
    await stop(); start({ QDRANT_URL: "" }); await ready();
    const qdrantMissing = await call(adminToken, { query: "fusionneedle", mode: "VECTOR" }); assert.equal(qdrantMissing.status, 503); assert.equal(qdrantMissing.body.failureCode, "QDRANT_NOT_CONFIGURED");
    await stop(); start(); await ready();

    const runs = await get("/api/admin/knowledge-retrieval/runs"); assert.equal(runs.status, 200);
    const runStatuses = new Set(runs.body.items.map((item) => item.status)); assert.ok(runStatuses.has("COMPLETED") && runStatuses.has("DEGRADED") && runStatuses.has("FAILED"));
    const completed = runs.body.items.find((item) => item.status === "COMPLETED");
    for (const key of ["queryHash", "normalizedQuery", "searchMode", "filters", "keywordCandidateCount", "vectorCandidateCount", "fusedCandidateCount", "returnedCount", "rerankerApplied", "degraded", "status", "failureCode", "durationMs", "createdBy"]) assert.ok(Object.hasOwn(completed, key), key);
    const serialized = JSON.stringify({ runs: runs.body, vector, hybrid });
    for (const secret of ["SECRET-RAW", "qdrant-SECRET-key", "reranker-SECRET-key", "embedding-SECRET-key", "FORGED-SECRET-PAYLOAD", "vector\":["]) assert.equal(serialized.includes(secret), false, secret);
    assert.ok(state.qdrantHeaders.some((headers) => headers["api-key"] === "qdrant-SECRET-key"));
    assert.equal(state.qdrantBodies.some((body) => body.includes("qdrant-SECRET-key") || body.includes("SECRET-RAW")), false);
    const persistedRuns = JSON.parse(await readFile(path.join(dataDir, "store.json"), "utf8")).knowledgeRetrievalRuns;
    await stop(); start(); await ready(); const reloadedRuns = await get("/api/admin/knowledge-retrieval/runs");
    assert.deepEqual(reloadedRuns.body.items.map((item) => item.id).sort((a, b) => a - b), persistedRuns.map((item) => item.id).sort((a, b) => a - b));
    console.log("Hybrid retrieval integration passed: reranker matrix, scoring, validation, filtering, RRF, current knowledge, runs, privacy and persistence.");
  } finally { await stop(); embedding.close(); qdrant.close(); reranker.close(); await rm(dataDir, { recursive: true, force: true }); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
