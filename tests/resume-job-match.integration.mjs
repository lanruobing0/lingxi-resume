import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const pii = { name: "Match Privacy Name", email: "match-private@example.test", phone: "13800138001", website: "https://match-private.example.test", city: "Private Match City", profile: "Private Match Portfolio" };
const prompts = [];

function listen(server) { return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port))); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
function tokenHash(token) { return createHash("sha256").update(token).digest("base64url"); }

function parsedJob() {
  return {
    jobTitle: { text: "Java 工程师", evidence: "" }, companyName: { text: "未明确", evidence: "" },
    responsibilities: [{ text: "负责服务开发", evidence: "负责服务开发" }],
    requiredSkills: [{ text: "Java", evidence: "Java" }, { text: "Spring Boot", evidence: "Spring Boot" }],
    preferredSkills: [{ text: "Redis", evidence: "Redis" }], educationRequirements: [{ text: "本科及以上学历", evidence: "本科及以上学历" }],
    experienceRequirements: [{ text: "2 年及以上经验", evidence: "2 年及以上经验" }], technicalKeywords: [{ text: "Java", evidence: "Java" }], softSkills: [], seniority: { text: "未明确", evidence: "" }, uncertainties: [],
  };
}

function matchReport({ zero = false, forged = false } = {}) {
  const score = zero ? 0 : undefined;
  const dimensions = [
    ["required_skills", "必备技能", score ?? 100, ["Java"], ["Java"]],
    ["project_relevance", "项目相关性", score ?? 80, ["订单系统提升 20%"], ["负责服务开发"]],
    ["keyword_coverage", "关键词覆盖", score ?? 0, [], ["Spring Boot"]],
    ["experience", "经验匹配", score ?? 0, [], ["2 年及以上经验"]],
    ["education", "教育背景", score ?? 0, [], ["本科及以上学历"]],
    ["expression", "表达质量", score ?? 0, [], []],
  ].map(([key, label, dimensionScore, resumeEvidence, jdEvidence]) => ({ key, label, score: dimensionScore, summary: "基于锁定材料的匹配结论", resumeEvidence: forged && key === "required_skills" ? ["伪造的简历证据"] : resumeEvidence, jdEvidence, missingEvidence: dimensionScore === 0 ? ["待补充"] : [], suggestions: ["按 JD 补充可核验成果"] }));
  const matched = { skillName: "Java", matchStatus: "MATCHED", resumeEvidence: ["Java"], jdEvidence: ["Java"], explanation: "简历中有明确技术证据", confidence: 93 };
  const missing = { skillName: "Redis", matchStatus: "NOT_FOUND", resumeEvidence: [], jdEvidence: ["Redis"], explanation: "模型原始措辞会被服务端规范化", confidence: 78 };
  return { totalScore: 99, summary: "该报告只基于锁定简历与真实 JD。", dimensions, matchedRequiredSkills: [matched], partiallyMatchedRequiredSkills: [], missingRequiredSkills: [missing], matchedPreferredSkills: [], missingPreferredSkills: [missing], matchedKeywords: [{ ...matched, skillName: "Spring Boot", resumeEvidence: ["Spring Boot"], jdEvidence: ["Spring Boot"] }], missingKeywords: [], strongestResumeEvidence: ["订单系统提升 20%"], risks: ["当前简历中未找到相关证据"], prioritizedSuggestions: ["优先补充与 JD 必备项相关的真实项目证据"] };
}

async function main() {
  const mockAi = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const schemaName = request.text?.format?.name;
    const prompt = request.input?.[1]?.content?.[0]?.text || "";
    prompts.push({ schemaName, prompt });
    let data = schemaName === "job_description_parse" ? parsedJob() : matchReport({ zero: prompt.includes("ZERO_MATCH"), forged: prompt.includes("FORGED_MATCH") });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(data) }));
  });
  const mockPort = await listen(mockAi);
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-match-test-")); await mkdir(dataDir, { recursive: true });
  const tokenA = randomBytes(24).toString("hex"); const tokenB = randomBytes(24).toString("hex");
  const store = {
    users: [{ id: 7, username: "match-a", passwordHash: "test", role: "USER", status: 1 }, { id: 8, username: "match-b", passwordHash: "test", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 7, tokenHash: tokenHash(tokenA), expiresAt: new Date(Date.now() + 60_000).toISOString() }, { id: 2, userId: 8, tokenHash: tokenHash(tokenB), expiresAt: new Date(Date.now() + 60_000).toISOString() }],
    resumes: [{ id: 11, userId: 7, version: 3, title: "Java 简历", currentPosition: "后端工程师", realName: pii.name, email: pii.email, phone: pii.phone, website: pii.website, city: pii.city, profileFields: [{ label: "作品集", value: pii.profile }], selfEvaluation: "Java 与 Spring Boot 开发", sectionContent: { "专业技能": ["Java", "Spring Boot"], "项目经历": ["订单系统提升 20%"] }, sectionDetails: {}, moduleOrder: ["专业技能", "项目经历"] }],
    resumeHistories: [], analysisRecords: [], optimizeRecords: [], grammarRecords: [], interviewQuestions: [], jobPositions: [], jobDescriptions: [], jobDescriptionParseResults: [], jobApplications: [], resumeJobMatches: [], mockInterviews: [], interviewAnswers: [], systemNotices: [],
  };
  await writeFile(path.join(dataDir, "store.json"), JSON.stringify(store), "utf8");
  const probe = createServer(); const apiPort = await listen(probe); await close(probe);
  const backend = spawn(process.execPath, ["backend/server.js"], { cwd: projectRoot, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dataDir, OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, OPENAI_MODEL: "test-model" }, stdio: ["ignore", "pipe", "pipe"] });
  const base = `http://127.0.0.1:${apiPort}`;
  async function request(token, pathname, options = {}, expected = 200) {
    const response = await fetch(`${base}${pathname}`, { ...options, headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = response.status === 204 ? {} : await response.json();
    assert.equal(response.status, expected, `${pathname}: ${JSON.stringify(data)}`); return data;
  }
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) { try { await request(tokenA, "/api/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); } }
    await request(tokenA, "/api/resumes/11", { method: "PUT", body: JSON.stringify({ summary: "为匹配测试创建锁定版本" }) });
    const resumeVersionId = (await request(tokenA, "/api/resumes/11/versions")).items[0].id;
    const jd = await request(tokenA, "/api/job-descriptions", { method: "POST", body: JSON.stringify({ title: "Java 工程师", rawText: "负责服务开发，要求 Java、Spring Boot、Redis、本科及以上学历、2 年及以上经验。" }) }, 201);
    const parse = await request(tokenA, `/api/job-descriptions/${jd.item.id}/parse`, { method: "POST" }, 201);
    const application = await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId, jobDescriptionId: jd.item.id }) }, 201);
    assert.ok(application.item.resumeVersionId);
    assert.equal(application.item.jobDescriptionParseResultId, parse.item.id);
    const first = await request(tokenA, `/api/job-applications/${application.item.id}/matches`, { method: "POST" }, 201);
    assert.equal(first.item.status, "COMPLETED"); assert.equal(first.item.totalScore, 50, "server must ignore the AI totalScore and use fixed weights");
    assert.equal(first.item.report.missingRequiredSkills[0].explanation, "当前简历中未找到相关证据");
    assert.equal(first.item.report.dimensions[0].weightedScore, 30);
    const history = await request(tokenA, `/api/job-applications/${application.item.id}/matches`);
    assert.equal(history.items.length, 1); assert.equal(history.items[0].hasReport, true);
    const detail = await request(tokenA, `/api/resume-job-matches/${first.item.id}`); assert.equal(detail.item.resumeContentHash, application.item.resumeContentHash);
    await request(tokenB, `/api/resume-job-matches/${first.item.id}`, {}, 404);
    await request(tokenB, `/api/job-applications/${application.item.id}/matches`, {}, 404);
    await request(tokenA, `/api/resume-job-matches/${first.item.id}/retry`, { method: "POST" }, 409);
    await request(tokenA, `/api/job-descriptions/${jd.item.id}`, { method: "PUT", body: JSON.stringify({ rawText: "ZERO_MATCH 负责服务开发，要求 Java、Spring Boot、Redis、本科及以上学历、2 年及以上经验。" }) });
    await request(tokenA, `/api/job-applications/${application.item.id}/matches`, { method: "POST" }, 409);
    const zeroParse = await request(tokenA, `/api/job-descriptions/${jd.item.id}/parse`, { method: "POST" }, 201);
    const zeroApplication = await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId, jobDescriptionId: jd.item.id }) }, 201);
    assert.equal(zeroApplication.item.jobDescriptionParseResultId, zeroParse.item.id);
    const zero = await request(tokenA, `/api/job-applications/${zeroApplication.item.id}/matches`, { method: "POST" }, 201); assert.equal(zero.item.totalScore, 0);
    await request(tokenA, `/api/job-descriptions/${jd.item.id}`, { method: "PUT", body: JSON.stringify({ rawText: "FORGED_MATCH 负责服务开发，要求 Java、Spring Boot、Redis、本科及以上学历、2 年及以上经验。" }) });
    await request(tokenA, `/api/job-descriptions/${jd.item.id}/parse`, { method: "POST" }, 201);
    const forgedApplication = await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId, jobDescriptionId: jd.item.id }) }, 201);
    await request(tokenA, `/api/job-applications/${forgedApplication.item.id}/matches`, { method: "POST" }, 422);
    const failedHistory = await request(tokenA, `/api/job-applications/${forgedApplication.item.id}/matches`);
    assert.equal(failedHistory.items[0].status, "FAILED"); assert.equal(failedHistory.items[0].hasReport, false);
    await request(tokenA, `/api/resume-job-matches/${failedHistory.items[0].id}/retry`, { method: "POST" }, 422);
    await request(tokenA, "/api/ai-config", { method: "PUT", body: JSON.stringify({ enabled: false }) });
    const disabledApplication = await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId, jobDescriptionId: jd.item.id }) }, 201);
    await request(tokenA, `/api/job-applications/${disabledApplication.item.id}/matches`, { method: "POST" }, 400);
    const disabledHistory = await request(tokenA, `/api/job-applications/${disabledApplication.item.id}/matches`); assert.equal(disabledHistory.items[0].failureCode, "AI_NOT_CONFIGURED");
    for (const prompt of prompts.filter((item) => item.schemaName === "resume_job_match")) for (const value of Object.values(pii)) assert.equal(prompt.prompt.includes(value), false, "match prompt leaked PII");
    await request(tokenA, "/api/resumes/11", { method: "DELETE" }, 204);
    const saved = JSON.parse(await readFile(path.join(dataDir, "store.json"), "utf8"));
    assert.equal(saved.jobApplications.some((item) => item.resumeId === 11), false); assert.equal(saved.resumeJobMatches.some((item) => item.resumeId === 11), false);
    console.log("Resume-job match integration passed: fixed scores, snapshots, evidence checks, privacy, failures, isolation, and deletion cascade.");
  } finally {
    if (backend.exitCode === null) { backend.kill(); await new Promise((resolve) => backend.once("exit", resolve)); }
    await close(mockAi); await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
