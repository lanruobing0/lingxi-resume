import { validateClaimSupport } from "./claim-support-validator.js";

const knowledgeClaimType = "KNOWLEDGE_CLAIM";

function numericId(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function reason(code, message) {
  return { code, message };
}

function validateCitation(store, report, citation) {
  const retrievalRunId = numericId(citation?.retrievalRunId);
  const chunkId = numericId(citation?.chunkId);
  const documentId = numericId(citation?.documentId);
  const processingVersion = numericId(citation?.processingVersion);
  const quote = typeof citation?.quote === "string" ? citation.quote.trim() : "";
  if (!retrievalRunId || !chunkId || !documentId || !processingVersion || !quote) return { valid: false, reason: reason("CITATION_SHAPE_INVALID", "引用字段不完整") };
  if (!report.retrievalRunIds.includes(retrievalRunId)) return { valid: false, reason: reason("CITATION_RUN_NOT_OWNED", "引用检索记录不属于本报告") };
  const run = store.knowledgeRetrievalRuns.find((item) => item.id === retrievalRunId && item.status !== "FAILED");
  const candidate = run?.candidateRefs?.find((item) => item.chunkId === chunkId && item.documentId === documentId && item.processingVersion === processingVersion);
  if (!candidate) return { valid: false, reason: reason("CITATION_NOT_IN_RETRIEVAL_RUN", "引用 Chunk 不在本次检索候选中") };
  const chunk = store.knowledgeChunks.find((item) => item.id === chunkId && item.documentId === documentId && item.processingVersion === processingVersion);
  const document = store.knowledgeDocuments.find((item) => item.id === documentId);
  if (!chunk || !document) return { valid: false, reason: reason("CITATION_LOCAL_SOURCE_MISSING", "本地知识来源不存在") };
  if (document.status !== "PROCESSED" || document.vectorStatus !== "INDEXED" || chunk.processingVersion !== document.processingVersion || !document.activeIndexRunId) {
    return { valid: false, reason: reason("CITATION_SOURCE_NOT_CURRENT", "知识来源已撤回或不是当前有效版本") };
  }
  if (candidate.contentHash !== chunk.contentHash || Number(candidate.indexRunId) !== Number(document.activeIndexRunId)) {
    return { valid: false, reason: reason("CITATION_SOURCE_VERSION_MISMATCH", "引用版本与本地当前来源不一致") };
  }
  if (!chunk.content.includes(quote)) return { valid: false, reason: reason("CITATION_QUOTE_INVALID", "引用摘录不在本地 Chunk 正文中") };
  return {
    valid: true,
    citation: {
      retrievalRunId,
      chunkId,
      documentId,
      processingVersion,
      quote,
      sourceTitle: document.title || "",
      contentHash: chunk.contentHash,
    },
  };
}

export function validateKnowledgeClaims(store, report, claims) {
  const kept = [];
  const failures = [];
  for (const claim of claims) {
    if (claim.claimType !== knowledgeClaimType) {
      kept.push(claim);
      continue;
    }
    const citations = Array.isArray(claim.citations) ? claim.citations : [];
    if (!citations.length) {
      failures.push({ claimId: claim.claimId, ...reason("CITATION_REQUIRED", "知识主张缺少引用") });
      continue;
    }
    const uniqueCitations = [];
    const citationKeys = new Set();
    for (const citation of citations) {
      const key = `${citation?.retrievalRunId}:${citation?.chunkId}:${citation?.documentId}:${citation?.processingVersion}:${String(citation?.quote || "").trim()}`;
      if (citationKeys.has(key)) continue;
      citationKeys.add(key);
      uniqueCitations.push(citation);
    }
    const validated = uniqueCitations.map((citation) => validateCitation(store, report, citation));
    const invalid = validated.find((item) => !item.valid);
    if (invalid) {
      failures.push({ claimId: claim.claimId, ...invalid.reason });
      continue;
    }
    const trustedCitations = validated.map((item) => item.citation);
    const support = validateClaimSupport({ claimText: claim.text, citations: trustedCitations, localQuotes: trustedCitations.map((citation) => citation.quote) });
    if (!support.supported) {
      failures.push({ claimId: claim.claimId, code: support.supportFailureCode, message: "知识主张未获得引用的语义支持", supportMetrics: support.supportMetrics });
      continue;
    }
    kept.push({ ...claim, citations: trustedCitations, validationStatus: "VALID", ...support });
  }
  return {
    claims: kept,
    droppedClaimCount: failures.length,
    validationFailures: failures,
    validKnowledgeClaimCount: kept.filter((item) => item.claimType === knowledgeClaimType).length,
  };
}

export function sourceAvailability(store, citation) {
  const chunk = store.knowledgeChunks.find((item) => item.id === citation.chunkId && item.documentId === citation.documentId && item.processingVersion === citation.processingVersion);
  const document = store.knowledgeDocuments.find((item) => item.id === citation.documentId);
  return Boolean(chunk && document && document.status === "PROCESSED" && document.vectorStatus === "INDEXED" && document.processingVersion === chunk.processingVersion && document.activeIndexRunId);
}
