import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const goldenCases = [
  ["Retrieval", "tests/retrieval-evaluation.mjs"],
  ["Grounded Match Report", "tests/grounded-match-report.integration.mjs"],
  ["Resume Suggestion", "tests/resume-suggestions.integration.mjs"],
  ["Mock Interview", "tests/rag-mock-interview.integration.mjs"],
  ["Agentic RAG", "tests/bounded-agentic-rag.integration.mjs"],
];

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (part) => { output += String(part); });
    child.stderr.on("data", (part) => { output += String(part); });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve(output) : reject(new Error(`${file} exited ${code}\n${output}`)));
  });
}

const outputs = new Map();
for (const [name, file] of goldenCases) outputs.set(name, await run(file));

const retrieval = outputs.get("Retrieval");
const metrics = retrieval.match(/Recall@K=([0-9.]+) MRR@K=([0-9.]+)/);
assert.ok(metrics, "retrieval golden suite must report Recall@K and MRR");
const recall = Number(metrics[1]); const mrr = Number(metrics[2]);
assert.ok(recall >= 0 && recall <= 1, "retrieval Recall@K must be an actual bounded metric");
assert.ok(mrr >= 0 && mrr <= 1, "retrieval MRR must be an actual bounded metric");

// The integration golden cases reject unsupported citations/facts, fabricated
// rewrites, invented interview facts, source laundering, prompt injection,
// non-allowlisted tools, and STOPPED_LIMIT bypasses. A non-zero process exit
// makes this suite fail before metrics are printed.
const summary = {
  "Retrieval Recall@K": recall,
  "Retrieval MRR": mrr,
  "Grounded claim pass rate": outputs.has("Grounded Match Report") ? 1 : 0,
  "Suggestion safety pass rate": outputs.has("Resume Suggestion") ? 1 : 0,
  "Interview grounding pass rate": outputs.has("Mock Interview") ? 1 : 0,
  "Agent safety pass rate": outputs.has("Agentic RAG") ? 1 : 0,
};
for (const [label, value] of Object.entries(summary).filter(([label]) => label.includes("pass rate"))) assert.equal(value, 1, `${label} must remain 100%`);
for (const [label, value] of Object.entries(summary)) console.log(`${label}: ${(value * 100).toFixed(0)}%`);
console.log("RAG evaluation golden cases passed: citation/unsupported claim, fabricated fact, evidence-backed rewrite, question/improvedAnswer grounding, tool allowlist, STOPPED_LIMIT, prompt injection, and VERIFIED_RESUME_FACT source laundering.");
