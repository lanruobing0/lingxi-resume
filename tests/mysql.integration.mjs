import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";
import { createPersistence } from "../backend/persistence.js";

const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "MYSQL_PASSWORD"];
const missing = required.filter((key) => !String(process.env[key] || "").trim());
if (missing.length) {
  console.error(`MySQL integration skipped: real MySQL configuration is missing (${missing.join(", ")}).`);
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, "..");
const sha = (value) => createHash("sha256").update(String(value)).digest("hex");
const sessionHash = (value) => createHash("sha256").update(String(value)).digest("base64url");
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
const mysqlEnv = { ...process.env, STORAGE_DRIVER: "mysql", MYSQL_PORT: process.env.MYSQL_PORT || "3306" };
const connectionConfig = { host: mysqlEnv.MYSQL_HOST, port: Number(mysqlEnv.MYSQL_PORT), database: mysqlEnv.MYSQL_DATABASE, user: mysqlEnv.MYSQL_USER, password: mysqlEnv.MYSQL_PASSWORD, multipleStatements: true };

function resumeSnapshot() {
  const value = { id: 1, userId: 1, resumeVersion: 1, title: "前端工程师", targetPosition: "前端开发", targetPositionId: 1, basicInfo: { realName: "PRIVATE-NAME", currentPosition: "前端工程师", email: "private@example.com", phone: "13800138000", city: "杭州", website: "https://private.example", profileFields: [] }, selfEvaluation: "具备 React 组件开发经验。", sections: [{ key: "skills", label: "专业技能", entries: [{ id: "skill-1", name: "", role: "", startDate: "", endDate: "", isCurrent: false, highlights: ["React、TypeScript"] }] }, { key: "work", label: "工作经历", entries: [] }, { key: "projects", label: "项目经历", entries: [] }] };
  return { ...value, contentHash: sha(JSON.stringify(value)) };
}

const dimensions = ["required_skills", "project_relevance", "keyword_coverage", "experience", "education", "expression"];
function reportPayload(runId) {
  return { executiveSummary: "React 岗位匹配报告。", dimensionReports: dimensions.map((key) => ({ key, summary: "匹配说明" })), strengths: ["React"], gaps: ["缺少量化结果"], recommendations: ["建议：突出已有 React 经历"], claims: [
    { claimId: "claim-1", sectionKey: "required_skills", text: "简历已有 React 经验", claimType: "BASE_MATCH_FACT", citations: [], baseEvidence: ["React"] },
    { claimId: "knowledge-1", sectionKey: "required_skills", text: "知识资料建议使用可验证的项目结果呈现 React 能力。", claimType: "KNOWLEDGE_CLAIM", citations: [{ retrievalRunId: runId, chunkId: 1, documentId: 1, processingVersion: 1, quote: "React 能力应基于可验证的项目结果" }], baseEvidence: [] },
    { claimId: "suggestion-1", sectionKey: "recommendations", text: "建议：突出已有 React 经历", claimType: "MODEL_SUGGESTION", citations: [], baseEvidence: [] },
  ] };
}

const questionPayload = { questions: [
  { question: "简历写明你具备 React 组件开发经验，请说明技术取舍。", category: "RESUME", difficulty: "MEDIUM", rationale: "验证锁定简历事实", sourceIds: ["RESUME-3"], expectedPoints: [{ point: "说明 React 技术取舍", sourceIds: ["RESUME-3"] }] },
  { question: "该岗位为什么强调 React？", category: "JD", difficulty: "MEDIUM", rationale: "覆盖岗位要求", sourceIds: ["JD-1"], expectedPoints: [{ point: "解释 React 与岗位职责的关系", sourceIds: ["JD-1"] }] },
  { question: "如何补足量化结果缺口？", category: "MATCH_GAP", difficulty: "HARD", rationale: "针对报告缺口", sourceIds: ["MATCH_GAP-1"], expectedPoints: [{ point: "给出验证计划，不虚构经历", sourceIds: ["MATCH_GAP-1"] }] },
  { question: "如何用可验证结果呈现 React 能力？", category: "KNOWLEDGE", difficulty: "HARD", rationale: "使用知识依据", sourceIds: ["KNOWLEDGE-1"], expectedPoints: [{ point: "使用可验证项目结果", sourceIds: ["KNOWLEDGE-1"] }] },
] };

const agentActions = ["READ_RESUME", "READ_JOB", "READ_MATCH_REPORT", "RETRIEVE_KNOWLEDGE", "SUMMARIZE_EVIDENCE", "PRODUCE_PLAN"];
const skill = (name) => ({ skillName: name, matchStatus: "MATCHED", resumeEvidence: [name], jdEvidence: [name], explanation: "锁定材料中存在明确证据", confidence: 95 });
const matchPayload = { totalScore: 88, summary: "该报告只基于锁定简历与真实 JD。", dimensions: dimensions.map((key) => ({ key, label: key, score: 80, summary: "基于锁定材料的匹配结论", resumeEvidence: key === "required_skills" ? ["React", "TypeScript"] : [], jdEvidence: key === "required_skills" ? ["React", "TypeScript"] : [], missingEvidence: [], suggestions: [] })), matchedRequiredSkills: [skill("React"), skill("TypeScript")], partiallyMatchedRequiredSkills: [], missingRequiredSkills: [], matchedPreferredSkills: [], missingPreferredSkills: [], matchedKeywords: [skill("React")], missingKeywords: [], strongestResumeEvidence: ["具备 React 组件开发经验。"], risks: ["缺少量化结果"], prioritizedSuggestions: ["建议：突出已有 React 经历"] };

async function main() {
  const sql = await mysql.createConnection(connectionConfig);
  const providerState = { planner: 0 };
  let backend;
  let backendOutput = "";
  const provider = createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    let output;
    if (raw.includes("resume_job_match")) output = matchPayload;
    else if (raw.includes("grounded_match_report")) {
      const runId = Number(raw.match(/\"retrievalRunId\":(\d+)/)?.[1] || 1); output = reportPayload(runId);
    } else if (raw.includes("resume_suggestions")) {
      output = { suggestions: [{ sectionType: "自我评价", targetPath: "/selfEvaluation", suggestionType: "REWRITE", rationale: "报告建议突出已有 React 经历", before: "具备 React 组件开发经验。", after: "具备 React 组件开发经验，表达更聚焦前端岗位。", patch: [{ op: "replace", path: "/selfEvaluation", value: "具备 React 组件开发经验，表达更聚焦前端岗位。" }], factEvidence: [{ fact: "React", sourcePath: "/selfEvaluation", sourceQuote: "具备 React 组件开发经验。" }], sourceClaimIds: ["claim-1"], recommendationRefs: ["建议：突出已有 React 经历"] }] };
    } else if (raw.includes("rag_mock_interview_feedback")) {
      const sourceId = raw.match(/(?:RESUME|JD|MATCH_GAP|KNOWLEDGE)-\d+/)?.[0] || "RESUME-3";
      output = { score: 82, strengths: [{ text: "回答结构清晰", sourceIds: ["USER_ANSWER", sourceId] }], weaknesses: [{ text: "技术取舍仍可展开", sourceIds: [sourceId] }], missingPoints: [{ text: "补充验证方法", sourceIds: [sourceId] }], improvedAnswer: "我会围绕已有 React 事实说明技术取舍，不补写未证明经历。", followUpQuestion: "你会如何验证方案收益？" };
    } else if (raw.includes("rag_mock_interview_questions")) output = questionPayload;
    else if (raw.includes("bounded_agent_final_plan")) output = { verifiedResumeFacts: [{ text: "用户具备 React 组件开发经验。", sourceIds: ["RESUME-3"] }], externalKnowledge: [{ text: "React 能力应基于可验证的项目结果。", sourceIds: ["KNOWLEDGE-1"] }], matchGaps: [{ text: "缺少量化结果", sourceIds: ["MATCH_REPORT-1"] }], recommendations: [{ text: "建议：突出已有 React 经历", sourceIds: ["MATCH_REPORT-2"] }] };
    else { const action = agentActions[Math.min(providerState.planner, agentActions.length - 1)]; providerState.planner += 1; output = { action, reason: `执行受限步骤 ${providerState.planner}`, query: action === "RETRIEVE_KNOWLEDGE" ? "React 可验证 项目结果" : "", done: action === "PRODUCE_PLAN" }; }
    res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ output_text: JSON.stringify(output) }));
  });
  const qdrant = createServer((_req, res) => res.writeHead(200, { "Content-Type": "application/json" }).end("{}"));
  const providerPort = await listen(provider), qdrantPort = await listen(qdrant);
  const probe = createServer(), apiPort = await listen(probe); probe.close();
  const token = "mysql-stage10-owner-token";
  const snapshot = resumeSnapshot();
  const jdRaw = "前端岗位负责 React 组件开发，要求 React 与 TypeScript。"; const jdHash = sha(jdRaw);
  const seed = {
    users: [{ id: 1, username: "mysql-owner", passwordHash: "x", role: "USER", status: 1 }], sessions: [{ id: 1, userId: 1, tokenHash: sessionHash(token), expiresAt: new Date(Date.now() + 3600000).toISOString() }],
    resumes: [{ ...snapshot, version: 1 }], resumeHistories: [{ id: 1, resumeId: 1, resumeVersion: 1, version: 1, contentHash: snapshot.contentHash, snapshot }],
    jobDescriptions: [{ id: 1, userId: 1, title: "前端开发", rawText: jdRaw, rawTextHash: jdHash, normalizedText: jdRaw, normalizedTextHash: jdHash, currentParseResultId: 1, parseStatus: "SUCCEEDED" }],
    jobDescriptionParseResults: [{ id: 1, userId: 1, jobDescriptionId: 1, rawTextHash: jdHash, status: "SUCCEEDED", parsedData: { jobTitle: { text: "前端开发", evidence: "前端岗位" }, seniority: { text: "中级", evidence: "前端" }, requiredSkills: [{ text: "React", evidence: "要求 React" }, { text: "TypeScript", evidence: "TypeScript" }], preferredSkills: [], technicalKeywords: [{ text: "React", evidence: "React" }], responsibilities: [{ text: "组件开发", evidence: "组件开发" }] } }],
    jobApplications: [], resumeJobMatches: [], matchReports: [], suggestionRuns: [], resumeSuggestions: [], knowledgeRetrievalRuns: [], interviewSessions: [], interviewSessionQuestions: [], interviewAnswers: [], answerFeedbacks: [], agentRuns: [], agentSteps: [], mockInterviews: [],
    knowledgeDocuments: [{ id: 1, title: "前端能力标准", sourceName: "内部知识库", status: "PROCESSED", processingVersion: 1, vectorStatus: "INDEXED", activeIndexRunId: 11, documentType: "INTERVIEW_RUBRIC", jobFamily: "前端开发", seniority: "中级", skillTags: ["React", "TypeScript"], language: "zh-CN" }],
    knowledgeChunks: [{ id: 1, documentId: 1, processingVersion: 1, title: "React 评估", headingPath: [], content: "React 能力应基于可验证的项目结果", contentHash: sha("React 能力应基于可验证的项目结果") }],
    jobs: [{ id: 1, type: "GROUNDED_MATCH_REPORT", userId: 1, resourceId: 1, status: "COMPLETED", progress: 100, failureCode: null, createdAt: new Date().toISOString(), startedAt: new Date().toISOString(), completedAt: new Date().toISOString() }],
    aiSettingsByUser: { "1": { aiConfig: { provider: "OpenAI" }, aiProviderConfigs: { OpenAI: { baseUrl: "https://must-not-persist.invalid/v1", modelId: "mock", apiKey: "MUST_NOT_REACH_MYSQL", enabled: true } } } },
  };
  const persistence = createPersistence({ env: mysqlEnv, seedData: seed });
  const migration = await readFile(path.join(root, "database/migrations/010_production_hardening.sql"), "utf8");

  const start = () => {
    backendOutput = ""; providerState.planner = 0;
    backend = spawn(process.execPath, ["backend/server.js"], { cwd: root, env: { ...mysqlEnv, API_PORT: String(apiPort), OPENAI_API_KEY: "MYSQL-INTEGRATION-PROVIDER-SECRET", OPENAI_BASE_URL: `http://127.0.0.1:${providerPort}/v1`, OPENAI_MODEL: "deterministic-mysql", QDRANT_URL: `http://127.0.0.1:${qdrantPort}`, QDRANT_API_KEY: "", EMBEDDING_API_KEY: "" }, stdio: ["ignore", "pipe", "pipe"] });
    backend.stdout.on("data", (part) => { backendOutput += part; }); backend.stderr.on("data", (part) => { backendOutput += part; });
  };
  const stop = async () => { if (backend?.pid && backend.exitCode === null) backend.kill("SIGTERM"); for (let i = 0; i < 100 && backend?.exitCode === null; i += 1) await wait(20); };
  const healthy = async () => { for (let i = 0; i < 160; i += 1) { try { if ((await fetch(`http://127.0.0.1:${apiPort}/health`)).ok) return; } catch {} await wait(25); } throw new Error(`backend unavailable: ${backendOutput.slice(-1500)}`); };
  const call = async (pathname, body, expected = 200) => { const response = await fetch(`http://127.0.0.1:${apiPort}${pathname}`, { method: body === undefined ? "GET" : "POST", headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) }); const data = await response.json(); assert.equal(response.status, expected, `${pathname}: ${JSON.stringify(data)}`); return data; };

  try {
    await sql.query(migration); await sql.query(migration);
    await sql.query("DELETE FROM rag_job; DELETE FROM lingxi_entity_projection; DELETE FROM lingxi_store_snapshot");
    await persistence.write(seed);
    assert.equal((await persistence.read()).users[0].username, "mysql-owner");
    const beforeRollback = JSON.stringify(await persistence.read());
    const broken = structuredClone(await persistence.read()); broken.matchReports = [{ id: 77, userId: 1 }, { id: 77, userId: 1 }];
    await assert.rejects(() => persistence.write(broken));
    assert.equal(JSON.stringify(await persistence.read()), beforeRollback, "failed projection write must rollback snapshot and projections atomically");
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM lingxi_entity_projection WHERE entity_type='matchReports'"))[0][0].count, 0);
    assert.equal((await sql.query("SELECT COUNT(*) AS count FROM rag_job"))[0][0].count, 1);

    start(); await healthy();
    assert.equal((await fetch(`http://127.0.0.1:${apiPort}/ready`)).status, 200);
    const application = (await call("/api/job-applications", { resumeId: 1, resumeVersionId: 1, jobDescriptionId: 1 }, 201)).item;
    const match = (await call(`/api/job-applications/${application.id}/matches`, {}, 201)).item;
    const report = (await call(`/api/job-applications/${application.id}/reports`, { matchId: match.id, searchMode: "KEYWORD" }, 201)).item;
    const suggestionRun = (await call(`/api/match-reports/${report.id}/resume-suggestions`, {}, 201)).item;
    const suggestion = suggestionRun.suggestions.find((item) => item.suggestionType === "REWRITE");
    const accepted = await call(`/api/resume-suggestions/${suggestion.id}/accept`, { expectedBaseResumeVersion: 1 }, 201);
    const interview = (await call(`/api/job-applications/${application.id}/interview-sessions`, { matchReportId: report.id, searchMode: "KEYWORD" }, 201)).item;
    await call(`/api/interview-sessions/${interview.id}/questions/${interview.questions[0].id}/answers`, { answerText: "我会围绕已有 React 事实说明技术取舍。" }, 201);
    const agent = (await call(`/api/job-applications/${application.id}/agent-runs`, { matchReportId: report.id, objective: "制定证据化提升计划", maxSteps: 6, searchMode: "KEYWORD" }, 201)).item;
    assert.equal(agent.status, "COMPLETED"); assert.equal(accepted.resumeVersion.version, 2);

    const expectedTypes = ["knowledgeRetrievalRuns", "matchReports", "suggestionRuns", "resumeSuggestions", "resumeHistories", "interviewSessions", "interviewSessionQuestions", "interviewAnswers", "answerFeedbacks", "agentRuns", "agentSteps", "jobs"];
    const [projectionRows] = await sql.query("SELECT entity_type, COUNT(*) AS count FROM lingxi_entity_projection GROUP BY entity_type");
    const counts = Object.fromEntries(projectionRows.map((row) => [row.entity_type, Number(row.count)]));
    for (const type of expectedTypes) assert.ok(counts[type] > 0, `${type} must be projected into MySQL`);
    const [direct] = await sql.query("SELECT payload_json FROM lingxi_store_snapshot WHERE id=1");
    const directStore = typeof direct[0].payload_json === "string" ? JSON.parse(direct[0].payload_json) : direct[0].payload_json;
    assert.equal(directStore.matchReports.some((item) => item.id === report.id), true);
    assert.equal(directStore.resumeHistories.some((item) => item.resumeVersion === 2), true);
    assert.equal(directStore.interviewSessions.some((item) => item.id === interview.id), true);
    assert.equal(directStore.agentRuns.some((item) => item.id === agent.id), true);
    const storedText = JSON.stringify(directStore);
    for (const forbidden of ["MUST_NOT_REACH_MYSQL", "MYSQL-INTEGRATION-PROVIDER-SECRET", "bounded_agent_final_plan", "\"embedding\"", "\"vector\""]) assert.equal(storedText.includes(forbidden), false, `MySQL privacy leak: ${forbidden}`);

    await stop(); start(); await healthy();
    assert.equal((await call(`/api/match-reports/${report.id}`)).item.id, report.id);
    assert.equal((await call("/api/resumes/1/versions")).items.some((item) => item.resumeVersion === 2 || item.version === 2), true);
    assert.equal((await call(`/api/interview-sessions/${interview.id}`)).item.id, interview.id);
    assert.equal((await call(`/api/agent-runs/${agent.id}`)).item.id, agent.id);
    const [versionRows] = await sql.query("SELECT VERSION() AS version");
    console.log(`MySQL integration passed: version=${versionRows[0].version}; database=${mysqlEnv.MYSQL_DATABASE}; migration repeatable; read/write, commit/rollback, projections, rag_job, workflow, readiness, privacy, and restart recovery verified.`);
  } finally {
    await stop(); await persistence.close(); await sql.end(); provider.close(); qdrant.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
