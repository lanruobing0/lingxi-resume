import { validateClaimSupport } from "./claim-support-validator.js";

export const groundedReportPromptVersion = "grounded-match-report-v5";

const citationSchema = {
  type: "object", additionalProperties: false,
  required: ["retrievalRunId", "chunkId", "documentId", "processingVersion", "quote"],
  properties: {
    retrievalRunId: { type: "integer", minimum: 1 }, chunkId: { type: "integer", minimum: 1 }, documentId: { type: "integer", minimum: 1 }, processingVersion: { type: "integer", minimum: 1 }, quote: { type: "string", minLength: 1 },
  },
};

const claimSchema = {
  type: "object", additionalProperties: false,
  required: ["claimId", "sectionKey", "text", "claimType", "citations", "baseEvidence"],
  properties: {
    claimId: { type: "string", minLength: 1 }, sectionKey: { type: "string", minLength: 1 }, text: { type: "string", minLength: 1 },
    claimType: { type: "string", enum: ["BASE_MATCH_FACT", "KNOWLEDGE_CLAIM", "MODEL_SUGGESTION"] }, citations: { type: "array", items: citationSchema, maxItems: 4 }, baseEvidence: { type: "array", items: { type: "string" }, maxItems: 4 },
  },
};

export const groundedReportSchema = {
  type: "object", additionalProperties: false,
  required: ["executiveSummary", "dimensionReports", "strengths", "gaps", "recommendations", "claims"],
  properties: {
    executiveSummary: { type: "string", minLength: 1 },
    dimensionReports: { type: "array", items: { type: "object", additionalProperties: false, required: ["key", "summary"], properties: { key: { type: "string" }, summary: { type: "string", minLength: 1 } } }, maxItems: 6 },
    strengths: { type: "array", items: { type: "string" }, maxItems: 8 }, gaps: { type: "array", items: { type: "string" }, maxItems: 8 }, recommendations: { type: "array", items: { type: "string" }, maxItems: 8 }, claims: { type: "array", items: claimSchema, maxItems: 24 },
  },
};

export function buildGroundedReportPrompt({ aiResume, jobDescription, parseResult, match, candidates, baseEvidence = [] }) {
  const knowledgeEvidenceOptions = [];
  const seen = new Set();
  candidateLoop: for (const group of candidates) for (const candidate of group.candidates) {
    for (const sentence of candidate.content.split(/(?<=[。！？\n])/u).map(text => text.trim())) {
      if (sentence.length < 12 || sentence.length > 180 || /你|本人|候选人|求职者/.test(sentence) || seen.has(sentence)) continue;
      if (!validateClaimSupport({ claimText: sentence, localQuotes: [sentence] }).supported) continue;
      seen.add(sentence);
      knowledgeEvidenceOptions.push({ text: sentence, citation: { ...candidate.citationIdentity, quote: sentence } });
      break;
    }
    if (knowledgeEvidenceOptions.length >= 12) break candidateLoop;
  }
  const knowledgeSchema = { ...claimSchema, properties: { ...claimSchema.properties,
    claimType: { type: "string", enum: ["KNOWLEDGE_CLAIM"] },
    text: { type: "string", enum: knowledgeEvidenceOptions.map(option => option.text) },
  } };
  const nonKnowledgeSchema = { ...claimSchema, properties: { ...claimSchema.properties, claimType: { type: "string", enum: ["BASE_MATCH_FACT", "MODEL_SUGGESTION"] } } };
  const schema = knowledgeEvidenceOptions.length ? { ...groundedReportSchema, properties: { ...groundedReportSchema.properties, claims: { ...groundedReportSchema.properties.claims, items: { anyOf: [nonKnowledgeSchema, knowledgeSchema] } } } } : groundedReportSchema;
  return {
    schema,
    system: `You generate an evidence-grounded Chinese job-match report. Use only the locked base-match facts and supplied knowledge candidates. ${groundedReportPromptVersion}. A KNOWLEDGE_CLAIM must express only general knowledge directly supported by its candidate quotes: cite candidate chunk IDs and quote a continuous exact substring. Do not infer that the user, candidate, or resume has any ability, experience, result, employer, project, score, number, duration, tool, or skill from knowledge material. User facts may only be BASE_MATCH_FACT with exact supplied baseEvidence and no knowledge citation. A knowledge claim must not add a number, duration, tool, skill, project, company, result, positive conclusion, or certainty absent from the quote; never turn advice, possibility, limitation, or negation into a proven fact. MODEL_SUGGESTION must begin with “建议：” and must not be presented as a fact. If strict support is unavailable, omit the KNOWLEDGE_CLAIM or use MODEL_SUGGESTION. Never invent sources, scores, experience, employers, projects, or skills. Do not edit the resume and do not describe agent actions.`,
    user: [
      `Locked non-sensitive resume context: ${JSON.stringify(aiResume)}`,
      `Locked JD normalized text: ${jobDescription.normalizedText}`,
      `Locked JD parse result: ${JSON.stringify(parseResult.parsedData)}`,
      `Locked base match facts: ${JSON.stringify(match.report)}`,
      `Allowed BASE_MATCH_FACT baseEvidence strings: ${JSON.stringify(baseEvidence)}`,
      'For each BASE_MATCH_FACT, citations must be [] and baseEvidence must copy one or more complete strings from the allowed list exactly. Do not use field names, evidence IDs, newly paraphrased text or arbitrary resume excerpts as baseEvidence. If no allowed string supports the claim, omit the claim. Keep claims concise and avoid repeating the same evidence throughout the report.',
      `Knowledge candidates grouped by retrieval run: ${JSON.stringify(candidates)}`,
      `Knowledge evidence options: ${JSON.stringify(knowledgeEvidenceOptions)}. For KNOWLEDGE_CLAIM select relevant options and copy text and citation exactly as supplied. Do not paraphrase, summarize or combine options. Selection must be relevant to this JD; options do not prove candidate experience. If none is relevant, omit knowledge honestly.`,
      'Review candidate relevance before writing claims. When candidates contain general guidance relevant to this JD, include at least one KNOWLEDGE_CLAIM using a short continuous verbatim excerpt as its text and the matching citationIdentity. Do not silently omit all knowledge merely to simplify output. If every candidate is unrelated or cannot support a safe claim, omit knowledge honestly; never invent a source or turn guidance into candidate experience.',
      'For every knowledge citation copy all four IDs together from that candidate citationIdentity; never mix IDs from different candidates or retrieval runs. Prefer a short continuous exact quote as the claim text itself. Avoid added introductions such as "资料在某要点中指出" and unsupported explanations. A reference to application users or resource ownership is general technical knowledge, never proof of the job seeker having experience. Do not add candidate abilities to a knowledge claim.',
      "Return only the strict JSON schema. Do not include contact information or any content not in the supplied materials.",
    ].join("\n"),
  };
}
