import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

const coreEntityCollections = [
  "knowledgeRetrievalRuns", "matchReports", "suggestionRuns", "resumeSuggestions", "resumeHistories",
  "interviewSessions", "interviewSessionQuestions", "interviewAnswers", "answerFeedbacks", "agentRuns", "agentSteps", "jobs",
];

const mysqlPrivateFields = new Set(["apikey", "api_key", "systemprompt", "hiddensystemprompt", "embedding", "vector"]);

function mysqlSafeValue(value) {
  if (Array.isArray(value)) return value.map(mysqlSafeValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !mysqlPrivateFields.has(String(key).toLowerCase()))
    .map(([key, nested]) => [key, mysqlSafeValue(nested)]));
}

function mysqlConfig(env) {
  const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"];
  const missing = required.filter((key) => !String(env[key] || "").trim());
  if (missing.length) throw Object.assign(new Error(`Missing MySQL configuration: ${missing.join(", ")}`), { code: "MYSQL_CONFIG_INVALID" });
  const port = Number(env.MYSQL_PORT || 3306);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error("MYSQL_PORT must be a valid TCP port"), { code: "MYSQL_CONFIG_INVALID" });
  return { host: env.MYSQL_HOST, port, database: env.MYSQL_DATABASE, user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, connectionLimit: Math.max(1, Math.min(10, Number(env.MYSQL_CONNECTION_LIMIT || 4) || 4)) };
}

export function storageConfig(env = process.env) {
  const driver = String(env.STORAGE_DRIVER || "json").trim().toLowerCase();
  if (!["json", "mysql"].includes(driver)) throw Object.assign(new Error("STORAGE_DRIVER must be json or mysql"), { code: "STORAGE_DRIVER_INVALID" });
  return { driver, mysql: driver === "mysql" ? mysqlConfig(env) : null };
}

export class JsonPersistence {
  constructor({ dataDir, seedData }) { this.dataDir = dataDir; this.dataFile = path.join(dataDir, "store.json"); this.seedData = seedData; }
  async ensure() { await mkdir(this.dataDir, { recursive: true }); if (!existsSync(this.dataFile)) await writeFile(this.dataFile, JSON.stringify(this.seedData, null, 2), "utf8"); }
  async read() { await this.ensure(); return JSON.parse(await readFile(this.dataFile, "utf8")); }
  async write(store) {
    await this.ensure();
    const temporaryFile = `${this.dataFile}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(temporaryFile, JSON.stringify(store, null, 2), { encoding: "utf8", mode: 0o600 });
    try {
      for (let attempt = 0; attempt < 3; attempt += 1) try { await rename(temporaryFile, this.dataFile); return; } catch (error) {
        if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code) || attempt === 2) throw error;
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
      }
    } catch (error) {
      if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code)) throw error;
      await writeFile(this.dataFile, await readFile(temporaryFile), { mode: 0o600 });
    } finally { await unlink(temporaryFile).catch(() => {}); }
  }
  async health() { await this.ensure(); await readFile(this.dataFile, "utf8"); return { ok: true, driver: "json" }; }
  async close() {}
}

export class MysqlPersistence {
  constructor({ config, seedData }) { this.config = config; this.seedData = seedData; this.pool = null; this.ensurePromise = null; }
  async #pool() {
    if (!this.pool) {
      const mysql = await import("mysql2/promise").catch(() => { throw Object.assign(new Error("mysql2 is required when STORAGE_DRIVER=mysql"), { code: "MYSQL_DRIVER_UNAVAILABLE" }); });
      this.pool = mysql.createPool(this.config);
    }
    return this.pool;
  }
  async ensure() {
    if (!this.ensurePromise) this.ensurePromise = (async () => {
      const pool = await this.#pool();
      await pool.query("CREATE TABLE IF NOT EXISTS lingxi_store_snapshot (id TINYINT PRIMARY KEY, payload_json LONGTEXT NOT NULL, updated_at DATETIME NOT NULL)");
      await pool.query("ALTER TABLE lingxi_store_snapshot MODIFY payload_json LONGTEXT NOT NULL");
      await pool.query("CREATE TABLE IF NOT EXISTS lingxi_entity_projection (entity_type VARCHAR(64) NOT NULL, entity_id BIGINT NOT NULL, user_id BIGINT NULL, payload_json JSON NOT NULL, updated_at DATETIME NOT NULL, PRIMARY KEY(entity_type, entity_id), INDEX idx_lingxi_entity_owner (entity_type, user_id))");
      await pool.query("CREATE TABLE IF NOT EXISTS rag_job (id BIGINT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(64) NOT NULL, user_id BIGINT NOT NULL, resource_id BIGINT NOT NULL, status VARCHAR(16) NOT NULL, progress INT NOT NULL DEFAULT 0, failure_code VARCHAR(100) NULL, created_at DATETIME NOT NULL, started_at DATETIME NULL, completed_at DATETIME NULL, INDEX idx_rag_job_owner_created (user_id, created_at), INDEX idx_rag_job_status_created (status, created_at))");
    })().catch((error) => { this.ensurePromise = null; throw error; });
    await this.ensurePromise;
  }
  async read() { await this.ensure(); const pool = await this.#pool(); const [rows] = await pool.query("SELECT payload_json FROM lingxi_store_snapshot WHERE id = 1"); return rows.length ? (typeof rows[0].payload_json === "string" ? JSON.parse(rows[0].payload_json) : rows[0].payload_json) : structuredClone(this.seedData); }
  async write(store) {
    await this.ensure(); const pool = await this.#pool(); const connection = await pool.getConnection();
    const safeStore = mysqlSafeValue(store);
    try {
      await connection.beginTransaction();
      await connection.query("INSERT INTO lingxi_store_snapshot (id, payload_json, updated_at) VALUES (1, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = UTC_TIMESTAMP()", [JSON.stringify(safeStore)]);
      for (const entityType of coreEntityCollections) {
        const rows = Array.isArray(safeStore[entityType]) ? safeStore[entityType] : [];
        await connection.query("DELETE FROM lingxi_entity_projection WHERE entity_type = ?", [entityType]);
        if (rows.length) await connection.query("INSERT INTO lingxi_entity_projection (entity_type, entity_id, user_id, payload_json, updated_at) VALUES ?", [rows.map((row) => [entityType, Number(row.id), Number.isInteger(Number(row.userId)) ? Number(row.userId) : null, JSON.stringify(row), new Date()])]);
      }
      const jobs = Array.isArray(safeStore.jobs) ? safeStore.jobs : [];
      await connection.query("DELETE FROM rag_job");
      if (jobs.length) await connection.query("INSERT INTO rag_job (id, type, user_id, resource_id, status, progress, failure_code, created_at, started_at, completed_at) VALUES ?", [jobs.map((job) => [job.id, job.type, job.userId, job.resourceId, job.status, job.progress, job.failureCode, new Date(job.createdAt), job.startedAt ? new Date(job.startedAt) : null, job.completedAt ? new Date(job.completedAt) : null])]);
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  }
  async health() { await this.ensure(); const pool = await this.#pool(); await pool.query("SELECT 1"); return { ok: true, driver: "mysql" }; }
  async close() { if (this.pool) await this.pool.end(); }
}

export function createPersistence({ env = process.env, dataDir, seedData }) {
  const config = storageConfig(env);
  return config.driver === "mysql" ? new MysqlPersistence({ config: config.mysql, seedData }) : new JsonPersistence({ dataDir, seedData });
}
