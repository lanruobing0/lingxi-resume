export const ANALYSIS_DIMENSIONS = [
  { key: "completeness", label: "内容完整度", weight: 15 },
  { key: "relevance", label: "岗位相关性", weight: 25 },
  { key: "keywordCoverage", label: "关键词覆盖度", weight: 20 },
  { key: "experienceQuality", label: "项目与经历质量", weight: 20 },
  { key: "quantification", label: "成果量化程度", weight: 10 },
  { key: "readability", label: "表达规范与可读性", weight: 10 },
];

function requiredText(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`AI 返回字段 ${fieldName} 不能为空`);
  return text;
}

function normalizedScore(value, fieldName) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new Error(`AI 返回字段 ${fieldName} 不是有效分数`);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizedTextList(value, fieldName, maxItems) {
  if (!Array.isArray(value)) throw new Error(`AI 返回字段 ${fieldName} 不是数组`);
  const items = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (!items.length) throw new Error(`AI 返回字段 ${fieldName} 至少需要 1 项`);
  return items.slice(0, maxItems);
}

export function normalizeAnalysisDimensions(value) {
  if (!Array.isArray(value)) throw new Error("AI 返回字段 dimensions 不是数组");
  if (value.length !== ANALYSIS_DIMENSIONS.length) throw new Error(`AI 返回字段 dimensions 必须包含 ${ANALYSIS_DIMENSIONS.length} 项`);

  const inputByKey = new Map();
  for (const item of value) {
    const key = String(item?.key || "").trim();
    if (!ANALYSIS_DIMENSIONS.some((dimension) => dimension.key === key)) throw new Error(`AI 返回了未知诊断维度 ${key || "(空)"}`);
    if (inputByKey.has(key)) throw new Error(`AI 返回了重复诊断维度 ${key}`);
    inputByKey.set(key, item || {});
  }

  return ANALYSIS_DIMENSIONS.map((definition) => {
    const item = inputByKey.get(definition.key);
    if (!item) throw new Error(`AI 缺少诊断维度 ${definition.key}`);
    return {
      key: definition.key,
      label: definition.label,
      score: normalizedScore(item.score, `dimensions.${definition.key}.score`),
      weight: definition.weight,
      summary: requiredText(item.summary, `dimensions.${definition.key}.summary`),
      evidence: normalizedTextList(item.evidence, `dimensions.${definition.key}.evidence`, 4),
      suggestions: normalizedTextList(item.suggestions, `dimensions.${definition.key}.suggestions`, 3),
    };
  });
}

export function calculateAnalysisTotalScore(dimensions) {
  if (!Array.isArray(dimensions) || dimensions.length !== ANALYSIS_DIMENSIONS.length) {
    throw new Error("无法计算总分：诊断维度不完整");
  }

  const totalWeight = ANALYSIS_DIMENSIONS.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight !== 100) throw new Error("无法计算总分：诊断权重必须为 100");

  return Math.round(dimensions.reduce((sum, dimension) => sum + normalizedScore(dimension.score, `dimensions.${dimension.key}.score`) * Number(dimension.weight), 0) / totalWeight);
}
