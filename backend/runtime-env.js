import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

// Direct API startup must use the same file precedence as the local launcher.
// Isolated stores skip local credentials unless explicitly opted in.
export function loadRuntimeEnv(root, env = process.env) {
  if (env.LINGXI_LOAD_LOCAL_ENV === "false" || (env.LINGXI_DATA_DIR && env.LINGXI_LOAD_LOCAL_ENV !== "true")) return;
  const values = {};
  for (const name of [".env", ".env.local"]) {
    const file = path.join(root, name);
    if (existsSync(file)) Object.assign(values, parseEnv(readFileSync(file, "utf8")));
  }
  for (const [key, value] of Object.entries(values)) if (env[key] === undefined) env[key] = value;
}
