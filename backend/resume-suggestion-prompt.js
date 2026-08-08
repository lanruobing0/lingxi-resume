export const resumeSuggestionPromptVersion = "resume-suggestions-v2-evidence";

const factEvidenceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fact", "sourcePath", "sourceQuote"],
  properties: {
    fact: { type: "string" },
    sourcePath: { type: "string" },
    sourceQuote: { type: "string" },
  },
};

const suggestionItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["sectionType", "targetPath", "suggestionType", "rationale", "before", "after", "patch", "factEvidence", "sourceClaimIds", "recommendationRefs"],
  properties: {
    sectionType: { type: "string" },
    targetPath: { type: "string" },
    suggestionType: { type: "string" },
    rationale: { type: "string" },
    before: { type: "string" },
    after: { type: "string" },
    patch: { type: "array", items: { type: "object" } },
    factEvidence: { type: "array", maxItems: 12, items: factEvidenceSchema },
    sourceClaimIds: { type: "array", items: { type: "string" } },
    recommendationRefs: { type: "array", items: { type: "string" } },
  },
};

export const resumeSuggestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["suggestions"],
  properties: {
    suggestions: { type: "array", maxItems: 12, items: suggestionItemSchema },
  },
};

export function buildResumeSuggestionPrompt({ resumeDocument, jobDescription, report }) {
  const safeReport = {
    reportVersion: report.reportVersion,
    dimensionReports: report.content?.dimensionReports || [],
    gaps: report.content?.gaps || [],
    recommendations: report.content?.recommendations || [],
    claims: (report.content?.claims || []).map(({ claimId, claimType, text, baseEvidence }) => ({ claimId, claimType, text, baseEvidence })),
  };
  return {
    system: `You create narrowly scoped Chinese resume editing suggestions from a locked resume and a grounded match report. Prompt version: ${resumeSuggestionPromptVersion}. Return JSON only. You may improve wording, clarify existing facts, align already-present keywords, or improve structure. Never invent or infer a company, project, skill, responsibility, date, year, number, percentage, metric, achievement, or user experience. Every executable non-FACT_REQUIRED suggestion must include non-empty factEvidence. Each evidence item must contain a concrete fact that appears in the proposed after text, a sourcePath pointing to the locked resume suggestion document, and a sourceQuote that is an exact continuous substring at that path and contains the same fact. Evidence from the JD, report, knowledge material, or your own inference never proves that the user did something. If any user fact cannot be proved from the locked resume, emit suggestionType FACT_REQUIRED with after as an empty string, patch as an empty array, and factEvidence as an empty array; explain exactly what fact the user must provide. For all other suggestions, patch must contain exactly one JSON Patch operation (replace, or add only for a new highlight), targetPath must equal patch[0].path, and before must be the exact current value. Only use paths present in the supplied resume suggestion document. sourceClaimIds must reference the supplied report claims; recommendationRefs must be exact supplied report recommendation strings. Do not include contact/profile information.`,
    user: [
      `Locked resume suggestion document: ${JSON.stringify(resumeDocument)}`,
      `Locked JD summary: ${JSON.stringify({ title: jobDescription.title, rawText: jobDescription.rawText, parsedData: jobDescription.parsedData })}`,
      `Locked grounded report: ${JSON.stringify(safeReport)}`,
      "Return { suggestions: [...] }. Do not add Markdown or any fields outside the schema.",
    ].join("\n"),
  };
}
