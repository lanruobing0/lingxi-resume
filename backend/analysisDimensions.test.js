import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_DIMENSIONS, calculateAnalysisTotalScore, normalizeAnalysisDimensions } from "./analysisDimensions.js";

function dimensionPayload(scores) {
  return ANALYSIS_DIMENSIONS.map((dimension, index) => ({
    key: dimension.key,
    label: dimension.label,
    score: scores[index],
    weight: dimension.weight,
    summary: `${dimension.label}测试结论`,
    evidence: [`${dimension.label}证据`],
    suggestions: [`${dimension.label}改进建议`],
  }));
}

test("总分由固定权重重新计算", () => {
  const dimensions = normalizeAnalysisDimensions(dimensionPayload([80, 90, 70, 85, 40, 95]));
  assert.equal(calculateAnalysisTotalScore(dimensions), 79);
});

test("不同维度结果得到不同的加权总分", () => {
  const blankResumeDimensions = normalizeAnalysisDimensions(dimensionPayload([28, 18, 12, 15, 0, 62]));
  const detailedResumeDimensions = normalizeAnalysisDimensions(dimensionPayload([92, 88, 85, 90, 78, 94]));
  assert.ok(calculateAnalysisTotalScore(blankResumeDimensions) < calculateAnalysisTotalScore(detailedResumeDimensions));
});

test("缺少证据或维度时拒绝不完整的 AI 返回", () => {
  const missingEvidence = dimensionPayload([80, 80, 80, 80, 80, 80]);
  missingEvidence[0].evidence = [];
  assert.throws(() => normalizeAnalysisDimensions(missingEvidence), /evidence/);

  const missingDimension = dimensionPayload([80, 80, 80, 80, 80, 80]).slice(0, 5);
  assert.throws(() => normalizeAnalysisDimensions(missingDimension), /dimensions/);
});
