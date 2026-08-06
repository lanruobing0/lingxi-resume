import { createHash } from "node:crypto";

export const retrievalModes = ["KEYWORD", "VECTOR", "HYBRID"];
export const retrievalEnums = {
  documentType: ["ROLE_SKILL_DESCRIPTION", "STAR_CASE", "INTERVIEW_RUBRIC", "RESUME_GUIDE", "OTHER"],
  seniority: ["实习", "初级", "中级", "高级", "专家", "不限"],
  language: ["zh-CN", "en", "mixed"],
};

export function normalizeQuery(value) {
  const normalizedQuery = String(value || "").replace(/\r\n?/g, "\n").replace(/[\t\n ]+/g, " ").trim().toLocaleLowerCase("en-US");
  if (!normalizedQuery) throw Object.assign(new Error("查询不能为空"), { code: "QUERY_REQUIRED", status: 400 });
  if (normalizedQuery.length > 300) throw Object.assign(new Error("查询长度不能超过300个字符"), { code: "QUERY_TOO_LONG", status: 400 });
  return { normalizedQuery, queryHash: createHash("sha256").update(normalizedQuery).digest("hex") };
}

export function parseRetrievalRequest(body = {}) {
  const { normalizedQuery, queryHash } = normalizeQuery(body.query);
  const mode = String(body.mode || "HYBRID").toUpperCase();
  if (!retrievalModes.includes(mode)) throw Object.assign(new Error("mode无效"), { code: "INVALID_MODE", status: 400 });
  const bounded = (value, fallback, min, max, field) => { const number = value === undefined ? fallback : Number(value); if (!Number.isInteger(number) || number < min || number > max) throw Object.assign(new Error(`${field}必须在${min}-${max}之间`), { code: "INVALID_RETRIEVAL_PARAMETER", status: 400 }); return number; };
  const scoreThreshold = body.scoreThreshold === undefined ? 0 : Number(body.scoreThreshold);
  if (!Number.isFinite(scoreThreshold) || scoreThreshold < -1 || scoreThreshold > 1) throw Object.assign(new Error("scoreThreshold必须是-1到1之间的有限数字"), { code: "INVALID_SCORE_THRESHOLD", status: 400 });
  if (body.useReranker !== undefined && typeof body.useReranker !== "boolean") throw Object.assign(new Error("useReranker必须为布尔值"), { code: "INVALID_RERANKER_FLAG", status: 400 });
  return { query: String(body.query || ""), normalizedQuery, queryHash, mode, topK: bounded(body.topK, 10, 1, 50, "topK"), keywordLimit: bounded(body.keywordLimit, 30, 1, 100, "keywordLimit"), vectorLimit: bounded(body.vectorLimit, 30, 1, 100, "vectorLimit"), rrfK: bounded(body.rrfK, 60, 20, 200, "rrfK"), scoreThreshold, useReranker: body.useReranker === true, filters: parseFilters(body.filters) };
}

export function parseFilters(raw = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Object.assign(new Error("filters无效"), { code: "INVALID_FILTERS", status: 400 });
  const list = (key, values) => { const value = raw[key] ?? []; if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim() || !values.includes(item))) throw Object.assign(new Error(`${key}包含无效值`), { code: "INVALID_FILTERS", status: 400 }); return [...new Set(value)]; };
  const documentIds = raw.documentIds ?? [];
  if (!Array.isArray(documentIds) || documentIds.some((id) => !Number.isInteger(id) || id <= 0)) throw Object.assign(new Error("documentIds必须是正整数数组"), { code: "INVALID_FILTERS", status: 400 });
  const skillTags = raw.skillTags ?? [];
  if (!Array.isArray(skillTags) || skillTags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 80)) throw Object.assign(new Error("skillTags无效"), { code: "INVALID_FILTERS", status: 400 });
  return { documentType: list("documentType", retrievalEnums.documentType), jobFamily: stringList("jobFamily"), seniority: list("seniority", retrievalEnums.seniority), skillTags: [...new Set(skillTags.map((tag) => tag.trim()))], language: list("language", retrievalEnums.language), documentIds: [...new Set(documentIds)] };
  function stringList(key) { const value = raw[key] ?? []; if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim() || item.length > 80)) throw Object.assign(new Error(`${key}无效`), { code: "INVALID_FILTERS", status: 400 }); return [...new Set(value.map((item) => item.trim()))]; }
}

export function documentMatchesFilters(document, filters) {
  const any = (values, value) => !values.length || values.includes(value || "");
  return any(filters.documentType, document.documentType) && any(filters.jobFamily, document.jobFamily) && any(filters.seniority, document.seniority) && any(filters.language, document.language) && (!filters.documentIds.length || filters.documentIds.includes(document.id)) && (!filters.skillTags.length || (document.skillTags || []).some((tag) => filters.skillTags.includes(tag)));
}

export function queryTokens(query) { return [...new Set((query.match(/[a-z][a-z0-9+#.\-]*/gi) || []).map((token) => token.toLowerCase()).concat([...query.matchAll(/[\u4e00-\u9fff]{2,}/g)].map((match) => match[0])) )]; }
