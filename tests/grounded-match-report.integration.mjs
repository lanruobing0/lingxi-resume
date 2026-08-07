import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { createEmbeddingProfile } from "../backend/embedding-provider.js";
import { claimSupportVersion, validateClaimSupport } from "../backend/claim-support-validator.js";
import { createReportInputHash, reportGenerationConfigHash } from "../backend/grounded-report-service.js";
import { groundedReportPromptVersion } from "../backend/grounded-report-prompt.js";

const root = path.resolve(import.meta.dirname, "..");
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchWithTimeout = (url, options = {}, timeoutMs = 10000) => fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

function dto() {
  const value = { id: 1, userId: 1, resumeVersion: 1, title: "Java 工程师", targetPosition: "研发", targetPositionId: null, basicInfo: { realName: "PRIVATE-NAME", currentPosition: "Java 工程师", email: "private@example.com", phone: "13800138000", city: "杭州", website: "https://private.example", profileFields: [] }, selfEvaluation: "Java 服务开发", sections: [{ key: "skills", label: "专业技能", entries: [{ id: "skill-1", name: "", role: "", startDate: "", endDate: "", isCurrent: false, highlights: ["Java 性能优化"] }] }] };
  return { ...value, contentHash: sha(JSON.stringify(value)) };
}
function baseMatch(snapshot, jdHash) {
  const dimensions = ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"].map((key) => ({ key, label: key, score: 80, weight: 0, weightedScore: 0, summary: "Java 匹配事实", resumeEvidence: ["Java"], jdEvidence: ["Java"], missingEvidence: [], suggestions: [] }));
  return { id: 1, userId: 1, jobApplicationId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: snapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, algorithmVersion: "base-match-v1", status: "COMPLETED", report: { summary: "Java 匹配事实", dimensions, strongestResumeEvidence: ["Java"], risks: [], prioritizedSuggestions: ["建议补充项目成果"] } };
}
function reportPayload(mode, runId = 1) {
  const citations = [{ retrievalRunId: runId, chunkId: 1, documentId: 1, processingVersion: 1, quote: "Java 性能优化应基于可验证的项目结果" }];
  if (mode === "badChunk") citations[0].chunkId = 999;
  if (mode === "otherRun") citations[0].retrievalRunId = 999;
  if (mode === "badQuote") citations[0].quote = "FORGED-QDRANT-PAYLOAD";
  if (mode === "oldVersion") citations[0].processingVersion = 99;
  if (mode === "otherDocumentChunk") Object.assign(citations[0], { chunkId: 2, documentId: 2, quote: "其他正文" });
  if (mode === "previousReportRun") citations[0].retrievalRunId = 1;
  if (mode === "duplicate") citations.push({ ...citations[0] });
  if (["parallelHttp", "parallelHttpShared", "parallelHttpAnd"].includes(mode)) citations.splice(0, citations.length, { retrievalRunId: runId, chunkId: 3, documentId: 3, processingVersion: 1, quote: "性能优化应展示吞吐量指标。" }, { retrievalRunId: runId, chunkId: 4, documentId: 3, processingVersion: 1, quote: "同时应展示响应延迟变化。" });
  const claimType = mode === "badEnum" ? "NOT_A_CLAIM" : "KNOWLEDGE_CLAIM";
  const claims = mode === "empty" ? [] : [
    { claimId: "base-1", sectionKey: "executive", text: "基础匹配显示 Java 证据已出现。", claimType: "BASE_MATCH_FACT", citations: [], baseEvidence: ["Java 匹配事实"] },
    { claimId: "knowledge-1", sectionKey: "required_skills", text: "知识资料建议用可验证项目结果呈现 Java 性能优化。", claimType, citations: mode === "noCitation" ? [] : citations, baseEvidence: [] },
    { claimId: "suggestion-1", sectionKey: "recommendations", text: "建议：补充 Java 性能优化的量化项目成果。", claimType: "MODEL_SUGGESTION", citations: [], baseEvidence: [] },
  ];
  if (mode === "partial") claims.push({ claimId: "knowledge-bad", sectionKey: "required_skills", text: "错误引用。", claimType: "KNOWLEDGE_CLAIM", citations: [{ ...citations[0], quote: "FORGED-QDRANT-PAYLOAD" }], baseEvidence: [] });
  if (mode === "semanticUser") claims[1].text = "用户已经精通 Java 性能优化，并取得了显著成果。";
  if (mode === "semanticNumber") claims[1].text = "知识资料建议将系统性能提升 50%。";
  if (mode === "semanticEntity") claims[1].text = "知识资料涉及 Redis、Kafka 和 Kubernetes。";
  if (mode === "semanticPolarity") claims[1].text = "掌握基础语法即可证明具备生产环境能力。";
  if (mode === "semanticTail") claims[1].text = "Java 性能优化应基于可验证的项目结果，同时也能支撑高并发架构能力。";
  if (mode === "parallelHttp") claims[1].text = "知识资料建议通过吞吐量和响应延迟共同说明性能优化效果。";
  if (mode === "parallelHttpShared") claims[1].text = "知识资料建议共同展示吞吐量和响应延迟。";
  if (mode === "parallelHttpAnd") claims[1].text = "知识资料建议并展示吞吐量和响应延迟。";
  if (mode === "semanticCommaAttribution") claims[1].text = "知识资料指出，他负责核心模块。";
  if (mode === "onlyInvalid") return { executiveSummary: "无支持报告。", dimensionReports: ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"].map((key) => ({ key, summary: "无支持" })), strengths: [], gaps: [], recommendations: [], claims: [{ claimId: "unsupported-only", sectionKey: "required_skills", text: "用户已经精通 Java 性能优化。", claimType: "KNOWLEDGE_CLAIM", citations, baseEvidence: [] }] };
  if (mode === "noKnowledge") return { executiveSummary: "只使用基础匹配事实。", dimensionReports: ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"].map((key) => ({ key, summary: "基础事实" })), strengths: ["Java"], gaps: [], recommendations: ["建议补充成果"], claims: [claims[0], claims.at(-1)] };
  return { executiveSummary: "Java 岗位匹配报告。", dimensionReports: ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"].map((key) => ({ key, summary: "匹配说明" })), strengths: ["Java"], gaps: [], recommendations: ["建议补充成果"], claims };
}

function supportScenario(name, claimText, quotes, expectedCode = "", expectedMetrics = {}) {
  const result = validateClaimSupport({ claimText, localQuotes: quotes });
  assert.equal(result.supported, !expectedCode, name);
  assert.equal(result.claimSupportVersion, claimSupportVersion, name);
  assert.equal(result.supportFailureCode, expectedCode, name);
  for (const [key, value] of Object.entries(expectedMetrics)) assert.deepEqual(result.supportMetrics[key], value, `${name}: supportMetrics.${key}`);
}

function runClaimSupportAttackTests() {
  const highOverlapAttributionCases = [
    ["candidate person", "候选人显著提高了系统性能"], ["candidate", "候选者显著提高了系统性能"], ["this candidate", "该候选者显著提高了系统性能"],
    ["resume holder", "简历持有人拥有丰富经验"], ["resume author", "简历作者拥有丰富经验"],
    ["applicant", "应聘者负责的系统核心模块稳定运行"], ["this applicant", "该应聘者负责的系统核心模块稳定运行"],
    ["job seeker", "求职者拥有丰富经验"], ["applicant alias", "申请人拥有丰富经验"],
    ["self", "本人拥有丰富经验"], ["resume display", "用户简历展示的系统性能结果显著"],
    ["resume proof", "用户简历证明的系统性能结果显著"], ["self pronoun", "其本人拥有丰富经验"],
    ["male pronoun", "他拥有丰富经验"], ["female pronoun", "她拥有丰富经验"],
  ];
  for (const [name, claim] of highOverlapAttributionCases) supportScenario(`high-overlap user attribution: ${name}`, claim, [claim.replace(/候选人|候选者|该候选者|简历持有人|简历作者|应聘者|该应聘者|求职者|申请人|用户简历展示的|用户简历证明的|其本人|本人|他|她/g, "")], "UNSUPPORTED_USER_ATTRIBUTION");
  supportScenario("same-keyword user attribution", "用户已经精通 Java 性能优化，并取得了显著成果。", ["Java 性能优化应基于可验证的项目结果。"], "UNSUPPORTED_USER_ATTRIBUTION");
  supportScenario("advice upgraded to fact", "接口吞吐量和响应速度已经显著提升。", ["建议展示接口吞吐量和响应延迟。"], "POLARITY_MISMATCH");
  supportScenario("invented percentage", "知识资料建议将系统性能提升 50%。", ["项目描述应包含可量化结果。"], "UNSUPPORTED_NUMBER");
  supportScenario("invented years", "知识资料指出需要 5 年 Java 开发经验。", ["高级岗位通常要求较丰富的工程经验。"], "UNSUPPORTED_NUMBER");
  supportScenario("invented entities", "知识资料涉及 Redis、Kafka 和 Kubernetes。", ["后端岗位需要关注高并发处理能力。"], "UNSUPPORTED_ENTITY");
  supportScenario("polarity mismatch", "掌握基础语法即可证明具备生产环境能力。", ["仅掌握基础语法不足以证明具备生产环境能力。"], "POLARITY_MISMATCH");
  for (const [name, quote, claim] of [
    ["not support becomes support", "系统不支持 Java。", "系统支持 Java。"], ["not yet becomes support", "系统未支持 Java。", "系统支持 Java。"],
    ["non-Java becomes Java support", "系统非 Java 支持。", "系统支持 Java。"], ["no support becomes support", "系统无 Java 支持。", "系统支持 Java。"],
    ["cannot support becomes support", "系统不能支持 Java。", "系统支持 Java。"], ["insufficient proof becomes sufficient", "现有证据不足以证明系统支持 Java。", "现有证据充分证明系统支持 Java。"],
    ["not reached becomes reached", "系统未达到 Java 支持标准。", "系统达到 Java 支持标准。"],
  ]) supportScenario(`negation reversal: ${name}`, claim, [quote], "POLARITY_MISMATCH");
  for (const [name, quote, claim] of [
    ["suggestion", "建议展示 Java 性能优化结果。", "Java 性能优化已完成。"], ["should", "应展示 Java 性能优化结果。", "Java 性能优化已实现。"], ["should formal", "应当展示 Java 性能优化结果。", "Java 性能优化已实现。"],
    ["can consider", "可考虑展示 Java 性能优化结果。", "Java 性能优化已具备。"], ["can", "可展示 Java 性能优化结果。", "Java 性能优化必然提升。"], ["can explicit", "可以展示 Java 性能优化结果。", "Java 性能优化必然提升。"],
    ["possible", "可能有助于展示 Java 性能优化结果。", "Java 性能优化必然提升。"], ["helpful", "有助于展示 Java 性能优化结果。", "Java 性能优化已解决。"],
    ["usually needed", "通常需要展示 Java 性能优化结果。", "Java 性能优化已满足。"], ["attention", "需注意 Java 性能优化结果。", "Java 性能优化已完成。"],
  ]) supportScenario(`modal escalation: ${name}`, claim, [quote], "POLARITY_MISMATCH");
  supportScenario("copied quote with unsupported architectural tail", "Java 性能优化基于可验证的项目结果，同时也能支撑高并发架构能力。", ["Java 性能优化基于可验证的项目结果。"], "UNSUPPORTED_CLAIM_EXTENSION");
  supportScenario("copied quote with unsupported effectiveness tail", "Java 性能优化基于可验证的项目结果，这种方法效果显著。", ["Java 性能优化基于可验证的项目结果。"], "UNSUPPORTED_CLAIM_EXTENSION");
  for (const [name, claim] of [["therefore", "Redis 用于缓存，因此性能提升了 50%。"], ["thereby", "Redis 用于缓存，从而性能提升了 50%。"], ["causes", "Redis 用于缓存，导致性能提升了 50%。"], ["explains", "Redis 用于缓存，说明性能提升了 50%。"], ["implements", "Redis 用于缓存，实现了 50% 的性能提升。"], ["brings", "Redis 用于缓存，带来了 50% 的性能提升。"], ["no connector", "Redis 用于缓存，性能提升了 50%。"]]) supportScenario(`Redis result stitching: ${name}`, claim, ["Redis 可用于缓存。", "部分案例展示了 50% 的性能提升。"], "UNSUPPORTED_CROSS_CITATION_INFERENCE", { citationCount: 2 });
  supportScenario("explicit male pronoun attribution", "他已经拥有丰富经验。", ["拥有丰富经验。"], "UNSUPPORTED_USER_ATTRIBUTION");
  for (const [name, claim] of [["comma male", "知识资料指出，他负责核心模块。"], ["comma female", "知识资料显示，她掌握 Java。"], ["comma self", "根据材料，其本人拥有丰富经验。"], ["comma candidate", "一般而言，候选人已经满足岗位要求。"]]) supportScenario(`punctuated attribution: ${name}`, claim, ["负责核心模块、掌握 Java、拥有丰富经验、满足岗位要求。"], "UNSUPPORTED_USER_ATTRIBUTION");
  supportScenario("generic other metric claim", "知识资料建议同时展示其他关键指标。", ["知识资料建议同时展示其他关键指标。"], "", { citationCount: 1 });
  supportScenario("generic other aspect claim", "知识资料还建议关注其他方面的能力。", ["知识资料还建议关注其他方面的能力。"], "", { citationCount: 1 });
  supportScenario("generic other supplement claim", "其他指标也可以作为补充。", ["其他指标也可以作为补充。"], "", { citationCount: 1 });
  supportScenario("generic any-role claim", "任何岗位都应重视可验证结果。", ["任何岗位都应重视可验证结果。"], "", { citationCount: 1 });
  supportScenario("generic other-tool claim", "其他工具可以作为替代方案。", ["其他工具可以作为替代方案。"], "", { citationCount: 1 });
  supportScenario("valid direct support", "知识资料建议使用可验证的项目结果呈现 Java 性能优化能力。", ["Java 性能优化应基于可验证的项目结果。"]);
  supportScenario("acceptance parallel citations jointly support", "知识资料建议通过吞吐量和响应延迟共同说明性能优化效果。", ["性能优化应展示吞吐量指标。", "同时应展示响应延迟变化。"], "", { citationCount: 2, parallelSupported: true });
  supportScenario("shared parallel citations jointly support", "知识资料建议共同展示吞吐量和响应延迟。", ["性能优化应展示吞吐量指标。", "同时应展示响应延迟变化。"], "", { citationCount: 2, parallelSupported: true });
  supportScenario("and parallel citations jointly support", "知识资料建议并展示吞吐量和响应延迟。", ["性能优化应展示吞吐量指标。", "同时应展示响应延迟变化。"], "", { citationCount: 2, parallelSupported: true });
}

async function main() {
  const state = { mode: "valid", vectorDown: false, providerBodies: [], qdrantBodies: [], backendOutput: [] };
  const provider = createServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part; state.providerBodies.push(body);
    if (state.mode === "provider503") return res.writeHead(503).end("{}");
    if (state.mode === "timeout") { await wait(250); return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ output_text: JSON.stringify(reportPayload("valid")) })); }
    if (state.mode === "invalidJson") return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ output_text: "not-json" }));
    const request = JSON.parse(body); const prompt = request.input?.[1]?.content?.[0]?.text || request.messages?.[1]?.content || ""; const match = prompt.match(/"retrievalRunId":(\d+)/); const output = reportPayload(state.mode, Number(match?.[1] || 1));
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ output_text: JSON.stringify(output) }));
  });
  const embedding = createServer(async (_req, res) => res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ data: [{ embedding: [1, 0, 0, 0] }] })));
  const qdrant = createServer(async (req, res) => {
    let body = ""; for await (const part of req) body += part; state.qdrantBodies.push(body);
    if (req.url === "/healthz") return res.end("{}");
    if (state.vectorDown) return res.writeHead(503).end("{}");
    const result = ["parallelHttp", "parallelHttpShared", "parallelHttpAnd"].includes(state.mode)
      ? [{ id: "point-2", score: 0.9, payload: { chunkId: 3, documentId: 3, indexRunId: 13, rawText: "FORGED-QDRANT-PAYLOAD" } }, { id: "point-3", score: 0.8, payload: { chunkId: 4, documentId: 3, indexRunId: 13, rawText: "FORGED-QDRANT-PAYLOAD" } }]
      : [{ id: "point-1", score: 0.9, payload: { chunkId: 1, documentId: 1, indexRunId: 11, rawText: "FORGED-QDRANT-PAYLOAD" } }];
    return res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ result }));
  });
  const reranker = createServer(async (_req, res) => res.writeHead(503).end("{}"));
  const providerPort = await listen(provider), embeddingPort = await listen(embedding), qdrantPort = await listen(qdrant), rerankerPort = await listen(reranker);
  const token = randomBytes(20).toString("hex"), otherToken = randomBytes(20).toString("hex");
  const snapshot = dto(), jdRaw = "研发岗位需要 Java，要求中级经验。", jdHash = sha(jdRaw), normalizedHash = sha(jdRaw);
  const snapshotB = dto(); snapshotB.id = 2; snapshotB.title = "第二份 Java 简历"; snapshotB.basicInfo = { ...snapshotB.basicInfo, currentPosition: "Java 平台工程师" }; delete snapshotB.contentHash; snapshotB.contentHash = sha(JSON.stringify(snapshotB));
  const jdRawB = "另一份研发 JD 需要 Java 和工程经验。", jdHashB = sha(jdRawB);
  const profile = createEmbeddingProfile({ baseUrl: `http://127.0.0.1:${embeddingPort}/v1`, apiKey: "embedding-SECRET", model: "mock", dimension: 4 });
  const dir = await mkdtemp(path.join(tmpdir(), "lingxi-grounded-report-")); const probe = createServer(); const apiPort = await listen(probe); probe.close();
  const mismatchedApplicationMatch = { ...baseMatch(snapshot, jdHash), id: 2, jobApplicationId: 2 };
  const store = { users: [{ id: 1, username: "report-user", passwordHash: "x", role: "USER", status: 1 }, { id: 2, username: "other", passwordHash: "x", role: "USER", status: 1 }], sessions: [{ id: 1, userId: 1, tokenHash: hash(token), expiresAt: new Date(Date.now() + 60000).toISOString() }, { id: 2, userId: 2, tokenHash: hash(otherToken), expiresAt: new Date(Date.now() + 60000).toISOString() }], resumes: [{ ...snapshot, version: 1 }], resumeHistories: [{ id: 1, resumeId: 1, resumeVersion: 1, version: 1, contentHash: snapshot.contentHash, snapshot }], jobDescriptions: [{ id: 1, userId: 1, title: "研发", rawText: jdRaw, rawTextHash: jdHash, normalizedText: jdRaw, normalizedTextHash: normalizedHash, currentParseResultId: 1, parseStatus: "SUCCEEDED" }], jobDescriptionParseResults: [{ id: 1, userId: 1, jobDescriptionId: 1, status: "SUCCEEDED", rawTextHash: jdHash, parsedData: { jobTitle: { text: "研发", evidence: "Java" }, seniority: { text: "中级", evidence: "Java" }, requiredSkills: [{ text: "Java", evidence: "Java" }], preferredSkills: [], technicalKeywords: [{ text: "Java", evidence: "Java" }] } }], jobApplications: [{ id: 1, userId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: snapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, jobDescriptionNormalizedTextHash: normalizedHash }], resumeJobMatches: [baseMatch(snapshot, jdHash), mismatchedApplicationMatch], matchReports: [], knowledgeDocuments: [{ id: 1, title: "Java 参考", status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: 11, documentType: "ROLE_SKILL_DESCRIPTION", jobFamily: "研发", seniority: "中级", skillTags: ["Java"], language: "zh-CN" }, { id: 2, title: "其他资料", status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: 12, documentType: "ROLE_SKILL_DESCRIPTION", jobFamily: "研发", seniority: "中级", skillTags: ["Java"], language: "zh-CN" }], knowledgeChunks: [{ id: 1, documentId: 1, processingVersion: 1, content: "Java 性能优化应基于可验证的项目结果。", contentHash: sha("Java 性能优化应基于可验证的项目结果。"), headingPath: [] }, { id: 2, documentId: 2, processingVersion: 1, content: "其他正文", contentHash: sha("其他正文"), headingPath: [] }], knowledgeVectorRecords: [{ id: 1, pointId: "point-1", chunkId: 1, documentId: 1, processingVersion: 1, indexRunId: 11, embeddingProfileId: profile.profileId, status: "ACTIVE" }], knowledgeRetrievalRuns: [], aiSettingsByUser: { "1": { aiConfig: { provider: "OpenAI" }, aiProviderConfigs: { OpenAI: { baseUrl: `http://127.0.0.1:${providerPort}/v1`, modelId: "mock-report", apiKey: "provider-SECRET", enabled: true } } } } };
  store.knowledgeDocuments.push({ id: 3, title: "性能指标", status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: 13, documentType: "ROLE_SKILL_DESCRIPTION", jobFamily: "研发", seniority: "中级", skillTags: ["Java", "性能"], language: "zh-CN" });
  store.knowledgeChunks.push({ id: 3, documentId: 3, processingVersion: 1, content: "性能优化应展示吞吐量指标。", contentHash: sha("性能优化应展示吞吐量指标。"), headingPath: [] }, { id: 4, documentId: 3, processingVersion: 1, content: "同时应展示响应延迟变化。", contentHash: sha("同时应展示响应延迟变化。"), headingPath: [] });
  store.knowledgeVectorRecords.push({ id: 2, pointId: "point-2", chunkId: 3, documentId: 3, processingVersion: 1, indexRunId: 13, embeddingProfileId: profile.profileId, status: "ACTIVE" }, { id: 3, pointId: "point-3", chunkId: 4, documentId: 3, processingVersion: 1, indexRunId: 13, embeddingProfileId: profile.profileId, status: "ACTIVE" });
  const parsedB = { jobTitle: { text: "研发", evidence: "Java" }, seniority: { text: "中级", evidence: "Java" }, requiredSkills: [{ text: "Java", evidence: "Java" }], preferredSkills: [], technicalKeywords: [{ text: "Java", evidence: "Java" }] };
  const applicationB = { id: 2, userId: 1, resumeId: 2, resumeVersionId: 2, resumeVersion: 1, resumeContentHash: snapshotB.contentHash, jobDescriptionId: 2, jobDescriptionParseResultId: 2, jobDescriptionRawTextHash: jdHashB, jobDescriptionNormalizedTextHash: jdHashB };
  const matchB = { ...baseMatch(snapshotB, jdHashB), id: 3, jobApplicationId: 2, resumeId: 2, resumeVersionId: 2, resumeContentHash: snapshotB.contentHash, jobDescriptionId: 2, jobDescriptionParseResultId: 2, jobDescriptionRawTextHash: jdHashB };
  store.resumes.push({ ...snapshotB, version: 1 }); store.resumeHistories.push({ id: 2, resumeId: 2, resumeVersion: 1, version: 1, contentHash: snapshotB.contentHash, snapshot: snapshotB }); store.jobDescriptions.push({ id: 2, userId: 1, title: "研发", rawText: jdRawB, rawTextHash: jdHashB, normalizedText: jdRawB, normalizedTextHash: jdHashB, currentParseResultId: 2, parseStatus: "SUCCEEDED" }); store.jobDescriptionParseResults.push({ id: 2, userId: 1, jobDescriptionId: 2, status: "SUCCEEDED", rawTextHash: jdHashB, parsedData: parsedB }); store.jobApplications.push(applicationB); store.resumeJobMatches.push(matchB);
  await writeFile(path.join(dir, "store.json"), JSON.stringify(store));
  let backend;
  const start = () => { backend = spawn(process.execPath, ["backend/server.js"], { cwd: root, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dir, OPENAI_API_KEY: "", OPENAI_BASE_URL: "", OPENAI_MODEL: "", EMBEDDING_BASE_URL: `http://127.0.0.1:${embeddingPort}/v1`, EMBEDDING_API_KEY: "embedding-SECRET", EMBEDDING_MODEL: "mock", EMBEDDING_DIMENSION: "4", QDRANT_URL: `http://127.0.0.1:${qdrantPort}`, QDRANT_API_KEY: "qdrant-SECRET", RERANKER_ENABLED: "true", RERANKER_BASE_URL: `http://127.0.0.1:${rerankerPort}`, RERANKER_API_KEY: "reranker-SECRET", RERANKER_MODEL: "mock", AI_PROVIDER_TIMEOUT_MS: "100" }, stdio: ["ignore", "pipe", "pipe"] }); backend.stdout.on("data", (part) => state.backendOutput.push(String(part))); backend.stderr.on("data", (part) => state.backendOutput.push(String(part))); };
  const waitForBackendHealthy = async (timeoutMs = 3000) => { const deadline = Date.now() + timeoutMs; let lastFailure = "no response"; while (Date.now() < deadline) { try { const response = await fetchWithTimeout(`http://127.0.0.1:${apiPort}/api/health`, {}, 500); if (response.ok) return; lastFailure = `HTTP ${response.status}`; } catch (error) { lastFailure = error instanceof Error ? error.message : String(error); } await wait(25); } throw new Error(`Backend health check timed out after ${timeoutMs}ms (${lastFailure}). Recent backend output: ${state.backendOutput.join("").slice(-1200)}`); };
  const stop = async () => { if (!backend?.pid || backend.exitCode !== null) return; const backendPid = backend.pid; backend.kill("SIGKILL"); const deadline = Date.now() + 3000; while (Date.now() < deadline) { try { process.kill(backendPid, 0); } catch (error) { if (error?.code === "ESRCH") return; throw error; } await wait(25); } throw new Error(`Backend pid ${backendPid} did not exit within 3000ms after SIGKILL`); };
  const call = async (tokenValue, pathName, body, expected) => { const response = await fetchWithTimeout(`http://127.0.0.1:${apiPort}${pathName}`, { method: body === undefined ? "GET" : "POST", headers: { Cookie: `lingxi_session=${tokenValue}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }, 15000); const data = await response.json(); if (expected !== undefined) assert.equal(response.status, expected, JSON.stringify(data)); return { status: response.status, data }; };
  try {
    runClaimSupportAttackTests();
    start(); await waitForBackendHealthy();
    let result = await call(token, "/api/job-applications/1/reports", { matchId: 1, searchMode: "HYBRID", useReranker: false }, 201);
    assert.equal(result.data.item.status, "COMPLETED"); assert.equal(result.data.item.content.claims.some((claim) => claim.claimType === "KNOWLEDGE_CLAIM"), true); assert.equal(result.data.item.retrievalRunIds.length, 6); const firstKnowledgeCitation = result.data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM").citations[0]; assert.equal(firstKnowledgeCitation.availability, "AVAILABLE"); assert.equal(firstKnowledgeCitation.documentType, "ROLE_SKILL_DESCRIPTION"); assert.equal(firstKnowledgeCitation.jobFamily, "研发"); assert.deepEqual(firstKnowledgeCitation.skillTags, ["Java"]); assert.equal(JSON.stringify(firstKnowledgeCitation).match(/qdrant|vector|SECRET/i) !== null, false, "citation view data must stay local and non-sensitive"); assert.equal(result.data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM").supportStatus, "SUPPORTED"); assert.equal(result.data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM").claimSupportVersion, claimSupportVersion); assert.equal(result.data.item.promptVersion, groundedReportPromptVersion); assert.equal(result.data.item.provider, "OpenAI"); assert.equal(result.data.item.model, "mock-report"); assert.equal(result.data.item.generationConfigHash, reportGenerationConfigHash({ searchMode: "HYBRID", useReranker: false, promptVersion: groundedReportPromptVersion })); assert.equal(result.data.item.inputHash, createReportInputHash({ application: store.jobApplications[0], match: store.resumeJobMatches[0], retrievalRunIds: result.data.item.retrievalRunIds, promptVersion: groundedReportPromptVersion, generationConfigHash: result.data.item.generationConfigHash }));
    const reportId = result.data.item.id;
    const reportHistory = await call(token, "/api/job-applications/1/reports", undefined, 200);
    assert.equal(reportHistory.data.items.length, 1, "report history must expose the generated report for its application");
    assert.equal(reportHistory.data.items[0].id, reportId);
    assert.equal(reportHistory.data.items[0].reportVersion, 1);
    assert.equal(reportHistory.data.items[0].status, "COMPLETED");
    assert.equal(reportHistory.data.items[0].model, "mock-report");
    assert.equal(reportHistory.data.items[0].evidenceCoverage.ratio, 1);
    assert.equal(Object.hasOwn(reportHistory.data.items[0], "content"), false, "history must remain a summary and never expose report bodies or retrieval internals");
    assert.equal(JSON.stringify(reportHistory.data.items).match(/provider-SECRET|qdrant-SECRET|FORGED-QDRANT-PAYLOAD|vector/i) !== null, false, "history must not expose secrets, vectors, or Qdrant payloads");
    assert.equal((await call(otherToken, "/api/job-applications/1/reports", undefined, 404)).status, 404, "cross-user report history must not be accessible");
    for (const [mode, text] of [["parallelHttp", "知识资料建议通过吞吐量和响应延迟共同说明性能优化效果。"], ["parallelHttpShared", "知识资料建议共同展示吞吐量和响应延迟。"], ["parallelHttpAnd", "知识资料建议并展示吞吐量和响应延迟。"]]) { state.mode = mode; result = await call(token, "/api/job-applications/1/reports", { matchId: 1, searchMode: "VECTOR" }, 201); const parallelClaim = result.data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM"); assert.equal(result.data.item.status, "COMPLETED", JSON.stringify(result.data.item)); assert.equal(result.data.item.droppedClaimCount, 0); assert.deepEqual(result.data.item.evidenceCoverage, { retrievalRunCount: 6, candidateCount: 12, knowledgeClaimCount: 1, validKnowledgeClaimCount: 1, ratio: 1 }); assert.equal(parallelClaim.text, text); assert.equal(parallelClaim.supportStatus, "SUPPORTED"); assert.equal(parallelClaim.supportFailureCode, ""); assert.equal(parallelClaim.supportMetrics.citationCount, 2); assert.equal(parallelClaim.supportMetrics.parallelSupported, true); assert.deepEqual(result.data.item.content.claims.map((claim) => claim.claimType), ["BASE_MATCH_FACT", "KNOWLEDGE_CLAIM", "MODEL_SUGGESTION"]); } state.mode = "valid";
    assert.equal((await call(otherToken, `/api/match-reports/${result.data.item.id}`, undefined, 404)).status, 404);
    assert.equal((await call(otherToken, "/api/job-applications/1/reports", { matchId: 1 }, 404)).status, 404, "cross-user report creation must not reveal application");
    assert.equal((await call(token, "/api/job-applications/999/reports", { matchId: 1 }, 404)).status, 404, "missing application must fail");
    assert.equal((await call(token, "/api/job-applications/1/reports", { matchId: 2 }, 409)).data.failureCode, "REPORT_INPUT_INVALID", "match must belong to the application");
    const independent = await call(token, "/api/job-applications/2/reports", { matchId: 3 }, 201); assert.equal(independent.data.item.resumeId, 2); assert.equal(independent.data.item.jobDescriptionId, 2); assert.notEqual(independent.data.item.resumeContentHash, result.data.item.resumeContentHash, "reports for two resumes/JDs must retain independent inputs");
    assert.equal(state.providerBodies.some((body) => /PRIVATE-NAME|private@example.com|13800138000|provider-SECRET|Cookie/.test(body)), false, "provider prompt leaked private data");
    assert.equal(state.providerBodies.some((body) => body.includes("FORGED-QDRANT-PAYLOAD")), false, "Qdrant payload body must never become prompt evidence");
    await stop(); start(); await waitForBackendHealthy(); assert.equal((await call(token, `/api/match-reports/${reportId}`, undefined, 200)).data.item.id, reportId, "report persists across restart");

    const semanticFailureCodes = { semanticUser: "UNSUPPORTED_USER_ATTRIBUTION", semanticNumber: "UNSUPPORTED_NUMBER", semanticEntity: "UNSUPPORTED_ENTITY", semanticTail: "UNSUPPORTED_CLAIM_EXTENSION", semanticCommaAttribution: "UNSUPPORTED_USER_ATTRIBUTION" };
    for (const mode of ["badChunk", "otherRun", "previousReportRun", "otherDocumentChunk", "badQuote", "oldVersion", "noCitation", "partial", "semanticUser", "semanticNumber", "semanticEntity", "semanticPolarity", "semanticTail", "semanticCommaAttribution"]) { state.mode = mode; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }); assert.equal(result.status, 201); assert.equal(result.data.item.status, "DEGRADED", mode); assert.equal(result.data.item.droppedClaimCount, 1, mode); if (semanticFailureCodes[mode]) { assert.ok(result.data.item.validationFailures.some((failure) => failure.code === semanticFailureCodes[mode]), `${mode}: ${JSON.stringify(result.data.item.validationFailures)}`); assert.equal(result.data.item.evidenceCoverage.validKnowledgeClaimCount, 0, mode); assert.equal(result.data.item.evidenceCoverage.knowledgeClaimCount, 1, mode); assert.equal(result.data.item.evidenceCoverage.ratio, 0, mode); assert.deepEqual(result.data.item.content.claims.map((claim) => claim.claimType), ["BASE_MATCH_FACT", "MODEL_SUGGESTION"], mode); } }
    state.mode = "duplicate"; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 201); assert.equal(result.data.item.status, "COMPLETED", "duplicate citations must be deduplicated before support validation"); assert.equal(result.data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM").citations.length, 1);
    assert.ok(result.data.item.reportVersion > 1, "new generation must create a new report version rather than overwrite history");
    assert.equal((await call(token, `/api/match-reports/${reportId}`, undefined, 200)).data.item.content.executiveSummary, "Java 岗位匹配报告。", "failed reports must not overwrite previous successful body");
    state.mode = "noKnowledge"; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 201); assert.equal(result.data.item.status, "DEGRADED"); assert.equal(result.data.item.evidenceCoverage.validKnowledgeClaimCount, 0);
    for (const mode of ["empty", "onlyInvalid", "badEnum", "invalidJson", "provider503", "timeout"]) { state.mode = mode; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }); assert.ok(result.status >= 400, mode); if (mode === "onlyInvalid") assert.equal(result.data.failureCode, "REPORT_NO_SUPPORTED_CLAIMS"); }
    state.mode = "valid"; state.vectorDown = true; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 201); assert.equal(result.data.item.status, "DEGRADED", "keyword fallback must be visible"); state.vectorDown = false;
    result = await call(token, "/api/job-applications/1/reports", { matchId: 1, useReranker: true }, 201); assert.equal(result.data.item.status, "DEGRADED", "reranker fallback must be visible");
    assert.equal((await call(token, "/api/job-applications/1/reports", { matchId: 999 }, 404)).data.failureCode, "REPORT_MATCH_NOT_FOUND");
    assert.equal((await call(token, "/api/job-applications/1/reports", { matchId: 1, useReranker: "true" }, 400)).data.failureCode, "REPORT_INPUT_INVALID");
    const saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8")); assert.ok(saved.matchReports.some((item) => item.status === "FAILED"), "failed reports must persist"); assert.equal(JSON.stringify(saved.matchReports).includes("provider-SECRET"), false); assert.equal(JSON.stringify(saved.matchReports).includes("FORGED-QDRANT-PAYLOAD"), false); assert.equal(state.backendOutput.join("\n").match(/provider-SECRET|embedding-SECRET|qdrant-SECRET|reranker-SECRET|Cookie|Authorization|FORGED-QDRANT-PAYLOAD|PRIVATE-NAME/) !== null, false, "backend output leaked secret or internal payload");
    const latest = saved.matchReports.find((item) => item.id === reportId); const doc = saved.knowledgeDocuments.find((item) => item.id === 1); doc.status = "DRAFT"; await writeFile(path.join(dir, "store.json"), JSON.stringify(saved)); await stop(); start(); await waitForBackendHealthy(); assert.equal((await call(token, `/api/match-reports/${reportId}`, undefined, 200)).data.item.content.claims.find((claim) => claim.claimType === "KNOWLEDGE_CLAIM").citations[0].availability, "UNAVAILABLE"); state.mode = "valid"; result = await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 201); assert.equal(result.data.item.status, "DEGRADED", "new reports must not retain withdrawn knowledge claims"); assert.equal(result.data.item.content.claims.some((claim) => claim.claimType === "KNOWLEDGE_CLAIM"), false, "withdrawn source cannot enter a new report");
    const withoutProvider = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8")); withoutProvider.aiSettingsByUser["1"].aiProviderConfigs.OpenAI.apiKey = ""; withoutProvider.resumeJobMatches[0].status = "FAILED"; await writeFile(path.join(dir, "store.json"), JSON.stringify(withoutProvider)); await stop(); start(); await waitForBackendHealthy(); assert.equal((await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 409)).data.failureCode, "REPORT_MATCH_NOT_COMPLETED"); withoutProvider.resumeJobMatches[0].status = "COMPLETED"; await writeFile(path.join(dir, "store.json"), JSON.stringify(withoutProvider)); await stop(); start(); await waitForBackendHealthy(); assert.equal((await call(token, "/api/job-applications/1/reports", { matchId: 1 }, 400)).data.failureCode, "REPORT_PROVIDER_NOT_CONFIGURED");
    console.log("Grounded match-report integration passed: immutable binding, production retrieval, citation validation, fallback, failures, isolation, persistence, revocation, and privacy.");
  } finally { await stop(); await Promise.all([new Promise((resolve) => provider.close(resolve)), new Promise((resolve) => embedding.close(resolve)), new Promise((resolve) => qdrant.close(resolve)), new Promise((resolve) => reranker.close(resolve))]); await rm(dir, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
