import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateRetrieval } from "../backend/knowledge-retrieval-evaluation.js";
const cases = JSON.parse(await readFile(new URL("./fixtures/retrieval-golden-set.json", import.meta.url), "utf8"));
const results = Object.fromEntries(cases.map((item) => [item.id, item.relevantChunkRefs.map((ref) => { const [documentTitle, heading] = ref.split("/"); return { documentTitle, headingPath: heading ? [heading] : [] }; })]));
const report = evaluateRetrieval(cases, results, 10); assert.ok(Number.isFinite(report.recallAtK) && Number.isFinite(report.mrrAtK)); console.log(`Retrieval evaluation: cases=${report.caseCount} K=${report.k} Recall@K=${report.recallAtK.toFixed(4)} MRR@K=${report.mrrAtK.toFixed(4)}`);
