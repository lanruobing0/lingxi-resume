import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { selectHistoryMatch, selectLatestFailedMatch } from "../src/matchState.js";

const projectRoot = path.resolve(import.meta.dirname, "..");
const pii = { name: "Match Privacy Name", email: "match-private@example.test", phone: "13800138001", website: "https://match-private.example.test", city: "Private Match City", profile: "Private Match Portfolio" };
const prompts = [];
const historyAttemptCount = new Map();

function listen(server) { return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port))); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
function tokenHash(token) { return createHash("sha256").update(token).digest("base64url"); }

function jobFixture(kind) {
  if (kind === "react") return {
    title: "React 工程师",
    rawText: "负责 React 前端开发，要求 React、TypeScript、性能优化、SSR、本科及以上学历、2 年及以上经验。",
    responsibility: "负责 React 前端开发",
    required: ["React", "TypeScript"],
    preferred: ["性能优化", "SSR"],
  };
  return {
    title: "Java 工程师",
    rawText: "负责 Java 服务开发，要求 Java、Spring Boot、Redis、Docker、本科及以上学历、2 年及以上经验。",
    responsibility: "负责 Java 服务开发",
    required: ["Java", "Spring Boot"],
    preferred: ["Redis", "Docker"],
  };
}

function parsedJob(kind) {
  const job = jobFixture(kind);
  return {
    jobTitle: { text: job.title, evidence: "" }, companyName: { text: "未明确", evidence: "" },
    responsibilities: [{ text: job.responsibility, evidence: job.responsibility }],
    requiredSkills: job.required.map((text) => ({ text, evidence: text })),
    preferredSkills: job.preferred.map((text) => ({ text, evidence: text })),
    educationRequirements: [{ text: "本科及以上学历", evidence: "本科及以上学历" }],
    experienceRequirements: [{ text: "2 年及以上经验", evidence: "2 年及以上经验" }],
    technicalKeywords: [{ text: job.required[0], evidence: job.required[0] }], softSkills: [], seniority: { text: "未明确", evidence: "" }, uncertainties: [],
  };
}

function skill(skillName, matchStatus, resumeEvidence, jdEvidence, confidence = 93) {
  return { skillName, matchStatus, resumeEvidence, jdEvidence, explanation: matchStatus === "NOT_FOUND" ? "模型原始措辞会被服务端规范化" : "简历中有明确技术证据", confidence };
}

function matchReport({ resumeKind, jdKind, zero = false, forged = false, crossResumeEvidence = false, crossJdEvidence = false } = {}) {
  const job = jobFixture(jdKind);
  const matched = !zero && resumeKind === jdKind;
  const resumeSkill = resumeKind === "react" ? "React" : "Java";
  const projectEvidence = resumeKind === "react" ? "前端性能优化 30%" : "订单系统提升 20%";
  const dimensionScores = zero ? [0, 0, 0, 0, 0, 0] : matched ? [100, 80, 0, 0, 0, 0] : [0, 0, 0, 0, 0, 0];
  const dimensions = [
    ["required_skills", "必备技能", [matched ? resumeSkill : ""].filter(Boolean), [job.required[0]]],
    ["project_relevance", "项目相关性", [matched ? projectEvidence : ""].filter(Boolean), [job.responsibility]],
    ["keyword_coverage", "关键词覆盖", [], [job.required[1]]],
    ["experience", "经验匹配", [], ["2 年及以上经验"]],
    ["education", "教育背景", [], ["本科及以上学历"]],
    ["expression", "表达质量", [], []],
  ].map(([key, label, resumeEvidence, jdEvidence], index) => ({
    key, label, score: dimensionScores[index], summary: "基于锁定材料的匹配结论",
    resumeEvidence: forged && key === "required_skills" ? ["伪造的简历证据"] : crossResumeEvidence && key === "required_skills" ? ["订单系统提升 20%"] : resumeEvidence,
    jdEvidence: crossJdEvidence && key === "required_skills" ? ["负责 Java 服务开发"] : jdEvidence,
    missingEvidence: dimensionScores[index] === 0 ? ["待补充"] : [], suggestions: ["按 JD 补充可核验成果"],
  }));
  const requiredSkill = job.required[0];
  const preferredSkill = job.preferred[0];
  const missingPreferredSkill = job.preferred[1];
  const matchedRequiredSkills = matched ? [skill(requiredSkill, "MATCHED", [resumeSkill], [requiredSkill])] : [];
  const missingRequiredSkills = matched ? [] : [skill(requiredSkill, "NOT_FOUND", [], [requiredSkill], 78)];
  const matchedPreferredSkills = matched ? [skill(preferredSkill, "MATCHED", [preferredSkill], [preferredSkill])] : [];
  const missingPreferredSkills = [skill(missingPreferredSkill, "NOT_FOUND", [], [missingPreferredSkill], 78)];
  return {
    totalScore: 99,
    summary: "该报告只基于锁定简历与真实 JD。",
    dimensions,
    matchedRequiredSkills,
    partiallyMatchedRequiredSkills: [],
    missingRequiredSkills,
    matchedPreferredSkills,
    missingPreferredSkills,
    matchedKeywords: matched ? [skill(requiredSkill, "MATCHED", [resumeSkill], [requiredSkill])] : [],
    missingKeywords: matched ? [] : [skill(requiredSkill, "NOT_FOUND", [], [requiredSkill], 78)],
    strongestResumeEvidence: matched ? [projectEvidence] : [resumeSkill],
    risks: ["当前简历中未找到相关证据"],
    prioritizedSuggestions: ["优先补充与 JD 必备项相关的真实项目证据"],
  };
}

async function main() {
  const mockAi = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const schemaName = request.text?.format?.name;
    const prompt = request.input?.[1]?.content?.[0]?.text || "";
    prompts.push({ schemaName, prompt });
    const jdKind = prompt.includes("React 前端开发") ? "react" : "java";
    const resumeKind = prompt.includes("React 简历") ? "react" : "java";
    const historyAttemptKey = schemaName === "resume_job_match" && prompt.includes("FAIL_AFTER_SUCCESS") ? prompt : "";
    const historyAttempt = historyAttemptKey ? (historyAttemptCount.get(historyAttemptKey) || 0) + 1 : 0;
    if (historyAttemptKey) historyAttemptCount.set(historyAttemptKey, historyAttempt);
    const data = schemaName === "job_description_parse"
      ? parsedJob(jdKind)
      : matchReport({
        resumeKind,
        jdKind,
        zero: prompt.includes("ZERO_MATCH"),
        forged: prompt.includes("FORGED_MATCH") || historyAttempt > 1,
        crossResumeEvidence: prompt.includes("CROSS_RESUME_EVIDENCE"),
        crossJdEvidence: prompt.includes("CROSS_JD_EVIDENCE"),
      });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(data) }));
  });
  const mockPort = await listen(mockAi);
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-match-test-")); await mkdir(dataDir, { recursive: true });
  const tokenA = randomBytes(24).toString("hex"); const tokenB = randomBytes(24).toString("hex");
  const store = {
    users: [{ id: 7, username: "match-a", passwordHash: "test", role: "USER", status: 1 }, { id: 8, username: "match-b", passwordHash: "test", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 7, tokenHash: tokenHash(tokenA), expiresAt: new Date(Date.now() + 60_000).toISOString() }, { id: 2, userId: 8, tokenHash: tokenHash(tokenB), expiresAt: new Date(Date.now() + 60_000).toISOString() }],
    resumes: [
      { id: 11, userId: 7, version: 3, title: "Java 简历", currentPosition: "后端工程师", realName: pii.name, email: pii.email, phone: pii.phone, website: pii.website, city: pii.city, profileFields: [{ label: "作品集", value: pii.profile }], selfEvaluation: "Java 与 Spring Boot 开发", sectionContent: { "专业技能": ["Java", "Spring Boot", "Redis"], "项目经历": ["订单系统提升 20%"] }, sectionDetails: {}, moduleOrder: ["专业技能", "项目经历"] },
      { id: 12, userId: 7, version: 1, title: "React 简历", currentPosition: "前端工程师", selfEvaluation: "React 与 TypeScript 开发", sectionContent: { "专业技能": ["React", "TypeScript", "性能优化"], "项目经历": ["前端性能优化 30%"] }, sectionDetails: {}, moduleOrder: ["专业技能", "项目经历"] },
    ],
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
  async function createParsedJob(kind, rawText = jobFixture(kind).rawText) {
    const job = await request(tokenA, "/api/job-descriptions", { method: "POST", body: JSON.stringify({ title: jobFixture(kind).title, rawText }) }, 201);
    const parse = await request(tokenA, `/api/job-descriptions/${job.item.id}/parse`, { method: "POST" }, 201);
    return { job: job.item, parse: parse.item };
  }
  async function createApplication(resumeId, resumeVersionId, jobDescriptionId) {
    return (await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId, resumeVersionId, jobDescriptionId }) }, 201)).item;
  }
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) { try { await request(tokenA, "/api/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); } }
    await request(tokenA, "/api/resumes/11", { method: "PUT", body: JSON.stringify({ summary: "为匹配测试创建锁定版本" }) });
    await request(tokenA, "/api/resumes/12", { method: "PUT", body: JSON.stringify({ summary: "为 React 匹配测试创建锁定版本" }) });
    const javaVersionId = (await request(tokenA, "/api/resumes/11/versions")).items[0].id;
    const reactVersionId = (await request(tokenA, "/api/resumes/12/versions")).items[0].id;

    const java = await createParsedJob("java");
    const javaApplication = await createApplication(11, javaVersionId, java.job.id);
    const reactToJavaApplication = await createApplication(12, reactVersionId, java.job.id);
    assert.equal(javaApplication.jobDescriptionParseResultId, java.parse.id);
    const javaMatch = await request(tokenA, `/api/job-applications/${javaApplication.id}/matches`, { method: "POST" }, 201);
    const reactToJavaMatch = await request(tokenA, `/api/job-applications/${reactToJavaApplication.id}/matches`, { method: "POST" }, 201);
    assert.equal(javaMatch.item.status, "COMPLETED"); assert.equal(javaMatch.item.totalScore, 50, "server must ignore the AI totalScore and use fixed weights");
    assert.equal(javaMatch.item.report.dimensions[0].weightedScore, 30);
    assert.equal(javaMatch.item.report.matchedRequiredSkills[0].skillName, "Java");
    assert.equal(javaMatch.item.report.matchedPreferredSkills[0].skillName, "Redis");
    assert.equal(javaMatch.item.report.missingPreferredSkills[0].skillName, "Docker");
    assert.equal(reactToJavaMatch.item.report.missingRequiredSkills[0].skillName, "Java");
    assert.equal(reactToJavaMatch.item.report.missingRequiredSkills[0].explanation, "当前简历中未找到相关证据");
    assert.equal(JSON.stringify(reactToJavaMatch.item.report).includes("订单系统提升 20%"), false, "React report must not cite Java resume evidence");
    assert.notEqual(javaMatch.item.resumeId, reactToJavaMatch.item.resumeId);
    assert.notEqual(javaMatch.item.resumeVersion, reactToJavaMatch.item.resumeVersion);
    assert.notEqual(javaMatch.item.resumeContentHash, reactToJavaMatch.item.resumeContentHash);
    assert.equal((await request(tokenA, `/api/job-applications/${javaApplication.id}/matches`)).items.length, 1);
    assert.equal((await request(tokenA, `/api/job-applications/${reactToJavaApplication.id}/matches`)).items.length, 1);
    await request(tokenB, `/api/resume-job-matches/${javaMatch.item.id}`, {}, 404);
    await request(tokenB, `/api/job-applications/${javaApplication.id}/matches`, {}, 404);
    await request(tokenA, `/api/resume-job-matches/${javaMatch.item.id}/retry`, { method: "POST" }, 409);

    const react = await createParsedJob("react");
    const javaToReactApplication = await createApplication(11, javaVersionId, react.job.id);
    const javaToReactMatch = await request(tokenA, `/api/job-applications/${javaToReactApplication.id}/matches`, { method: "POST" }, 201);
    assert.notEqual(javaMatch.item.jobDescriptionId, javaToReactMatch.item.jobDescriptionId);
    assert.notEqual(javaMatch.item.jobDescriptionParseResultId, javaToReactMatch.item.jobDescriptionParseResultId);
    assert.notEqual(javaMatch.item.jobDescriptionRawTextHash, javaToReactMatch.item.jobDescriptionRawTextHash);
    assert.equal(javaToReactMatch.item.report.missingRequiredSkills[0].skillName, "React");
    assert.equal(JSON.stringify(javaMatch.item.report).includes("负责 React 前端开发"), false, "Java JD report must not cite React JD evidence");
    assert.equal(JSON.stringify(javaToReactMatch.item.report).includes("负责 Java 服务开发"), false, "React JD report must not cite Java JD evidence");
    assert.equal((await request(tokenA, `/api/job-applications/${javaToReactApplication.id}/matches`)).items.length, 1);

    const zero = await createParsedJob("java", `ZERO_MATCH ${jobFixture("java").rawText}`);
    const zeroApplication = await createApplication(11, javaVersionId, zero.job.id);
    const zeroMatch = await request(tokenA, `/api/job-applications/${zeroApplication.id}/matches`, { method: "POST" }, 201);
    assert.equal(zeroMatch.item.totalScore, 0, "0 scores must remain 0");

    const history = await createParsedJob("java", `FAIL_AFTER_SUCCESS ${jobFixture("java").rawText}`);
    const historyApplication = await createApplication(11, javaVersionId, history.job.id);
    const completedHistoryMatch = await request(tokenA, `/api/job-applications/${historyApplication.id}/matches`, { method: "POST" }, 201);
    const completedReport = completedHistoryMatch.item.report;
    await request(tokenA, `/api/job-applications/${historyApplication.id}/matches`, { method: "POST" }, 422);
    const historyAfterFailure = await request(tokenA, `/api/job-applications/${historyApplication.id}/matches`);
    assert.equal(historyAfterFailure.items.length, 2);
    const failedHistoryMatch = historyAfterFailure.items.find((item) => item.status === "FAILED");
    const completedHistorySummary = historyAfterFailure.items.find((item) => item.status === "COMPLETED");
    assert.equal(failedHistoryMatch.totalScore, null); assert.equal(failedHistoryMatch.hasReport, false);
    assert.ok(completedHistorySummary);
    assert.deepEqual((await request(tokenA, `/api/resume-job-matches/${completedHistorySummary.id}`)).item.report, completedReport, "a failure must not overwrite the earlier completed report");
    assert.equal(selectHistoryMatch(historyAfterFailure.items, { autoSelectCompleted: false }), null, "a failed refresh must not auto-select an older completed report");
    assert.equal(selectLatestFailedMatch(historyAfterFailure.items).id, failedHistoryMatch.id);

    const crossResume = await createParsedJob("java", `CROSS_RESUME_EVIDENCE ${jobFixture("java").rawText}`);
    const crossResumeApplication = await createApplication(12, reactVersionId, crossResume.job.id);
    await request(tokenA, `/api/job-applications/${crossResumeApplication.id}/matches`, { method: "POST" }, 422);
    assert.equal((await request(tokenA, `/api/job-applications/${crossResumeApplication.id}/matches`)).items[0].status, "FAILED", "cross-resume evidence must fail validation");
    const crossJd = await createParsedJob("react", `CROSS_JD_EVIDENCE ${jobFixture("react").rawText}`);
    const crossJdApplication = await createApplication(11, javaVersionId, crossJd.job.id);
    await request(tokenA, `/api/job-applications/${crossJdApplication.id}/matches`, { method: "POST" }, 422);
    assert.equal((await request(tokenA, `/api/job-applications/${crossJdApplication.id}/matches`)).items[0].status, "FAILED", "cross-JD evidence must fail validation");

    await request(tokenA, `/api/job-descriptions/${java.job.id}`, { method: "PUT", body: JSON.stringify({ rawText: `FORGED_MATCH ${jobFixture("java").rawText}` }) });
    await request(tokenA, `/api/job-applications/${javaApplication.id}/matches`, { method: "POST" }, 409);
    await request(tokenA, "/api/ai-config", { method: "PUT", body: JSON.stringify({ enabled: false }) });
    const disabledApplication = await createApplication(11, javaVersionId, react.job.id);
    await request(tokenA, `/api/job-applications/${disabledApplication.id}/matches`, { method: "POST" }, 400);
    const disabledHistory = await request(tokenA, `/api/job-applications/${disabledApplication.id}/matches`);
    assert.equal(disabledHistory.items[0].failureCode, "AI_NOT_CONFIGURED");
    for (const prompt of prompts.filter((item) => item.schemaName === "resume_job_match")) for (const value of Object.values(pii)) assert.equal(prompt.prompt.includes(value), false, "match prompt leaked PII");

    await request(tokenA, `/api/job-descriptions/${java.job.id}`, { method: "DELETE" }, 204);
    await request(tokenA, `/api/job-descriptions/${java.job.id}`, {}, 404);
    const applicationsAfterJavaDeletion = await request(tokenA, "/api/job-applications");
    assert.equal(applicationsAfterJavaDeletion.items.some((item) => item.jobDescriptionId === java.job.id), false);
    await request(tokenA, `/api/resume-job-matches/${javaMatch.item.id}`, {}, 404);
    assert.ok(applicationsAfterJavaDeletion.items.some((item) => item.id === javaToReactApplication.id));
    assert.equal((await request(tokenA, `/api/resume-job-matches/${javaToReactMatch.item.id}`)).item.id, javaToReactMatch.item.id);
    const saved = JSON.parse(await readFile(path.join(dataDir, "store.json"), "utf8"));
    assert.equal(saved.resumeJobMatches.some((item) => item.jobDescriptionId === java.job.id), false);
    assert.ok(saved.resumeJobMatches.some((item) => item.jobDescriptionId === react.job.id));
    console.log("Resume-job match integration passed: fixed scores, cross-resume/JD isolation, evidence validation, failed-history protection, privacy, and JD deletion cascade.");
  } finally {
    if (backend.exitCode === null) { backend.kill(); await new Promise((resolve) => backend.once("exit", resolve)); }
    await close(mockAi); await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
