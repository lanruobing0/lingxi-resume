import { createHash } from "node:crypto";

const reportDocumentTypes = ["ROLE_SKILL_DESCRIPTION", "STAR_CASE", "INTERVIEW_RUBRIC", "INTERVIEW_QUESTION", "RESUME_GUIDE", "OTHER"];

function text(value) { return String(value || "").replace(/[\r\n\t ]+/g, " ").trim(); }
function unique(values, max = 8) { return [...new Set(values.map(text).filter(Boolean))].slice(0, max); }
function evidenceFromMatch(match) {
  const report = match.report || {};
  return unique([
    report.summary,
    ...(report.dimensions || []).flatMap((dimension) => [dimension.summary, ...(dimension.resumeEvidence || []), ...(dimension.jdEvidence || []), ...(dimension.missingEvidence || [])]),
    ...(report.strongestResumeEvidence || []), ...(report.risks || []), ...(report.prioritizedSuggestions || []),
  ], 80);
}

export function buildReportRetrievalPlans(match, parseResult, { searchMode = "HYBRID", useReranker = false } = {}) {
  const parsed = parseResult.parsedData || {};
  const skills = unique([...(parsed.requiredSkills || []).map((item) => item.text), ...(parsed.preferredSkills || []).map((item) => item.text), ...(parsed.technicalKeywords || []).map((item) => item.text)], 8);
  const dimensions = Array.isArray(match.report?.dimensions) ? match.report.dimensions : [];
  const plans = dimensions.map((dimension) => {
    const query = text([parsed.jobTitle?.text, dimension.label, dimension.summary, ...dimension.jdEvidence, ...dimension.missingEvidence, ...skills].join(" ")).slice(0, 300);
    return {
      dimensionKey: dimension.key,
      request: {
        query: query || text([parsed.jobTitle?.text, ...skills].join(" ")).slice(0, 300), mode: searchMode, topK: 6, keywordLimit: 20, vectorLimit: 20, rrfK: 60, useReranker,
        // JD titles and skill sentences are search text, not exact catalogue metadata.
        filters: { documentType: reportDocumentTypes, language: ["zh-CN"] },
      },
    };
  });
  return plans.filter((plan) => plan.request.query);
}

export function createReportInputHash({ application, match, retrievalRunIds, promptVersion, generationConfigHash }) {
  return createHash("sha256").update(JSON.stringify({
    jobApplicationId: application.id, resumeId: match.resumeId, resumeVersionId: match.resumeVersionId, resumeVersion: match.resumeVersion, resumeContentHash: match.resumeContentHash,
    jobDescriptionId: match.jobDescriptionId, jobDescriptionParseResultId: match.jobDescriptionParseResultId, jobDescriptionRawTextHash: match.jobDescriptionRawTextHash, jobDescriptionNormalizedTextHash: application.jobDescriptionNormalizedTextHash,
    baseMatchAlgorithmVersion: match.algorithmVersion, promptVersion, generationConfigHash, retrievalRunIds,
  })).digest("hex");
}

export function reportGenerationConfigHash({ searchMode, useReranker, promptVersion }) {
  return createHash("sha256").update(JSON.stringify({ searchMode, useReranker, promptVersion, retrievalPlanVersion: "base-match-dimensions-v2", candidateLimit: 6 })).digest("hex");
}

export function buildCandidatePromptPayload(traces) {
  return traces.map((trace) => ({
    dimensionKey: trace.dimensionKey, retrievalRunId: trace.retrievalRunId,
    candidates: trace.candidates.map((candidate) => ({ chunkId: candidate.chunkId, documentId: candidate.documentId, processingVersion: candidate.processingVersion, title: candidate.documentTitle, headingPath: candidate.headingPath, content: candidate.content })),
  }));
}

export function allowedBaseEvidence(match) { return new Set(evidenceFromMatch(match)); }
export const normalizeBaseEvidence = text;
