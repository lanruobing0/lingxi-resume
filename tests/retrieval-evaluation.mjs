import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { KnowledgeRetrievalService } from "../backend/knowledge-retrieval-service.js";
import { evaluateRetrieval } from "../backend/knowledge-retrieval-evaluation.js";

const fixture = JSON.parse(await readFile(new URL("./fixtures/retrieval-golden-set.json", import.meta.url), "utf8"));
const store = {
  knowledgeDocuments: fixture.corpus.map(({ document }) => ({ ...document })),
  knowledgeChunks: fixture.corpus.map(({ chunk }) => ({ ...chunk, contentHash: createHash("sha256").update(chunk.content).digest("hex") })),
  knowledgeRetrievalRuns: [],
};
const service = new KnowledgeRetrievalService({ env: {}, persist: async () => {} });
const results = {};

for (const goldenCase of fixture.cases) {
  const actual = await service.search(store, {
    query: goldenCase.query,
    mode: "KEYWORD",
    filters: goldenCase.filters,
    topK: 10,
    keywordLimit: 30,
    useReranker: false,
  }, 1);
  results[goldenCase.id] = actual.results;
}

const report = evaluateRetrieval(fixture.cases, results, 10);
assert.ok(Number.isFinite(report.recallAtK) && Number.isFinite(report.mrrAtK));
assert.equal(store.knowledgeRetrievalRuns.length, fixture.cases.length, "production retrieval must persist one RetrievalRun per golden query");
console.log(`Retrieval evaluation: cases=${report.caseCount} K=${report.k} Recall@K=${report.recallAtK.toFixed(4)} MRR@K=${report.mrrAtK.toFixed(4)}`);
