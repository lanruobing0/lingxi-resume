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

async function waitForApi(request) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await request("/api/health");
      if (response.status === 200) return;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw lastError || new Error("API did not start");
}

function createKnowledgePayload(overrides = {}) {
  return {
    title: "Java 后端工程师能力资料",
    description: "用于验证岗位知识库的文本处理链路。",
    sourceType: "TEXT_ENTRY",
    documentType: "ROLE_SKILL_DESCRIPTION",
    jobFamily: "后端研发",
    seniority: "中级",
    skillTags: ["Java", "Spring Boot", "MySQL"],
    language: "zh-CN",
    sourceName: "内部岗位能力规范",
    sourceUrl: "https://example.test/backend-role",
    rawText: "# Java 后端工程师\n\n一、核心能力\n\n1.1 技术基础\n熟悉 Java、Spring Boot、MySQL 和 RESTful API 设计，能够完成稳定的服务端接口开发与问题定位。\n\n1.2 工程实践\n掌握单元测试、日志排查、缓存设计和性能优化，能够与产品及前端团队高效协作。\n\n【项目表达】\n使用 STAR 结构说明项目背景、个人职责、关键行动和可量化结果，避免只罗列技术名词。",
    ...overrides,
  };
}

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), "lingxi-knowledge-test-"));
  await mkdir(dataDir, { recursive: true });
  const adminToken = randomBytes(24).toString("hex");
  const secondAdminToken = randomBytes(24).toString("hex");
  const userToken = randomBytes(24).toString("hex");
  const tokenHash = (token) => createHash("sha256").update(token).digest("base64url");
  const store = {
    users: [
      { id: 1, username: "knowledge-admin", passwordHash: "test-only", role: "ADMIN", status: 1 },
      { id: 2, username: "knowledge-admin-two", passwordHash: "test-only", role: "ADMIN", status: 1 },
      { id: 3, username: "knowledge-user", passwordHash: "test-only", role: "USER", status: 1 },
    ],
    sessions: [
      { id: 1, userId: 1, tokenHash: tokenHash(adminToken), expiresAt: new Date(Date.now() + 60_000).toISOString() },
      { id: 2, userId: 2, tokenHash: tokenHash(secondAdminToken), expiresAt: new Date(Date.now() + 60_000).toISOString() },
      { id: 3, userId: 3, tokenHash: tokenHash(userToken), expiresAt: new Date(Date.now() + 60_000).toISOString() },
    ],
    resumes: [], resumeHistories: [], analysisRecords: [], optimizeRecords: [], grammarRecords: [], interviewQuestions: [],
    jobDescriptions: [], jobDescriptionParseResults: [], jobApplications: [], resumeJobMatches: [], mockInterviews: [], interviewAnswers: [], systemNotices: [],
  };
  await writeFile(path.join(dataDir, "store.json"), JSON.stringify(store), "utf8");
  const probe = createServer();
  const apiPort = await listen(probe);
  await close(probe);
  const base = `http://127.0.0.1:${apiPort}`;
  let backend;
  const startBackend = () => {
    backend = spawn(process.execPath, ["backend/server.js"], {
      cwd: projectRoot,
      env: { ...process.env, API_PORT: String(apiPort), LINGXI_DATA_DIR: dataDir },
      stdio: ["ignore", "pipe", "pipe"],
    });
  };
  const stopBackend = async () => {
    if (!backend || backend.exitCode !== null) return;
    backend.kill();
    await new Promise((resolve) => backend.once("exit", resolve));
  };
  const request = async (pathName, { token = adminToken, ...options } = {}) => {
    const response = await fetch(`${base}${pathName}`, {
      ...options,
      headers: { Cookie: `lingxi_session=${token}`, "Content-Type": "application/json", ...(options.headers || {}) },
    });
    return { status: response.status, data: await response.json() };
  };
  const expectOk = async (pathName, options) => {
    const response = await request(pathName, options);
    assert.ok(response.status >= 200 && response.status < 300, `${pathName}: ${JSON.stringify(response.data)}`);
    return response.data;
  };
  const createAndProcess = async (overrides) => {
    const created = await expectOk("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload(overrides)) });
    await expectOk(`/api/admin/knowledge-documents/${created.item.id}/process`, { method: "POST" });
    const chunks = await expectOk(`/api/admin/knowledge-documents/${created.item.id}/chunks`);
    return { document: created.item, chunks: chunks.items };
  };

  try {
    startBackend();
    await waitForApi(request);

    const forbiddenCreate = await request("/api/admin/knowledge-documents", { token: userToken, method: "POST", body: JSON.stringify(createKnowledgePayload()) });
    assert.equal(forbiddenCreate.status, 403);
    const forbiddenRead = await request("/api/admin/knowledge-chunks/1", { token: userToken });
    assert.equal(forbiddenRead.status, 403);

    const invalidType = await request("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload({ documentType: "NOT_A_TYPE" })) });
    assert.equal(invalidType.status, 400);
    const invalidTags = await request("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload({ skillTags: "Java" })) });
    assert.equal(invalidTags.status, 400);
    const invalidId = await request("/api/admin/knowledge-documents/0");
    assert.equal(invalidId.status, 400);
    const missing = await request("/api/admin/knowledge-documents/999");
    assert.equal(missing.status, 404);

    const empty = await expectOk("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload({ title: "空资料", rawText: "" })) });
    const emptyProcess = await request(`/api/admin/knowledge-documents/${empty.item.id}/process`, { method: "POST" });
    assert.equal(emptyProcess.status, 400);
    assert.equal(emptyProcess.data.failureCode, "EMPTY_RAW_TEXT");
    const whitespaceOnly = await expectOk("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload({ title: "纯空白资料", rawText: " \r\n\t " })) });
    const whitespaceProcess = await request(`/api/admin/knowledge-documents/${whitespaceOnly.item.id}/process`, { method: "POST" });
    assert.equal(whitespaceProcess.status, 400);
    assert.equal(whitespaceProcess.data.failureCode, "EMPTY_RAW_TEXT");

    const rawSource = "  # Java 工程师\r\n\r\n  Spring Boot 项目经验\r\n";
    const rawDocument = await expectOk("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload({ title: "原文保存资料", rawText: rawSource })) });
    const rawDetailBeforeProcess = await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}`);
    assert.equal(rawDetailBeforeProcess.item.rawText, rawSource);
    assert.equal(rawDetailBeforeProcess.item.rawTextHash, createHash("sha256").update(rawSource).digest("hex"));
    await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}/process`, { method: "POST" });
    const rawDetailAfterProcess = await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}`);
    assert.equal(rawDetailAfterProcess.item.rawText, rawSource);
    assert.equal(rawDetailAfterProcess.item.normalizedText.includes("\r"), false);
    assert.equal(rawDetailAfterProcess.item.normalizedText, "# Java 工程师\n\nSpring Boot 项目经验");
    const rawIdempotent = await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}/process`, { method: "POST" });
    assert.equal(rawIdempotent.idempotent, true);
    const whitespaceChangedSource = `${rawSource} `;
    const rawUpdated = await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}`, { method: "PUT", body: JSON.stringify(createKnowledgePayload({ title: "原文保存资料", rawText: whitespaceChangedSource })) });
    assert.equal(rawUpdated.item.rawTextHash, createHash("sha256").update(whitespaceChangedSource).digest("hex"));
    assert.notEqual(rawUpdated.item.rawTextHash, createHash("sha256").update(rawSource).digest("hex"));

    const skillsScenario = await createAndProcess({
      title: "技能列表回归资料",
      rawText: "技能列表\n\nJava\nSpring Boot\nMySQL\nRedis",
    });
    assert.ok(skillsScenario.chunks.length > 0);
    assert.ok(skillsScenario.chunks.some((chunk) => ["Java", "Spring Boot", "MySQL", "Redis"].every((skill) => chunk.content.includes(skill))));
    assert.ok(skillsScenario.chunks.every((chunk) => chunk.headingPath.length > 0));
    assert.ok(skillsScenario.chunks.every((chunk) => !["Java", "Spring Boot", "MySQL", "Redis"].some((skill) => chunk.headingPath.includes(skill))));

    const sentencesScenario = await createAndProcess({
      title: "短句回归资料",
      rawText: "系统设计需要考虑可扩展性\n高可用架构需要冗余设计\n数据库设计需要关注索引\n接口开发需要处理异常",
    });
    const sentencesContent = sentencesScenario.chunks.map((chunk) => chunk.content).join("\n");
    assert.ok(["系统设计需要考虑可扩展性", "高可用架构需要冗余设计", "数据库设计需要关注索引", "接口开发需要处理异常"].every((sentence) => sentencesContent.includes(sentence)));
    assert.ok(sentencesScenario.chunks.every((chunk) => chunk.headingPath.length > 0 && chunk.documentId === sentencesScenario.document.id));

    const headingsScenario = await createAndProcess({
      title: "标题层级回归资料",
      rawText: "# Java 后端工程师\n\n一、核心技能\n\n1. Spring Boot\n\n1.1 事务管理\n处理数据库事务边界、异常回滚和并发一致性问题。\n\n【项目经验】\n负责订单服务拆分、接口联调和稳定性优化。",
    });
    assert.ok(headingsScenario.chunks.some((chunk) => chunk.headingPath.includes("核心技能") && chunk.headingPath.includes("Spring Boot") && chunk.headingPath.includes("事务管理")));
    assert.ok(headingsScenario.chunks.some((chunk) => chunk.headingPath.includes("项目经验") && !chunk.headingPath.includes("核心技能")));

    const projectScenario = await createAndProcess({
      title: "项目职责回归资料",
      rawText: "订单管理系统\n\n负责订单核心流程开发\n实现库存扣减与回滚\n优化接口响应时间",
    });
    const projectChunk = projectScenario.chunks.find((chunk) => chunk.content.includes("负责订单核心流程开发"));
    assert.ok(projectChunk);
    assert.ok(projectChunk.headingPath.includes("订单管理系统"));
    assert.ok(["负责订单核心流程开发", "实现库存扣减与回滚", "优化接口响应时间"].every((line) => projectChunk.content.includes(line)));

    const created = await expectOk("/api/admin/knowledge-documents", { method: "POST", body: JSON.stringify(createKnowledgePayload()) });
    const documentId = created.item.id;
    assert.equal(created.item.status, "DRAFT");
    const initialRawText = createKnowledgePayload().rawText;
    assert.equal(created.item.rawTextHash, createHash("sha256").update(initialRawText).digest("hex"));

    const processed = await expectOk(`/api/admin/knowledge-documents/${documentId}/process`, { method: "POST" });
    assert.equal(processed.idempotent, false);
    assert.equal(processed.item.status, "PROCESSED");
    assert.ok(processed.item.chunkCount > 0);
    const firstVersion = processed.item.processingVersion;
    const chunksBefore = await expectOk(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.equal(chunksBefore.items.length, processed.item.chunkCount);
    assert.ok(chunksBefore.items.every((chunk) => chunk.documentId === documentId));
    assert.ok(chunksBefore.items.every((chunk) => chunk.contentHash === createHash("sha256").update(chunk.content).digest("hex")));
    assert.ok(chunksBefore.items.every((chunk) => chunk.content.length <= 1200));
    assert.ok(chunksBefore.items.some((chunk) => chunk.headingPath.includes("核心能力")));
    const singleChunk = await expectOk(`/api/admin/knowledge-chunks/${chunksBefore.items[0].id}`);
    assert.equal(singleChunk.item.documentId, documentId);

    const idempotent = await expectOk(`/api/admin/knowledge-documents/${documentId}/process`, { method: "POST" });
    assert.equal(idempotent.idempotent, true);
    const chunksAfterIdempotent = await expectOk(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.equal(chunksAfterIdempotent.items.length, chunksBefore.items.length);
    assert.deepEqual(chunksAfterIdempotent.items.map((chunk) => chunk.id), chunksBefore.items.map((chunk) => chunk.id));

    const blanked = await expectOk(`/api/admin/knowledge-documents/${documentId}`, { method: "PUT", body: JSON.stringify(createKnowledgePayload({ rawText: "", title: "已清空待处理资料" })) });
    assert.equal(blanked.item.status, "DRAFT");
    const failedReprocess = await request(`/api/admin/knowledge-documents/${documentId}/process`, { method: "POST" });
    assert.equal(failedReprocess.status, 400);
    const chunksAfterFailure = await expectOk(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.deepEqual(chunksAfterFailure.items.map((chunk) => chunk.id), chunksBefore.items.map((chunk) => chunk.id));

    const longParagraph = "系统设计能力与稳定性治理。".repeat(120);
    await expectOk(`/api/admin/knowledge-documents/${documentId}`, { method: "PUT", body: JSON.stringify(createKnowledgePayload({ rawText: `# 更新资料\n\n一、系统能力\n\n${longParagraph}` })) });
    const reprocessed = await expectOk(`/api/admin/knowledge-documents/${documentId}/process`, { method: "POST" });
    assert.ok(reprocessed.item.processingVersion > firstVersion);
    const newChunks = await expectOk(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.ok(newChunks.items.every((chunk) => chunk.processingVersion === reprocessed.item.processingVersion));
    assert.ok(newChunks.items.every((chunk) => chunk.content.length <= 1200));
    assert.notDeepEqual(newChunks.items.map((chunk) => chunk.id), chunksBefore.items.map((chunk) => chunk.id));
    const records = await expectOk(`/api/admin/knowledge-documents/${documentId}/processing-records`);
    assert.ok(records.items.length >= 3);
    assert.ok(records.items.some((record) => record.status === "FAILED"));
    assert.ok(records.items.every((record, index) => index === 0 || record.createdAt >= records.items[index - 1].createdAt));

    const second = await expectOk("/api/admin/knowledge-documents", { token: secondAdminToken, method: "POST", body: JSON.stringify(createKnowledgePayload({ title: "独立面试资料", documentType: "INTERVIEW_QUESTION", rawText: "【面试题】\n\n请说明你如何定位一次线上性能问题，并用 STAR 结构说明处理过程。" })) });
    await expectOk(`/api/admin/knowledge-documents/${second.item.id}/process`, { token: secondAdminToken, method: "POST" });
    const secondChunks = await expectOk(`/api/admin/knowledge-documents/${second.item.id}/chunks`, { token: secondAdminToken });
    assert.ok(secondChunks.items.every((chunk) => chunk.documentId === second.item.id));
    const firstChunksRemain = await expectOk(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.ok(firstChunksRemain.items.every((chunk) => chunk.documentId === documentId));

    await stopBackend();
    startBackend();
    await waitForApi(request);
    const persisted = await expectOk(`/api/admin/knowledge-documents/${documentId}`);
    assert.equal(persisted.item.id, documentId);
    assert.equal(persisted.item.rawTextHash, createHash("sha256").update(createKnowledgePayload({ rawText: `# 更新资料\n\n一、系统能力\n\n${longParagraph}` }).rawText).digest("hex"));
    const persistedRaw = await expectOk(`/api/admin/knowledge-documents/${rawDocument.item.id}`);
    assert.equal(persistedRaw.item.rawText, whitespaceChangedSource);
    assert.equal(persistedRaw.item.rawTextHash, createHash("sha256").update(whitespaceChangedSource).digest("hex"));

    await expectOk(`/api/admin/knowledge-documents/${documentId}`, { method: "DELETE" });
    const missingChunks = await request(`/api/admin/knowledge-documents/${documentId}/chunks`);
    assert.equal(missingChunks.status, 404);
    const secondStillPresent = await expectOk(`/api/admin/knowledge-documents/${second.item.id}`);
    assert.equal(secondStillPresent.item.id, second.item.id);
    console.log("Knowledge-base integration passed: admin-only CRUD, semantic chunks, idempotency, failed retry protection, cascade cleanup, isolation, and JSON restart persistence.");
  } finally {
    await stopBackend();
    await rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
