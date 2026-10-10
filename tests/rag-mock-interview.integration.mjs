import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildInterviewQuestionPrompt, buildInterviewQuestionsSchema, validateUserFactGrounding } from "../backend/mock-interview-service.js";

const root = path.resolve(import.meta.dirname, "..");
const hash = (value) => createHash("sha256").update(value).digest("base64url");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));

const minimalSources = ["RESUME", "JD", "MATCH_GAP"].map((sourceType) => ({ sourceId: `${sourceType}-1`, sourceType, quote: sourceType }));
const minimalSchema = buildInterviewQuestionsSchema(minimalSources, 4);
assert.deepEqual(minimalSchema.properties.questions.items.properties.category.enum, ["RESUME", "JD", "MATCH_GAP"]);
assert.equal(minimalSchema.properties.questions.minItems, 4);
assert.equal(minimalSchema.properties.questions.maxItems, 4);
assert.deepEqual(minimalSchema.properties.questions.items.properties.expectedPoints.items.properties.sourceIds.items.enum, minimalSources.map((source) => source.sourceId));
const threeQuestionPrompt = buildInterviewQuestionPrompt({ aiResume: {}, jobDescription: {}, parseResult: {}, matchReport: {}, sources: [...minimalSources, { sourceId: "KNOWLEDGE-1", sourceType: "KNOWLEDGE", quote: "缓存知识" }], questionCount: 3 });
assert.deepEqual(JSON.parse(threeQuestionPrompt.user).requiredCategories, ["RESUME", "JD", "MATCH_GAP"], "three questions must not require four categories");
for (const question of [
  '你在简历中写到：熟悉 Java 服务开发。',
  '你在简历中写到：熟悉 Java 服务开发。请说明你是如何设计接口的？',
  '你如何通过接口设计保障长期维护？',
  '请说明你如何设计开发过程中的接口？',
]) assert.doesNotThrow(() => validateUserFactGrounding(question, ['熟悉 Java 服务开发']), question);
for (const question of [
  '你在简历中写到：你之前主导 Kubernetes 缓存平台。',
  '你在简历中写到：你使用 Redis 构建缓存。',
  '请说明你之前如何使用 Redis 构建缓存？',
  '你是如何解释你已经掌握 Kubernetes 的？',
  '你是如何解释你做过百人团队管理的？',
  '请说明你是如何解释你主导 Kubernetes 平台的？',
  '你在简历中写到：你已经将性能提升 50%。',
]) assert.throws(() => validateUserFactGrounding(question, ['熟悉 Java 服务开发']), error => error.code === 'INTERVIEW_FACT_BOUNDARY_VIOLATION', question);
for (const advice of [
  '1. 建议说明开发思路。',
  '**建议**描述设计取舍，说明实施步骤并讨论优化方案。',
  '- 可以说明你如何设计接口。',
]) assert.doesNotThrow(() => validateUserFactGrounding(advice, ['熟悉 Java 服务开发'], { implicitUserVoice: true }));
for (const advice of [
  '1. 我负责 Redis 平台。',
  '**建议**说我使用 Kubernetes 构建平台。',
  '建议组织回答，我熟悉 Java 服务开发，提升性能 50%。',
  '建议描述你之前如何使用 Redis。',
  '建议说明设计思路。使用 Redis 构建过缓存模块。',
]) assert.throws(() => validateUserFactGrounding(advice, ['熟悉 Java 服务开发'], { implicitUserVoice: true }), error => error.code === 'INTERVIEW_FACT_BOUNDARY_VIOLATION', advice);

function lockedResume() {
  const value = {
    id: 1, userId: 1, resumeVersion: 1, title: "Java 工程师", targetPosition: "Java 研发", targetPositionId: null,
    basicInfo: { realName: "PRIVATE-NAME", currentPosition: "Java 工程师", email: "private@example.com", phone: "13800138000", city: "杭州", website: "https://private.example", profileFields: [] },
    selfEvaluation: "熟悉 Java 服务开发",
    sections: [{ key: "projects", label: "项目经历", entries: [{ id: "project-1", name: "订单平台", role: "后端开发", startDate: "", endDate: "", isCurrent: false, highlights: ["实现订单查询接口"] }] }],
  };
  return { ...value, contentHash: sha(JSON.stringify(value)) };
}

function questionPayload(mode) {
  if (mode === "fabricated") {
    return { questions: [
      { question: "请说明你带领百人团队并提升 50% 性能的经历。", category: "RESUME", difficulty: "HARD", rationale: "测试伪造事实", sourceIds: ["RESUME-1"], expectedPoints: [{ point: "团队规模与性能结果", sourceIds: ["RESUME-1"] }] },
      { question: "JD 为什么要求 Java？", category: "JD", difficulty: "MEDIUM", rationale: "岗位要求", sourceIds: ["JD-1"], expectedPoints: [{ point: "Java", sourceIds: ["JD-1"] }] },
      { question: "如何补足 Redis 缺口？", category: "MATCH_GAP", difficulty: "MEDIUM", rationale: "匹配缺口", sourceIds: ["MATCH_GAP-1"], expectedPoints: [{ point: "Redis", sourceIds: ["MATCH_GAP-1"] }] },
      { question: "如何衡量缓存效果？", category: "KNOWLEDGE", difficulty: "HARD", rationale: "知识依据", sourceIds: ["KNOWLEDGE-1"], expectedPoints: [{ point: "命中率", sourceIds: ["KNOWLEDGE-1"] }] },
    ] };
  }
  const payload = { questions: [
    { question: "简历写明你熟悉 Java 服务开发，请说明相关技术取舍。", category: "RESUME", difficulty: "MEDIUM", rationale: "验证锁定简历中的能力陈述", sourceIds: ["RESUME-3"], expectedPoints: [{ point: "说明技术取舍但不补写未证明经历", sourceIds: ["RESUME-3"] }] },
    { question: "该岗位为什么强调 Java 服务开发能力？", category: "JD", difficulty: "MEDIUM", rationale: "覆盖岗位必备要求", sourceIds: ["JD-1"], expectedPoints: [{ point: "解释 Java 与岗位职责的关系", sourceIds: ["JD-1"] }] },
    { question: "你准备如何补足 Redis 证据缺口？", category: "MATCH_GAP", difficulty: "HARD", rationale: "针对匹配报告缺口", sourceIds: ["MATCH_GAP-1"], expectedPoints: [{ point: "给出学习或验证计划，不声称已有经历", sourceIds: ["MATCH_GAP-1"] }] },
    { question: "设计缓存方案时应如何用命中率和延迟评估效果？", category: "KNOWLEDGE", difficulty: "HARD", rationale: "使用检索知识考察技术判断", sourceIds: ["KNOWLEDGE-1"], expectedPoints: [{ point: "同时讨论缓存命中率和响应延迟", sourceIds: ["KNOWLEDGE-1"] }] },
  ] };
  const indexByCategory = { JD: 1, MATCH_GAP: 2, KNOWLEDGE: 3 };
  const attack = mode.match(/^(jd|gap|knowledge)(Question|Expected)Attack$/);
  if (attack) {
    const category = attack[1] === "jd" ? "JD" : attack[1] === "gap" ? "MATCH_GAP" : "KNOWLEDGE";
    const target = payload.questions[indexByCategory[category]];
    const fabricatedText = category === "JD"
      ? "你之前使用 Redis 构建缓存时是如何设计的？"
      : category === "MATCH_GAP"
        ? "你已经掌握 Kubernetes，请说明实践经验。"
        : "你落地过高并发缓存平台，请说明架构。";
    if (attack[2] === "Question") target.question = fabricatedText;
    else target.expectedPoints[0].point = fabricatedText;
  }
  if (mode === "legalExternalQuestions") {
    payload.questions[1].question = "你会如何设计 Redis 缓存？";
    payload.questions[1].expectedPoints[0].point = "说明 Redis 缓存设计原则";
    payload.questions[2].question = "针对岗位要求的高并发，你会如何处理？";
    payload.questions[2].expectedPoints[0].point = "给出高并发设计方案";
    payload.questions[3].question = "请解释 Kubernetes Deployment。";
    payload.questions[3].expectedPoints[0].point = "解释 Kubernetes Deployment 核心概念";
  }
  if (mode === "legalQuestionScaffolding") payload.questions[0].question = "你在简历中写到：熟悉 Java 服务开发。请说明你是如何设计接口的？";
  return payload;
}

function feedbackPayload(mode, sourceId = "RESUME-1") {
  if (mode === "badFeedbackSource") return { score: 80, strengths: [{ text: "回答清晰", sourceIds: ["USER_ANSWER"] }], weaknesses: [{ text: "伪造依据", sourceIds: ["KNOWLEDGE-999"] }], missingPoints: [{ text: "缺少取舍", sourceIds: ["RESUME-1"] }], improvedAnswer: "建议稿", followUpQuestion: "如何验证？" };
  const payload = {
    score: 82,
    strengths: [{ text: "回答说明了本次采用的接口拆分思路", sourceIds: ["USER_ANSWER", sourceId] }],
    weaknesses: [{ text: "还没有充分对应题目要求的技术取舍", sourceIds: [sourceId] }],
    missingPoints: [{ text: "需要补充职责边界和方案权衡", sourceIds: [sourceId] }],
    improvedAnswer: "建议按背景、职责、取舍和可验证结果组织回答；没有证据的经历不要补写。",
    followUpQuestion: "你会如何验证接口拆分后的收益？",
  };
  if (mode === "improvedFabricated") payload.improvedAnswer = "我使用 Redis 构建高并发缓存系统。2021 年我在字节跳动主导了缓存平台重构，将查询延迟降低 50%。我也掌握 Kubernetes。";
  if (mode === "improvedResumeSupported") payload.improvedAnswer = "我熟悉 Java 服务开发。";
  if (mode === "improvedRedisSupported") payload.improvedAnswer = "我使用 Redis 构建过缓存模块。";
  if (mode === "improvedRedisPercent") payload.improvedAnswer = "我使用 Redis 构建过缓存模块，并将性能提升 50%。";
  return payload;
}

async function main() {
  const state = { mode: "valid", bodies: [] };
  const provider = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString("utf8");
    state.bodies.push(body);
    if (state.mode === "providerFail") { res.writeHead(503, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: { message: "provider down" } })); return; }
    const isFeedback = body.includes("rag_mock_interview_feedback");
    const currentSourceId = body.match(/(?:RESUME|JD|MATCH_GAP|KNOWLEDGE)-\d+/)?.[0] || "RESUME-1";
    const correction = body.includes("事实边界纠正：");
    const questionMode = state.mode === "correctableFact" ? (correction ? "valid" : "fabricated") : state.mode === "correctableCategory" || state.mode.startsWith("noKnowledge") ? "valid" : state.mode;
    const feedbackMode = state.mode === "correctableFeedback" ? (body.includes("反馈事实纠正：") ? "valid" : "improvedFabricated") : state.mode;
    const payload = isFeedback ? feedbackPayload(feedbackMode, currentSourceId) : questionPayload(questionMode);
    if (!isFeedback && state.mode === "correctableCategory" && !correction) payload.questions[0].sourceIds = ["JD-1"];
    if (!isFeedback && state.mode.startsWith("noKnowledge")) {
      const requestPrompt = JSON.parse(JSON.parse(body).input.find((item) => item.role === "user").content[0].text.split("\n\n事实边界纠正：")[0]);
      assert.deepEqual(requestPrompt.allowedCategories, ["RESUME", "JD", "MATCH_GAP"]);
      const schema = JSON.parse(body).text.format.schema;
      assert.equal(schema.properties.questions.items.properties.category.enum.includes("KNOWLEDGE"), false);
      assert.equal(schema.properties.questions.items.properties.sourceIds.items.enum.some((id) => id.startsWith("KNOWLEDGE-")), false);
      payload.questions[3] = { question: "如果需要设计 Redis 缓存，你会如何确定方案？", category: "JD", difficulty: "HARD", rationale: "考察岗位要求", sourceIds: ["JD-1"], expectedPoints: [{ point: "讨论缓存方案的取舍", sourceIds: ["JD-1"] }] };
      if (state.mode === "noKnowledgePersistent" || (state.mode === "noKnowledgeCorrectable" && !correction)) payload.questions[3].category = "KNOWLEDGE";
    }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(payload) }));
  });
  const providerPort = await listen(provider);
  const token = randomBytes(20).toString("hex");
  const otherToken = randomBytes(20).toString("hex");
  const dir = await mkdtemp(path.join(tmpdir(), "lingxi-stage8-interview-"));
  const probe = createServer(); const apiPort = await listen(probe); probe.close();
  const snapshot = lockedResume();
  const jdRaw = "Java 研发岗位负责服务开发，要求 Java 与 Redis。";
  const jdHash = sha(jdRaw);
  const parsed = { jobTitle: { text: "Java 研发", evidence: "Java 研发岗位" }, seniority: { text: "中级", evidence: "Java" }, requiredSkills: [{ text: "Java", evidence: "要求 Java" }, { text: "Redis", evidence: "Redis" }], preferredSkills: [], technicalKeywords: [{ text: "Java", evidence: "Java" }, { text: "Redis", evidence: "Redis" }], responsibilities: [{ text: "服务开发", evidence: "负责服务开发" }] };
  const dimensions = ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"].map((key) => ({ key, label: key, score: 70, weight: 0, weightedScore: 0, summary: "Java 匹配", resumeEvidence: ["Java"], jdEvidence: ["Java"], missingEvidence: key === "required_skills" ? ["Redis"] : [], suggestions: [] }));
  const match = { id: 1, userId: 1, jobApplicationId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: snapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, algorithmVersion: "base-match-v1", status: "COMPLETED", report: { summary: "Java 匹配", dimensions, strongestResumeEvidence: ["Java"], risks: ["Redis 证据不足"], prioritizedSuggestions: ["补充 Redis 可验证证据"] } };
  const report = { id: 1, userId: 1, jobApplicationId: 1, resumeJobMatchId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: snapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, status: "COMPLETED", content: { gaps: ["Redis 证据不足"], recommendations: ["建议：补充 Redis 可验证证据"], claims: [] } };
  const knowledgeText = "缓存方案应同时观察缓存命中率和响应延迟，避免只看单一指标。";
  const store = {
    users: [{ id: 1, username: "owner", passwordHash: "x", role: "USER", status: 1 }, { id: 2, username: "other", passwordHash: "x", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 1, tokenHash: hash(token), expiresAt: new Date(Date.now() + 600000).toISOString() }, { id: 2, userId: 2, tokenHash: hash(otherToken), expiresAt: new Date(Date.now() + 600000).toISOString() }],
    resumes: [{ ...snapshot, version: 2, realName: "CURRENT-PRIVATE-NAME", email: "current-private@example.com" }],
    resumeHistories: [{ id: 1, resumeId: 1, resumeVersion: 1, version: 1, contentHash: snapshot.contentHash, snapshot }],
    jobDescriptions: [{ id: 1, userId: 1, title: "Java 研发", rawText: jdRaw, rawTextHash: jdHash, normalizedText: jdRaw, normalizedTextHash: jdHash, currentParseResultId: 1, parseStatus: "SUCCEEDED" }],
    jobDescriptionParseResults: [{ id: 1, userId: 1, jobDescriptionId: 1, rawTextHash: jdHash, status: "SUCCEEDED", parsedData: parsed }],
    jobApplications: [{ id: 1, userId: 1, resumeId: 1, resumeVersionId: 1, resumeVersion: 1, resumeContentHash: snapshot.contentHash, jobDescriptionId: 1, jobDescriptionParseResultId: 1, jobDescriptionRawTextHash: jdHash, jobDescriptionNormalizedTextHash: jdHash }],
    resumeJobMatches: [match], matchReports: [report],
    knowledgeDocuments: [{ id: 1, title: "缓存面试量表", sourceName: "内部知识库", status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: 11, documentType: "INTERVIEW_RUBRIC", jobFamily: "Java 研发", seniority: "中级", skillTags: ["Java", "Redis"], language: "zh-CN" }],
    knowledgeChunks: [{ id: 1, documentId: 1, processingVersion: 1, title: "缓存评估", headingPath: [], content: knowledgeText, contentHash: sha(knowledgeText) }],
    knowledgeRetrievalRuns: [], interviewSessions: [], interviewSessionQuestions: [], interviewAnswers: [], answerFeedbacks: [], mockInterviews: [],
    aiSettingsByUser: { "1": { aiConfig: { provider: "OpenAI" }, aiProviderConfigs: { OpenAI: { baseUrl: `http://127.0.0.1:${providerPort}/v1`, modelId: "mock-stage8", apiKey: "provider-SECRET", enabled: true } } } },
  };
  const personalMode = process.argv.includes("--personal-materials");
  if (personalMode) {
    Object.assign(store.knowledgeDocuments[0], { scope: "PRIVATE", userId: 1, aiConsent: true });
    store.knowledgeDocuments.push({ ...store.knowledgeDocuments[0], id: 2, userId: 2, title: "OTHER-USER-MATERIAL-SECRET", activeIndexRunId: 12 });
    store.knowledgeChunks.push({ ...store.knowledgeChunks[0], id: 2, documentId: 2, content: knowledgeText + " OTHER-USER-MATERIAL-SECRET" });
  }
  await writeFile(path.join(dir, "store.json"), JSON.stringify(store));
  let backend; let backendOutput = "";
  const start = () => { backend = spawn(process.execPath, ["backend/server.js"], { cwd: root, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dir, OPENAI_API_KEY: "", OPENAI_BASE_URL: "", OPENAI_MODEL: "", AI_PROVIDER_TIMEOUT_MS: "100" }, stdio: ["ignore", "pipe", "pipe"] }); backend.stdout.on("data", (part) => { backendOutput += part; }); backend.stderr.on("data", (part) => { backendOutput += part; }); };
  const stop = async () => { if (!backend?.pid || backend.exitCode !== null) return; backend.kill("SIGKILL"); for (let i = 0; i < 100; i += 1) { try { process.kill(backend.pid, 0); } catch { return; } await wait(20); } };
  const healthy = async () => { for (let i = 0; i < 120; i += 1) { try { if ((await fetch(`http://127.0.0.1:${apiPort}/api/health`)).ok) return; } catch {} await wait(25); } throw new Error(`backend failed: ${backendOutput.slice(-1000)}`); };
  const call = async (tokenValue, pathname, body, expected, method = body === undefined ? "GET" : "POST") => { const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, { method, headers: { Cookie: `lingxi_session=${tokenValue}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) }); const data = await response.json(); if (expected !== undefined) assert.equal(response.status, expected, JSON.stringify(data)); return { status: response.status, data }; };
  try {
    start(); await healthy();
    const created = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    assert.equal(created.data.item.resumeVersion, 1, "session must retain the application ResumeVersion instead of current resume version 2");
    assert.equal(created.data.item.resumeVersionId, 1);
    assert.equal(created.data.item.resumeContentHash, snapshot.contentHash);
    assert.equal(created.data.item.provider, "OpenAI"); assert.equal(created.data.item.model, "mock-stage8");
    assert.equal(created.data.item.status, "IN_PROGRESS"); assert.equal(created.data.item.questions.length, 4);
    assert.deepEqual(created.data.item.questions.map((item) => item.category), ["RESUME", "JD", "MATCH_GAP", "KNOWLEDGE"]);
    const knowledgeQuestion = created.data.item.questions.find((item) => item.category === "KNOWLEDGE");
    assert.equal(knowledgeQuestion.sourceRefs[0].retrievalRunId, created.data.item.retrievalRunIds[0]);
    assert.equal(knowledgeQuestion.sourceRefs[0].availability, "AVAILABLE");
    if (personalMode) {
      assert.equal(knowledgeQuestion.sourceRefs[0].materialUserId, 1);
      assert.equal(state.bodies.some((body) => body.includes("OTHER-USER-MATERIAL-SECRET")), false);
    }
    assert.equal((await call(token, `/api/interview-sessions/${created.data.item.id}/questions`, undefined, 200)).data.items.length, 4);
    assert.equal((await call(otherToken, `/api/interview-sessions/${created.data.item.id}`, undefined, 404)).status, 404);
    assert.equal((await call(otherToken, `/api/interview-sessions/${created.data.item.id}/questions`, undefined, 404)).status, 404);

    const firstQuestion = created.data.item.questions[0];
    assert.equal((await call(otherToken, `/api/interview-sessions/${created.data.item.id}/questions/${firstQuestion.id}/answers`, { answerText: "cross-user" }, 404)).status, 404);
    assert.equal((await call(otherToken, `/api/interview-sessions/${created.data.item.id}/complete`, {}, 404)).status, 404);
    const answered = await call(token, `/api/interview-sessions/${created.data.item.id}/questions/${firstQuestion.id}/answers`, { answerText: "我在本次回答中说明采用分层接口并权衡维护成本。" }, 201);
    assert.equal(answered.data.feedback.score, 82);
    assert.equal(answered.data.feedback.improvedAnswerIsSuggestion, true);
    assert.equal(answered.data.feedback.strengths[0].sourceRefs[0].sourceType, "USER_ANSWER");
    assert.equal(answered.data.feedback.weaknesses[0].sourceRefs[0].sourceType, "RESUME");
    assert.equal((await call(token, `/api/interview-sessions/${created.data.item.id}/answers/${answered.data.item.id}/feedback`, undefined, 200)).data.item.id, answered.data.feedback.id);
    assert.equal((await call(otherToken, `/api/interview-sessions/${created.data.item.id}/answers/${answered.data.item.id}/feedback`, undefined, 404)).status, 404);
    for (const question of created.data.item.questions.slice(1)) await call(token, `/api/interview-sessions/${created.data.item.id}/questions/${question.id}/answers`, { answerText: `回答问题 ${question.id}，不补写未证明的个人经历。` }, 201);
    const completed = await call(token, `/api/interview-sessions/${created.data.item.id}/complete`, {}, 200);
    assert.equal(completed.data.item.status, "COMPLETED"); assert.ok(completed.data.item.completedAt); assert.equal(completed.data.item.averageScore, 82);

    const degraded = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "HYBRID" }, 201);
    assert.equal(degraded.data.item.status, "DEGRADED"); assert.equal(degraded.data.item.retrievalStatus, "DEGRADED"); assert.ok(degraded.data.item.retrievalRunIds.length);

    for (const mode of ["correctableFact", "correctableCategory"]) {
      state.mode = mode;
      const before = state.bodies.length;
      const corrected = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
      assert.equal(state.bodies.length - before, 2, "boundary violations get exactly one correction");
      assert.equal(corrected.data.item.questions.length, 4);
      assert.equal(corrected.data.item.promptVersion, "rag-mock-interview-v3");
      assert.equal(corrected.data.item.questions.some((item) => item.question.includes("百人团队")), false);
      const [first, second] = state.bodies.slice(before).map((body) => JSON.parse(body));
      const firstUser = first.input.find((item) => item.role === "user").content[0].text;
      const secondUser = second.input.find((item) => item.role === "user").content[0].text;
      assert.ok(secondUser.startsWith(firstUser), "correction must retain the exact locked request input");
      assert.ok(secondUser.includes("事实边界纠正："));
    }
    state.mode = "fabricated";
    const fabricatedBefore = state.bodies.length;
    const fabricated = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 422);
    assert.equal(fabricated.data.failureCode, "INTERVIEW_FACT_BOUNDARY_VIOLATION");
    assert.equal(state.bodies.length - fabricatedBefore, 2, "persistent violations stop after the second response");
    let saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    assert.equal(saved.interviewSessions.at(-1).status, "FAILED"); assert.equal(saved.interviewSessionQuestions.some((item) => item.sessionId === saved.interviewSessions.at(-1).id), false);

    for (const mode of ["jdQuestionAttack", "jdExpectedAttack", "gapQuestionAttack", "gapExpectedAttack", "knowledgeQuestionAttack", "knowledgeExpectedAttack"]) {
      state.mode = mode;
      const attacked = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 422);
      assert.equal(attacked.data.failureCode, "INTERVIEW_FACT_BOUNDARY_VIOLATION", mode);
      saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
      assert.equal(saved.interviewSessions.at(-1).status, "FAILED", mode);
      assert.equal(saved.interviewSessionQuestions.some((item) => item.sessionId === saved.interviewSessions.at(-1).id), false, mode);
    }

    state.mode = "legalExternalQuestions";
    const legalExternal = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    assert.equal(legalExternal.data.item.questions.find((item) => item.category === "JD").question, "你会如何设计 Redis 缓存？");
    assert.equal(legalExternal.data.item.questions.find((item) => item.category === "MATCH_GAP").question, "针对岗位要求的高并发，你会如何处理？");
    const legalKnowledge = legalExternal.data.item.questions.find((item) => item.category === "KNOWLEDGE");
    assert.equal(legalKnowledge.question, "请解释 Kubernetes Deployment。");
    assert.equal(legalKnowledge.sourceRefs.some((item) => item.sourceType === "KNOWLEDGE" && item.retrievalRunId), true, "legal knowledge question must retain a real KNOWLEDGE sourceRef");
    state.mode = "legalQuestionScaffolding";
    const scaffoldBefore = state.bodies.length;
    const scaffoldSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    assert.equal(state.bodies.length - scaffoldBefore, 1, "legal interview wording must not require regeneration");
    assert.equal(scaffoldSession.data.item.questions[0].question, "你在简历中写到：熟悉 Java 服务开发。请说明你是如何设计接口的？");

    state.mode = "valid";
    const fabricatedFeedbackSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "improvedFabricated";
    const fabricatedFeedback = await call(token, `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/questions/${fabricatedFeedbackSession.data.item.questions[0].id}/answers`, { answerText: "我只说明 Java 接口拆分，没有补充其他经历。" }, 422);
    assert.equal(fabricatedFeedback.data.failureCode, "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT");
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    const rejectedFeedback = saved.answerFeedbacks.find((item) => item.id === fabricatedFeedback.data.feedbackId);
    assert.equal(rejectedFeedback.status, "FAILED");
    assert.equal(rejectedFeedback.improvedAnswer, "", "unsupported improvedAnswer must not be persisted as normal feedback content");
    assert.equal(JSON.stringify(rejectedFeedback).includes("字节跳动"), false);

    const retryPath = `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/answers/${fabricatedFeedback.data.answerId}/feedback/retry`;
    assert.equal((await call(otherToken, retryPath, {}, 404)).status, 404);
    assert.equal((await call(token, `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/answers/${answered.data.item.id}/feedback/retry`, {}, 404)).status, 404);
    const answerCount = saved.interviewAnswers.length;
    const retryFailed = await call(token, retryPath, {}, 422);
    assert.equal(retryFailed.data.failureCode, "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT");
    assert.equal(retryFailed.data.answerId, fabricatedFeedback.data.answerId);
    state.mode = "valid";
    const recovered = await call(token, retryPath, { answerText: "must not replace the original answer" }, 201);
    assert.equal(recovered.data.item.id, fabricatedFeedback.data.answerId);
    assert.equal(recovered.data.item.answerText, "我只说明 Java 接口拆分，没有补充其他经历。");
    assert.equal(recovered.data.feedback.promptVersion, "rag-mock-interview-feedback-v2");
    const latest = await call(token, `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/answers/${fabricatedFeedback.data.answerId}/feedback`, undefined, 200);
    assert.equal(latest.data.item.id, recovered.data.feedback.id);
    const noRetryCalls = state.bodies.length;
    await call(token, retryPath, {}, 409);
    assert.equal(state.bodies.length, noRetryCalls, "successful feedback cannot be regenerated");
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    assert.equal(saved.interviewAnswers.length, answerCount);
    assert.equal(saved.answerFeedbacks.find(item => item.id === fabricatedFeedback.data.feedbackId).status, "FAILED", "old failed feedback must remain in history");
    for (const question of fabricatedFeedbackSession.data.item.questions.slice(1)) await call(token, `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/questions/${question.id}/answers`, { answerText: "不补写个人经历。" }, 201);
    const recoveredComplete = await call(token, `/api/interview-sessions/${fabricatedFeedbackSession.data.item.id}/complete`, {}, 200);
    assert.equal(recoveredComplete.data.item.averageScore, 82, "completion must use latest feedback per answer");
    await call(token, retryPath, {}, 409);

    state.mode = "valid";
    const correctionSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "correctableFeedback";
    const feedbackBefore = state.bodies.length;
    const correctedFeedback = await call(token, `/api/interview-sessions/${correctionSession.data.item.id}/questions/${correctionSession.data.item.questions[0].id}/answers`, { answerText: "只说明技术取舍，不补写经历。" }, 201);
    assert.equal(state.bodies.length - feedbackBefore, 2, "feedback gets at most one factual correction");
    assert.equal(correctedFeedback.data.feedback.status, "COMPLETED");
    assert.equal(correctedFeedback.data.feedback.improvedAnswer.includes("字节跳动"), false);

    state.mode = "valid";
    const resumeSupportedSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "improvedResumeSupported";
    const resumeSupportedFeedback = await call(token, `/api/interview-sessions/${resumeSupportedSession.data.item.id}/questions/${resumeSupportedSession.data.item.questions[0].id}/answers`, { answerText: "我会围绕问题给出技术取舍。" }, 201);
    assert.equal(resumeSupportedFeedback.data.feedback.improvedAnswer, "我熟悉 Java 服务开发。", "locked ResumeVersion may support improvedAnswer user facts");

    state.mode = "valid";
    const supportedFeedbackSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "improvedRedisSupported";
    const supportedFeedback = await call(token, `/api/interview-sessions/${supportedFeedbackSession.data.item.id}/questions/${supportedFeedbackSession.data.item.questions[0].id}/answers`, { answerText: "我之前使用 Redis 做过缓存模块。" }, 201);
    assert.equal(supportedFeedback.data.feedback.improvedAnswer, "我使用 Redis 构建过缓存模块。");
    assert.equal(supportedFeedback.data.feedback.improvedAnswerIsSuggestion, true);

    state.mode = "valid";
    const isolatedAnswerSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "improvedRedisSupported";
    const isolatedAnswerFailure = await call(token, `/api/interview-sessions/${isolatedAnswerSession.data.item.id}/questions/${isolatedAnswerSession.data.item.questions[0].id}/answers`, { answerText: "当前回答没有提供缓存经历。" }, 422);
    assert.equal(isolatedAnswerFailure.data.failureCode, "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT", "another session's UserAnswer must not support this feedback");

    state.mode = "valid";
    const unsupportedPercentSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "improvedRedisPercent";
    const unsupportedPercent = await call(token, `/api/interview-sessions/${unsupportedPercentSession.data.item.id}/questions/${unsupportedPercentSession.data.item.questions[0].id}/answers`, { answerText: "我之前使用 Redis 做过缓存模块。" }, 422);
    assert.equal(unsupportedPercent.data.failureCode, "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT");
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    assert.equal(saved.answerFeedbacks.find((item) => item.id === unsupportedPercent.data.feedbackId).status, "FAILED");

    // Empty business knowledge store: generate from actual sources and keep degradation explicit.
    await stop();
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    const knowledgeDocuments = saved.knowledgeDocuments;
    const knowledgeChunks = saved.knowledgeChunks;
    saved.knowledgeDocuments = []; saved.knowledgeChunks = [];
    await writeFile(path.join(dir, "store.json"), JSON.stringify(saved));
    start(); await healthy();
    for (const mode of ["noKnowledgeValid", "noKnowledgeCorrectable", "noKnowledgePersistent"]) {
      state.mode = mode;
      const before = state.bodies.length;
      const result = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, mode === "noKnowledgePersistent" ? 422 : 201);
      assert.equal(state.bodies.length - before, mode === "noKnowledgeValid" ? 1 : 2);
      if (mode === "noKnowledgePersistent") {
        assert.equal(result.data.failureCode, "INTERVIEW_FACT_BOUNDARY_VIOLATION");
        saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
        assert.equal(saved.interviewSessions.at(-1).status, "FAILED");
        assert.equal(saved.interviewSessionQuestions.some((item) => item.sessionId === saved.interviewSessions.at(-1).id), false);
      } else {
        assert.equal(result.data.item.status, "DEGRADED");
        assert.equal(result.data.item.failureCode, "INTERVIEW_NO_KNOWLEDGE_EVIDENCE");
        assert.equal(result.data.item.questions.length, 4);
        assert.equal(result.data.item.questions.some((item) => item.category === "KNOWLEDGE"), false);
        assert.equal(result.data.item.questions.flatMap((item) => item.sourceRefs).some((source) => source.sourceType === "KNOWLEDGE"), false);
      }
    }
    await stop();
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    saved.knowledgeDocuments = knowledgeDocuments; saved.knowledgeChunks = knowledgeChunks;
    await writeFile(path.join(dir, "store.json"), JSON.stringify(saved));
    start(); await healthy();

    state.mode = "providerFail";
    const providerFailure = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 503);
    assert.equal(providerFailure.data.failureCode, "INTERVIEW_PROVIDER_UNAVAILABLE");
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8")); assert.equal(saved.interviewSessions.at(-1).status, "FAILED");

    state.mode = "valid";
    const feedbackFailureSession = await call(token, "/api/job-applications/1/interview-sessions", { matchReportId: 1, searchMode: "KEYWORD" }, 201);
    state.mode = "badFeedbackSource";
    const feedbackFailure = await call(token, `/api/interview-sessions/${feedbackFailureSession.data.item.id}/questions/${feedbackFailureSession.data.item.questions[0].id}/answers`, { answerText: "本次回答" }, 422);
    assert.equal(feedbackFailure.data.failureCode, "INTERVIEW_SOURCE_INVALID"); assert.ok(feedbackFailure.data.answerId); assert.ok(feedbackFailure.data.feedbackId);
    saved = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    assert.equal(saved.interviewAnswers.find((item) => item.id === feedbackFailure.data.answerId).status, "FEEDBACK_FAILED");
    assert.equal(saved.answerFeedbacks.find((item) => item.id === feedbackFailure.data.feedbackId).status, "FAILED");

    assert.equal(state.bodies.some((body) => /PRIVATE-NAME|private@example.com|13800138000|current-private|provider-SECRET/.test(body)), false, "provider prompt leaked private data or key");
    assert.equal(JSON.stringify(saved).includes("improvedAnswerIsSuggestion"), true);
    assert.equal(saved.resumes.some((item) => JSON.stringify(item).includes("建议按背景、职责、取舍")), false, "improvedAnswer must never be written back to Resume");
    assert.equal(backendOutput.match(/provider-SECRET|PRIVATE-NAME|private@example.com|13800138000/) !== null, false, "backend log leaked private data or key");
    const deleteId = feedbackFailureSession.data.item.id;
    await call(otherToken, `/api/interview-sessions/${deleteId}`, undefined, 404, "DELETE");
    await call(token, `/api/interview-sessions/${deleteId}`, undefined, 200, "DELETE");
    await call(token, `/api/interview-sessions/${deleteId}`, undefined, 404);
    await call(token, `/api/interview-sessions/${deleteId}/answers/${feedbackFailure.data.answerId}/feedback`, undefined, 404);
    await call(token, `/api/interview-sessions/${deleteId}/complete`, {}, 404);
    const visibleHistory = await call(token, "/api/job-applications/1/interview-sessions", undefined, 200);
    assert.ok(!visibleHistory.data.items.some((item) => item.id === deleteId));
    const deletedStore = JSON.parse(await readFile(path.join(dir, "store.json"), "utf8"));
    for (const key of ["interviewSessionQuestions", "interviewAnswers", "answerFeedbacks"]) assert.ok(!deletedStore[key].some((item) => item.sessionId === deleteId));
    assert.deepEqual(deletedStore.resumes, saved.resumes);
    assert.deepEqual(deletedStore.resumeHistories, saved.resumeHistories);
    const busySession = deletedStore.interviewSessions.find((item) => item.userId === 1 && !item.deletedAt && !["PENDING", "RUNNING"].includes(item.status));
    await writeFile(path.join(dir, "store.json"), JSON.stringify({ ...deletedStore, answerFeedbacks: [...deletedStore.answerFeedbacks, { id: 99999, userId: 1, sessionId: busySession.id, status: "PENDING" }] }));
    assert.equal((await call(token, `/api/interview-sessions/${busySession.id}`, undefined, 409, "DELETE")).data.failureCode, "HISTORY_BUSY");
    await writeFile(path.join(dir, "store.json"), JSON.stringify(deletedStore));
    await stop(); start(); await healthy();
    await call(token, `/api/interview-sessions/${deleteId}`, undefined, 404);
    console.log("Stage 8 RAG mock interview integration passed: immutable ResumeVersion, sourced questions, retrieval traces, grounded feedback, failures, degradation, ownership, fact boundary, and history deletion.");
  } finally {
    await stop(); await new Promise((resolve) => provider.close(resolve)); await rm(dir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
