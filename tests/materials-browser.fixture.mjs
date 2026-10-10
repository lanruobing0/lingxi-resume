// Manual browser verification only. Isolated store + mock providers; never uses
// personal accounts, production cookies or the production Qdrant collection.
import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { startMockServices } from "./vector-index.integration.mjs";

const root = path.resolve(import.meta.dirname, "..");
const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-materials-browser-"));
const tokens = { admin: randomBytes(24).toString("hex"), user: randomBytes(24).toString("hex") };
const mocks = await startMockServices();
const store = {
  users: [{ id: 1, username: "公共资料管理员（隔离测试）", role: "ADMIN", status: 1 }, { id: 2, username: "资料读者（隔离测试）", role: "USER", status: 1 }],
  sessions: Object.values(tokens).map((token, index) => ({ id: index + 1, userId: index + 1, tokenHash: createHash("sha256").update(token).digest("base64url"), expiresAt: new Date(Date.now() + 3600000).toISOString() })),
  resumes: [], resumeHistories: [], jobDescriptions: [], jobApplications: [], mockInterviews: [], interviewAnswers: [], systemNotices: [], knowledgeDocuments: [],
};
await writeFile(path.join(dataDir, "store.json"), JSON.stringify(store));
const env = { ...process.env, STORAGE_DRIVER: "json", API_PORT: "8911", PORT: "8911", LINGXI_DATA_DIR: dataDir,
  EMBEDDING_BASE_URL: `http://127.0.0.1:${mocks.embeddingPort}/v1`, EMBEDDING_API_KEY: "fixture-only", EMBEDDING_MODEL: "mock-embed", EMBEDDING_DIMENSION: "4", EMBEDDING_MAX_RETRIES: "0", QDRANT_URL: `http://127.0.0.1:${mocks.qdrantPort}`, QDRANT_API_KEY: "fixture-only" };
const backend = spawn(process.execPath, ["backend/server.js"], { cwd: root, env, stdio: "ignore", windowsHide: true });
const proxy = createServer(async (req, res) => {
  if (req.url === "/api/fixture/admin" || req.url === "/api/fixture/user") {
    const role = req.url.endsWith("/user") ? "user" : "admin";
    return res.writeHead(302, { "Set-Cookie": `fixture_role=${role}; Path=/; SameSite=Lax`, Location: "/#materials" }).end();
  }
  if (req.url === "/api/fixture/fail-index") { mocks.state.failEmbedding = true; return res.writeHead(200).end('{}'); }
  if (req.url === "/api/fixture/restore-index") { mocks.state.failEmbedding = false; return res.writeHead(200).end('{}'); }
  if (req.url === "/api/fixture/state") {
    const stored = JSON.parse(await readFile(path.join(dataDir, "store.json"), "utf8"));
    return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ documents: stored.knowledgeDocuments.map(({ id, title, status, vectorStatus }) => ({ id, title, status, vectorStatus })), embeddingCalls: mocks.state.embeddingCalls, points: [...mocks.state.points.values()].reduce((count, points) => count + points.size, 0) }));
  }
  const role = String(req.headers.cookie || "").includes("fixture_role=user") ? "user" : "admin";
  const forwarded = httpRequest({ hostname: "127.0.0.1", port: 8911, path: req.url, method: req.method, headers: { ...req.headers, cookie: `lingxi_session=${tokens[role]}` } }, (response) => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
  forwarded.on("error", () => { if (!res.headersSent) res.writeHead(503, { "Content-Type": "application/json" }); res.end('{"message":"Fixture backend unavailable"}'); });
  req.pipe(forwarded);
});
await new Promise((resolve) => proxy.listen(8912, "127.0.0.1", resolve));
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "5175", "--strictPort"], { cwd: root, env: { ...process.env, VITE_API_PROXY_TARGET: "http://127.0.0.1:8912" }, stdio: "ignore", windowsHide: true });
console.log("Materials browser fixture: http://127.0.0.1:5175/#materials (admin by default); switch role via /api/fixture/user or /api/fixture/admin. Isolated mock providers.");
let closing = false;
async function cleanup() {
  if (closing) return; closing = true;
  for (const child of [vite, backend]) if (child.exitCode === null) { child.kill(); await new Promise((resolve) => child.once("exit", resolve)); }
  await new Promise((resolve) => proxy.close(resolve)); await mocks.close();
  const cleanupPath = path.resolve(dataDir);
  if (path.dirname(cleanupPath) !== path.resolve(tmpdir()) || !path.basename(cleanupPath).startsWith("lingxi-materials-browser-")) throw new Error("Unexpected fixture cleanup path");
  await rm(cleanupPath, { recursive: true, force: true });
  process.exit(0);
}
process.on("SIGINT", cleanup); process.on("SIGTERM", cleanup);
