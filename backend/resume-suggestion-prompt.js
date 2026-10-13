export const resumeSuggestionPromptVersion = "resume-suggestions-v4-fact-guidance";

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
  required: ["sectionType", "targetPath", "suggestionType", "rationale", "factQuestions", "before", "after", "patch", "factEvidence", "sourceClaimIds", "recommendationRefs"],
  properties: {
    sectionType: { type: "string" },
    targetPath: { type: "string" },
    suggestionType: { type: "string", enum: ["REWRITE", "CLARIFY", "KEYWORD_ALIGNMENT", "STRUCTURE", "FACT_REQUIRED"] },
    rationale: { type: "string" },
    factQuestions: { type: "array", maxItems: 4, items: { type: "string", maxLength: 300 } },
    before: { type: "string" },
    after: { type: "string" },
    patch: { type: "array", maxItems: 1, items: { type: "object", additionalProperties: false, required: ["op", "path", "value"], properties: { op: { type: "string", enum: ["replace", "add"] }, path: { type: "string" }, value: { type: "string" } } } },
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

export function buildResumeSuggestionPathCatalog(document) {
  const escape = (value) => String(value).replace(/~/g, "~0").replace(/\//g, "~1");
  const paths = ["title", "targetPosition", "selfEvaluation"].map((field) => ({ op: "replace", path: `/${field}`, before: document[field] }));
  for (const [sectionKey, section] of Object.entries(document.sections || {})) {
    for (const [entryId, entry] of Object.entries(section.entries || {})) {
      const prefix = `/sections/${escape(sectionKey)}/entries/${escape(entryId)}`;
      for (const field of ["name", "role", "startDate", "endDate"]) paths.push({ op: "replace", path: `${prefix}/${field}`, before: entry[field] });
      entry.highlights.forEach((before, index) => paths.push({ op: "replace", path: `${prefix}/highlights/${index}`, before }));
      paths.push({ op: "add", path: `${prefix}/highlights/-`, before: "" });
    }
  }
  return paths;
}

export function buildResumeSuggestionSchema(document) {
  const catalog = buildResumeSuggestionPathCatalog(document);
  const schema = structuredClone(resumeSuggestionSchema);
  const properties = schema.properties.suggestions.items.properties;
  properties.targetPath.enum = catalog.map((item) => item.path);
  properties.patch.items.properties.path.enum = [...properties.targetPath.enum];
  properties.factEvidence.items.properties.sourcePath.enum = catalog.filter((item) => item.op === "replace").map((item) => item.path);
  return schema;
}

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
      `Exclusive editable path catalog (copy op/path/before exactly): ${JSON.stringify(buildResumeSuggestionPathCatalog(resumeDocument))}`,
      "Entries use stable string IDs, not array positions. Never target a section, entry, or highlights array as a whole. Replace one highlight using its numeric index; append only with op add and final /-. FACT_REQUIRED must target an existing replace path with its exact before, even when asking for missing education or projects; use /selfEvaluation if no corresponding entry exists. Its after is empty, patch and factEvidence are empty. Executable patch value must equal after. sourcePath must be an existing replace path, never the append path. Return only a few highest-priority suggestions; do not rewrite every field.",
      "For FACT_REQUIRED, include factQuestions: 1–4 specific Chinese questions about the exact missing facts (which project, your responsibility, actual implementation, or verifiable result). Ask only what this suggestion needs, never contact/profile information, and never supply invented answers or example metrics. For executable suggestions use factQuestions: []. Pure wording changes to already documented facts should retain those facts and cite exact source phrases rather than asking the user to add the same facts again. The fact field itself must occur verbatim in both sourceQuote and after; do not put a paraphrase in fact. A target role is an intention, not proof of experience: never convert it into claimed work experience.",
      `Locked JD summary: ${JSON.stringify({ title: jobDescription.title, rawText: jobDescription.rawText, parsedData: jobDescription.parsedData })}`,
      `Locked grounded report: ${JSON.stringify(safeReport)}`,
      "Return { suggestions: [...] }. Do not add Markdown or any fields outside the schema.",
    ].join("\n"),
  };
}
