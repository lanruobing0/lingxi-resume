import { documentMatchesFilters, queryTokens } from "./knowledge-query.js";

const includes = (text, token) => String(text || "").toLocaleLowerCase("en-US").includes(token);
export function currentKnowledge(store, filters) {
  const documents = store.knowledgeDocuments.filter((document) => document.status === "PROCESSED" && document.vectorStatus === "INDEXED" && documentMatchesFilters(document, filters));
  const byId = new Map(documents.map((document) => [document.id, document]));
  return store.knowledgeChunks.filter((chunk) => { const document = byId.get(chunk.documentId); return document && chunk.processingVersion === document.processingVersion; }).map((chunk) => ({ chunk, document: byId.get(chunk.documentId) }));
}
export function keywordRetrieve(store, normalizedQuery, filters, limit) {
  const terms = queryTokens(normalizedQuery); const scored = [];
  for (const { chunk, document } of currentKnowledge(store, filters)) {
    const title = `${document.title} ${chunk.title}`; const path = (chunk.headingPath || []).join(" "); const body = chunk.content || ""; const tags = (document.skillTags || []).join(" ");
    const matchedTerms = terms.filter((term) => includes(`${title} ${path} ${body} ${tags} ${document.jobFamily || ""}`, term));
    if (!matchedTerms.length) continue;
    let score = normalizedQuery.length > 2 && includes(`${title} ${path} ${body}`, normalizedQuery) ? 10 : 0; for (const term of matchedTerms) { if (includes(title, term)) score += 12; if (includes(path, term)) score += 8; if (includes(tags, term)) score += 8; if (includes(document.jobFamily, term)) score += 5; }
    const bodyCoverage = terms.length ? matchedTerms.filter((term) => includes(body, term)).length / terms.length : 0;
    score += Math.round(bodyCoverage * 12);
    scored.push({ chunk, document, keywordScore: score, keywordMatchedTerms: matchedTerms });
  }
  return scored.sort((a, b) => b.keywordScore - a.keywordScore || a.chunk.id - b.chunk.id).slice(0, limit).map((item, index) => ({ ...item, keywordRank: index + 1 }));
}
