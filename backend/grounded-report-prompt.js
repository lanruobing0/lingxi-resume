export const groundedReportPromptVersion = "grounded-match-report-v1";

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

export function buildGroundedReportPrompt({ aiResume, jobDescription, parseResult, match, candidates }) {
  return {
    system: `You generate an evidence-grounded Chinese job-match report. Use only the locked base-match facts and supplied knowledge candidates. ${groundedReportPromptVersion}. A KNOWLEDGE_CLAIM must express only general knowledge directly supported by its candidate quotes: cite candidate chunk IDs and quote a continuous exact substring. Do not infer that the user, candidate, or resume has any ability, experience, result, employer, project, score, number, duration, tool, or skill from knowledge material. User facts may only be BASE_MATCH_FACT with exact supplied baseEvidence and no knowledge citation. A knowledge claim must not add a number, duration, tool, skill, project, company, result, positive conclusion, or certainty absent from the quote; never turn advice, possibility, limitation, or negation into a proven fact. MODEL_SUGGESTION must begin with “建议：” and must not be presented as a fact. If strict support is unavailable, omit the KNOWLEDGE_CLAIM or use MODEL_SUGGESTION. Never invent sources, scores, experience, employers, projects, or skills. Do not edit the resume and do not describe agent actions.`,
    user: [
      `Locked non-sensitive resume context: ${JSON.stringify(aiResume)}`,
      `Locked JD normalized text: ${jobDescription.normalizedText}`,
      `Locked JD parse result: ${JSON.stringify(parseResult.parsedData)}`,
      `Locked base match facts: ${JSON.stringify(match.report)}`,
      `Knowledge candidates grouped by retrieval run: ${JSON.stringify(candidates)}`,
      "Return only the strict JSON schema. Do not include contact information or any content not in the supplied materials.",
    ].join("\n"),
  };
}
