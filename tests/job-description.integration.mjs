import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

function close(server) {
  return new Promise((resolve) => server.close(resolve));
}

function parsedFor(rawText) {
  const frontend = rawText.includes("React");
  const testing = rawText.includes("测试用例");
  const title = frontend ? "前端开发工程师" : testing ? "软件测试工程师" : "Java 后端开发工程师";
  const required = frontend ? "熟悉 React 和 TypeScript" : testing ? "掌握测试用例设计" : "熟悉 Java 与 Spring Boot";
  const preferred = frontend ? "有性能优化经验" : testing ? "有自动化测试经验" : "有 Redis 使用经验";
  const evidence = (text) => ({ text, evidence: text });
  return {
    jobTitle: { text: title, evidence: "" },
    companyName: { text: "未明确", evidence: "" },
    responsibilities: [evidence(frontend ? "负责 Web 前端页面开发" : testing ? "负责测试用例设计与执行" : "负责后端服务开发")],
    requiredSkills: [evidence(required)],
    preferredSkills: [evidence(preferred)],
    educationRequirements: [evidence("本科及以上学历")],
    experienceRequirements: [evidence("2 年及以上经验")],
    technicalKeywords: [evidence(frontend ? "React" : testing ? "接口测试" : "Spring Boot")],
    softSkills: [evidence("良好的沟通协作能力")],
    seniority: { text: "未明确", evidence: "" },
    uncertainties: [],
  };
}

async function main() {
  const mockAi = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const userText = request.input?.[1]?.content?.[0]?.text || "";
    const rawText = userText.split("Raw job description:\n").at(-1);
    const parsed = parsedFor(rawText);
    if (rawText.includes("INVALID_EVIDENCE")) parsed.requiredSkills[0].evidence = "JD 中不存在的内容";
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ output_text: JSON.stringify(parsed) }));
  });
  const mockAiPort = await listen(mockAi);
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-jd-test-"));
  await mkdir(dataDir, { recursive: true });
  const token = randomBytes(24).toString("hex");
  const store = {
    users: [{ id: 7, username: "jd-test", passwordHash: "test-only", role: "USER", status: 1 }],
    sessions: [{ id: 1, userId: 7, tokenHash: createHash("sha256").update(token).digest("base64url"), expiresAt: new Date(Date.now() + 60_000).toISOString() }],
    resumes: [{ id: 11, userId: 7, version: 2, title: "测试简历", currentPosition: "工程师", selfEvaluation: "具备后端和协作经验", sectionContent: { "专业技能": ["Java", "Spring Boot"] }, sectionDetails: {}, moduleOrder: ["基本信息", "专业技能"] }],
    resumeHistories: [], analysisRecords: [], optimizeRecords: [], grammarRecords: [], interviewQuestions: [],
    jobDescriptions: [], jobDescriptionParseResults: [], jobApplications: [], mockInterviews: [], interviewAnswers: [], systemNotices: [],
  };
  await writeFile(path.join(dataDir, "store.json"), JSON.stringify(store), "utf8");
  const probe = createServer();
  const apiPort = await listen(probe);
  await close(probe);
  const backend = spawn(process.execPath, ["backend/server.js"], {
    cwd: projectRoot,
    env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dataDir, OPENAI_API_KEY: "test-key", OPENAI_BASE_URL: `http://127.0.0.1:${mockAiPort}/v1`, OPENAI_MODEL: "test-model" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const base = `http://127.0.0.1:${apiPort}`;
  const request = async (pathName, options = {}) => {
    const response = await fetch(`${base}${pathName}`, { ...options, headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json", ...(options.headers || {}) } });
    const data = await response.json();
    assert.equal(response.ok, true, `${pathName}: ${JSON.stringify(data)}`);
    return data;
  };
  try {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try { await request("/api/health"); break; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); }
    }
    await request("/api/resumes/11", { method: "PUT", body: JSON.stringify({ summary: "为 JD 测试创建锁定版本" }) });
    const resumeVersions = await request("/api/resumes/11/versions");
    const resumeVersionId = resumeVersions.items[0].id;
    const samples = [
      { title: "前端开发工程师", companyName: "星云科技", rawText: "岗位职责：负责 Web 前端页面开发。任职要求：本科及以上学历，2 年及以上经验，熟悉 React 和 TypeScript。加分项：有性能优化经验。具备良好的沟通协作能力。" },
      { title: "Java 后端开发工程师", companyName: "远航软件", rawText: "岗位职责：负责后端服务开发。任职要求：本科及以上学历，2 年及以上经验，熟悉 Java 与 Spring Boot。加分项：有 Redis 使用经验。具备良好的沟通协作能力。" },
      { title: "软件测试工程师", companyName: "质效实验室", rawText: "岗位职责：负责测试用例设计与执行。任职要求：本科及以上学历，2 年及以上经验，掌握测试用例设计。加分项：有自动化测试经验。技术关键词：接口测试。具备良好的沟通协作能力。" },
    ];
    for (const sample of samples) {
      const created = await request("/api/job-descriptions", { method: "POST", body: JSON.stringify(sample) });
      assert.equal(created.item.rawText, sample.rawText);
      const parsed = await request(`/api/job-descriptions/${created.item.id}/parse`, { method: "POST" });
      assert.equal(parsed.item.status, "SUCCEEDED");
      assert.equal(parsed.item.userId, 7);
      assert.ok(parsed.item.parsedData.requiredSkills.length);
      assert.ok(parsed.item.parsedData.preferredSkills.length);
      assert.equal(parsed.item.parsedData.requiredSkills[0].evidence.length > 0, true);
      const application = await request("/api/job-applications", { method: "POST", body: JSON.stringify({ resumeId: 11, resumeVersionId, jobDescriptionId: created.item.id }) });
      assert.equal(application.item.resumeId, 11);
      assert.equal(application.item.jobDescriptionId, created.item.id);
      assert.equal(application.item.jobDescriptionParseResultId, parsed.item.id);
    }
    const invalid = await request("/api/job-descriptions", { method: "POST", body: JSON.stringify({ title: "失败重试示例", rawText: "INVALID_EVIDENCE 岗位职责：负责后端服务开发。任职要求：本科及以上学历，2 年及以上经验，熟悉 Java 与 Spring Boot。加分项：有 Redis 使用经验。具备良好的沟通协作能力。" }) });
    const failedResponse = await fetch(`${base}/api/job-descriptions/${invalid.item.id}/parse`, { method: "POST", headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json" } });
    assert.equal(failedResponse.ok, false);
    const failedDetail = await request(`/api/job-descriptions/${invalid.item.id}`);
    assert.equal(failedDetail.item.rawText.includes("INVALID_EVIDENCE"), true);
    assert.equal(failedDetail.item.parseStatus, "FAILED");
    const repaired = await request(`/api/job-descriptions/${invalid.item.id}`, { method: "PUT", body: JSON.stringify({ rawText: samples[1].rawText }) });
    const reparsed = await request(`/api/job-descriptions/${repaired.item.id}/parse`, { method: "POST" });
    assert.equal(reparsed.item.status, "SUCCEEDED");
    const list = await request("/api/job-descriptions");
    assert.equal(list.items.length, 4);
    console.log("JD integration passed: 3 distinct JDs saved, parsed, and linked to resume #11; failure retained raw text and retry succeeded.");
  } finally {
    if (backend.exitCode === null) {
      backend.kill();
      await new Promise((resolve) => backend.once("exit", resolve));
    }
    await close(mockAi);
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
