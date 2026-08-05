import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createDeterministicPointId } from "../backend/knowledge-embedding-text.js";

const docker = spawnSync("docker", ["version"], { stdio: "ignore" });
if (docker.status !== 0) {
  console.error("Real Qdrant Smoke Test 未验证：当前机器没有可用 Docker。");
  process.exitCode = 2;
} else {
  const project = "lingxi-stage5a-smoke";
  const compose = (args) => {
    const result = spawnSync("docker", ["compose", "-f", "docker-compose.qdrant.yml", "-p", project, ...args], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || result.stdout || "docker compose failed");
  };
  const collection = `lingxi_smoke_${randomUUID().replaceAll("-", "")}`;
  try {
    compose(["up", "-d", "--wait"]);
    const base = "http://127.0.0.1:6333";
    const create = await fetch(`${base}/collections/${collection}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vectors: { size: 4, distance: "Cosine" } }) }); assert.ok(create.ok);
    const collectionInfo = await fetch(`${base}/collections/${collection}`); const vectors = (await collectionInfo.json()).result.config.params.vectors; assert.equal(vectors.size, 4); assert.equal(vectors.distance, "Cosine");
    const pointId = createDeterministicPointId({ documentId: 77, chunkIndex: 0, embeddingInputHash: "safe-hash", embeddingProfileId: "ep_smoke" });
    const payload = { documentId: 77, chunkId: 88, processingVersion: 3, embeddingInputHash: "safe-hash", embeddingProfileId: "ep_smoke", indexRunId: 9, indexedAt: new Date().toISOString() };
    const otherPointId = createDeterministicPointId({ documentId: 78, chunkIndex: 0, embeddingInputHash: "other-safe-hash", embeddingProfileId: "ep_smoke" });
    const upsert = async () => fetch(`${base}/collections/${collection}/points?wait=true`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: [{ id: pointId, vector: [0.1, 0.2, 0.3, 0.4], payload }, { id: otherPointId, vector: [0.2, 0.3, 0.4, 0.5], payload: { documentId: 78, chunkId: 89, indexRunId: 10 } }] }) }); assert.ok((await upsert()).ok); assert.ok((await upsert()).ok);
    const read = await fetch(`${base}/collections/${collection}/points`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [pointId], with_payload: true, with_vector: false }) }); const found = (await read.json()).result; assert.equal(found.length, 1); assert.equal(found[0].payload.documentId, 77); assert.equal(Object.hasOwn(found[0].payload, "rawText"), false);
    const remove = await fetch(`${base}/collections/${collection}/points/delete?wait=true`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ points: [pointId] }) }); assert.ok(remove.ok);
    const missing = await fetch(`${base}/collections/${collection}/points`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [pointId], with_payload: false, with_vector: false }) }); assert.equal((await missing.json()).result.length, 0);
    const otherRead = await fetch(`${base}/collections/${collection}/points`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [otherPointId], with_payload: false, with_vector: false }) }); assert.equal((await otherRead.json()).result.length, 1);
    const exists = await fetch(`${base}/collections/${collection}`); assert.ok(exists.ok); console.log("Real Qdrant smoke test passed.");
  } finally { try { await fetch(`http://127.0.0.1:6333/collections/${collection}`, { method: "DELETE" }); } catch {} compose(["down"]); }
}
