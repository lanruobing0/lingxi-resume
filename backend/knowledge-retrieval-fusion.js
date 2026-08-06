export function fuseRetrievals(keyword = [], vector = [], rrfK = 60) {
  const results = new Map();
  for (const item of keyword) results.set(item.chunk.id, { ...item, vectorRank: null, vectorScore: null, retrievalSources: "KEYWORD", rrfScore: 1 / (rrfK + item.keywordRank) });
  for (const item of vector) { const existing = results.get(item.chunk.id); const contribution = 1 / (rrfK + item.vectorRank); if (existing) Object.assign(existing, { vectorRank: item.vectorRank, vectorScore: item.vectorScore, rrfScore: existing.rrfScore + contribution, retrievalSources: "KEYWORD_AND_VECTOR" }); else results.set(item.chunk.id, { ...item, keywordRank: null, keywordScore: null, keywordMatchedTerms: [], retrievalSources: "VECTOR", rrfScore: contribution }); }
  return [...results.values()].sort((a, b) => b.rrfScore - a.rrfScore || Math.min(a.keywordRank || Infinity, a.vectorRank || Infinity) - Math.min(b.keywordRank || Infinity, b.vectorRank || Infinity) || a.chunk.id - b.chunk.id);
}
