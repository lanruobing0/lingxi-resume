import { createHash } from "node:crypto";

export const mockInterviewPromptVersion = "rag-mock-interview-v1";
export const mockInterviewFeedbackPromptVersion = "rag-mock-interview-feedback-v1";
export const interviewQuestionCategories = ["RESUME", "JD", "MATCH_GAP", "KNOWLEDGE"];
export const interviewDifficulties = ["EASY", "MEDIUM", "HARD"];

const text = (value) => String(value || "").replace(/[\r\n\t ]+/g, " ").trim();
const unique = (values, maximum = 40) => [...new Set(values.map(text).filter(Boolean))].slice(0, maximum);

export function interviewFailure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

export function interviewGenerationConfigHash(options = {}) {
  return createHash("sha256").update(JSON.stringify({
    promptVersion: mockInterviewPromptVersion,
    questionCount: options.questionCount,
    searchMode: options.searchMode,
    useReranker: options.useReranker,
    retrievalPlanVersion: "job-resume-gap-direction-v1",
  })).digest("hex");
}

export function interviewResumeFacts(aiResume) {
  const facts = [aiResume.title, aiResume.targetPosition, aiResume.currentPosition, aiResume.selfEvaluation];
  for (const section of aiResume.sections || []) {
    for (const entry of section.entries || []) {
      facts.push(entry.name, entry.role, ...(entry.highlights || []));
    }
  }
  return unique(facts);
}

function parsedFacts(parsed = {}) {
  return unique([
    parsed.jobTitle?.text,
    parsed.seniority?.text,
    ...(parsed.requiredSkills || []).flatMap((item) => [item.text, item.evidence]),
    ...(parsed.preferredSkills || []).flatMap((item) => [item.text, item.evidence]),
    ...(parsed.technicalKeywords || []).flatMap((item) => [item.text, item.evidence]),
    ...(parsed.responsibilities || []).flatMap((item) => [item.text, item.evidence]),
  ]);
}

function gapFacts(matchReport, match) {
  const content = matchReport.content || {};
  return unique([
    ...(content.gaps || []),
    ...(content.recommendations || []),
    ...(content.claims || []).filter((claim) => claim.claimType === "BASE_MATCH_FACT").map((claim) => claim.text),
    ...(match.report?.risks || []),
    ...(match.report?.prioritizedSuggestions || []),
    ...(match.report?.dimensions || []).flatMap((dimension) => dimension.missingEvidence || []),
  ]);
}

export function buildInterviewRetrievalRequest({ aiResume, parseResult, matchReport, match, searchMode, useReranker }) {
  const parsed = parseResult.parsedData || {};
  const direction = unique([
    parsed.jobTitle?.text,
    ...(parsed.requiredSkills || []).map((item) => item.text),
    ...interviewResumeFacts(aiResume).slice(0, 6),
    ...gapFacts(matchReport, match).slice(0, 6),
  ], 20).join(" ").slice(0, 300);
  return {
    query: direction || "岗位能力 模拟面试",
    mode: searchMode,
    topK: 8,
    keywordLimit: 24,
    vectorLimit: 24,
    rrfK: 60,
    useReranker,
    filters: {
      documentType: ["ROLE_SKILL_DESCRIPTION", "STAR_CASE", "INTERVIEW_RUBRIC", "RESUME_GUIDE", "OTHER"],
      language: ["zh-CN"],
    },
  };
}

export function buildInterviewSources({ aiResume, parseResult, matchReport, match, retrieval }) {
  const sources = [];
  const push = (sourceType, refId, quote, metadata = {}) => {
    const normalized = text(quote);
    if (!normalized || sources.some((item) => item.sourceType === sourceType && item.quote === normalized)) return;
    sources.push({ sourceId: `${sourceType}-${sources.filter((item) => item.sourceType === sourceType).length + 1}`, sourceType, refId: String(refId), quote: normalized.slice(0, 800), ...metadata });
  };
  interviewResumeFacts(aiResume).forEach((fact) => push("RESUME", `resume-version:${aiResume.resumeVersion}`, fact));
  parsedFacts(parseResult.parsedData).forEach((fact) => push("JD", `job-description:${parseResult.jobDescriptionId}`, fact));
  gapFacts(matchReport, match).forEach((fact) => push("MATCH_GAP", `match-report:${matchReport.id}`, fact));
  for (const item of retrieval?.results || []) {
    push("KNOWLEDGE", `knowledge-chunk:${item.chunkId}`, item.content, {
      retrievalRunId: retrieval.run.id,
      chunkId: item.chunkId,
      documentId: item.documentId,
      processingVersion: item.processingVersion,
      contentHash: item.contentHash,
      sourceTitle: item.documentTitle,
    });
  }
  return sources;
}

export const interviewQuestionsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array", minItems: 3, maxItems: 8,
      items: {
        type: "object", additionalProperties: false,
        required: ["question", "category", "difficulty", "rationale", "sourceIds", "expectedPoints"],
        properties: {
          question: { type: "string" },
          category: { type: "string", enum: interviewQuestionCategories },
          difficulty: { type: "string", enum: interviewDifficulties },
          rationale: { type: "string" },
          sourceIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 },
          expectedPoints: {
            type: "array", minItems: 1, maxItems: 8,
            items: {
              type: "object", additionalProperties: false, required: ["point", "sourceIds"],
              properties: { point: { type: "string" }, sourceIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 } },
            },
          },
        },
      },
    },
  },
};

export function buildInterviewQuestionPrompt({ aiResume, jobDescription, parseResult, matchReport, sources, questionCount }) {
  const publicSources = sources.map(({ sourceId, sourceType, quote, sourceTitle }) => ({ sourceId, sourceType, quote, sourceTitle: sourceTitle || "" }));
  return {
    system: [
      "你是严谨的中文招聘面试官。只根据提供的锁定简历、JD、匹配缺口和知识来源生成可追溯问题。",
      "绝对不能把 JD、知识资料、匹配缺口或模型推测写成候选人做过的事。候选人经历事实只能来自 RESUME 来源。",
      "每个问题和每个 expectedPoint 必须引用给定 sourceId；不得创造 sourceId、用户事实或知识事实。",
      "KNOWLEDGE 问题必须引用 KNOWLEDGE；RESUME/JD/MATCH_GAP 问题必须引用同类别来源。",
    ].join("\n"),
    user: JSON.stringify({
      task: `生成 ${questionCount} 道模拟面试题。至少覆盖 RESUME、JD、MATCH_GAP；存在 KNOWLEDGE 来源时也必须覆盖 KNOWLEDGE。`,
      lockedResume: aiResume,
      jobDescription: { id: jobDescription.id, title: jobDescription.title || "", parsed: parseResult.parsedData || {} },
      matchReport: { id: matchReport.id, gaps: matchReport.content?.gaps || [], recommendations: matchReport.content?.recommendations || [] },
      sources: publicSources,
    }),
  };
}

function nonEmpty(value, field) {
  const normalized = text(value);
  if (!normalized) throw interviewFailure(422, "INTERVIEW_INVALID_RESPONSE", `AI 返回字段 ${field} 为空`);
  return normalized;
}

function resolveSourceIds(sourceIds, sourceMap, field) {
  if (!Array.isArray(sourceIds) || !sourceIds.length) throw interviewFailure(422, "INTERVIEW_SOURCE_REQUIRED", `${field} 缺少来源`);
  const ids = [...new Set(sourceIds.map((item) => text(item)).filter(Boolean))];
  if (ids.some((id) => !sourceMap.has(id))) throw interviewFailure(422, "INTERVIEW_SOURCE_INVALID", `${field} 引用了未知来源`);
  return ids.map((id) => sourceMap.get(id));
}

const userFactAction = /(?:主导|负责|实现|完成|带领|提升|提高|降低|开发|设计|管理|优化|参与|创建|搭建|构建|推动|交付|达成|获得|担任|使用|落地|掌握|精通|熟悉|具备|拥有|做过|实践过)/;
const userFactSubject = /(?:我|本人|你|候选人|应聘者|求职者|用户|简历持有人)/;
const userFactPastOrCurrent = /(?:之前|此前|曾经|曾|已经|已|目前|当前|过|实践经验)/;
const hypotheticalUserQuestion = /(?:如果|假设|假如|设想|让你|你会|你将|会如何|将如何|准备如何|打算如何|可以如何|应该如何|会怎么|将怎么)/;
const factNumberToken = /\d+(?:\.\d+)?(?:%|％|年|个月|倍|ms|秒|次|项|万|k)?/gi;
const factTechnicalToken = /[a-z][a-z0-9+#.\-]*/gi;
const userFactScaffolding = /请|结合|说明|介绍|谈谈|回答|候选人|应聘者|求职者|用户|简历持有人|本人|我|你|简历|写明|提到|关于|相关|具体|经历|经验|事实|时|中|的|了|过/g;
const userFactGenericWords = new Set([
  "主导", "负责", "实现", "完成", "带领", "提升", "提高", "降低", "开发", "设计", "管理", "优化", "参与", "创建", "搭建", "构建", "推动", "交付", "达成", "获得", "担任", "使用", "落地", "掌握", "精通", "熟悉", "具备", "拥有", "做过", "实践", "说明", "介绍", "回答", "之前", "此前", "曾经", "已经", "目前", "当前", "相关", "具体", "经历", "经验", "简历", "写明", "提到", "候选人", "应聘者", "求职者", "用户", "本人",
]);
const chineseWordSegmenter = new Intl.Segmenter("zh-CN", { granularity: "word" });

function uniqueTokens(value, pattern) {
  return [...new Set((String(value || "").match(pattern) || []).map((item) => item.toLocaleLowerCase("en-US")))];
}

function factBigrams(value) {
  const compact = String(value || "").toLocaleLowerCase("en-US").replace(userFactScaffolding, "").replace(/[^\u4e00-\u9fff]/g, "");
  const output = [];
  for (let index = 0; index < compact.length - 1; index += 1) output.push(compact.slice(index, index + 2));
  return [...new Set(output)];
}

function chineseFactWords(value) {
  return [...chineseWordSegmenter.segment(String(value || ""))]
    .filter((item) => item.isWordLike && /[\u4e00-\u9fff]/.test(item.segment))
    .map((item) => item.segment)
    .filter((item) => item.length >= 2 && !userFactGenericWords.has(item));
}

function assertedUserFactClauses(value, { implicitUserVoice = false } = {}) {
  return String(value || "").split(/[，,；;。！？!?]+/).map((item) => item.trim()).filter((clause) => {
    if (!userFactAction.test(clause)) return false;
    const implicitAttribution = implicitUserVoice && !/^(?:建议|可以|可|应该|应当|如果|假设|假如)/.test(clause);
    const explicitAttribution = userFactSubject.test(clause) || userFactPastOrCurrent.test(clause) || implicitAttribution;
    if (!explicitAttribution) return false;
    if (hypotheticalUserQuestion.test(clause) && !userFactPastOrCurrent.test(clause)) return false;
    return true;
  });
}

export function validateUserFactGrounding(value, evidenceTexts, { failureCode = "INTERVIEW_FACT_BOUNDARY_VIOLATION", field = "内容", implicitUserVoice = false } = {}) {
  const evidence = unique((evidenceTexts || []).map((item) => text(item)));
  const normalizedEvidence = evidence.join("\n").toLocaleLowerCase("en-US");
  const evidenceBigrams = new Set(evidence.flatMap(factBigrams));
  const evidenceWords = new Set(evidence.flatMap(chineseFactWords));
  for (const clause of assertedUserFactClauses(value, { implicitUserVoice })) {
    const unsupportedNumber = uniqueTokens(clause, factNumberToken).find((item) => !normalizedEvidence.includes(item));
    const unsupportedEntity = uniqueTokens(clause, factTechnicalToken).find((item) => !normalizedEvidence.includes(item));
    const unsupportedChineseWord = chineseFactWords(clause).find((item) => !evidenceWords.has(item));
    const bigrams = factBigrams(clause);
    const supportedBigrams = bigrams.filter((item) => evidenceBigrams.has(item)).length;
    if (unsupportedNumber || unsupportedEntity || unsupportedChineseWord || (bigrams.length >= 2 && supportedBigrams / bigrams.length < 0.5) || (!bigrams.length && !uniqueTokens(clause, factTechnicalToken).length)) {
      throw interviewFailure(422, failureCode, `${field} 包含锁定 ResumeVersion 或当前回答未支持的用户经历事实`);
    }
  }
}

export function normalizeInterviewQuestions(data, sources, questionCount) {
  if (!data || !Array.isArray(data.questions) || data.questions.length !== questionCount) throw interviewFailure(422, "INTERVIEW_INVALID_RESPONSE", "AI 返回的面试题数量不正确");
  const sourceMap = new Map(sources.map((item) => [item.sourceId, item]));
  const questions = data.questions.map((item, index) => {
    const category = text(item?.category);
    const difficulty = text(item?.difficulty);
    if (!interviewQuestionCategories.includes(category) || !interviewDifficulties.includes(difficulty)) throw interviewFailure(422, "INTERVIEW_INVALID_RESPONSE", "AI 返回的问题分类或难度不合法");
    const sourceRefs = resolveSourceIds(item.sourceIds, sourceMap, `questions.${index}.sourceIds`);
    if (!sourceRefs.some((source) => source.sourceType === category)) throw interviewFailure(422, "INTERVIEW_FACT_BOUNDARY_VIOLATION", `${category} 问题没有绑定同类可信来源`);
    const resumeEvidence = sources.filter((source) => source.sourceType === "RESUME").map((source) => source.quote);
    validateUserFactGrounding(item.question, resumeEvidence, { field: `questions.${index}.question` });
    if (!Array.isArray(item.expectedPoints) || !item.expectedPoints.length) throw interviewFailure(422, "INTERVIEW_INVALID_RESPONSE", "面试题缺少 expectedPoints");
    const expectedPoints = item.expectedPoints.map((point, pointIndex) => {
      const pointText = nonEmpty(point?.point, `questions.${index}.expectedPoints.${pointIndex}.point`);
      validateUserFactGrounding(pointText, resumeEvidence, { field: `questions.${index}.expectedPoints.${pointIndex}.point` });
      return { point: pointText, sourceRefs: resolveSourceIds(point?.sourceIds, sourceMap, `questions.${index}.expectedPoints.${pointIndex}.sourceIds`) };
    });
    return { question: nonEmpty(item.question, `questions.${index}.question`), category, difficulty, rationale: nonEmpty(item.rationale, `questions.${index}.rationale`), sourceRefs, expectedPoints };
  });
  for (const required of ["RESUME", "JD", "MATCH_GAP"]) if (!questions.some((item) => item.category === required)) throw interviewFailure(422, "INTERVIEW_CATEGORY_MISSING", `AI 未生成 ${required} 类问题`);
  if (sources.some((item) => item.sourceType === "KNOWLEDGE") && questionCount >= 4 && !questions.some((item) => item.category === "KNOWLEDGE")) throw interviewFailure(422, "INTERVIEW_CATEGORY_MISSING", "AI 未生成 KNOWLEDGE 类问题");
  return questions;
}

export const answerFeedbackSchema = {
  type: "object", additionalProperties: false,
  required: ["score", "strengths", "weaknesses", "missingPoints", "improvedAnswer", "followUpQuestion"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    strengths: { type: "array", minItems: 1, maxItems: 6, items: { $ref: "#/$defs/groundedItem" } },
    weaknesses: { type: "array", minItems: 1, maxItems: 6, items: { $ref: "#/$defs/groundedItem" } },
    missingPoints: { type: "array", minItems: 1, maxItems: 8, items: { $ref: "#/$defs/groundedItem" } },
    improvedAnswer: { type: "string" },
    followUpQuestion: { type: "string" },
  },
  $defs: {
    groundedItem: { type: "object", additionalProperties: false, required: ["text", "sourceIds"], properties: { text: { type: "string" }, sourceIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 8 } } },
  },
};

export function buildAnswerFeedbackPrompt({ question, answerText }) {
  const sourceRows = [...question.sourceRefs.map(({ sourceId, sourceType, quote }) => ({ sourceId, sourceType, quote })), { sourceId: "USER_ANSWER", sourceType: "USER_ANSWER", quote: answerText }];
  return {
    sources: sourceRows,
    system: [
      "你是严谨的中文面试反馈教练。评分必须依据问题、候选人本次回答、expectedPoints 和给定证据。",
      "每条 strengths/weaknesses/missingPoints 必须引用给定 sourceId。知识性判断必须引用 KNOWLEDGE 来源。",
      "USER_ANSWER 只证明候选人在本次回答中说了什么，不能证明其简历经历真实；JD/MATCH_GAP/KNOWLEDGE 也不能证明候选人做过某事。",
      "improvedAnswer 是建议稿，不是候选人的真实经历，禁止声称未在锁定 RESUME 或 USER_ANSWER 出现的个人事实。",
    ].join("\n"),
    user: JSON.stringify({ question: question.question, category: question.category, difficulty: question.difficulty, expectedPoints: question.expectedPoints.map((item) => ({ point: item.point, sourceIds: item.sourceRefs.map((source) => source.sourceId) })), candidateAnswer: answerText, sources: sourceRows }),
  };
}

export function normalizeAnswerFeedback(data, allowedSources, { userFactEvidence = [] } = {}) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw interviewFailure(422, "FEEDBACK_INVALID_RESPONSE", "AI 反馈不是对象");
  const sourceMap = new Map(allowedSources.map((item) => [item.sourceId, item]));
  const normalizeItems = (items, field) => {
    if (!Array.isArray(items) || !items.length) throw interviewFailure(422, "FEEDBACK_INVALID_RESPONSE", `AI 反馈字段 ${field} 为空`);
    return items.slice(0, 8).map((item, index) => ({ text: nonEmpty(item?.text, `${field}.${index}.text`), sourceRefs: resolveSourceIds(item?.sourceIds, sourceMap, `${field}.${index}.sourceIds`) }));
  };
  const score = Number(data.score);
  if (!Number.isFinite(score)) throw interviewFailure(422, "FEEDBACK_INVALID_RESPONSE", "AI 反馈分数无效");
  const improvedAnswer = nonEmpty(data.improvedAnswer, "improvedAnswer");
  validateUserFactGrounding(improvedAnswer, userFactEvidence, { failureCode: "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT", field: "improvedAnswer", implicitUserVoice: true });
  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    strengths: normalizeItems(data.strengths, "strengths"),
    weaknesses: normalizeItems(data.weaknesses, "weaknesses"),
    missingPoints: normalizeItems(data.missingPoints, "missingPoints"),
    improvedAnswer,
    improvedAnswerIsSuggestion: true,
    followUpQuestion: nonEmpty(data.followUpQuestion, "followUpQuestion"),
  };
}
