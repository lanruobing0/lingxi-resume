import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadRuntimeEnv } from "../backend/runtime-env.js";

const root = await mkdtemp(path.join(tmpdir(), "lingxi-runtime-env-"));
try {
  await writeFile(path.join(root, ".env"), 'EMBEDDING_MODEL=base\nEMBEDDING_API_KEY="test-only-value"\n');
  await writeFile(path.join(root, ".env.local"), 'EMBEDDING_MODEL=local\nQDRANT_URL=http://127.0.0.1:16333\n');
  const env = {}; loadRuntimeEnv(root, env);
  assert.equal(env.EMBEDDING_MODEL, "local");
  assert.equal(env.QDRANT_URL, "http://127.0.0.1:16333");
  assert.equal(env.EMBEDDING_API_KEY, "test-only-value");
  loadRuntimeEnv(root, env); assert.equal(env.EMBEDDING_MODEL, "local");
  const overridden = { EMBEDDING_MODEL: "explicit", EMBEDDING_API_KEY: "" };
  loadRuntimeEnv(root, overridden); assert.equal(overridden.EMBEDDING_MODEL, "explicit"); assert.equal(overridden.EMBEDDING_API_KEY, "");
  const isolated = { LINGXI_DATA_DIR: root }; loadRuntimeEnv(root, isolated); assert.equal(isolated.EMBEDDING_API_KEY, undefined);
  const disabled = { LINGXI_LOAD_LOCAL_ENV: "false" }; loadRuntimeEnv(root, disabled); assert.equal(disabled.EMBEDDING_MODEL, undefined);
  const optedIn = { LINGXI_DATA_DIR: root, LINGXI_LOAD_LOCAL_ENV: "true" }; loadRuntimeEnv(root, optedIn); assert.equal(optedIn.EMBEDDING_MODEL, "local");
  console.log("Runtime env passed: local override, explicit env precedence, repeat startup and isolated-secret protection.");
} finally { await rm(root, { recursive: true, force: true }); }
