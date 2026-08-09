import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import path from "node:path";
import { createPersistence, storageConfig } from "../backend/persistence.js";
import { InProcessJobQueue, publicJob } from "../backend/job-queue.js";

const directory = await mkdtemp(path.join(tmpdir(), "lingxi-production-hardening-"));
try {
  assert.equal(storageConfig({}).driver, "json");
  assert.throws(() => storageConfig({ STORAGE_DRIVER: "invalid" }), /STORAGE_DRIVER/);
  assert.throws(() => storageConfig({ STORAGE_DRIVER: "mysql" }), /Missing MySQL configuration/);

  const persistence = createPersistence({ env: {}, dataDir: directory, seedData: { users: [], jobs: [], matchReports: [] } });
  const store = await persistence.read();
  assert.deepEqual(store.jobs, []);
  store.matchReports.push({ id: 7, userId: 3, status: "COMPLETED" });
  await persistence.write(store);
  assert.equal((await persistence.read()).matchReports[0].id, 7);
  assert.equal((await persistence.health()).driver, "json");

  const apiPort = 19000 + Math.floor(Math.random() * 1000);
  const api = spawn(process.execPath, ["backend/server.js"], { cwd: path.resolve(import.meta.dirname, ".."), env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: directory, QDRANT_URL: "", EMBEDDING_API_KEY: "" }, stdio: "ignore" });
  try {
    let health;
    for (let index = 0; index < 50; index += 1) {
      try { health = await fetch(`http://127.0.0.1:${apiPort}/health`); if (health.ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(health?.status, 200, "health must not require persistence or Qdrant readiness");
    const ready = await fetch(`http://127.0.0.1:${apiPort}/ready`);
    assert.equal(ready.status, 503, "unconfigured Qdrant must make readiness fail visibly");
    const readyBody = await ready.json();
    assert.equal(readyBody.persistence.driver, "json");
    assert.equal(JSON.stringify(readyBody).includes("MYSQL_PASSWORD"), false, "readiness must not expose connection configuration");
  } finally { api.kill("SIGTERM"); }

  let current = await persistence.read();
  const queue = new InProcessJobQueue({ readStore: () => persistence.read(), writeStore: (next) => persistence.write(next), concurrency: 1 });
  queue.register("GROUNDED_MATCH_REPORT", async ({ job, setProgress }) => { await setProgress(60); assert.equal(job.resourceId, 7); });
  const job = await queue.enqueue(current, { type: "GROUNDED_MATCH_REPORT", userId: 3, resourceId: 7, payload: { internalOnly: true } });
  assert.equal(job.status, "PENDING");
  assert.equal(publicJob(job).payload, undefined);
  for (let index = 0; index < 50; index += 1) {
    const latest = (await persistence.read()).jobs[0];
    if (latest.status === "COMPLETED") break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const completed = (await persistence.read()).jobs[0];
  assert.deepEqual({ status: completed.status, progress: completed.progress, failureCode: completed.failureCode }, { status: "COMPLETED", progress: 100, failureCode: null });
  await queue.shutdown();
  await assert.rejects(async () => queue.enqueue(await persistence.read(), { type: "GROUNDED_MATCH_REPORT", userId: 3, resourceId: 7 }), /shutting down/);
  console.log("Production hardening integration passed: JSON persistence abstraction, bounded job lifecycle, privacy projection, and shutdown admission control.");
} finally { await rm(directory, { recursive: true, force: true }); }
