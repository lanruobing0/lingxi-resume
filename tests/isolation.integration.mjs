import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const pii = { name: "Privacy Test Name", email: "privacy-test@example.test", phone: "13800138000", website: "https://private.example.test", city: "Private City", profileValue: "Private Portfolio" };
const prompts = [];

function listen(server) { return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port))); }
function close(server) { return new Promise((resolve) => server.close(resolve)); }
function tokenHash(token) { return createHash("sha256").update(token).digest("base64url"); }
function aiResult(schemaName) {
  if (schemaName === "resume_analysis") return { totalScore: 63, completenessScore: 47, matchScore: 10, keywordScore: 92, projectScore: 0, analysisResult: "测试诊断结论", keywords: ["Java", "Spring", "SQL", "Redis", "Docker"], suggestions: ["建议一", "建议二", "建议三"] };
  if (schemaName === "resume_optimize") return { optimizedContent: "优化后的项目表述" };
  if (schemaName === "resume_grammar_check") return { score: 91, issues: [] };
  if (schemaName === "interview_opening") return { questionText: "请介绍一个项目成果。", questionType: "项目经历" };
  if (schemaName === "interview_feedback") return { score: 88, feedback: "回答具体。", referenceAnswer: "参考回答。", followUpQuestion: "请补充量化结果。" };
  if (schemaName === "interview_report") return { totalScore: 88, summary: "总体表现良好。", strengths: ["表达清晰", "结构完整"], improvements: ["量化成果", "技术细节" ] };
  if (schemaName === "job_description_parse") {
    const evidence = "熟悉 Java";
    return { jobTitle: { text: "Java 工程师", evidence: "" }, companyName: { text: "未明确", evidence: "" }, responsibilities: [{ text: "负责服务开发", evidence: "负责服务开发" }], requiredSkills: [{ text: evidence, evidence }], preferredSkills: [], educationRequirements: [], experienceRequirements: [], technicalKeywords: [{ text: "Java", evidence }], softSkills: [], seniority: { text: "未明确", evidence: "" }, uncertainties: [] };
  }
  throw new Error(`Unexpected schema ${schemaName}`);
}

async function main() {
  const mockAi = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const schemaName = request.text?.format?.name;
    prompts.push({ schemaName, text: request.input?.[1]?.content?.[0]?.text || "" });
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(aiResult(schemaName)) }));
  });
  const mockPort = await listen(mockAi);
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-isolation-test-"));
  await mkdir(dataDir, { recursive: true });
  const tokenA = randomBytes(24).toString("hex");
  const tokenB = randomBytes(24).toString("hex");
  const photo = `data:image/png;base64,${"A".repeat(200_000)}`;
  const store = {
    users: [{ id: 7, username: "user-a", passwordHash: "test", role: "USER", status: 1 }, { id: 8, username: "user-b", passwordHash: "test", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 7, tokenHash: tokenHash(tokenA), expiresAt: new Date(Date.now() + 60_000).toISOString() }, { id: 2, userId: 8, tokenHash: tokenHash(tokenB), expiresAt: new Date(Date.now() + 60_000).toISOString() }],
    resumes: [
      { id: 11, userId: 7, version: 3, title: "A Java 简历", targetPosition: "Java 工程师", currentPosition: "后端工程师", realName: pii.name, email: pii.email, phone: pii.phone, website: pii.website, city: pii.city, profileFields: [{ label: "作品集", value: pii.profileValue }], selfEvaluation: "负责订单服务", photoDataUrl: photo, sectionContent: { "专业技能": ["Java", "Spring"], "项目经历": ["订单系统提升 20%"], "工作经历": ["负责服务开发"] }, sectionDetails: {}, moduleOrder: ["专业技能", "项目经历", "工作经历"] },
      { id: 12, userId: 7, version: 2, title: "A Frontend 简历", targetPosition: "前端工程师", currentPosition: "前端工程师", selfEvaluation: "React 开发", sectionContent: { "专业技能": ["React"] }, sectionDetails: {}, moduleOrder: ["专业技能"] },
      { id: 21, userId: 8, version: 1, title: "B 简历", targetPosition: "测试工程师", currentPosition: "测试工程师", selfEvaluation: "测试自动化", sectionContent: { "专业技能": ["Python"] }, sectionDetails: {}, moduleOrder: ["专业技能"] },
    ],
    resumeHistories: [], analysisRecords: [], optimizeRecords: [], grammarRecords: [], interviewQuestions: [], jobPositions: [{ id: 1, positionName: "Java 工程师", keywords: ["Java"] }],
    jobDescriptions: [], jobDescriptionParseResults: [], jobApplications: [], mockInterviews: [], interviewAnswers: [], systemNotices: [],
  };
  await writeFile(path.join(dataDir, "store.json"), JSON.stringify(store), "utf8");
  const probe = createServer(); const apiPort = await listen(probe); await close(probe);
  const backend = spawn(process.execPath, ["backend/server.js"], { cwd: projectRoot, env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dataDir, OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: `http://127.0.0.1:${mockPort}/v1`, OPENAI_MODEL: "test-model" }, stdio: ["ignore", "pipe", "pipe"] });
  const base = `http://127.0.0.1:${apiPort}`;
  async function request(token, pathName, options = {}, expected = 200) {
    const response = await fetch(`${base}${pathName}`, { ...options, headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = response.status === 204 ? {} : await response.json();
    assert.equal(response.status, expected, `${pathName}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { await request(tokenA, "/api/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    const updatedResume = await request(tokenA, "/api/resumes/11", { method: "PUT", body: JSON.stringify({ selfEvaluation: "负责订单服务与性能优化", summary: "test version snapshot" }) });
    assert.equal(updatedResume.item.version, 4);
    const lockedVersionId = (await request(tokenA, "/api/resumes/11/versions")).items[0].id;
    const analysis = await request(tokenA, "/api/resumes/11/analyze", { method: "POST", body: JSON.stringify({ targetPosition: "Java 工程师" }) }, 201);
    const analysisA2 = await request(tokenA, "/api/resumes/12/analyze", { method: "POST", body: JSON.stringify({ targetPosition: "前端工程师" }) }, 201);
    assert.deepEqual([analysis.item.matchScore, analysis.item.keywordScore, analysis.item.projectScore, analysis.item.completenessScore], [10, 92, 0, 47]);
    assert.equal(analysis.item.resumeId, 11);
    assert.equal(analysisA2.item.resumeId, 12);
    const optimizeA1 = await request(tokenA, "/api/resumes/11/optimize", { method: "POST", body: JSON.stringify({ content: "负责订单服务" }) }, 201);
    const optimizeA2 = await request(tokenA, "/api/resumes/12/optimize", { method: "POST", body: JSON.stringify({ content: "负责 React 页面开发" }) }, 201);
    const grammarA1 = await request(tokenA, "/api/resumes/11/grammar-check", { method: "POST", body: JSON.stringify({ content: "负责订单服务" }) }, 201);
    const grammarA2 = await request(tokenA, "/api/resumes/12/grammar-check", { method: "POST", body: JSON.stringify({ content: "负责 React 页面开发" }) }, 201);
    assert.equal(optimizeA1.item.resumeVersion, 4);
    assert.equal(grammarA1.item.resumeVersion, 4);
    assert.equal(optimizeA2.item.resumeVersion, 2);
    assert.equal(grammarA2.item.resumeVersion, 2);
    assert.equal(optimizeA1.item.resumeContentHash, grammarA1.item.resumeContentHash);
    assert.notEqual(optimizeA1.item.resumeContentHash, optimizeA2.item.resumeContentHash);
    const beforeInterviewBytes = (await readFile(path.join(dataDir, "store.json"), "utf8")).length;
    const interview = await request(tokenA, "/api/interviews", { method: "POST", body: JSON.stringify({ resumeId: 11, positionId: 1, questionCount: 2 }) }, 201);
    const afterInterviewBytes = (await readFile(path.join(dataDir, "store.json"), "utf8")).length;
    assert.ok(afterInterviewBytes - beforeInterviewBytes < 20_000, "interview snapshot must not persist the 200KB photo");
    const interviewA2 = await request(tokenA, "/api/interviews", { method: "POST", body: JSON.stringify({ resumeId: 12, questionCount: 2 }) }, 201);
    assert.equal(interview.item.resumeId, 11);
    assert.equal(interviewA2.item.resumeId, 12);
    assert.equal(interview.item.resumeSnapshot.photoDataUrl, undefined);
    assert.equal(interview.item.resumeSnapshot.resumeVersion, 4);
    assert.equal(interview.item.resumeSnapshot.basicInfo.currentPosition, "后端工程师");
    assert.ok(interview.item.resumeSnapshot.snapshotCreatedAt);
    assert.ok(interview.item.resumeSnapshot.sections.length > 0);
    const firstAnswer = await request(tokenA, `/api/interviews/${interview.item.id}/answers`, { method: "POST", body: JSON.stringify({ questionId: "q-1", answerText: "我负责订单服务并完成性能优化。" }) }, 201);
    assert.equal(firstAnswer.nextQuestion?.id, "q-2");
    await request(tokenA, `/api/interviews/${interview.item.id}/answers`, { method: "POST", body: JSON.stringify({ questionId: "q-2", answerText: "优化后接口响应时间降低。" }) }, 201);
    const report = await request(tokenA, `/api/interviews/${interview.item.id}/report`, { method: "POST" }, 201);
    assert.equal(report.report.totalScore, 88);
    for (const schemaName of ["interview_opening", "interview_feedback", "interview_report"]) assert.ok(prompts.some((prompt) => prompt.schemaName === schemaName), `${schemaName} prompt was not called`);
    for (const prompt of prompts) for (const value of Object.values(pii)) assert.equal(prompt.text.includes(value), false, `${prompt.schemaName} leaked ${value}`);
    for (const endpoint of ["analysis", "optimize", "grammar", "interviews"]) {
      const all = await request(tokenA, `/api/records/${endpoint}`); assert.ok(all.items.length >= 2); assert.ok(all.items.every((item) => item.userId === 7));
      const empty = await request(tokenA, `/api/records/${endpoint}?resumeId=`); assert.deepEqual(empty.items.map((item) => item.id), all.items.map((item) => item.id));
      const exact = await request(tokenA, `/api/records/${endpoint}?resumeId=11`); assert.ok(exact.items.length >= 1); assert.ok(exact.items.every((item) => item.resumeId === 11 && item.resumeVersion === 4 && /^[a-f0-9]{64}$/.test(item.resumeContentHash)));
      const secondResume = await request(tokenA, `/api/records/${endpoint}?resumeId=12`); assert.ok(secondResume.items.length >= 1); assert.ok(secondResume.items.every((item) => item.resumeId === 12 && item.resumeVersion === 2 && /^[a-f0-9]{64}$/.test(item.resumeContentHash)));
      const none = await request(tokenA, `/api/records/${endpoint}?resumeId=999999`); assert.equal(none.items.length, 0);
      for (const invalid of ["0", "-1", "1.5", "abc"]) await request(tokenA, `/api/records/${endpoint}?resumeId=${invalid}`, {}, 400);
      const bRecords = await request(tokenB, `/api/records/${endpoint}`); assert.equal(bRecords.items.length, 0);
    }
    await request(tokenB, "/api/resumes/11", {}, 404);
    await request(tokenB, "/api/resumes/11/analyze", { method: "POST", body: JSON.stringify({ targetPosition: "Java 工程师" }) }, 404);
    await request(tokenB, "/api/interviews", { method: "POST", body: JSON.stringify({ resumeId: 11 }) }, 404);
    await request(tokenB, `/api/interviews/${interview.item.id}/answers`, { method: "POST", body: JSON.stringify({ answerText: "unauthorized" }) }, 404);
    await request(tokenB, `/api/interviews/${interview.item.id}/report`, { method: "POST" }, 404);
    await request(tokenA, "/api/interviews", { method: "POST", body: JSON.stringify({ resumeId: 11, positionId: "bad" }) }, 400);
    await request(tokenA, "/api/interviews", { method: "POST", body: JSON.stringify({ resumeId: "bad" }) }, 400);
    const jd = await request(tokenA, "/api/job-descriptions", { method: "POST", body: JSON.stringify({ title: "Java 工程师", rawText: "负责服务开发，熟悉 Java。" }) }, 201);
    await request(tokenB, `/api/job-descriptions/${jd.item.id}`, {}, 404);
    await request(tokenB, `/api/job-descriptions/${jd.item.id}`, { method: "PUT", body: JSON.stringify({ title: "unauthorized" }) }, 404);
    await request(tokenB, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId: lockedVersionId, jobDescriptionId: jd.item.id }) }, 404);
    await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId: lockedVersionId, jobDescriptionId: jd.item.id }) }, 409);
    await request(tokenA, `/api/job-descriptions/${jd.item.id}/parse`, { method: "POST" }, 201);
    const application = await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId: lockedVersionId, jobDescriptionId: jd.item.id }) }, 201);
    assert.equal(application.item.resumeId, 11);
    await request(tokenA, `/api/job-descriptions/${jd.item.id}`, { method: "PUT", body: JSON.stringify({ rawText: "负责服务开发，熟悉 Java 和 Spring。" }) });
    await request(tokenA, "/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId: lockedVersionId, jobDescriptionId: jd.item.id }) }, 409);
    const versions = await request(tokenA, "/api/resumes/11/versions");
    assert.ok(versions.items.length >= 1);
    assert.equal(versions.items[0].hasSnapshot, true);
    const versionDetail = await request(tokenA, `/api/resumes/11/versions/${versions.items[0].id}`);
    assert.equal(versionDetail.item.resumeId, 11);
    assert.equal(versionDetail.item.snapshot.resumeVersion, 4);
    await request(tokenB, `/api/resumes/11/versions/${versions.items[0].id}`, {}, 404);
    await request(tokenA, "/api/resumes/11/versions/999999", {}, 404);
    await request(tokenA, "/api/resumes/11", { method: "DELETE" }, 204);
    const stored = JSON.parse(await readFile(path.join(dataDir, "store.json"), "utf8"));
    assert.equal(stored.mockInterviews.some((item) => item.resumeId === 11), false);
    assert.equal(stored.interviewAnswers.some((item) => item.resumeId === 11), false);
    assert.equal(stored.analysisRecords.some((item) => item.resumeId === 11), false);
    assert.equal(stored.optimizeRecords.some((item) => item.resumeId === 11), false);
    assert.equal(stored.grammarRecords.some((item) => item.resumeId === 11), false);
    assert.equal(stored.resumeHistories.some((item) => item.resumeId === 11), false);
    assert.equal(stored.jobApplications.some((item) => item.resumeId === 11), false);
    assert.equal(stored.jobDescriptions.some((item) => item.id === jd.item.id), true);
    console.log("Isolation integration passed: user/resume ownership, record filters, PII-safe AI context, DTO interview snapshot, JD isolation, and deletion cascade.");
  } finally {
    if (backend.exitCode === null) { backend.kill(); await new Promise((resolve) => backend.once("exit", resolve)); }
    await close(mockAi); await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
