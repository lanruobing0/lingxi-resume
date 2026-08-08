import { createServer } from "node:http";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { KnowledgeVectorIndexError, KnowledgeVectorIndexService } from "./knowledge-vector-index.js";
import { KnowledgeRetrievalService } from "./knowledge-retrieval-service.js";
import { validateKnowledgeClaims, sourceAvailability } from "./citation-validator.js";
import { buildCandidatePromptPayload, buildReportRetrievalPlans, createReportInputHash, allowedBaseEvidence, reportGenerationConfigHash } from "./grounded-report-service.js";
import { buildGroundedReportPrompt, groundedReportPromptVersion, groundedReportSchema } from "./grounded-report-prompt.js";
import { buildResumeSuggestionPrompt, resumeSuggestionPromptVersion, resumeSuggestionSchema } from "./resume-suggestion-prompt.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.LINGXI_DATA_DIR ? path.resolve(process.env.LINGXI_DATA_DIR) : path.join(__dirname, "data");
const dataFile = path.join(dataDir, "store.json");
const port = Number(process.env.API_PORT || 8787);
const maxJsonBodyBytes = 9 * 1024 * 1024;
const sessionCookieName = "lingxi_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 24;
const passwordHashLength = 64;
const scrypt = promisify(scryptCallback);
const authRateLimits = new Map();
const captchaChallenges = new Map();
const suggestionDecisionLocks = new Set();
const captchaLifetimeMs = 1000 * 60 * 5;
const captchaAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const aiProviderDefaults = {
  DeepSeek: { provider: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-v4-flash", enabled: true },
  豆包: { provider: "豆包", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", modelId: "doubao-seed-2-0-lite-260215", enabled: true },
  OpenAI: { provider: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4.1-mini", enabled: true },
  Gemini: { provider: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: "gemini-3.5-flash", enabled: true },
};

const seedData = {
  users: [],
  jobPositions: [
    {
      id: 1,
      positionName: "前端开发工程师",
      positionType: "技术",
      keywords: ["React", "Vue", "TypeScript", "工程化", "性能优化", "组件化"],
      description: "负责 Web 前端页面、组件和业务交互开发。",
      status: 1,
    },
    {
      id: 2,
      positionName: "Java 后端开发",
      positionType: "技术",
      keywords: ["Spring Boot", "MySQL", "Redis", "接口设计", "微服务"],
      description: "负责后端接口、业务逻辑和数据库设计。",
      status: 1,
    },
    {
      id: 3,
      positionName: "软件测试工程师",
      positionType: "技术",
      keywords: ["测试用例", "自动化测试", "接口测试", "缺陷管理"],
      description: "负责软件质量保障和测试流程。",
      status: 1,
    },
  ],
  resumes: [
    {
      id: 1,
      userId: 2,
      title: "前端开发工程师简历",
      targetPositionId: 1,
      realName: "林澈",
      phone: "13800138000",
      email: "linche@example.com",
      city: "杭州市西湖区",
      website: "https://linche.dev",
      selfEvaluation: "具备前端工程化和组件化开发经验，关注性能优化与用户体验。",
      templateName: "modern",
      themeColor: "black",
      version: 3,
      updatedAt: "2026-06-26T09:00:00.000Z",
      sections: {
        skills: [
          "熟悉 React、Vue、TypeScript、Vite、Pinia、Zustand 等前端技术栈。",
          "掌握组件化开发、权限控制、性能优化和可视化看板开发。",
          "了解 Spring Boot 接口联调、MySQL 数据建模和 RESTful API 设计。",
        ],
        projects: [
          {
            projectName: "AI 智能简历优化平台",
            roleName: "前端负责人",
            responsibility: "负责三栏简历工作台、AI 诊断结果页和模拟面试页面。",
            resultDesc: "完成简历编辑、AI 分析、优化记录和面试反馈闭环。",
          },
        ],
        work: [
          "负责招聘平台候选人看板、筛选流程和面试排期模块开发。",
          "沉淀表单组件和权限配置方案，减少重复开发成本。",
          "优化列表渲染与接口缓存策略，核心页面加载效率提升 35%。",
        ],
      },
    },
  ],
  resumeHistories: [
    {
      id: 1,
      resumeId: 1,
      version: 1,
      summary: "创建基础简历信息",
      createdAt: "2026-06-26T08:20:00.000Z",
    },
    {
      id: 2,
      resumeId: 1,
      version: 2,
      summary: "补充项目经历和岗位方向",
      createdAt: "2026-06-26T08:40:00.000Z",
    },
    {
      id: 3,
      resumeId: 1,
      version: 3,
      summary: "加入 AI 诊断后的量化结果",
      createdAt: "2026-06-26T09:00:00.000Z",
    },
  ],
  analysisRecords: [
    {
      id: 1,
      userId: 2,
      resumeId: 1,
      targetPositionId: 1,
      totalScore: 86,
      completenessScore: 90,
      matchScore: 86,
      keywordScore: 84,
      projectScore: 78,
      analysisResult: "简历基础完整，前端关键词覆盖较好，项目结果仍可继续量化。",
      suggestions: ["项目经历缺少可衡量结果", "建议补充性能优化指标", "建议突出 React 与 TypeScript 实战场景"],
      createdAt: "2026-06-26T09:05:00.000Z",
    },
  ],
  optimizeRecords: [
    {
      id: 1,
      userId: 2,
      resumeId: 1,
      optimizeType: "project_experience",
      originalContent: "负责招聘平台页面开发，完成筛选和面试排期功能。",
      optimizedContent: "主导筛选与面试排期模块，减少 35% 操作步骤，页面响应提升 28%。",
      createdAt: "2026-06-26T09:10:00.000Z",
    },
  ],
  grammarRecords: [
    {
      id: 1,
      userId: 2,
      resumeId: 1,
      score: 82,
      content: "负责招聘平台页面开发，完成筛选和面试排期功能，Thier 页面响应比较快。",
      issues: [
        { type: "拼写", original: "Thier", suggestion: "Their", reason: "英文拼写错误" },
        { type: "表达", original: "负责", suggestion: "主导", reason: "动词更有行动感" },
      ],
      createdAt: "2026-06-26T09:12:00.000Z",
    },
  ],
  interviewQuestions: [
    {
      id: 1,
      positionId: 1,
      questionText: "请介绍一个你主导或深度参与的前端项目，并说明你解决的核心问题。",
      questionType: "项目经历",
      difficulty: "中等",
      referenceAnswer: "建议按项目背景、个人职责、技术难点、解决方案和结果进行回答。",
    },
    {
      id: 2,
      positionId: 1,
      questionText: "如果一个页面首屏加载很慢，你会从哪些角度定位和优化？",
      questionType: "技术能力",
      difficulty: "中等",
      referenceAnswer: "可从资源体积、接口耗时、渲染阻塞、缓存策略和代码分割等角度回答。",
    },
  ],
  jobDescriptions: [],
  jobDescriptionParseResults: [],
  jobApplications: [],
  resumeJobMatches: [],
  matchReports: [],
  suggestionRuns: [],
  resumeSuggestions: [],
  knowledgeDocuments: [],
  knowledgeChunks: [],
  knowledgeProcessingRecords: [],
  knowledgeIndexRuns: [],
  knowledgeVectorRecords: [],
  knowledgeRetrievalRuns: [],
  mockInterviews: [],
  interviewAnswers: [],
  systemNotices: [
    {
      id: 1,
      title: "系统上线提示",
      content: "AI 简历诊断、简历优化和模拟面试功能已开放体验。",
      status: 1,
      createdAt: "2026-06-26T08:00:00.000Z",
    },
  ],
  aiConfig: {
    provider: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelId: "gpt-5.5",
    apiKey: "",
    enabled: true,
    updatedAt: "2026-06-26T08:00:00.000Z",
  },
};

function now() {
  return new Date().toISOString();
}

function publicUser(user) {
  if (!user) return null;
  const { password, passwordHash, ...safeUser } = user;
  return safeUser;
}

function hashSessionToken(token) {
  return createHash("sha256").update(token).digest("base64url");
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const hash = await scrypt(password, salt, passwordHashLength);
  return `scrypt$${salt}$${Buffer.from(hash).toString("base64url")}`;
}

async function verifyPassword(password, storedHash) {
  const [algorithm, salt, encodedHash] = String(storedHash || "").split("$");
  if (algorithm !== "scrypt" || !salt || !encodedHash) return false;
  const expected = Buffer.from(encodedHash, "base64url");
  const actual = Buffer.from(await scrypt(password, salt, expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function parseCookies(req) {
  return String(req.headers.cookie || "").split(";").reduce((cookies, part) => {
    const separator = part.indexOf("=");
    if (separator < 1) return cookies;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function getSessionToken(req) {
  const cookieToken = parseCookies(req)[sessionCookieName];
  if (cookieToken) return cookieToken;
  const authorization = String(req.headers.authorization || "");
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

function requireUser(store, req, { allowPasswordUpdate = false } = {}) {
  const token = getSessionToken(req);
  const tokenHash = token ? hashSessionToken(token) : "";
  const session = store.sessions.find((item) => item.tokenHash === tokenHash && item.expiresAt > now());
  const user = session && store.users.find((item) => item.id === session.userId && item.status === 1);
  if (!user) throw new HttpError(401, "请先登录后再访问个人数据");
  if (user.passwordUpdateRequired && !allowPasswordUpdate) {
    throw new HttpError(403, "请先在通用设置中更新账号密码");
  }
  return user;
}

function issueSession(store, user) {
  const token = randomBytes(32).toString("base64url");
  const session = {
    tokenHash: hashSessionToken(token),
    userId: user.id,
    createdAt: now(),
    expiresAt: new Date(Date.now() + sessionLifetimeMs).toISOString(),
  };
  store.sessions = [...store.sessions.filter((item) => item.expiresAt > now() && item.userId !== user.id), session];
  return { session, token };
}

function sessionCookie(token, maxAge = Math.floor(sessionLifetimeMs / 1000)) {
  const secure = process.env.SESSION_SECURE === "true" || process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", sessionCookie(token));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", sessionCookie("", 0));
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function checkRateLimit(key, maxAttempts, windowMs) {
  const timestamp = Date.now();
  const item = authRateLimits.get(key);
  if (!item || item.resetAt <= timestamp) return null;
  if (item.count < maxAttempts) return null;
  return Math.ceil((item.resetAt - timestamp) / 1000);
}

function recordRateLimitAttempt(key, windowMs) {
  const timestamp = Date.now();
  const item = authRateLimits.get(key);
  if (!item || item.resetAt <= timestamp) {
    authRateLimits.set(key, { count: 1, resetAt: timestamp + windowMs });
    return;
  }
  item.count += 1;
}

function clearRateLimit(key) {
  authRateLimits.delete(key);
}

function createCaptchaCode() {
  const bytes = randomBytes(5);
  return [...bytes].map((byte) => captchaAlphabet[byte % captchaAlphabet.length]).join("");
}

function cleanupCaptchaChallenges() {
  const timestamp = Date.now();
  for (const [id, captcha] of captchaChallenges) {
    if (captcha.expiresAt <= timestamp || captcha.attempts >= 5) captchaChallenges.delete(id);
  }
  while (captchaChallenges.size > 1000) {
    captchaChallenges.delete(captchaChallenges.keys().next().value);
  }
}

function issueCaptcha() {
  cleanupCaptchaChallenges();
  const code = createCaptchaCode();
  const id = randomUUID();
  captchaChallenges.set(id, {
    answerHash: hashSessionToken(code),
    expiresAt: Date.now() + captchaLifetimeMs,
    attempts: 0,
    code,
  });
  return { id, imageUrl: `/api/auth/captcha/${id}` };
}

function verifyCaptcha(captchaId, captchaCode) {
  cleanupCaptchaChallenges();
  const captcha = captchaChallenges.get(String(captchaId || ""));
  const submittedHash = hashSessionToken(String(captchaCode || "").trim().toUpperCase());
  if (!captcha || captcha.expiresAt <= Date.now()) {
    throw new HttpError(400, "验证码已过期，请刷新后重试");
  }
  captcha.attempts += 1;
  const expected = Buffer.from(captcha.answerHash);
  const submitted = Buffer.from(submittedHash);
  const matches = expected.length === submitted.length && timingSafeEqual(expected, submitted);
  if (!matches) {
    if (captcha.attempts >= 5) captchaChallenges.delete(String(captchaId));
    throw new HttpError(400, "验证码不正确，请刷新后重试");
  }
  captchaChallenges.delete(String(captchaId));
}

function captchaSvg(code) {
  const characters = [...code].map((character, index) => {
    const rotation = [-8, 5, -4, 7, -6][index];
    const y = [41, 45, 40, 46, 42][index];
    const color = ["#1f2937", "#245ca6", "#374151", "#7c4a2d", "#1f2937"][index];
    return `<text x="${17 + index * 27}" y="${y}" fill="${color}" font-size="27" font-family="Arial, sans-serif" font-weight="700" transform="rotate(${rotation} ${17 + index * 27} ${y})">${character}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="58" viewBox="0 0 160 58" role="img" aria-label="验证码"><rect width="160" height="58" rx="6" fill="#f6f7f8"/><path d="M4 42 C35 7 101 58 156 16" fill="none" stroke="#c8d3e0" stroke-width="2"/><path d="M2 18 C44 50 104 4 158 41" fill="none" stroke="#ead7ad" stroke-width="2"/>${characters}</svg>`;
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function validatePassword(password) {
  if (password.length < 10 || password.length > 128 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    throw new HttpError(400, "密码需为 10-128 位，且同时包含字母和数字");
  }
}

function validateRegistration({ username, password, email }) {
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    throw new HttpError(400, "用户名需为 3-32 位小写字母、数字、下划线或连字符");
  }
  validatePassword(password);
  if (email && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 100)) {
    throw new HttpError(400, "邮箱格式不正确");
  }
}

function nextId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1;
}

function parseOptionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new HttpError(400, `${fieldName} must be a positive integer`);
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) throw new HttpError(400, `${fieldName} must be a positive integer`);
  return parsed;
}

function textItems(items = []) {
  return Array.isArray(items) ? items.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function normalizedStructuredEntries(entries = [], fallbackLines = []) {
  if (Array.isArray(entries) && entries.length) {
    return entries.map((entry, index) => ({
      id: String(entry?.id || `entry-${index + 1}`),
      name: String(entry?.name || "").trim(),
      role: String(entry?.role || "").trim(),
      startDate: String(entry?.startDate || "").trim(),
      endDate: String(entry?.endDate || "").trim(),
      isCurrent: Boolean(entry?.isCurrent),
      highlights: textItems(entry?.highlights),
    }));
  }
  if (Array.isArray(fallbackLines) && fallbackLines.some((item) => item && typeof item === "object")) {
    return fallbackLines.filter((item) => item && typeof item === "object").map((entry, index) => ({
      id: String(entry.id || `legacy-${index + 1}`),
      name: String(entry.name || entry.projectName || entry.companyName || "").trim(),
      role: String(entry.role || entry.roleName || entry.jobTitle || "").trim(),
      startDate: String(entry.startDate || "").trim(),
      endDate: String(entry.endDate || "").trim(),
      isCurrent: Boolean(entry.isCurrent),
      highlights: textItems([
        entry.responsibility,
        entry.resultDesc,
        entry.projectDesc,
        entry.workContent,
        entry.description,
      ]),
    }));
  }
  return textItems(fallbackLines).map((text, index) => ({
    id: `legacy-${index + 1}`,
    name: "",
    role: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    highlights: [text],
  }));
}

// ResumeDTO is the single normalized shape used by AI features and version snapshots.
// It preserves all editor content while keeping legacy `sections` data readable during migration.
function buildResumeDTO(resume = {}) {
  // Version snapshots are already in DTO form. Rebuild their hash from the
  // supported fields so AI calls work for both new DTO snapshots and legacy
  // raw resume snapshots without copying editor-only payloads.
  if (Array.isArray(resume.sections) && resume.basicInfo && Object.hasOwn(resume, "resumeVersion")) {
    const dto = {
      id: Number(resume.id) || null,
      userId: Number(resume.userId) || null,
      resumeVersion: Number(resume.resumeVersion) || 1,
      title: String(resume.title || "").trim(),
      targetPosition: String(resume.targetPosition || "").trim(),
      targetPositionId: Number(resume.targetPositionId) || null,
      basicInfo: {
        realName: String(resume.basicInfo.realName || "").trim(),
        currentPosition: String(resume.basicInfo.currentPosition || resume.title || "").trim(),
        email: String(resume.basicInfo.email || "").trim(),
        phone: String(resume.basicInfo.phone || "").trim(),
        city: String(resume.basicInfo.city || "").trim(),
        website: String(resume.basicInfo.website || "").trim(),
        profileFields: Array.isArray(resume.basicInfo.profileFields) ? resume.basicInfo.profileFields : [],
      },
      selfEvaluation: String(resume.selfEvaluation || "").trim(),
      sections: resume.sections,
    };
    return { ...dto, contentHash: createHash("sha256").update(JSON.stringify(dto)).digest("hex") };
  }
  const sectionContent = resume.sectionContent && typeof resume.sectionContent === "object" ? resume.sectionContent : {};
  const sectionDetails = resume.sectionDetails && typeof resume.sectionDetails === "object" ? resume.sectionDetails : {};
  const legacySections = resume.sections && typeof resume.sections === "object" ? resume.sections : {};
  const profileFields = Array.isArray(resume.profileFields)
    ? resume.profileFields.map((field, index) => ({
      id: String(field?.id || `profile-${index + 1}`),
      label: String(field?.label || "").trim(),
      value: String(field?.value || "").trim(),
    })).filter((field) => field.label || field.value)
    : [];
  const labels = [...new Set([
    ...(Array.isArray(resume.moduleOrder) ? resume.moduleOrder : []),
    ...Object.keys(sectionContent),
    ...Object.keys(sectionDetails),
  ])];
  const standard = [
    { key: "skills", label: "\u4e13\u4e1a\u6280\u80fd", legacy: legacySections.skills },
    { key: "work", label: "\u5de5\u4f5c\u7ecf\u5386", legacy: legacySections.work },
    { key: "projects", label: "\u9879\u76ee\u7ecf\u5386", legacy: legacySections.projects },
  ];
  const standardLabels = new Set(standard.map((item) => item.label));
  const sections = standard.map(({ key, label, legacy }) => ({
    key,
    label,
    entries: normalizedStructuredEntries(sectionDetails[label], sectionContent[label] || legacy),
  }));
  labels.filter((label) => !standardLabels.has(label) && label !== "\u57fa\u672c\u4fe1\u606f").forEach((label) => {
    sections.push({
      key: `custom:${label}`,
      label,
      entries: normalizedStructuredEntries(sectionDetails[label], sectionContent[label]),
    });
  });
  const dto = {
    id: Number(resume.id) || null,
    userId: Number(resume.userId) || null,
    resumeVersion: Number(resume.version) || 1,
    title: String(resume.title || "").trim(),
    targetPosition: String(resume.targetPosition || "").trim(),
    targetPositionId: Number(resume.targetPositionId) || null,
    basicInfo: {
      realName: String(resume.realName || "").trim(),
      currentPosition: String(resume.currentPosition || resume.title || "").trim(),
      email: String(resume.email || "").trim(),
      phone: String(resume.phone || "").trim(),
      city: String(resume.city || "").trim(),
      website: String(resume.website || "").trim(),
      profileFields,
    },
    selfEvaluation: String(resume.selfEvaluation || "").trim(),
    sections,
  };
  return { ...dto, contentHash: createHash("sha256").update(JSON.stringify(dto)).digest("hex") };
}

function buildAiResumeContext(resume = {}) {
  const dto = buildResumeDTO(resume);
  return {
    resumeId: dto.id,
    resumeVersion: dto.resumeVersion,
    resumeContentHash: dto.contentHash,
    title: dto.title,
    targetPosition: dto.targetPosition,
    // Contact and profile fields stay in the local ResumeDTO/history only.
    // AI providers receive only job-relevant resume content.
    currentPosition: dto.basicInfo.currentPosition,
    selfEvaluation: dto.selfEvaluation,
    sections: dto.sections,
  };
}

function createInterviewResumeSnapshot(resume = {}) {
  return { ...buildResumeDTO(resume), snapshotCreatedAt: now() };
}

function createResumeHistoryRecord(store, resume, summary) {
  const snapshot = buildResumeDTO(resume);
  store.resumeHistories.push({
    id: nextId(store.resumeHistories),
    resumeId: resume.id,
    resumeVersion: snapshot.resumeVersion,
    version: snapshot.resumeVersion,
    summary,
    snapshot,
    contentHash: snapshot.contentHash,
    createdAt: now(),
  });
}

function createStarterResume(store, user) {
  const resume = {
    id: nextId(store.resumes),
    userId: user.id,
    title: "我的简历",
    targetPositionId: 1,
    realName: user.realName || user.username,
    email: user.email || "",
    phone: "",
    city: "",
    website: "",
    selfEvaluation: "",
    templateName: "modern",
    themeColor: "#171717",
    templateLayout: "左图右文",
    version: 1,
    updatedAt: now(),
    sections: { skills: [], projects: [], work: [] },
  };
  store.resumes.push(resume);
  createResumeHistoryRecord(store, resume, "创建个人简历");
  return resume;
}

function getOwnedResume(store, user, requestedId, { createIfMissing = false } = {}) {
  const ownedResumes = store.resumes.filter((item) => item.userId === user.id);
  // `current` used to mean the most recently updated resume and could silently
  // select a different document than the one open in the workspace.
  if (requestedId === "current") return null;
  const resumeId = Number(requestedId);
  if (!Number.isInteger(resumeId) || resumeId < 1) return null;
  return ownedResumes.find((item) => item.id === resumeId) || null;
}

function getOwnedJobDescription(store, user, requestedId) {
  const jobDescriptionId = Number(requestedId);
  if (!Number.isInteger(jobDescriptionId) || jobDescriptionId < 1) return null;
  return store.jobDescriptions.find((item) => item.id === jobDescriptionId && item.userId === user.id) || null;
}

function getOwnedJobApplication(store, user, requestedId) {
  const applicationId = Number(requestedId);
  if (!Number.isInteger(applicationId) || applicationId < 1) return null;
  return store.jobApplications.find((item) => item.id === applicationId && item.userId === user.id) || null;
}

function getOwnedResumeJobMatch(store, user, requestedId) {
  const matchId = Number(requestedId);
  if (!Number.isInteger(matchId) || matchId < 1) return null;
  return store.resumeJobMatches.find((item) => item.id === matchId && item.userId === user.id) || null;
}

function getResumeSnapshotForApplication(store, application) {
  const history = store.resumeHistories.find((item) => item.id === application.resumeVersionId
    && item.resumeId === application.resumeId
    && item.resumeVersion === application.resumeVersion
    && item.contentHash === application.resumeContentHash
    && item.snapshot);
  return history?.snapshot || null;
}

function contentHash(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeJobDescriptionText(value) {
  return String(value || "").replace(/\r\n?/g, "\n").replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  if (!existsSync(dataFile)) {
    await writeFile(dataFile, JSON.stringify(seedData, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  const store = JSON.parse(raw);
  const normalizedStore = {
    ...seedData,
    ...store,
    users: store.users || seedData.users,
    jobPositions: store.jobPositions || seedData.jobPositions,
    resumes: store.resumes || seedData.resumes,
    resumeHistories: store.resumeHistories || seedData.resumeHistories,
    analysisRecords: store.analysisRecords || seedData.analysisRecords,
    optimizeRecords: store.optimizeRecords || seedData.optimizeRecords,
    grammarRecords: store.grammarRecords || seedData.grammarRecords,
    interviewQuestions: store.interviewQuestions || seedData.interviewQuestions,
    jobDescriptions: store.jobDescriptions || [],
    jobDescriptionParseResults: store.jobDescriptionParseResults || [],
    jobApplications: store.jobApplications || [],
    resumeJobMatches: store.resumeJobMatches || [],
    matchReports: store.matchReports || [],
    suggestionRuns: store.suggestionRuns || [],
    resumeSuggestions: store.resumeSuggestions || [],
    knowledgeDocuments: store.knowledgeDocuments || [],
    knowledgeChunks: store.knowledgeChunks || [],
    knowledgeProcessingRecords: store.knowledgeProcessingRecords || [],
    knowledgeIndexRuns: store.knowledgeIndexRuns || [],
    knowledgeVectorRecords: store.knowledgeVectorRecords || [],
    knowledgeRetrievalRuns: store.knowledgeRetrievalRuns || [],
    mockInterviews: store.mockInterviews || [],
    interviewAnswers: store.interviewAnswers || [],
    systemNotices: store.systemNotices || seedData.systemNotices,
    aiConfig: store.aiConfig || seedData.aiConfig,
    aiProviderConfigs: store.aiProviderConfigs || {},
    sessions: store.sessions || [],
    aiSettingsByUser: store.aiSettingsByUser || {},
  };
  if (await migrateSensitiveStoreData(normalizedStore)) {
    await writeStore(normalizedStore);
  }
  return normalizedStore;
}

async function writeStore(store) {
  const temporaryFile = `${dataFile}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  const serializedStore = JSON.stringify(store, null, 2);
  await writeFile(temporaryFile, serializedStore, { encoding: "utf8", mode: 0o600 });
  try {
    await replaceStoreFile(temporaryFile);
  } finally {
    await unlink(temporaryFile).catch(() => {});
  }
}

async function replaceStoreFile(temporaryFile) {
  let lastRenameError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await rename(temporaryFile, dataFile);
      return;
    } catch (error) {
      lastRenameError = error;
      if (!["EPERM", "EACCES", "EBUSY"].includes(error?.code) || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }

  // Windows can temporarily lock the destination while another process reads it.
  // Writing in place keeps local persistence available instead of failing the request.
  if (["EPERM", "EACCES", "EBUSY"].includes(lastRenameError?.code)) {
    await writeFile(dataFile, await readFile(temporaryFile), { mode: 0o600 });
    return;
  }
  throw lastRenameError;
}

async function migrateSensitiveStoreData(store) {
  let changed = false;
  for (const user of store.users) {
    if (!user.passwordHash && user.password) {
      user.passwordHash = await hashPassword(String(user.password));
      delete user.password;
      changed = true;
    }
    if (user.password) {
      delete user.password;
      changed = true;
    }
    if (["admin", "linche"].includes(user.username) && user.passwordUpdateRequired === undefined) {
      user.passwordUpdateRequired = true;
      changed = true;
    }
  }
  const activeSessions = store.sessions.filter((item) => item.tokenHash && item.expiresAt > now());
  if (activeSessions.length !== store.sessions.length) {
    store.sessions = activeSessions;
    changed = true;
  }
  return changed;
}

async function readJson(req) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxJsonBodyBytes) {
      throw new HttpError(413, "请求图片过大", "请上传不超过 6MB 的图片。");
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    const body = JSON.parse(raw);
    if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("invalid body");
    return body;
  } catch {
    throw new HttpError(400, "请求数据格式不正确");
  }
}

function send(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function sendSvg(res, status, svg) {
  res.writeHead(status, {
    "Content-Type": "image/svg+xml; charset=utf-8",
  });
  res.end(svg);
}

function applySecurityHeaders(req, res) {
  const allowedOrigins = String(process.env.APP_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const origin = String(req.headers.origin || "");
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
}

function routeKey(method, pathname) {
  return `${method} ${pathname}`;
}

const knowledgeDocumentTypes = new Set([
  "ROLE_SKILL_DESCRIPTION",
  "COMPETENCY_STANDARD",
  "INDUSTRY_ROLE_REQUIREMENT",
  "RESUME_EXAMPLE",
  "PROJECT_CASE",
  "STAR_TEMPLATE",
  "INTERVIEW_QUESTION",
  "INTERVIEW_RUBRIC",
  "RESUME_COMMON_ISSUE",
  "RESUME_WRITING_GUIDELINE",
]);
const knowledgeSourceTypes = new Set(["TEXT_ENTRY", "INTERNAL", "EXTERNAL"]);
const knowledgeStatuses = new Set(["DRAFT", "PROCESSING", "PROCESSED", "FAILED"]);
const knowledgeProcessingStrategy = "heading-paragraph-sentence-v1";
const knowledgeTargetLength = 760;
const knowledgeMaxLength = 1200;
const knowledgeMinLength = 100;

function vectorIndexService() {
  return new KnowledgeVectorIndexService({ persist: writeStore, now });
}

function knowledgeRetrievalService() {
  return new KnowledgeRetrievalService({ persist: writeStore, now });
}

function vectorIndexErrorResponse(error) {
  if (error instanceof KnowledgeVectorIndexError) return { status: error.status, message: error.message, failureCode: error.code };
  if (error && typeof error.status === "number" && error.code) return { status: error.status, message: error.message, failureCode: error.code };
  return { status: 502, message: "向量索引服务不可用", failureCode: "VECTOR_INDEX_FAILED" };
}

function requireAdmin(store, req) {
  const user = requireUser(store, req);
  if (user.role !== "ADMIN") throw new HttpError(403, "仅管理员可访问知识库管理接口");
  return user;
}

function validateKnowledgeString(value, fieldName, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${fieldName}不能为空`);
    return "";
  }
  if (typeof value !== "string") throw new HttpError(400, `${fieldName}必须为文本`);
  const normalized = value.trim();
  if (required && !normalized) throw new HttpError(400, `${fieldName}不能为空`);
  if (normalized.length > max) throw new HttpError(400, `${fieldName}长度不能超过${max}`);
  return normalized;
}

// Raw source text is an audit record. Unlike regular metadata fields it must
// retain every submitted character, including leading whitespace and CRLF.
function validateKnowledgeRawText(value, { allowBlank = true, max = 300000 } = {}) {
  if (typeof value !== "string") throw new HttpError(400, "rawText必须为文本");
  if (value.length > max) throw new HttpError(400, `rawText长度不能超过${max}`);
  if (!allowBlank && !value.trim()) throw new HttpError(400, "rawText不能为空");
  return value;
}

function validateKnowledgeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 30) throw new HttpError(400, "skillTags必须是最多30项的文本数组");
  const tags = value.map((tag) => {
    if (typeof tag !== "string") throw new HttpError(400, "skillTags必须是文本数组");
    const normalized = tag.trim();
    if (!normalized || normalized.length > 64) throw new HttpError(400, "skillTags中的每个标签长度须为1-64");
    return normalized;
  });
  if (new Set(tags.map((tag) => tag.toLocaleLowerCase())).size !== tags.length) {
    throw new HttpError(400, "skillTags不能包含重复标签");
  }
  return tags;
}

function validateKnowledgeDocumentInput(body, { isCreate = false, current = null } = {}) {
  const required = (field, options) => body[field] === undefined && !isCreate
    ? current[field]
    : validateKnowledgeString(body[field], field, options);
  const documentType = body.documentType === undefined && !isCreate ? current.documentType : validateKnowledgeString(body.documentType, "documentType", { required: true, max: 64 });
  if (!knowledgeDocumentTypes.has(documentType)) throw new HttpError(400, "documentType不合法");
  const sourceType = body.sourceType === undefined && !isCreate ? current.sourceType : validateKnowledgeString(body.sourceType, "sourceType", { required: true, max: 32 });
  if (!knowledgeSourceTypes.has(sourceType)) throw new HttpError(400, "sourceType不合法");
  const rawText = body.rawText === undefined && !isCreate ? current.rawText : validateKnowledgeRawText(body.rawText);
  const skillTags = body.skillTags === undefined && !isCreate ? current.skillTags : validateKnowledgeTags(body.skillTags);
  const sourceUrl = required("sourceUrl", { max: 2048 });
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) throw new HttpError(400, "sourceUrl必须是http或https地址");
  return {
    title: required("title", { required: true, max: 160 }),
    description: required("description", { max: 2000 }),
    sourceType,
    documentType,
    jobFamily: required("jobFamily", { max: 100 }),
    seniority: required("seniority", { max: 80 }),
    skillTags,
    language: required("language", { max: 32 }) || "zh-CN",
    sourceName: required("sourceName", { max: 200 }),
    sourceUrl,
    rawText,
  };
}

// This intentionally does not rewrite facts or wording. Offsets stored on chunks
// refer to normalizedText, the stable source used by later retrieval phases.
function normalizeKnowledgeText(rawText = "") {
  const lines = String(rawText).replace(/\r\n?/g, "\n").split("\n");
  const normalized = [];
  let previousBlank = false;
  for (const line of lines) {
    const cleaned = line.replace(/[\t ]+/g, " ").trim();
    if (!cleaned) {
      if (!previousBlank && normalized.length) normalized.push("");
      previousBlank = true;
      continue;
    }
    normalized.push(cleaned);
    previousBlank = false;
  }
  while (normalized.at(-1) === "") normalized.pop();
  return normalized.join("\n");
}

function isLikelyKnowledgeBodyLine(line) {
  const text = String(line || "").trim();
  return text.length > 28
    || /[。！？!?；;]$/.test(text)
    || /(?:负责|参与|实现|完成|优化|开发|设计|处理|支持|推动|协作|需要|应当|能够|可以|具有|掌握|熟悉|使用|提升|降低|确保|建立|包括|通过)/.test(text);
}

function detectKnowledgeHeading(lines, index) {
  const text = String(lines[index]?.text || "").trim();
  let match = text.match(/^(#{1,6})\s+(.+)$/);
  if (match) return { level: match[1].length, title: match[2].trim() };
  match = text.match(/^([一二三四五六七八九十百]+)、\s*(.+)$/);
  if (match) return { level: 1, title: match[2].trim() };
  match = text.match(/^(\d+(?:\.\d+){0,4})[.、]?\s+(.+)$/);
  if (match) return { level: match[1].split(".").length + 1, title: match[2].trim() };
  match = text.match(/^【\s*(.{1,100}?)\s*】$/);
  if (match) return { level: 1, title: match[1].trim() };
  const startsBlock = index === 0 || !lines[index - 1]?.text;
  if (!startsBlock || text.length < 2 || text.length > 24 || /[。！？!?；;，,：:]$/.test(text) || /^[-*+•]/.test(text)) return null;
  if (isLikelyKnowledgeBodyLine(text)) return null;
  let nextIndex = index + 1;
  while (nextIndex < lines.length && !lines[nextIndex].text) nextIndex += 1;
  const nextLine = lines[nextIndex]?.text || "";
  // An independent short line only earns heading status when the following
  // content looks like prose/body text. This keeps skill rows and consecutive
  // short responsibility sentences as content instead of turning a whole
  // document into headings.
  if (nextLine && isLikelyKnowledgeBodyLine(nextLine)) return { level: 1, title: text };
  return null;
}

function estimateKnowledgeTokens(content = "") {
  const cjk = (String(content).match(/[\u3400-\u9fff]/g) || []).length;
  const nonCjkWords = String(content).replace(/[\u3400-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(cjk + nonCjkWords / 4));
}

function splitKnowledgeText(text, startOffset, maxLength = knowledgeMaxLength) {
  if (text.length <= maxLength) return [{ content: text, startOffset, endOffset: startOffset + text.length }];
  const parts = [];
  let cursor = 0;
  const sentences = [...text.matchAll(/[^。！？!?；;\n]+[。！？!?；;]?|\n+/gu)].map((match) => ({ text: match[0], index: match.index }));
  let buffer = "";
  let bufferStart = 0;
  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    const leading = buffer.indexOf(content);
    parts.push({ content, startOffset: startOffset + bufferStart + leading, endOffset: startOffset + bufferStart + leading + content.length });
    buffer = "";
  };
  for (const sentence of sentences) {
    const candidate = sentence.text;
    if (candidate.length > maxLength) {
      flush();
      for (let index = 0; index < candidate.length; index += maxLength) {
        const content = candidate.slice(index, index + maxLength).trim();
        if (content) parts.push({ content, startOffset: startOffset + sentence.index + index, endOffset: startOffset + sentence.index + index + content.length });
      }
      cursor = sentence.index + candidate.length;
      continue;
    }
    if (!buffer) {
      buffer = candidate;
      bufferStart = sentence.index;
    } else if (buffer.length + candidate.length > maxLength) {
      flush();
      buffer = candidate;
      bufferStart = sentence.index;
    } else {
      buffer += candidate;
    }
    cursor = sentence.index + candidate.length;
  }
  flush();
  return parts.length ? parts : [{ content: text.slice(0, maxLength), startOffset, endOffset: startOffset + Math.min(text.length, maxLength) }];
}

function createKnowledgeChunks(document, normalizedText, processingVersion) {
  const lines = [];
  let position = 0;
  for (const line of normalizedText.split("\n")) {
    lines.push({ text: line, startOffset: position, endOffset: position + line.length });
    position += line.length + 1;
  }
  const blocks = [];
  const headingStack = [{ level: 0, title: document.title }];
  let paragraph = [];
  const emitParagraph = () => {
    if (!paragraph.length) return;
    const content = paragraph.map((line) => line.text).join("\n");
    blocks.push({ content, startOffset: paragraph[0].startOffset, endOffset: paragraph.at(-1).endOffset, headingPath: headingStack.map((item) => item.title) });
    paragraph = [];
  };
  for (const [index, line] of lines.entries()) {
    const heading = line.text ? detectKnowledgeHeading(lines, index) : null;
    if (heading) {
      emitParagraph();
      while (headingStack.length && headingStack.at(-1).level >= heading.level) headingStack.pop();
      headingStack.push(heading);
    } else if (!line.text) {
      emitParagraph();
    } else {
      paragraph.push(line);
    }
  }
  emitParagraph();
  const chunks = [];
  let pending = null;
  const pushPending = () => {
    if (!pending?.content.trim()) return;
    for (const part of splitKnowledgeText(pending.content, pending.startOffset)) {
      chunks.push({ ...part, headingPath: pending.headingPath });
    }
    pending = null;
  };
  for (const block of blocks) {
    if (block.content.length > knowledgeMaxLength) {
      pushPending();
      for (const part of splitKnowledgeText(block.content, block.startOffset)) chunks.push({ ...part, headingPath: block.headingPath });
      continue;
    }
    const sameSection = pending && JSON.stringify(pending.headingPath) === JSON.stringify(block.headingPath);
    if (!pending || !sameSection || pending.content.length + 2 + block.content.length > knowledgeTargetLength) {
      pushPending();
      pending = { ...block };
    } else {
      pending.content += `\n\n${block.content}`;
      pending.endOffset = block.endOffset;
    }
  }
  pushPending();
  if (!chunks.length && normalizedText.trim()) chunks.push({ content: normalizedText.trim(), startOffset: 0, endOffset: normalizedText.trim().length, headingPath: [] });
  return chunks.map((chunk, chunkIndex) => ({
    id: null,
    documentId: document.id,
    chunkIndex,
    headingPath: chunk.headingPath,
    title: chunk.headingPath.at(-1) || document.title,
    content: chunk.content,
    contentHash: contentHash(chunk.content),
    tokenEstimate: estimateKnowledgeTokens(chunk.content),
    startOffset: chunk.startOffset,
    endOffset: chunk.endOffset,
    sourceType: document.sourceType,
    documentType: document.documentType,
    jobFamily: document.jobFamily,
    seniority: document.seniority,
    skillTags: [...document.skillTags],
    language: document.language,
    processingVersion,
    createdAt: now(),
  }));
}

function nextKnowledgeProcessingVersion(store, documentId) {
  return store.knowledgeProcessingRecords.filter((record) => record.documentId === documentId)
    .reduce((maximum, record) => Math.max(maximum, Number(record.processingVersion) || 0), 0) + 1;
}

function knowledgeDocumentSummary(document) {
  const { rawText, normalizedText, ...summary } = document;
  return summary;
}

class HttpError extends Error {
  constructor(status, message, detail = "") {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

function normalizeBaseUrl(baseUrl = "") {
  return (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
}

function normalizeProvider(provider = "") {
  return Object.hasOwn(aiProviderDefaults, provider) ? provider : "OpenAI";
}

function normalizeModelId(provider, modelId, fallbackModelId) {
  const value = String(modelId || "").trim();
  // DeepSeek has retired the legacy chat/reasoner identifiers used by early local configs.
  if (provider === "DeepSeek" && ["deepseek-chat", "deepseek-reasoner"].includes(value)) {
    return aiProviderDefaults.DeepSeek.modelId;
  }
  return value || fallbackModelId;
}

function getAiSettingsForUser(store, userId) {
  const saved = store.aiSettingsByUser?.[String(userId)];
  if (saved) return saved;
  // Preserve the existing local configuration for the original seeded account only.
  if (Number(userId) === 2) {
    return { aiConfig: store.aiConfig || {}, aiProviderConfigs: store.aiProviderConfigs || {} };
  }
  return { aiConfig: {}, aiProviderConfigs: {} };
}

function getAiProviderConfigs(store, userId) {
  const settings = getAiSettingsForUser(store, userId);
  const legacyConfig = settings.aiConfig || {};
  const savedConfigs = settings.aiProviderConfigs || {};
  const legacyProvider = normalizeProvider(legacyConfig.provider);
  return Object.fromEntries(Object.entries(aiProviderDefaults).map(([provider, defaults]) => {
    const saved = savedConfigs[provider] || (provider === legacyProvider ? legacyConfig : {});
    return [provider, {
      ...defaults,
      ...saved,
      provider,
      baseUrl: normalizeBaseUrl(saved.baseUrl || defaults.baseUrl),
      modelId: normalizeModelId(provider, saved.modelId, defaults.modelId),
      enabled: saved.enabled !== false,
    }];
  }));
}

function getAiConfig(store, userId) {
  const settings = getAiSettingsForUser(store, userId);
  const selectedProvider = normalizeProvider(process.env.AI_PROVIDER || settings.aiConfig?.provider);
  const stored = getAiProviderConfigs(store, userId)[selectedProvider];
  return {
    provider: selectedProvider,
    baseUrl: normalizeBaseUrl(process.env.OPENAI_BASE_URL || stored.baseUrl),
    modelId: normalizeModelId(selectedProvider, process.env.OPENAI_MODEL || stored.modelId, "gpt-5.5"),
    apiKey: process.env.OPENAI_API_KEY || stored.apiKey || "",
    enabled: stored.enabled !== false,
  };
}

function maskApiKey(apiKey = "") {
  if (!apiKey) return "";
  if (apiKey.length <= 10) return "已配置";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function publicAiConfig(store, userId) {
  const config = getAiConfig(store, userId);
  const configs = getAiProviderConfigs(store, userId);
  const source = process.env.OPENAI_API_KEY ? "env" : "local";
  const providerConfigs = Object.fromEntries(Object.entries(configs).map(([provider, item]) => [provider, {
    provider,
    baseUrl: item.baseUrl,
    modelId: item.modelId,
    enabled: item.enabled,
    hasApiKey: Boolean(item.apiKey),
    apiKeyPreview: maskApiKey(item.apiKey),
    source: provider === config.provider ? source : "local",
  }]));
  return {
    provider: config.provider,
    activeProvider: config.provider,
    baseUrl: config.baseUrl,
    modelId: config.modelId,
    enabled: config.enabled,
    hasApiKey: Boolean(config.apiKey),
    apiKeyPreview: maskApiKey(config.apiKey),
    source,
    providerConfigs,
  };
}

function extractResponseText(data) {
  if (data.output_text) return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (typeof part.text === "string") return part.text;
      if (typeof part.output_text === "string") return part.output_text;
    }
  }
  return "";
}

function parseJsonText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("AI 返回为空");
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("AI 未返回 JSON");
    return JSON.parse(match[0]);
  }
}

function parseStrictJsonText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw Object.assign(new Error("AI 返回为空"), { code: "REPORT_INVALID_RESPONSE" });
  try {
    return JSON.parse(trimmed);
  } catch {
    throw Object.assign(new Error("AI 未返回严格 JSON"), { code: "REPORT_INVALID_RESPONSE" });
  }
}

function unwrapAiPayload(data, schemaName) {
  if (data && typeof data === "object" && data[schemaName] && typeof data[schemaName] === "object") {
    return data[schemaName];
  }
  return data;
}

function requireNonEmptyText(value, fieldName) {
  const text = String(value || "").trim();
  if (!text) throw new Error(`AI 返回字段 ${fieldName} 为空`);
  return text;
}

function normalizeScore(value, fieldName) {
  const score = Number(value);
  if (!Number.isFinite(score)) throw new Error(`AI 返回字段 ${fieldName} 不是有效分数`);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeTextList(value, fieldName, minItems, maxItems) {
  if (!Array.isArray(value)) throw new Error(`AI 返回字段 ${fieldName} 不是数组`);
  const items = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (items.length < minItems) throw new Error(`AI 返回字段 ${fieldName} 至少需要 ${minItems} 项`);
  return items.slice(0, maxItems);
}

function normalizeIssue(issue = {}) {
  return {
    type: requireNonEmptyText(issue.type || "表达", "issue.type"),
    original: String(issue.original || "").trim() || "原文",
    suggestion: String(issue.suggestion || "").trim() || "无需修改",
    reason: String(issue.reason || "").trim() || "AI 未给出详细原因",
  };
}

async function requestJson(url, payload, apiKey) {
  const controller = new AbortController();
  const timeoutMs = Math.max(100, Number(process.env.AI_PROVIDER_TIMEOUT_MS || 20000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(data.error?.message || data.message || `AI 请求失败: ${response.status}`), { status: response.status, code: "AI_PROVIDER_UNAVAILABLE" });
    }
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw Object.assign(new Error("AI 请求超时"), { status: 504, code: "AI_PROVIDER_UNAVAILABLE" });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function runAiJson(store, userId, { system, user, schemaName, schema, strictJson = false }) {
  const config = getAiConfig(store, userId);
  if (!config.enabled || !config.apiKey) {
    return { ok: false, status: 400, code: "AI_NOT_CONFIGURED", error: "AI 服务未配置 API Key，请先在 AI 服务商页面保存配置或设置 OPENAI_API_KEY。" };
  }

  const jsonInstruction = "只返回符合要求的 JSON，不要 Markdown，不要解释。";
  try {
    const responsesData = await requestJson(`${config.baseUrl}/responses`, {
      model: config.modelId,
      input: [
        { role: "system", content: [{ type: "input_text", text: `${system}\n${jsonInstruction}` }] },
        { role: "user", content: [{ type: "input_text", text: user }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      },
    }, config.apiKey);
    return { ok: true, mode: "live", data: unwrapAiPayload((strictJson ? parseStrictJsonText : parseJsonText)(extractResponseText(responsesData)), schemaName) };
  } catch (responsesError) {
    try {
      const chatData = await requestJson(`${config.baseUrl}/chat/completions`, {
        model: config.modelId,
        messages: [
          { role: "system", content: `${system}\n${jsonInstruction}` },
          { role: "user", content: `${user}\n\nReturn JSON object named ${schemaName}. Required fields: ${(schema.required || []).join(", ")}. All string fields must be non-empty.` },
        ],
        response_format: { type: "json_object" },
      }, config.apiKey);
      const text = chatData.choices?.[0]?.message?.content || "";
      return { ok: true, mode: "live", data: unwrapAiPayload((strictJson ? parseStrictJsonText : parseJsonText)(text), schemaName) };
    } catch (chatError) {
      return { ok: false, status: chatError.status || 502, code: chatError.code || (strictJson ? "REPORT_PROVIDER_UNAVAILABLE" : "AI_PROVIDER_UNAVAILABLE"), error: chatError.message || responsesError.message };
    }
  }
}

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["totalScore", "completenessScore", "matchScore", "keywordScore", "projectScore", "analysisResult", "keywords", "suggestions"],
  properties: {
    totalScore: { type: "integer", minimum: 0, maximum: 100 },
    completenessScore: { type: "integer", minimum: 0, maximum: 100 },
    matchScore: { type: "integer", minimum: 0, maximum: 100 },
    keywordScore: { type: "integer", minimum: 0, maximum: 100 },
    projectScore: { type: "integer", minimum: 0, maximum: 100 },
    analysisResult: { type: "string" },
    keywords: { type: "array", items: { type: "string" }, minItems: 5, maxItems: 10 },
    suggestions: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
  },
};

const optimizeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["optimizedContent"],
  properties: {
    optimizedContent: { type: "string" },
  },
};

const grammarSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "issues"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    issues: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "original", "suggestion", "reason"],
        properties: {
          type: { type: "string" },
          original: { type: "string" },
          suggestion: { type: "string" },
          reason: { type: "string" },
        },
      },
    },
  },
};

const interviewSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "feedback", "referenceAnswer", "followUpQuestion"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    feedback: { type: "string" },
    referenceAnswer: { type: "string" },
    followUpQuestion: { type: "string" },
  },
};

const interviewOpeningSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questionText", "questionType"],
  properties: {
    questionText: { type: "string" },
    questionType: { type: "string" },
  },
};

const interviewReportSchema = {
  type: "object",
  additionalProperties: false,
  required: ["totalScore", "summary", "strengths", "improvements"],
  properties: {
    totalScore: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
    improvements: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
  },
};

const jobDescriptionParseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["jobTitle", "companyName", "responsibilities", "requiredSkills", "preferredSkills", "educationRequirements", "experienceRequirements", "technicalKeywords", "softSkills", "seniority", "uncertainties"],
  properties: {
    jobTitle: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } },
    companyName: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } },
    responsibilities: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    requiredSkills: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    preferredSkills: { type: "array", maxItems: 20, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    educationRequirements: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    experienceRequirements: { type: "array", maxItems: 8, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    technicalKeywords: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    softSkills: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
    seniority: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } },
    uncertainties: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["text", "evidence"], properties: { text: { type: "string" }, evidence: { type: "string" } } } },
  },
};

function normalizeEvidenceItem(value = {}, fieldName, rawText, { allowEmptyEvidence = false } = {}) {
  const evidence = String(value.evidence || "").trim();
  if (!allowEmptyEvidence && !evidence) throw new Error(`AI returned ${fieldName} without JD evidence`);
  if (evidence && !String(rawText || "").includes(evidence)) {
    throw new Error(`AI returned ${fieldName} evidence that is not present in the JD`);
  }
  return {
    text: requireNonEmptyText(value.text, `${fieldName}.text`),
    evidence,
  };
}

function normalizeEvidenceList(value, fieldName, maxItems, rawText) {
  if (!Array.isArray(value)) throw new Error(`AI returned invalid ${fieldName}`);
  return value.slice(0, maxItems).map((item) => normalizeEvidenceItem(item, fieldName, rawText));
}

async function generateAiJobDescriptionParse(store, userId, jobDescription) {
  const ai = await runAiJson(store, userId, {
    schemaName: "job_description_parse",
    schema: jobDescriptionParseSchema,
    system: "You extract structured requirements from a job description for Chinese job seekers. Only state requirements explicitly present in the supplied JD. Never infer missing requirements. Keep required and preferred qualifications strictly separate. Every item must include a short verbatim evidence excerpt from the JD; if the JD does not state a field, return an empty list or an object with text '未明确' and empty evidence. Return JSON only.",
    user: [
      `Saved title: ${jobDescription.title || ""}`,
      `Saved company: ${jobDescription.companyName || ""}`,
      "Raw job description:",
      jobDescription.rawText,
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "JD parsing failed", ai.error);
  const data = ai.data;
  return {
    jobTitle: normalizeEvidenceItem(data.jobTitle, "jobTitle", jobDescription.rawText, { allowEmptyEvidence: true }),
    companyName: normalizeEvidenceItem(data.companyName, "companyName", jobDescription.rawText, { allowEmptyEvidence: true }),
    responsibilities: normalizeEvidenceList(data.responsibilities, "responsibilities", 12, jobDescription.rawText),
    requiredSkills: normalizeEvidenceList(data.requiredSkills, "requiredSkills", 20, jobDescription.rawText),
    preferredSkills: normalizeEvidenceList(data.preferredSkills, "preferredSkills", 20, jobDescription.rawText),
    educationRequirements: normalizeEvidenceList(data.educationRequirements, "educationRequirements", 8, jobDescription.rawText),
    experienceRequirements: normalizeEvidenceList(data.experienceRequirements, "experienceRequirements", 8, jobDescription.rawText),
    technicalKeywords: normalizeEvidenceList(data.technicalKeywords, "technicalKeywords", 30, jobDescription.rawText),
    softSkills: normalizeEvidenceList(data.softSkills, "softSkills", 12, jobDescription.rawText),
    seniority: normalizeEvidenceItem(data.seniority, "seniority", jobDescription.rawText, { allowEmptyEvidence: true }),
    uncertainties: normalizeEvidenceList(data.uncertainties, "uncertainties", 12, jobDescription.rawText),
    aiMode: ai.mode,
  };
}

const matchDimensionDefinitions = [
  ["required_skills", "必备技能", 30],
  ["project_relevance", "项目相关性", 25],
  ["keyword_coverage", "关键词覆盖", 15],
  ["experience", "经验匹配", 10],
  ["education", "教育背景", 10],
  ["expression", "表达质量", 10],
];
const matchStatusValues = new Set(["MATCHED", "PARTIALLY_MATCHED", "NOT_FOUND", "NOT_APPLICABLE"]);
const missingResumeEvidenceText = "当前简历中未找到相关证据";

const matchSkillSchema = {
  type: "object", additionalProperties: false,
  required: ["skillName", "matchStatus", "resumeEvidence", "jdEvidence", "explanation", "confidence"],
  properties: {
    skillName: { type: "string" }, matchStatus: { type: "string", enum: [...matchStatusValues] },
    resumeEvidence: { type: "array", items: { type: "string" } }, jdEvidence: { type: "array", items: { type: "string" } },
    explanation: { type: "string" }, confidence: { type: "integer", minimum: 0, maximum: 100 },
  },
};
const matchDimensionSchema = {
  type: "object", additionalProperties: false,
  required: ["key", "label", "score", "summary", "resumeEvidence", "jdEvidence", "missingEvidence", "suggestions"],
  properties: {
    key: { type: "string" }, label: { type: "string" }, score: { type: "integer", minimum: 0, maximum: 100 }, summary: { type: "string" },
    resumeEvidence: { type: "array", items: { type: "string" } }, jdEvidence: { type: "array", items: { type: "string" } },
    missingEvidence: { type: "array", items: { type: "string" } }, suggestions: { type: "array", items: { type: "string" } },
  },
};
const matchSchema = {
  type: "object", additionalProperties: false,
  required: ["totalScore", "summary", "dimensions", "matchedRequiredSkills", "partiallyMatchedRequiredSkills", "missingRequiredSkills", "matchedPreferredSkills", "missingPreferredSkills", "matchedKeywords", "missingKeywords", "strongestResumeEvidence", "risks", "prioritizedSuggestions"],
  properties: {
    totalScore: { type: "integer", minimum: 0, maximum: 100 }, summary: { type: "string" }, dimensions: { type: "array", items: matchDimensionSchema },
    matchedRequiredSkills: { type: "array", items: matchSkillSchema }, partiallyMatchedRequiredSkills: { type: "array", items: matchSkillSchema }, missingRequiredSkills: { type: "array", items: matchSkillSchema },
    matchedPreferredSkills: { type: "array", items: matchSkillSchema }, missingPreferredSkills: { type: "array", items: matchSkillSchema },
    matchedKeywords: { type: "array", items: matchSkillSchema }, missingKeywords: { type: "array", items: matchSkillSchema },
    strongestResumeEvidence: { type: "array", items: { type: "string" } }, risks: { type: "array", items: { type: "string" } }, prioritizedSuggestions: { type: "array", items: { type: "string" } },
  },
};

function strictMatchScore(value, fieldName) {
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 100) throw new Error(`AI 返回字段 ${fieldName} 必须是 0 到 100 的整数`);
  return score;
}

function normalizeMatchEvidence(value, fieldName, sourceText, { required = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`AI 返回字段 ${fieldName} 不是数组`);
  const items = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (required && !items.length) throw new Error(`AI 返回字段 ${fieldName} 缺少证据`);
  for (const item of items) if (!sourceText.includes(item)) throw new Error(`AI 返回字段 ${fieldName} 包含无法验证的证据`);
  return items;
}

function normalizeMatchTextList(value, fieldName, { required = false } = {}) {
  if (!Array.isArray(value)) throw new Error(`AI 返回字段 ${fieldName} 不是数组`);
  const items = [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))];
  if (required && !items.length) throw new Error(`AI 返回字段 ${fieldName} 不能为空`);
  return items;
}

function normalizeMatchSkillList(value, fieldName, expectedStatuses, resumeText, jdText) {
  if (!Array.isArray(value)) throw new Error(`AI 返回字段 ${fieldName} 不是数组`);
  return value.map((item, index) => {
    const status = String(item?.matchStatus || "").trim();
    if (!matchStatusValues.has(status) || !expectedStatuses.includes(status)) throw new Error(`AI 返回字段 ${fieldName}[${index}].matchStatus 不合法`);
    const resumeEvidence = normalizeMatchEvidence(item?.resumeEvidence, `${fieldName}[${index}].resumeEvidence`, resumeText, { required: status !== "NOT_FOUND" && status !== "NOT_APPLICABLE" });
    const jdEvidence = normalizeMatchEvidence(item?.jdEvidence, `${fieldName}[${index}].jdEvidence`, jdText, { required: status !== "NOT_APPLICABLE" });
    return {
      skillName: requireNonEmptyText(item?.skillName, `${fieldName}[${index}].skillName`),
      matchStatus: status,
      resumeEvidence,
      jdEvidence,
      explanation: status === "NOT_FOUND" ? missingResumeEvidenceText : requireNonEmptyText(item?.explanation, `${fieldName}[${index}].explanation`),
      confidence: strictMatchScore(item?.confidence, `${fieldName}[${index}].confidence`),
    };
  });
}

function normalizeMatchReport(data, { resumeSnapshot, jobDescription, parseResult }) {
  const resumeText = JSON.stringify(buildAiResumeContext(resumeSnapshot));
  const jdText = `${jobDescription.rawText}\n${JSON.stringify(parseResult.parsedData || {})}`;
  if (!Array.isArray(data?.dimensions) || data.dimensions.length !== matchDimensionDefinitions.length) throw new Error("AI 返回的匹配维度不完整");
  const dimensions = matchDimensionDefinitions.map(([key, label, weight], index) => {
    const item = data.dimensions[index];
    if (!item || item.key !== key) throw new Error(`AI 返回的匹配维度顺序或 key 不正确：${key}`);
    const resumeEvidence = normalizeMatchEvidence(item.resumeEvidence, `dimensions.${key}.resumeEvidence`, resumeText);
    const jdEvidence = normalizeMatchEvidence(item.jdEvidence, `dimensions.${key}.jdEvidence`, jdText);
    const missingEvidence = normalizeMatchTextList(item.missingEvidence, `dimensions.${key}.missingEvidence`);
    return {
      key, label: String(item.label || label).trim() || label, score: strictMatchScore(item.score, `dimensions.${key}.score`), weight,
      weightedScore: 0, summary: requireNonEmptyText(item.summary, `dimensions.${key}.summary`), resumeEvidence, jdEvidence,
      missingEvidence: missingEvidence.map(() => missingResumeEvidenceText), suggestions: normalizeMatchTextList(item.suggestions, `dimensions.${key}.suggestions`),
    };
  });
  for (const item of dimensions) item.weightedScore = Number((item.score * item.weight / 100).toFixed(2));
  const totalScore = Math.round(dimensions.reduce((total, item) => total + item.weightedScore, 0));
  return {
    totalScore,
    summary: requireNonEmptyText(data.summary, "summary"),
    dimensions,
    matchedRequiredSkills: normalizeMatchSkillList(data.matchedRequiredSkills, "matchedRequiredSkills", ["MATCHED"], resumeText, jdText),
    partiallyMatchedRequiredSkills: normalizeMatchSkillList(data.partiallyMatchedRequiredSkills, "partiallyMatchedRequiredSkills", ["PARTIALLY_MATCHED"], resumeText, jdText),
    missingRequiredSkills: normalizeMatchSkillList(data.missingRequiredSkills, "missingRequiredSkills", ["NOT_FOUND"], resumeText, jdText),
    matchedPreferredSkills: normalizeMatchSkillList(data.matchedPreferredSkills, "matchedPreferredSkills", ["MATCHED", "PARTIALLY_MATCHED"], resumeText, jdText),
    missingPreferredSkills: normalizeMatchSkillList(data.missingPreferredSkills, "missingPreferredSkills", ["NOT_FOUND"], resumeText, jdText),
    matchedKeywords: normalizeMatchSkillList(data.matchedKeywords, "matchedKeywords", ["MATCHED", "PARTIALLY_MATCHED"], resumeText, jdText),
    missingKeywords: normalizeMatchSkillList(data.missingKeywords, "missingKeywords", ["NOT_FOUND"], resumeText, jdText),
    strongestResumeEvidence: normalizeMatchEvidence(data.strongestResumeEvidence, "strongestResumeEvidence", resumeText, { required: true }),
    risks: normalizeMatchTextList(data.risks, "risks"),
    prioritizedSuggestions: normalizeMatchTextList(data.prioritizedSuggestions, "prioritizedSuggestions", { required: true }),
  };
}

async function generateAiResumeJobMatch(store, userId, context) {
  const aiResume = buildAiResumeContext(context.resumeSnapshot);
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_job_match", schema: matchSchema,
    system: `You produce an evidence-backed Chinese resume-to-JD matching report. Assess only the supplied resume snapshot and JD. Never infer personal ability beyond the resume. When the resume lacks evidence, use exactly '${missingResumeEvidenceText}'. Every non-empty resumeEvidence must be a verbatim excerpt from the resume context; every non-empty jdEvidence must be a verbatim excerpt from the JD or its parsed result. Use exactly six dimensions in this order: required_skills, project_relevance, keyword_coverage, experience, education, expression. Do not decide the final total score; it will be calculated by the server. Return JSON only.`,
    user: [
      `Locked resume context: ${JSON.stringify(aiResume)}`,
      `Locked JD raw text: ${context.jobDescription.rawText}`,
      `Locked JD parse result: ${JSON.stringify(context.parseResult.parsedData)}`,
      "Return a report with summary, dimensions, required/preferred skill lists, keyword lists, strongestResumeEvidence, risks, and prioritizedSuggestions. Every skill item needs skillName, matchStatus, resumeEvidence, jdEvidence, explanation, confidence. Do not include name, contact information, or any private profile field.",
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "岗位匹配 AI 调用失败", ai.error);
  return { ...normalizeMatchReport(ai.data, context), aiMode: ai.mode };
}

function resolveResumeJobMatchContext(store, user, application) {
  const requiredFields = ["userId", "resumeId", "resumeVersionId", "resumeVersion", "resumeContentHash", "jobDescriptionId", "jobDescriptionParseResultId", "jobDescriptionRawTextHash"];
  if (requiredFields.some((field) => application[field] === undefined || application[field] === null || application[field] === "")) {
    throw new HttpError(409, "求职分析任务的固化输入不完整，无法生成匹配报告");
  }
  const resume = getOwnedResume(store, user, application.resumeId);
  const resumeSnapshot = getResumeSnapshotForApplication(store, application);
  if (!resume || !resumeSnapshot || buildResumeDTO(resumeSnapshot).contentHash !== application.resumeContentHash) {
    throw new HttpError(409, "简历版本或内容哈希不一致，无法生成匹配报告");
  }
  const jobDescription = getOwnedJobDescription(store, user, application.jobDescriptionId);
  const parseResult = store.jobDescriptionParseResults.find((item) => item.id === application.jobDescriptionParseResultId
    && item.userId === user.id && item.jobDescriptionId === application.jobDescriptionId && item.status === "SUCCEEDED");
  if (!jobDescription || !parseResult || jobDescription.rawTextHash !== application.jobDescriptionRawTextHash || parseResult.rawTextHash !== jobDescription.rawTextHash || jobDescription.currentParseResultId !== parseResult.id || jobDescription.parseStatus !== "SUCCEEDED") {
    throw new HttpError(409, "岗位 JD 解析结果已失效或未成功解析，无法生成匹配报告");
  }
  return { resumeSnapshot, jobDescription, parseResult };
}

async function executeResumeJobMatch(store, user, application) {
  const context = resolveResumeJobMatchContext(store, user, application);
  const config = getAiConfig(store, user.id);
  const record = {
    id: nextId(store.resumeJobMatches), userId: user.id, jobApplicationId: application.id,
    resumeId: application.resumeId, resumeVersionId: application.resumeVersionId, resumeVersion: application.resumeVersion, resumeContentHash: application.resumeContentHash,
    jobDescriptionId: application.jobDescriptionId, jobDescriptionParseResultId: application.jobDescriptionParseResultId,
    jobDescriptionRawTextHash: application.jobDescriptionRawTextHash, algorithmVersion: "base-match-v1",
    status: "PENDING", totalScore: null, report: null, modelProvider: config.provider, modelId: config.modelId,
    failureCode: null, failureMessage: null, createdAt: now(), updatedAt: now(),
  };
  store.resumeJobMatches.push(record);
  await writeStore(store);
  record.status = "ANALYZING";
  record.updatedAt = now();
  await writeStore(store);
  try {
    const result = await generateAiResumeJobMatch(store, user.id, context);
    record.status = "COMPLETED";
    record.totalScore = result.totalScore;
    record.report = result;
    record.modelProvider = getAiConfig(store, user.id).provider;
    record.modelId = getAiConfig(store, user.id).modelId;
    record.failureCode = null;
    record.failureMessage = null;
    record.updatedAt = now();
    await writeStore(store);
    return record;
  } catch (error) {
    record.status = "FAILED";
    record.totalScore = null;
    record.report = null;
    record.failureCode = error instanceof HttpError && error.status === 400 ? "AI_NOT_CONFIGURED" : "MATCH_GENERATION_FAILED";
    record.failureMessage = String(error.message || "岗位匹配失败").slice(0, 500);
    record.updatedAt = now();
    await writeStore(store);
    throw new HttpError(error instanceof HttpError ? error.status : 422, "岗位匹配失败", { matchId: record.id, reason: record.failureMessage });
  }
}

function reportFailure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function normalizeGroundedText(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) throw reportFailure(422, "REPORT_INVALID_RESPONSE", `AI 返回字段 ${fieldName} 为空`);
  return normalized;
}

function normalizeGroundedReport(data, match) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 报告不是对象");
  const expectedKeys = matchDimensionDefinitions.map(([key]) => key);
  if (!Array.isArray(data.dimensionReports) || data.dimensionReports.length !== expectedKeys.length) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 报告维度不完整");
  const dimensionReports = data.dimensionReports.map((item, index) => {
    if (!item || item.key !== expectedKeys[index]) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 报告维度顺序不合法");
    return { key: item.key, summary: normalizeGroundedText(item.summary, `dimensionReports.${item.key}.summary`) };
  });
  const normalizeList = (value, fieldName) => {
    if (!Array.isArray(value)) throw reportFailure(422, "REPORT_INVALID_RESPONSE", `AI 返回字段 ${fieldName} 不是数组`);
    return [...new Set(value.map((item) => normalizeGroundedText(item, fieldName)))].slice(0, 8);
  };
  if (!Array.isArray(data.claims)) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 返回字段 claims 不是数组");
  const baseEvidence = allowedBaseEvidence(match);
  const ids = new Set();
  const claims = data.claims.map((claim, index) => {
    const claimId = normalizeGroundedText(claim?.claimId, `claims.${index}.claimId`);
    if (ids.has(claimId)) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 返回重复 claimId");
    ids.add(claimId);
    const claimType = String(claim?.claimType || "").trim();
    if (!["BASE_MATCH_FACT", "KNOWLEDGE_CLAIM", "MODEL_SUGGESTION"].includes(claimType)) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI 返回未知 Claim 类型");
    const citations = Array.isArray(claim?.citations) ? claim.citations : null;
    const claimBaseEvidence = Array.isArray(claim?.baseEvidence) ? [...new Set(claim.baseEvidence.map((item) => String(item || "").trim()).filter(Boolean))] : null;
    if (!citations || !claimBaseEvidence) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "AI Claim 缺少结构字段");
    if (claimType === "BASE_MATCH_FACT") {
      if (citations.length || !claimBaseEvidence.length || claimBaseEvidence.some((item) => !baseEvidence.has(item))) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "基础匹配事实没有引用已验证证据");
    } else if (claimType === "KNOWLEDGE_CLAIM") {
      if (claimBaseEvidence.length) throw reportFailure(422, "REPORT_INVALID_RESPONSE", "知识主张不得冒充基础匹配事实");
    } else if (citations.length || claimBaseEvidence.length || !String(claim?.text || "").trim().startsWith("建议：")) {
      throw reportFailure(422, "REPORT_INVALID_RESPONSE", "模型建议必须显式标识且不带事实引用");
    }
    return { claimId, sectionKey: normalizeGroundedText(claim?.sectionKey, `claims.${index}.sectionKey`), text: normalizeGroundedText(claim?.text, `claims.${index}.text`), claimType, citations, baseEvidence: claimBaseEvidence, validationStatus: claimType === "KNOWLEDGE_CLAIM" ? "PENDING" : "VALID" };
  });
  if (!claims.length) throw reportFailure(422, "REPORT_NO_SUPPORTED_CLAIMS", "AI 报告不包含可保留的主张");
  return { executiveSummary: normalizeGroundedText(data.executiveSummary, "executiveSummary"), dimensionReports, strengths: normalizeList(data.strengths, "strengths"), gaps: normalizeList(data.gaps, "gaps"), recommendations: normalizeList(data.recommendations, "recommendations"), claims };
}

function resolveMatchReportContext(store, user, application, match) {
  if (!match) throw reportFailure(404, "REPORT_MATCH_NOT_FOUND", "基础匹配记录不存在");
  if (match.status !== "COMPLETED" || !match.report) throw reportFailure(409, "REPORT_MATCH_NOT_COMPLETED", "只有已完成的基础匹配可以生成报告");
  const fields = ["userId", "resumeId", "resumeVersionId", "resumeVersion", "resumeContentHash", "jobDescriptionId", "jobDescriptionParseResultId", "jobDescriptionRawTextHash"];
  if (fields.some((field) => application[field] === undefined || match[field] === undefined || application[field] !== match[field]) || match.jobApplicationId !== application.id) {
    throw reportFailure(409, "REPORT_INPUT_INVALID", "基础匹配与求职分析任务的固化输入不一致");
  }
  const resumeSnapshot = getResumeSnapshotForApplication(store, application);
  const resume = getOwnedResume(store, user, application.resumeId);
  const jobDescription = getOwnedJobDescription(store, user, application.jobDescriptionId);
  const parseResult = store.jobDescriptionParseResults.find((item) => item.id === application.jobDescriptionParseResultId && item.userId === user.id && item.jobDescriptionId === application.jobDescriptionId && item.status === "SUCCEEDED");
  const normalizedText = normalizeJobDescriptionText(jobDescription?.rawText);
  const normalizedTextHash = contentHash(normalizedText);
  if (!resume || !resumeSnapshot || buildResumeDTO(resumeSnapshot).contentHash !== application.resumeContentHash || !jobDescription || !parseResult || jobDescription.rawTextHash !== application.jobDescriptionRawTextHash || parseResult.rawTextHash !== application.jobDescriptionRawTextHash || application.jobDescriptionNormalizedTextHash !== normalizedTextHash) {
    throw reportFailure(409, "REPORT_INPUT_INVALID", "报告的简历版本、JD 或解析结果已失效");
  }
  return { resumeSnapshot, jobDescription: { ...jobDescription, normalizedText, normalizedTextHash }, parseResult };
}

async function generateAiGroundedReport(store, userId, context, match, candidates) {
  const prompt = buildGroundedReportPrompt({ aiResume: buildAiResumeContext(context.resumeSnapshot), jobDescription: context.jobDescription, parseResult: context.parseResult, match, candidates });
  const ai = await runAiJson(store, userId, { schemaName: "grounded_match_report", schema: groundedReportSchema, system: prompt.system, user: prompt.user, strictJson: true });
  if (!ai.ok) {
    const code = ai.code === "AI_NOT_CONFIGURED" ? "REPORT_PROVIDER_NOT_CONFIGURED" : ai.code === "REPORT_INVALID_RESPONSE" ? "REPORT_INVALID_RESPONSE" : "REPORT_PROVIDER_UNAVAILABLE";
    throw reportFailure(ai.status || 502, code, ai.error || "报告生成服务不可用");
  }
  return normalizeGroundedReport(ai.data, match);
}

async function executeGroundedMatchReport(store, user, application, match, options) {
  const context = resolveMatchReportContext(store, user, application, match);
  const config = getAiConfig(store, user.id);
  const reportVersion = store.matchReports.filter((item) => item.userId === user.id && item.jobApplicationId === application.id && item.resumeJobMatchId === match.id).reduce((maximum, item) => Math.max(maximum, Number(item.reportVersion) || 0), 0) + 1;
  const generationConfigHash = reportGenerationConfigHash({ ...options, promptVersion: groundedReportPromptVersion });
  const report = {
    id: nextId(store.matchReports), userId: user.id, jobApplicationId: application.id, resumeJobMatchId: match.id,
    resumeId: match.resumeId, resumeVersionId: match.resumeVersionId, resumeVersion: match.resumeVersion, resumeContentHash: match.resumeContentHash,
    jobDescriptionId: match.jobDescriptionId, jobDescriptionParseResultId: match.jobDescriptionParseResultId, jobDescriptionRawTextHash: match.jobDescriptionRawTextHash, jobDescriptionNormalizedTextHash: context.jobDescription.normalizedTextHash,
    baseMatchAlgorithmVersion: match.algorithmVersion, status: "PENDING", reportVersion, inputHash: "", promptVersion: groundedReportPromptVersion,
    provider: config.provider, model: config.modelId, generationConfigHash, retrievalRunIds: [], retrievalQueries: [], evidenceCoverage: null, droppedClaimCount: 0, validationFailures: [], failureCode: null, failureMessage: null, content: null, createdAt: now(), completedAt: null,
  };
  store.matchReports.push(report);
  await writeStore(store);
  try {
    const traces = [];
    for (const plan of buildReportRetrievalPlans(match, context.parseResult, options)) {
      const result = await knowledgeRetrievalService().search(store, plan.request, user.id);
      traces.push({ dimensionKey: plan.dimensionKey, retrievalRunId: result.run.id, query: result.normalizedQuery, queryHash: result.queryHash, degraded: result.degraded, rerankerFallback: result.rerankerFallback, candidates: result.results });
      report.retrievalRunIds = traces.map((trace) => trace.retrievalRunId);
    }
    report.retrievalRunIds = traces.map((trace) => trace.retrievalRunId);
    report.retrievalQueries = traces.map(({ dimensionKey, retrievalRunId, query, queryHash, candidates }) => ({ dimensionKey, retrievalRunId, query, queryHash, candidateChunkIds: candidates.map((candidate) => candidate.chunkId) }));
    report.inputHash = createReportInputHash({ application, match, retrievalRunIds: report.retrievalRunIds, promptVersion: report.promptVersion, generationConfigHash });
    const generated = await generateAiGroundedReport(store, user.id, context, match, buildCandidatePromptPayload(traces));
    const validated = validateKnowledgeClaims(store, report, generated.claims);
    const claims = validated.claims;
    if (!claims.length) throw reportFailure(422, "REPORT_NO_SUPPORTED_CLAIMS", "所有报告主张均未通过验证");
    const knowledgeClaimCount = generated.claims.filter((item) => item.claimType === "KNOWLEDGE_CLAIM").length;
    const candidateCount = traces.reduce((sum, trace) => sum + trace.candidates.length, 0);
    const retrievalDegraded = traces.some((trace) => trace.degraded || trace.rerankerFallback);
    const noKnowledgeEvidence = validated.validKnowledgeClaimCount === 0;
    report.status = retrievalDegraded || validated.droppedClaimCount || noKnowledgeEvidence ? "DEGRADED" : "COMPLETED";
    report.content = { ...generated, claims };
    report.evidenceCoverage = { retrievalRunCount: traces.length, candidateCount, knowledgeClaimCount, validKnowledgeClaimCount: validated.validKnowledgeClaimCount, ratio: knowledgeClaimCount ? Number((validated.validKnowledgeClaimCount / knowledgeClaimCount).toFixed(4)) : 0 };
    report.droppedClaimCount = validated.droppedClaimCount;
    report.validationFailures = validated.validationFailures;
    report.failureCode = report.status === "DEGRADED" ? (validated.droppedClaimCount ? "REPORT_CITATION_INVALID" : retrievalDegraded ? "REPORT_RETRIEVAL_DEGRADED" : "REPORT_NO_KNOWLEDGE_EVIDENCE") : null;
    report.failureMessage = report.status === "DEGRADED" ? "报告已降级：仅保留通过验证的内容。" : null;
    report.completedAt = now();
    await writeStore(store);
    return report;
  } catch (error) {
    report.status = "FAILED";
    report.content = null;
    report.failureCode = error.code || "REPORT_RETRIEVAL_FAILED";
    report.failureMessage = String(error.message || "报告生成失败").slice(0, 500);
    report.completedAt = now();
    await writeStore(store);
    throw reportFailure(error.status || 502, report.failureCode, report.failureMessage);
  }
}

const resumeSuggestionTypes = new Set(["REWRITE", "CLARIFY", "KEYWORD_ALIGNMENT", "STRUCTURE", "FACT_REQUIRED"]);
const resumeSuggestionStatuses = new Set(["PENDING", "ACCEPTED", "REJECTED", "INVALIDATED"]);
const resumeSuggestionMaxTextLength = 4000;
const resumeSuggestionMaxPatchOperations = 1;

function resumeSuggestionFailure(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function suggestionHash(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function escapeJsonPointerSegment(value) {
  return String(value).replace(/~/g, "~0").replace(/\//g, "~1");
}

function decodeJsonPointer(pointer) {
  if (typeof pointer !== "string" || !pointer.startsWith("/") || pointer.length > 600) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 路径不合法");
  return pointer.slice(1).split("/").map((segment) => {
    if (/~(?:[^01]|$)/.test(segment)) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 路径转义不合法");
    return segment.replace(/~1/g, "/").replace(/~0/g, "~");
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

// This document deliberately contains only editable resume content. Entry IDs, not
// array positions, are used in paths so a suggestion cannot drift after reordering.
function buildResumeSuggestionDocument(resumeSnapshot) {
  const dto = buildResumeDTO(resumeSnapshot);
  const sections = {};
  for (const section of dto.sections) {
    const entries = {};
    for (const entry of section.entries || []) {
      entries[String(entry.id)] = {
        name: String(entry.name || ""), role: String(entry.role || ""), startDate: String(entry.startDate || ""), endDate: String(entry.endDate || ""), highlights: (entry.highlights || []).map((item) => String(item || "")),
      };
    }
    sections[section.key] = { entries };
  }
  return { title: dto.title, targetPosition: dto.targetPosition, selfEvaluation: dto.selfEvaluation, sections };
}

function getSuggestionPathValue(document, segments) {
  let value = document;
  for (const segment of segments) {
    if (!value || typeof value !== "object" || !Object.hasOwn(value, segment)) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 指向不存在的简历内容");
    value = value[segment];
  }
  return value;
}

function validateResumeSuggestionPatch(document, patch, targetPath, before, after) {
  if (!Array.isArray(patch) || patch.length !== resumeSuggestionMaxPatchOperations) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "每条可应用建议只能包含一项 patch 操作");
  const operation = patch[0];
  if (!operation || typeof operation !== "object" || !["replace", "add"].includes(operation.op) || typeof operation.path !== "string" || Object.keys(operation).some((key) => !["op", "path", "value"].includes(key))) {
    throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 操作不合法");
  }
  if (operation.path !== targetPath || typeof operation.value !== "string" || operation.value.length > resumeSuggestionMaxTextLength || typeof before !== "string" || typeof after !== "string" || after.length > resumeSuggestionMaxTextLength || operation.value !== after) {
    throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 内容与目标不一致");
  }
  const segments = decodeJsonPointer(operation.path);
  let existingValue;
  if (["title", "targetPosition", "selfEvaluation"].includes(segments[0]) && segments.length === 1) {
    if (operation.op !== "replace") throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "基础字段只允许 replace");
    existingValue = getSuggestionPathValue(document, segments);
  } else if (segments[0] === "sections" && segments[2] === "entries" && segments.length >= 5) {
    const [,, , entryId, field, index] = segments;
    if (!entryId || !["name", "role", "startDate", "endDate", "highlights"].includes(field)) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 字段不在允许范围内");
    const entry = getSuggestionPathValue(document, ["sections", segments[1], "entries", entryId]);
    if (field === "highlights") {
      if (segments.length !== 6 || !Array.isArray(entry.highlights)) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 高亮信息路径不合法");
      if (operation.op === "add") {
        if (index !== "-") throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "新增 highlight 只能追加到末尾");
        existingValue = "";
      } else {
        if (!/^\d+$/.test(index) || Number(index) >= entry.highlights.length) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch highlight 下标不合法");
        existingValue = entry.highlights[Number(index)];
      }
    } else {
      if (segments.length !== 5 || operation.op !== "replace") throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "经历字段只允许 replace");
      existingValue = entry[field];
    }
  } else {
    throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 patch 试图修改非简历内容或受保护字段");
  }
  if (existingValue !== before) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_PATCH", "建议 before 与锁定简历内容不一致");
  return { op: operation.op, path: operation.path, value: operation.value, segments };
}

function applyValidatedResumeSuggestionPatch(document, validatedPatch) {
  const next = cloneJson(document);
  const segments = validatedPatch.segments;
  if (validatedPatch.op === "add") {
    const values = getSuggestionPathValue(next, segments.slice(0, -1));
    values.push(validatedPatch.value);
    return next;
  }
  let target = next;
  for (const segment of segments.slice(0, -1)) target = target[segment];
  target[segments.at(-1)] = validatedPatch.value;
  return next;
}

function normalizeSuggestionEvidenceText(value) {
  return String(value || "").trim().replace(/\s+/g, "").toLowerCase();
}

function readSuggestionEvidenceSource(baseDocument, sourcePath) {
  const segments = decodeJsonPointer(sourcePath);
  if (["title", "targetPosition", "selfEvaluation"].includes(segments[0]) && segments.length === 1) {
    const value = getSuggestionPathValue(baseDocument, segments);
    if (typeof value !== "string") throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径必须指向简历文本内容");
    return value;
  }
  if (segments[0] !== "sections" || segments[2] !== "entries" || !segments[1] || !segments[3]) throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径不在允许的简历内容字段内");
  if (["name", "role", "startDate", "endDate"].includes(segments[4]) && segments.length === 5) {
    const value = getSuggestionPathValue(baseDocument, segments);
    if (typeof value !== "string") throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径必须指向简历文本内容");
    return value;
  }
  if (segments[4] === "highlights" && segments.length === 6 && /^\d+$/.test(segments[5])) {
    const value = getSuggestionPathValue(baseDocument, segments);
    if (typeof value !== "string") throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径必须指向简历文本内容");
    return value;
  }
  throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径不在允许的简历内容字段内");
}

function validateSuggestionEvidence({ baseDocument, after, factEvidence }) {
  if (!Array.isArray(factEvidence) || !factEvidence.length) throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_MISSING", "可应用建议缺少锁定简历事实证据");
  if (factEvidence.length > 12) throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "事实证据数量超出限制");
  const afterText = normalizeSuggestionEvidenceText(after);
  const evidence = [];
  const seen = new Set();
  for (const item of factEvidence) {
    const fact = String(item?.fact || "").trim();
    const sourcePath = String(item?.sourcePath || "").trim();
    const sourceQuote = String(item?.sourceQuote || "");
    if (!fact || fact.length > 500 || !sourcePath || !sourceQuote || sourceQuote.length > resumeSuggestionMaxTextLength) throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "事实证据字段不合法");
    let sourceValue;
    try {
      sourceValue = readSuggestionEvidenceSource(baseDocument, sourcePath);
    } catch (error) {
      throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "证据路径不在锁定简历内容中");
    }
    const normalizedFact = normalizeSuggestionEvidenceText(fact);
    if (!sourceValue.includes(sourceQuote) || !normalizedFact || suggestionEvidenceNonFactTerms.has(normalizedFact) || !normalizeSuggestionEvidenceText(sourceQuote).includes(normalizedFact) || !afterText.includes(normalizedFact)) {
      throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_INVALID", "事实证据无法证明改写中的用户事实");
    }
    const key = `${sourcePath}\u0000${fact}\u0000${sourceQuote}`;
    if (!seen.has(key)) {
      seen.add(key);
      evidence.push({ fact, sourcePath, sourceQuote });
    }
  }
  validateSuggestionEvidenceCoverage({ baseDocument, after, evidence });
  return evidence;
}

const suggestionTechnicalAliases = new Map([
  ["js", "javascript"],
  ["nodejs", "node.js"],
  ["dotnet", ".net"],
]);
const suggestionCompoundTechnicalPattern = /(?<![A-Za-z0-9+#.-])(?:c\+\+|c#|\.net|node\.js|vue\.js|next\.js|objective-c|react\s+native|spring\s+cloud)(?![A-Za-z0-9+#.-])/gi;
const suggestionTechnicalIgnoredTerms = new Set(["and", "the", "with", "for", "from", "into", "using", "api", "ui", "to"]);
const suggestionEvidenceNonFactTerms = new Set([
  "完成", "完善", "优化", "提升", "提高", "改进", "加强", "推进", "作为", "开发", "维护", "建设", "负责", "参与", "协助", "配合", "对接", "承担", "支持", "提供", "服务", "管理", "主导", "涉及", "接触", "使用", "熟练", "编写", "持续", "进行", "主要", "日常", "长期", "当前", "此前", "曾", "曾将", "梳理", "简洁", "清晰", "表达更聚焦前端岗位", "表达更简洁清晰", "将接口响应时间降低", "并持续优化", "工作内容", "任务", "目标", "重点", "问题", "职责", "人员", "前端", "后端", "前后端", "移动端", "核心", "系统", "平台", "项目", "团队", "客户", "接口", "模块", "业务", "技术", "性能", "需求", "设计", "协作", "稳定性", "文档", "具备", "经验", "表达", "聚焦", "岗位", "组件", "基于", "构建", "缓存", "响应时间", "降低", "改写", "调整", "补充", "增强", "改善", "实现", "处理", "保障", "负责", "参与", "相关", "联调", "适配", "部署", "测试", "方案", "能力", "效果", "质量", "效率", "逻辑", "流程", "内容", "结果", "说明", "描述", "背景", "情况", "事项", "方向", "领域", "功能", "服务端", "客户端", "体验", "可维护性", "可用性", "可靠性", "复杂度", "风险", "沟通", "协调", "合作", "对接方", "服务对象", "合作对象", "客户方", "业务方", "合作方", "工作", "是", "为", "的", "与", "和", "及", "并", "将", "把", "从", "通过", "针对", "由", "我", "本人", "更", "较", "也", "还", "会", "能", "可", "在", "等",
]);

const suggestionEvidenceGenericChineseTerms = [...suggestionEvidenceNonFactTerms]
  .filter((term) => /^[\u3400-\u9fff]+$/u.test(term))
  .sort((left, right) => right.length - left.length);

function isGenericSuggestionChineseSpan(span) {
  // This is an all-or-nothing word break over the intact span. Functional
  // one-character tokens may bridge generic phrases, but are never removed from
  // inside an otherwise unsupported fact such as 高并发、高可用 or 微服务.
  const reachable = new Array(span.length + 1).fill(false);
  reachable[0] = true;
  for (let index = 0; index < span.length; index += 1) {
    if (!reachable[index]) continue;
    for (const term of suggestionEvidenceGenericChineseTerms) {
      if (span.startsWith(term, index)) reachable[index + term.length] = true;
    }
  }
  return reachable[span.length];
}

function validateSuggestionEvidenceCoverage({ baseDocument, after, evidence }) {
  const baseText = normalizeSuggestionEvidenceText(JSON.stringify(baseDocument));
  const evidenceFacts = evidence.map((item) => normalizeSuggestionEvidenceText(item.fact));
  const chineseSpans = normalizeSuggestionEvidenceText(after).match(/[\u3400-\u9fff]{2,}/g) || [];
  for (const span of chineseSpans) {
    const supported = baseText.includes(span) || evidenceFacts.some((fact) => fact.includes(span) || span.includes(fact));
    if (!supported && !isGenericSuggestionChineseSpan(span)) throw resumeSuggestionFailure(422, "SUGGESTION_EVIDENCE_MISSING", "改写中的新增事实缺少锁定简历证据");
  }
}

function normalizeSuggestionEntity(value) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
  return suggestionTechnicalAliases.get(normalized) || normalized;
}

function extractSuggestionTechnicalEntities(value) {
  const entities = new Set();
  const source = String(value || "");
  const compoundRanges = [];
  for (const match of source.matchAll(suggestionCompoundTechnicalPattern)) {
    entities.add(normalizeSuggestionEntity(match[0]));
    compoundRanges.push([match.index, match.index + match[0].length]);
  }
  for (const match of source.matchAll(/[A-Za-z][A-Za-z0-9.+#/-]*/g)) {
    const start = match.index;
    const end = start + match[0].length;
    if (compoundRanges.some(([compoundStart, compoundEnd]) => start < compoundEnd && end > compoundStart)) continue;
    const entity = normalizeSuggestionEntity(match[0]);
    if (suggestionTechnicalIgnoredTerms.has(entity)) continue;
    // One-letter C is an unambiguous language entity. Other one-letter prose is
    // deliberately ignored so normal wording does not become a claimed fact.
    if (entity.length > 1 || entity === "c") entities.add(entity);
  }
  return entities;
}

function firstUnsupportedEntity(afterEntities, beforeEntities, baseEntities) {
  for (const entity of afterEntities) {
    if (!beforeEntities.has(entity) && !baseEntities.has(entity)) return entity;
  }
  return "";
}

function factualDeltaFailure(before, after, baseDocument) {
  const baseText = JSON.stringify(baseDocument).toLowerCase();
  const beforeText = String(before || "").toLowerCase();
  const afterText = String(after || "").toLowerCase();
  const numberTokens = afterText.match(/(?:\b\d+(?:\.\d+)?%?|\d+年)/g) || [];
  const unsupportedNumber = [...new Set(numberTokens.filter((token) => !beforeText.includes(token)))].find((token) => !baseText.includes(token));
  if (unsupportedNumber) return `新增事实“${unsupportedNumber}”未在锁定简历中找到依据`;

  const baseTechnicalEntities = extractSuggestionTechnicalEntities(JSON.stringify(baseDocument));
  const unsupportedTechnicalEntity = firstUnsupportedEntity(
    extractSuggestionTechnicalEntities(after),
    extractSuggestionTechnicalEntities(before),
    baseTechnicalEntities,
  );
  if (unsupportedTechnicalEntity) return `新增技术实体“${unsupportedTechnicalEntity}”未在锁定简历中找到依据`;

  // Evidence from the locked ResumeVersion is the primary proof boundary. Chinese
  // relationship/entity heuristics intentionally do not authorize or reject a
  // REWRITE; numeric and complete technical-token checks remain deterministic
  // defense-in-depth blockers above.
  return "";
}

function normalizeSuggestionReferences(item, report) {
  const claimIds = new Set((report.content?.claims || []).map((claim) => String(claim.claimId || "")));
  const recommendations = new Set((report.content?.recommendations || []).map((value) => String(value || "")));
  const sourceClaimIds = [...new Set((Array.isArray(item.sourceClaimIds) ? item.sourceClaimIds : []).map((value) => String(value || "").trim()).filter(Boolean))];
  const recommendationRefs = [...new Set((Array.isArray(item.recommendationRefs) ? item.recommendationRefs : []).map((value) => String(value || "").trim()).filter(Boolean))];
  if (sourceClaimIds.some((id) => !claimIds.has(id)) || recommendationRefs.some((value) => !recommendations.has(value))) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_OUTPUT", "建议引用了未绑定的报告事实或建议");
  if (!sourceClaimIds.length && !recommendationRefs.length) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_OUTPUT", "建议缺少报告依据");
  return { sourceClaimIds, recommendationRefs };
}

function normalizeGeneratedResumeSuggestions(data, { baseDocument, report }) {
  if (!data || typeof data !== "object" || !Array.isArray(data.suggestions) || data.suggestions.length > 12) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_OUTPUT", "AI 建议输出结构不合法");
  return data.suggestions.map((item, index) => {
    const suggestionType = String(item?.suggestionType || "").trim();
    const sectionType = String(item?.sectionType || "").trim();
    const targetPath = String(item?.targetPath || "").trim();
    const rationale = String(item?.rationale || "").trim();
    const before = String(item?.before ?? "");
    const after = String(item?.after ?? "");
    if (!resumeSuggestionTypes.has(suggestionType) || !sectionType || !rationale || rationale.length > resumeSuggestionMaxTextLength || before.length > resumeSuggestionMaxTextLength) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_OUTPUT", `AI 建议 ${index + 1} 字段不合法`);
    const refs = normalizeSuggestionReferences(item, report);
    if (suggestionType === "FACT_REQUIRED") {
      if (after || !Array.isArray(item.patch) || item.patch.length || !Array.isArray(item.factEvidence) || item.factEvidence.length) throw resumeSuggestionFailure(422, "SUGGESTION_INVALID_OUTPUT", "FACT_REQUIRED 不得包含可直接应用的虚构正文或事实证据");
      // The location itself must still be a real editable field, even though this
      // suggestion intentionally has no patch and cannot be accepted.
      validateResumeSuggestionPatch(baseDocument, [{ op: "replace", path: targetPath, value: before }], targetPath, before, before);
      return { sectionType, targetPath, suggestionType, rationale, before, after: "", patch: [], factEvidence: [], ...refs, failureCode: null };
    }
    const validatedPatch = validateResumeSuggestionPatch(baseDocument, item.patch, targetPath, before, after);
    const factualFailure = factualDeltaFailure(before, after, baseDocument);
    if (factualFailure) {
      return { sectionType, targetPath, suggestionType: "FACT_REQUIRED", rationale: `${rationale}；${factualFailure}，请由用户补充后再修改。`, before, after: "", patch: [], factEvidence: [], ...refs, failureCode: "SUGGESTION_UNSUPPORTED_FACT" };
    }
    try {
      const factEvidence = validateSuggestionEvidence({ baseDocument, before, after, factEvidence: item.factEvidence });
      return { sectionType, targetPath, suggestionType, rationale, before, after, patch: [{ op: validatedPatch.op, path: validatedPatch.path, value: validatedPatch.value }], factEvidence, ...refs, failureCode: null };
    } catch (error) {
      if (!["SUGGESTION_EVIDENCE_MISSING", "SUGGESTION_EVIDENCE_INVALID"].includes(error.code)) throw error;
      return { sectionType, targetPath, suggestionType: "FACT_REQUIRED", rationale: `${rationale}；${error.message}，请由用户补充后再修改。`, before, after: "", patch: [], factEvidence: [], ...refs, failureCode: error.code };
    }
  });
}

function materializeSuggestionDocument(baseResume, document, nextVersion) {
  const dto = buildResumeDTO(baseResume);
  const baseDocument = buildResumeSuggestionDocument(baseResume);
  const next = { ...baseResume, title: document.title, targetPosition: document.targetPosition, selfEvaluation: document.selfEvaluation, version: nextVersion, resumeVersion: nextVersion, updatedAt: now() };
  const sectionDetails = { ...(baseResume.sectionDetails || {}) };
  const sectionContent = { ...(baseResume.sectionContent || {}) };
  for (const section of dto.sections) {
    const updatedEntries = document.sections[section.key]?.entries;
    if (!updatedEntries) continue;
    if (JSON.stringify(updatedEntries) === JSON.stringify(baseDocument.sections[section.key]?.entries || {})) continue;
    const entries = section.entries.map((entry) => ({ ...entry, ...updatedEntries[String(entry.id)], isCurrent: Boolean(entry.isCurrent) }));
    if (Array.isArray(baseResume.sectionDetails?.[section.label])) sectionDetails[section.label] = entries;
    else if (Array.isArray(baseResume.sectionContent?.[section.label])) sectionContent[section.label] = entries.flatMap((entry) => entry.highlights || []);
    else if (section.key === "skills" || section.key === "work" || section.key === "projects") {
      next.sections = { ...(baseResume.sections || {}), [section.key]: entries.map((entry) => entry.highlights || []).flat() };
    } else sectionDetails[section.label] = entries;
  }
  if (Object.keys(sectionDetails).length) next.sectionDetails = sectionDetails;
  if (Object.keys(sectionContent).length) next.sectionContent = sectionContent;
  return next;
}

function resolveSuggestionReportContext(store, user, report) {
  if (!report || report.userId !== user.id) throw resumeSuggestionFailure(404, "SUGGESTION_REPORT_NOT_FOUND", "岗位匹配报告不存在");
  if (!new Set(["COMPLETED", "DEGRADED"]).has(report.status) || !report.content) throw resumeSuggestionFailure(409, "SUGGESTION_REPORT_NOT_READY", "只有已完成或降级的报告可以生成简历建议");
  const application = getOwnedJobApplication(store, user, report.jobApplicationId);
  const match = getOwnedResumeJobMatch(store, user, report.resumeJobMatchId);
  const fields = ["userId", "resumeId", "resumeVersionId", "resumeVersion", "resumeContentHash", "jobDescriptionId", "jobDescriptionParseResultId"];
  if (!application || !match || fields.some((field) => report[field] === undefined || application[field] !== report[field] || match[field] !== report[field]) || match.jobApplicationId !== application.id) throw resumeSuggestionFailure(409, "SUGGESTION_INPUT_INVALID", "报告的固化输入不完整或不一致");
  const history = store.resumeHistories.find((item) => item.id === report.resumeVersionId && item.resumeId === report.resumeId && item.resumeVersion === report.resumeVersion && item.contentHash === report.resumeContentHash && item.snapshot);
  const jobDescription = getOwnedJobDescription(store, user, report.jobDescriptionId);
  const parseResult = store.jobDescriptionParseResults.find((item) => item.id === report.jobDescriptionParseResultId && item.userId === user.id && item.jobDescriptionId === report.jobDescriptionId && item.status === "SUCCEEDED");
  if (!history || buildResumeDTO(history.snapshot).contentHash !== report.resumeContentHash || !jobDescription || jobDescription.rawTextHash !== report.jobDescriptionRawTextHash || !parseResult || parseResult.rawTextHash !== report.jobDescriptionRawTextHash) throw resumeSuggestionFailure(409, "SUGGESTION_INPUT_INVALID", "报告绑定的简历版本或 JD 已失效");
  return { application, match, history, jobDescription: { title: jobDescription.title, rawText: jobDescription.rawText, parsedData: parseResult.parsedData || {} } };
}

async function executeResumeSuggestionRun(store, user, report) {
  const context = resolveSuggestionReportContext(store, user, report);
  const config = getAiConfig(store, user.id);
  const generationConfigHash = suggestionHash({ promptVersion: resumeSuggestionPromptVersion, schema: "resume-suggestions-v2-evidence", maxPatchOperations: resumeSuggestionMaxPatchOperations, maxTextLength: resumeSuggestionMaxTextLength });
  const run = {
    id: nextId(store.suggestionRuns), userId: user.id, jobApplicationId: report.jobApplicationId, resumeJobMatchId: report.resumeJobMatchId, matchReportId: report.id,
    resumeId: report.resumeId, baseResumeVersionId: report.resumeVersionId, baseResumeVersion: report.resumeVersion, baseResumeContentHash: report.resumeContentHash,
    jobDescriptionId: report.jobDescriptionId, reportVersion: report.reportVersion, promptVersion: resumeSuggestionPromptVersion, provider: config.provider, model: config.modelId,
    generationConfigHash, inputHash: suggestionHash({ matchReportId: report.id, reportVersion: report.reportVersion, resumeId: report.resumeId, resumeVersionId: report.resumeVersionId, resumeContentHash: report.resumeContentHash, jobDescriptionId: report.jobDescriptionId, promptVersion: resumeSuggestionPromptVersion, generationConfigHash }),
    status: "PENDING", failureCode: null, failureMessage: null, createdAt: now(), completedAt: null,
  };
  store.suggestionRuns.push(run);
  await writeStore(store);
  try {
    const baseDocument = buildResumeSuggestionDocument(context.history.snapshot);
    const prompt = buildResumeSuggestionPrompt({ resumeDocument: baseDocument, jobDescription: context.jobDescription, report });
    const ai = await runAiJson(store, user.id, { schemaName: "resume_suggestions", schema: resumeSuggestionSchema, system: prompt.system, user: prompt.user, strictJson: true });
    if (!ai.ok) throw resumeSuggestionFailure(ai.status || 502, ai.code === "AI_NOT_CONFIGURED" ? "SUGGESTION_PROVIDER_NOT_CONFIGURED" : "SUGGESTION_PROVIDER_UNAVAILABLE", ai.error || "建议生成服务不可用");
    const normalized = normalizeGeneratedResumeSuggestions(ai.data, { baseDocument, report });
    for (const item of normalized) store.resumeSuggestions.push({ id: nextId(store.resumeSuggestions), userId: user.id, suggestionRunId: run.id, ...item, status: "PENDING", createdAt: now(), decidedAt: null, appliedResumeVersion: null, appliedResumeVersionId: null });
    run.status = "COMPLETED";
    run.completedAt = now();
    await writeStore(store);
    return run;
  } catch (error) {
    run.status = "FAILED";
    run.failureCode = error.code || "SUGGESTION_INVALID_OUTPUT";
    run.failureMessage = String(error.message || "简历建议生成失败").slice(0, 500);
    run.completedAt = now();
    await writeStore(store);
    throw resumeSuggestionFailure(error.status || 422, run.failureCode, run.failureMessage);
  }
}

function publicSuggestionRun(store, run) {
  return { ...run, suggestions: store.resumeSuggestions.filter((item) => item.suggestionRunId === run.id) };
}

async function acceptResumeSuggestion(store, user, suggestionId, body) {
  const suggestion = store.resumeSuggestions.find((item) => item.id === suggestionId && item.userId === user.id);
  if (!suggestion) throw resumeSuggestionFailure(404, "SUGGESTION_NOT_FOUND", "简历建议不存在");
  if (suggestion.status !== "PENDING") throw resumeSuggestionFailure(409, "SUGGESTION_ALREADY_DECIDED", "该简历建议已处理，不能重复接受");
  if (suggestion.suggestionType === "FACT_REQUIRED") throw resumeSuggestionFailure(409, "SUGGESTION_FACT_REQUIRED", "该建议需要用户先补充事实，不能直接应用");
  const expectedBaseResumeVersion = Number(body?.expectedBaseResumeVersion);
  if (!Number.isInteger(expectedBaseResumeVersion) || expectedBaseResumeVersion < 1) throw resumeSuggestionFailure(400, "SUGGESTION_INPUT_INVALID", "expectedBaseResumeVersion 必须为正整数");
  const run = store.suggestionRuns.find((item) => item.id === suggestion.suggestionRunId && item.userId === user.id);
  if (!run || run.status !== "COMPLETED" || run.baseResumeVersion !== expectedBaseResumeVersion) throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "建议绑定的简历版本已变化");
  const resume = getOwnedResume(store, user, run.resumeId);
  if (!resume || Number(resume.version) !== run.baseResumeVersion || buildResumeDTO(resume).contentHash !== run.baseResumeContentHash) throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "当前简历版本或内容已变化，不能覆盖后续修改");
  const history = store.resumeHistories.find((item) => item.id === run.baseResumeVersionId && item.resumeId === run.resumeId && item.resumeVersion === run.baseResumeVersion && item.contentHash === run.baseResumeContentHash && item.snapshot);
  if (!history) throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "建议的基础简历版本不可用");
  const baseDocument = buildResumeSuggestionDocument(history.snapshot);
  let validatedPatch;
  try {
    validatedPatch = validateResumeSuggestionPatch(baseDocument, suggestion.patch, suggestion.targetPath, suggestion.before, suggestion.after);
  } catch (error) {
    throw resumeSuggestionFailure(409, error.code || "SUGGESTION_INVALID_PATCH", "建议 patch 已失效或不安全");
  }
  const currentDocument = buildResumeSuggestionDocument(resume);
  let currentValue;
  try {
    currentValue = validatedPatch.op === "add" ? "" : getSuggestionPathValue(currentDocument, validatedPatch.segments);
  } catch {
    throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "建议目标路径已变化");
  }
  if (currentValue !== suggestion.before) throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "建议目标内容已被修改");
  try {
    validateSuggestionEvidence({ baseDocument, before: suggestion.before, after: suggestion.after, factEvidence: suggestion.factEvidence });
  } catch (error) {
    throw resumeSuggestionFailure(409, error.code || "SUGGESTION_EVIDENCE_INVALID", "建议的锁定简历事实证据无效，不能应用");
  }
  if (factualDeltaFailure(suggestion.before, suggestion.after, baseDocument)) throw resumeSuggestionFailure(409, "SUGGESTION_UNSUPPORTED_FACT", "建议包含无依据的新事实，不能应用");
  const patchedDocument = applyValidatedResumeSuggestionPatch(baseDocument, validatedPatch);
  const nextResume = materializeSuggestionDocument(resume, patchedDocument, Number(resume.version) + 1);
  const resumeIndex = store.resumes.findIndex((item) => item.id === resume.id && item.userId === user.id);
  if (resumeIndex < 0) throw resumeSuggestionFailure(409, "RESUME_VERSION_CONFLICT", "当前简历不可用");
  store.resumes[resumeIndex] = nextResume;
  createResumeHistoryRecord(store, nextResume, "接受岗位匹配报告简历建议");
  const appliedHistory = store.resumeHistories.at(-1);
  suggestion.status = "ACCEPTED";
  suggestion.decidedAt = now();
  suggestion.appliedResumeVersion = appliedHistory.resumeVersion;
  suggestion.appliedResumeVersionId = appliedHistory.id;
  // Stage 7A strategy A: a newly created version invalidates every remaining
  // pending suggestion from this run rather than silently rebasing patches.
  for (const item of store.resumeSuggestions) {
    if (item.suggestionRunId === run.id && item.id !== suggestion.id && item.status === "PENDING") {
      item.status = "INVALIDATED";
      item.decidedAt = suggestion.decidedAt;
    }
  }
  await writeStore(store);
  return { suggestion, resumeVersion: { id: appliedHistory.id, version: appliedHistory.resumeVersion, contentHash: appliedHistory.contentHash } };
}

async function rejectResumeSuggestion(store, user, suggestionId) {
  const suggestion = store.resumeSuggestions.find((item) => item.id === suggestionId && item.userId === user.id);
  if (!suggestion) throw resumeSuggestionFailure(404, "SUGGESTION_NOT_FOUND", "简历建议不存在");
  if (suggestion.status !== "PENDING") throw resumeSuggestionFailure(409, "SUGGESTION_ALREADY_DECIDED", "该简历建议已处理，不能重复拒绝");
  suggestion.status = "REJECTED";
  suggestion.decidedAt = now();
  await writeStore(store);
  return suggestion;
}

function publicMatchReport(store, report) {
  const content = report.content ? {
    ...report.content,
    claims: report.content.claims.map((claim) => ({
      ...claim,
      citations: claim.citations.map((citation) => {
        const chunk = store.knowledgeChunks.find((item) => item.id === citation.chunkId && item.documentId === citation.documentId && item.processingVersion === citation.processingVersion);
        const document = store.knowledgeDocuments.find((item) => item.id === citation.documentId);
        return {
          ...citation,
          availability: sourceAvailability(store, citation) ? "AVAILABLE" : "UNAVAILABLE",
          headingPath: chunk?.headingPath || [],
          documentType: document?.documentType || "",
          jobFamily: document?.jobFamily || "",
          seniority: document?.seniority || "",
          skillTags: document?.skillTags || [],
          language: document?.language || "",
        };
      }),
    })),
  } : null;
  return { ...report, content };
}

function publicMatchReportSummary(report) {
  return {
    id: report.id,
    jobApplicationId: report.jobApplicationId,
    resumeJobMatchId: report.resumeJobMatchId,
    resumeId: report.resumeId,
    resumeVersion: report.resumeVersion,
    jobDescriptionId: report.jobDescriptionId,
    reportVersion: report.reportVersion,
    status: report.status,
    provider: report.provider || null,
    model: report.model || null,
    evidenceCoverage: report.evidenceCoverage || null,
    droppedClaimCount: report.droppedClaimCount || 0,
    failureCode: report.failureCode || null,
    createdAt: report.createdAt,
    completedAt: report.completedAt || null,
  };
}

async function generateAiAnalysis(store, userId, resume, position) {
  const resumeContext = buildAiResumeContext(resume);
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_analysis",
    schema: analysisSchema,
    system: "You are a senior resume coach for Chinese job seekers. Evaluate the resume against the target role. Return JSON only. Keep all string fields non-empty and write Chinese suggestions.",
    user: [
      `Resume context (resumeId ${resumeContext.resumeId}, version ${resumeContext.resumeVersion}): ${JSON.stringify(resumeContext)}`,
      `Target role: ${position.positionName}`,
      `Reference keywords for this role, if available: ${(position.keywords || []).join(", ") || "None; infer them from the role."}`,
      'Return exactly this JSON shape: {"totalScore":0,"completenessScore":0,"matchScore":0,"keywordScore":0,"projectScore":0,"analysisResult":"非空中文结论","keywords":["关键词一","关键词二","关键词三","关键词四","关键词五"],"suggestions":["建议一","建议二","建议三"]}. Scores must be integers from 0 to 100. Generate 5-10 specific Chinese or technical role keywords that should naturally appear in this resume, and 3-6 specific Chinese suggestions.',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 诊断失败", ai.error);
  return {
    totalScore: normalizeScore(ai.data.totalScore, "totalScore"),
    completenessScore: normalizeScore(ai.data.completenessScore, "completenessScore"),
    matchScore: normalizeScore(ai.data.matchScore, "matchScore"),
    keywordScore: normalizeScore(ai.data.keywordScore, "keywordScore"),
    projectScore: normalizeScore(ai.data.projectScore, "projectScore"),
    analysisResult: requireNonEmptyText(ai.data.analysisResult, "analysisResult"),
    keywords: normalizeTextList(ai.data.keywords, "keywords", 5, 10),
    suggestions: normalizeTextList(ai.data.suggestions, "suggestions", 3, 6),
    aiMode: ai.mode,
  };
}

async function generateAiOptimize(store, userId, resume, content, optimizeType = "general") {
  const resumeContext = buildAiResumeContext(resume);
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_optimize",
    schema: optimizeSchema,
    system: "You are a professional Chinese resume editor. Rewrite the user input into one concise, professional, result-oriented Chinese resume bullet. Preserve facts. Do not invent company names, numbers, or project details. Return JSON only and keep optimizedContent non-empty.",
    user: [
      `Resume context (resumeId ${resumeContext.resumeId}, version ${resumeContext.resumeVersion}): ${JSON.stringify(resumeContext)}`,
      `Optimize type: ${optimizeType}`,
      "Original resume text:",
      content || "",
      'Return exactly this JSON shape: {"optimizedContent":"非空中文润色结果"}',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 润色失败", ai.error);
  return { optimizedContent: requireNonEmptyText(ai.data.optimizedContent, "optimizedContent"), aiMode: ai.mode };
}

async function generateAiGrammar(store, userId, resume, content) {
  const resumeContext = buildAiResumeContext(resume);
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_grammar_check",
    schema: grammarSchema,
    system: "You are a Chinese resume proofreading expert. Check typos, English spelling, punctuation, grammar, clarity, and resume wording. Return JSON only. Write issue reasons in Chinese.",
    user: [
      `Resume context (resumeId ${resumeContext.resumeId}, version ${resumeContext.resumeVersion}): ${JSON.stringify(resumeContext)}`,
      "Resume text to proofread:",
      content || "",
      "Return score and an issues array. If there are no issues, return an empty issues array.",
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 语法检查失败", ai.error);
  return {
    score: normalizeScore(ai.data.score, "score"),
    issues: Array.isArray(ai.data.issues) ? ai.data.issues.map(normalizeIssue) : [],
    aiMode: ai.mode,
  };
}

function getInterviewResumeContext(resume = {}) {
  return `Resume context: ${JSON.stringify(buildAiResumeContext(resume))}`;
}

async function generateAiInterviewOpening(store, userId, { resume, targetPosition }) {
  const ai = await runAiJson(store, userId, {
    schemaName: "interview_opening",
    schema: interviewOpeningSchema,
    system: "You are an experienced Chinese interviewer. Generate the first interview question specifically from the target role and candidate resume. Ask one focused question only. Return JSON only.",
    user: [
      `Target role: ${targetPosition}`,
      getInterviewResumeContext(resume),
      'Return exactly this JSON shape: {"questionText":"非空中文面试题","questionType":"项目经历或技术能力等类别"}.',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 面试题生成失败", ai.error);
  return {
    questionText: requireNonEmptyText(ai.data.questionText, "questionText"),
    questionType: requireNonEmptyText(ai.data.questionType, "questionType"),
    aiMode: ai.mode,
  };
}

async function generateAiInterviewFeedback(store, userId, { targetPosition, resume, questionText, answerText, referenceAnswer }) {
  const ai = await runAiJson(store, userId, {
    schemaName: "interview_feedback",
    schema: interviewSchema,
    system: "You are a technical interview coach. Evaluate the candidate answer in Chinese against the target role and resume. Give practical feedback, a stronger reference answer, and one focused follow-up question based on the answer. Return JSON only.",
    user: [
      `Target role: ${targetPosition || ""}`,
      getInterviewResumeContext(resume),
      `Question: ${questionText || ""}`,
      `Candidate answer: ${answerText || ""}`,
      `Reference answer, if any: ${referenceAnswer || ""}`,
      'Return exactly this JSON shape: {"score":0,"feedback":"非空中文反馈","referenceAnswer":"非空中文参考答案","followUpQuestion":"非空中文追问"}.',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 面试反馈失败", ai.error);
  return {
    score: normalizeScore(ai.data.score, "score"),
    feedback: requireNonEmptyText(ai.data.feedback, "feedback"),
    referenceAnswer: requireNonEmptyText(ai.data.referenceAnswer, "referenceAnswer"),
    followUpQuestion: requireNonEmptyText(ai.data.followUpQuestion, "followUpQuestion"),
    aiMode: ai.mode,
  };
}

async function generateAiInterviewReport(store, userId, { resume, targetPosition, answers }) {
  const ai = await runAiJson(store, userId, {
    schemaName: "interview_report",
    schema: interviewReportSchema,
    system: "You are a senior Chinese interview coach. Summarize this completed mock interview into a concise and evidence-based report. Return JSON only.",
    user: [
      `Target role: ${targetPosition}`,
      getInterviewResumeContext(resume),
      `Interview answers: ${JSON.stringify(answers.map((item) => ({ question: item.questionText, answer: item.answerText, score: item.score, feedback: item.feedback })))}`,
      'Return exactly this JSON shape: {"totalScore":0,"summary":"非空中文总结","strengths":["优势一","优势二"],"improvements":["改进一","改进二"]}.',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 面试报告生成失败", ai.error);
  return {
    totalScore: normalizeScore(ai.data.totalScore, "totalScore"),
    summary: requireNonEmptyText(ai.data.summary, "summary"),
    strengths: normalizeTextList(ai.data.strengths, "strengths", 2, 4),
    improvements: normalizeTextList(ai.data.improvements, "improvements", 2, 4),
    aiMode: ai.mode,
  };
}

function buildAnalysis(store, resumeId, targetPositionId) {
  const resume = store.resumes.find((item) => item.id === resumeId);
  const position = store.jobPositions.find((item) => item.id === targetPositionId) || store.jobPositions[0];
  const searchable = JSON.stringify(resume || {}).toLowerCase();
  const covered = position.keywords.filter((keyword) => searchable.includes(keyword.toLowerCase()));
  const keywordScore = Math.min(96, 58 + covered.length * 7);
  const completenessScore = resume?.email && resume?.phone && resume?.sections?.projects?.length ? 90 : 72;
  const projectScore = searchable.includes("提升") || searchable.includes("%") ? 82 : 68;
  const matchScore = Math.round((keywordScore + projectScore) / 2);
  const totalScore = Math.round((completenessScore + matchScore + keywordScore + projectScore) / 4);

  return {
    totalScore,
    completenessScore,
    matchScore,
    keywordScore,
    projectScore,
    analysisResult: `${position.positionName}匹配度${totalScore >= 85 ? "较高" : "中等"}，已覆盖 ${covered.join("、") || "部分"} 核心要求。`,
    suggestions: [
      "项目经历建议继续补充量化结果",
      "将目标岗位关键词自然写入职责和成果",
      "面试前准备 3 个可复盘的技术决策案例",
    ],
  };
}

function optimizeContent(content = "") {
  if (!content.trim()) {
    return "主导核心模块设计与落地，明确业务目标、技术方案和量化结果，让项目价值更容易被招聘方识别。";
  }
  return content
    .replace("负责", "主导")
    .replace("完成", "落地")
    .replace(/。?$/, "，并补充效率提升、用户规模或性能指标，强化结果导向表达。");
}

function checkGrammar(content = "") {
  const issues = [];
  if (/Thier/i.test(content)) {
    issues.push({ type: "拼写", original: "Thier", suggestion: "Their", reason: "英文拼写错误" });
  }
  if (content.includes("比较快")) {
    issues.push({ type: "表达", original: "比较快", suggestion: "响应速度提升 28%", reason: "简历表达建议量化结果" });
  }
  if (content.includes("负责")) {
    issues.push({ type: "表达", original: "负责", suggestion: "主导", reason: "动词更有行动感" });
  }
  if (!/[。！？]$/.test(content.trim())) {
    issues.push({ type: "标点", original: "句末缺少标点", suggestion: "补充句末标点", reason: "保持正式书面表达" });
  }
  return {
    score: Math.max(60, 96 - issues.length * 7),
    issues,
  };
}

async function handleApi(req, res) {
  applySecurityHeaders(req, res);
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;
  const method = req.method || "GET";

  if (method === "OPTIONS") {
    return send(res, 204, {});
  }

  if (method === "GET" && pathname === "/api/auth/captcha") {
    return send(res, 200, issueCaptcha());
  }

  const captchaImageMatch = pathname.match(/^\/api\/auth\/captcha\/([\w-]+)$/);
  if (method === "GET" && captchaImageMatch) {
    cleanupCaptchaChallenges();
    const captcha = captchaChallenges.get(captchaImageMatch[1]);
    if (!captcha) return send(res, 404, { message: "验证码已过期，请刷新后重试" });
    return sendSvg(res, 200, captchaSvg(captcha.code));
  }

  const store = await readStore();
  const key = routeKey(method, pathname);

  if (key === "GET /api/health") {
    return send(res, 200, { ok: true, service: "ai-resume-coach-api", time: now() });
  }

  if (key === "GET /api/ai-config") {
    const user = requireUser(store, req);
    return send(res, 200, { item: publicAiConfig(store, user.id) });
  }

  if (key === "PUT /api/ai-config") {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const provider = normalizeProvider(body.provider);
    const configs = getAiProviderConfigs(store, user.id);
    const current = configs[provider];
    const nextConfig = {
      ...current,
      provider,
      baseUrl: normalizeBaseUrl(body.baseUrl || current.baseUrl),
      modelId: normalizeModelId(provider, body.modelId, current.modelId || "gpt-5.5"),
      enabled: body.enabled !== false,
      updatedAt: now(),
    };
    if (typeof body.apiKey === "string" && body.apiKey.trim()) {
      nextConfig.apiKey = body.apiKey.trim();
    }
    if (body.clearApiKey) {
      nextConfig.apiKey = "";
    }
    store.aiSettingsByUser = {
      ...store.aiSettingsByUser,
      [user.id]: {
        aiConfig: nextConfig,
        aiProviderConfigs: { ...configs, [provider]: nextConfig },
      },
    };
    await writeStore(store);
    return send(res, 200, { item: publicAiConfig(store, user.id) });
  }

  if (key === "POST /api/auth/login") {
    const body = await readJson(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const rateLimitKey = `login:${clientIp(req)}:${username || "unknown"}`;
    const retryAfter = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (retryAfter) return send(res, 429, { message: "登录尝试过于频繁，请稍后再试", retryAfter });
    verifyCaptcha(body.captchaId, body.captchaCode);
    const user = store.users.find((item) => item.username === username && item.status === 1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordRateLimitAttempt(rateLimitKey, 15 * 60 * 1000);
      return send(res, 401, { message: "用户名或密码错误" });
    }
    clearRateLimit(rateLimitKey);
    const { session, token } = issueSession(store, user);
    await writeStore(store);
    setSessionCookie(res, token);
    return send(res, 200, { user: publicUser(user), expiresAt: session.expiresAt });
  }

  if (key === "POST /api/auth/register") {
    const body = await readJson(req);
    const username = normalizeUsername(body.username);
    const password = String(body.password || "");
    const email = String(body.email || "").trim().toLowerCase();
    const rateLimitKey = `register:${clientIp(req)}`;
    const retryAfter = checkRateLimit(rateLimitKey, 5, 60 * 60 * 1000);
    if (retryAfter) return send(res, 429, { message: "注册请求过于频繁，请稍后再试", retryAfter });
    verifyCaptcha(body.captchaId, body.captchaCode);
    validateRegistration({ username, password, email });
    if (store.users.some((item) => item.username === username)) return send(res, 409, { message: "用户名已存在" });
    const user = {
      id: nextId(store.users),
      username,
      passwordHash: await hashPassword(password),
      realName: username,
      email,
      role: "USER",
      status: 1,
      createdAt: now(),
    };
    store.users.push(user);
    recordRateLimitAttempt(rateLimitKey, 60 * 60 * 1000);
    const { session, token } = issueSession(store, user);
    await writeStore(store);
    setSessionCookie(res, token);
    return send(res, 201, { user: publicUser(user), expiresAt: session.expiresAt });
  }

  if (key === "POST /api/auth/logout") {
    const token = getSessionToken(req);
    const tokenHash = token ? hashSessionToken(token) : "";
    if (tokenHash) {
      store.sessions = store.sessions.filter((item) => item.tokenHash !== tokenHash);
      await writeStore(store);
    }
    clearSessionCookie(res);
    return send(res, 204, {});
  }

  if (key === "POST /api/auth/change-password") {
    const user = requireUser(store, req, { allowPasswordUpdate: true });
    const body = await readJson(req);
    const currentPassword = String(body.currentPassword || "");
    const nextPassword = String(body.nextPassword || "");
    const rateLimitKey = `change-password:${user.id}`;
    const retryAfter = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (retryAfter) return send(res, 429, { message: "验证尝试过于频繁，请稍后再试", retryAfter });
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      recordRateLimitAttempt(rateLimitKey, 15 * 60 * 1000);
      return send(res, 401, { message: "当前密码不正确" });
    }
    validatePassword(nextPassword);
    if (await verifyPassword(nextPassword, user.passwordHash)) {
      return send(res, 400, { message: "新密码不能与当前密码相同" });
    }
    clearRateLimit(rateLimitKey);
    user.passwordHash = await hashPassword(nextPassword);
    user.passwordUpdateRequired = false;
    const { session, token } = issueSession(store, user);
    await writeStore(store);
    setSessionCookie(res, token);
    return send(res, 200, { user: publicUser(user), expiresAt: session.expiresAt });
  }

  if (key === "GET /api/users/me") {
    const user = requireUser(store, req, { allowPasswordUpdate: true });
    return send(res, 200, { user: publicUser(user) });
  }

  if (key === "GET /api/job-positions") {
    return send(res, 200, { items: store.jobPositions.filter((item) => item.status === 1) });
  }

  if (key === "GET /api/job-descriptions") {
    const user = requireUser(store, req);
    const items = store.jobDescriptions
      .filter((item) => item.userId === user.id)
      .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
      .map((item) => ({
        ...item,
        currentParseResult: store.jobDescriptionParseResults.find((result) => result.id === item.currentParseResultId) || null,
      }));
    return send(res, 200, { items });
  }

  if (key === "POST /api/job-descriptions") {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const rawText = requireNonEmptyText(body.rawText, "rawText");
    const jobDescription = {
      id: nextId(store.jobDescriptions),
      userId: user.id,
      title: String(body.title || "").trim() || "未命名岗位 JD",
      companyName: String(body.companyName || "").trim(),
      sourceUrl: String(body.sourceUrl || "").trim(),
      rawText,
      rawTextHash: contentHash(rawText),
      normalizedText: normalizeJobDescriptionText(rawText),
      normalizedTextHash: contentHash(normalizeJobDescriptionText(rawText)),
      currentParseResultId: null,
      parseStatus: "NOT_PARSED",
      createdAt: now(),
      updatedAt: now(),
    };
    store.jobDescriptions.push(jobDescription);
    await writeStore(store);
    return send(res, 201, { item: jobDescription });
  }

  const jobDescriptionMatch = pathname.match(/^\/api\/job-descriptions\/(\d+)$/);
  if (method === "GET" && jobDescriptionMatch) {
    const user = requireUser(store, req);
    const item = getOwnedJobDescription(store, user, jobDescriptionMatch[1]);
    if (!item) return send(res, 404, { message: "岗位 JD 不存在" });
    const parseResults = store.jobDescriptionParseResults
      .filter((result) => result.jobDescriptionId === item.id && result.userId === user.id)
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
    return send(res, 200, { item, parseResults, currentParseResult: parseResults.find((result) => result.id === item.currentParseResultId) || null });
  }

  if (method === "PUT" && jobDescriptionMatch) {
    const user = requireUser(store, req);
    const current = getOwnedJobDescription(store, user, jobDescriptionMatch[1]);
    if (!current) return send(res, 404, { message: "岗位 JD 不存在" });
    const body = await readJson(req);
    const rawText = Object.hasOwn(body, "rawText") ? requireNonEmptyText(body.rawText, "rawText") : current.rawText;
    const rawTextHash = contentHash(rawText);
    const normalizedText = normalizeJobDescriptionText(rawText);
    const sourceChanged = rawTextHash !== current.rawTextHash;
    const item = {
      ...current,
      title: Object.hasOwn(body, "title") ? String(body.title || "").trim() || current.title : current.title,
      companyName: Object.hasOwn(body, "companyName") ? String(body.companyName || "").trim() : current.companyName,
      sourceUrl: Object.hasOwn(body, "sourceUrl") ? String(body.sourceUrl || "").trim() : current.sourceUrl,
      rawText,
      rawTextHash,
      normalizedText,
      normalizedTextHash: contentHash(normalizedText),
      currentParseResultId: sourceChanged ? null : current.currentParseResultId,
      parseStatus: sourceChanged ? "NOT_PARSED" : current.parseStatus,
      updatedAt: now(),
    };
    const index = store.jobDescriptions.findIndex((candidate) => candidate.id === current.id);
    store.jobDescriptions[index] = item;
    await writeStore(store);
    return send(res, 200, { item });
  }

  if (method === "DELETE" && jobDescriptionMatch) {
    const user = requireUser(store, req);
    const item = getOwnedJobDescription(store, user, jobDescriptionMatch[1]);
    if (!item) return send(res, 404, { message: "岗位 JD 不存在" });
    const applicationIds = new Set(store.jobApplications.filter((application) => application.jobDescriptionId === item.id).map((application) => application.id));
    store.jobDescriptions = store.jobDescriptions.filter((candidate) => candidate.id !== item.id);
    store.jobDescriptionParseResults = store.jobDescriptionParseResults.filter((result) => result.jobDescriptionId !== item.id);
    store.jobApplications = store.jobApplications.filter((application) => application.jobDescriptionId !== item.id);
    store.resumeJobMatches = store.resumeJobMatches.filter((match) => !applicationIds.has(match.jobApplicationId) && match.jobDescriptionId !== item.id);
    store.matchReports = store.matchReports.filter((report) => !applicationIds.has(report.jobApplicationId) && report.jobDescriptionId !== item.id);
    const suggestionRunIds = new Set(store.suggestionRuns.filter((run) => applicationIds.has(run.jobApplicationId) || run.jobDescriptionId === item.id).map((run) => run.id));
    store.suggestionRuns = store.suggestionRuns.filter((run) => !suggestionRunIds.has(run.id));
    store.resumeSuggestions = store.resumeSuggestions.filter((suggestion) => !suggestionRunIds.has(suggestion.suggestionRunId));
    await writeStore(store);
    return send(res, 204, {});
  }

  const jobDescriptionParseMatch = pathname.match(/^\/api\/job-descriptions\/(\d+)\/parse$/);
  if (method === "POST" && jobDescriptionParseMatch) {
    const user = requireUser(store, req);
    const jobDescription = getOwnedJobDescription(store, user, jobDescriptionParseMatch[1]);
    if (!jobDescription) return send(res, 404, { message: "岗位 JD 不存在" });
    try {
      const parsedData = await generateAiJobDescriptionParse(store, user.id, jobDescription);
      const result = {
        id: nextId(store.jobDescriptionParseResults),
        userId: user.id,
        jobDescriptionId: jobDescription.id,
        rawTextHash: jobDescription.rawTextHash,
        parserVersion: "jd-parser-v1",
        status: "SUCCEEDED",
        parsedData,
        createdAt: now(),
      };
      store.jobDescriptionParseResults.push(result);
      jobDescription.currentParseResultId = result.id;
      jobDescription.parseStatus = "SUCCEEDED";
      jobDescription.updatedAt = now();
      await writeStore(store);
      return send(res, 201, { item: result, jobDescription });
    } catch (error) {
      jobDescription.parseStatus = "FAILED";
      jobDescription.lastParseError = error.message || "JD parsing failed";
      jobDescription.updatedAt = now();
      await writeStore(store);
      throw error instanceof HttpError ? error : new HttpError(422, "JD parsing failed", jobDescription.lastParseError);
    }
  }

  if (key === "GET /api/job-applications") {
    const user = requireUser(store, req);
    const items = store.jobApplications.filter((item) => item.userId === user.id).map((item) => ({
      ...item,
      resume: store.resumes.find((resume) => resume.id === item.resumeId && resume.userId === user.id) || null,
      jobDescription: store.jobDescriptions.find((jobDescription) => jobDescription.id === item.jobDescriptionId && jobDescription.userId === user.id) || null,
    }));
    return send(res, 200, { items });
  }

  if (key === "POST /api/job-applications") {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const resume = getOwnedResume(store, user, body.resumeId);
    const jobDescription = getOwnedJobDescription(store, user, body.jobDescriptionId);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    if (!jobDescription) return send(res, 404, { message: "岗位 JD 不存在" });
    const resumeVersionId = parseOptionalPositiveInteger(body.resumeVersionId, "resumeVersionId");
    if (!resumeVersionId) return send(res, 400, { message: "请选择明确的简历版本后再创建求职分析任务" });
    const resumeHistory = store.resumeHistories.find((item) => item.id === resumeVersionId && item.resumeId === resume.id && item.snapshot);
    if (!resumeHistory || buildResumeDTO(resumeHistory.snapshot).contentHash !== resumeHistory.contentHash) {
      return send(res, 409, { message: "所选简历版本快照不完整或内容哈希不一致" });
    }
    const parseResult = store.jobDescriptionParseResults.find((result) => result.id === jobDescription.currentParseResultId && result.jobDescriptionId === jobDescription.id && result.userId === user.id && result.status === "SUCCEEDED");
    if (!parseResult) return send(res, 409, { message: "请先成功解析该岗位 JD 后再创建求职分析任务" });
    const application = {
      id: nextId(store.jobApplications),
      userId: user.id,
      resumeId: resume.id,
      resumeVersionId: resumeHistory.id,
      resumeVersion: resumeHistory.resumeVersion,
      resumeContentHash: resumeHistory.contentHash,
      jobDescriptionId: jobDescription.id,
      jobDescriptionParseResultId: parseResult.id,
      jobDescriptionRawTextHash: jobDescription.rawTextHash,
      jobDescriptionNormalizedTextHash: jobDescription.normalizedTextHash || contentHash(normalizeJobDescriptionText(jobDescription.rawText)),
      status: "READY_FOR_MATCH",
      createdAt: now(),
    };
    store.jobApplications.push(application);
    await writeStore(store);
    return send(res, 201, { item: application });
  }

  const applicationMatchesMatch = pathname.match(/^\/api\/job-applications\/(\d+)\/matches$/);
  if (applicationMatchesMatch && method === "GET") {
    const user = requireUser(store, req);
    const application = getOwnedJobApplication(store, user, applicationMatchesMatch[1]);
    if (!application) return send(res, 404, { message: "求职分析任务不存在" });
    const items = store.resumeJobMatches
      .filter((item) => item.userId === user.id && item.jobApplicationId === application.id)
      .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
      .map(({ report, ...item }) => ({ ...item, hasReport: Boolean(report) }));
    return send(res, 200, { items });
  }

  if (applicationMatchesMatch && method === "POST") {
    const user = requireUser(store, req);
    const application = getOwnedJobApplication(store, user, applicationMatchesMatch[1]);
    if (!application) return send(res, 404, { message: "求职分析任务不存在" });
    const item = await executeResumeJobMatch(store, user, application);
    return send(res, 201, { item });
  }

  const applicationReportsMatch = pathname.match(/^\/api\/job-applications\/(\d+)\/reports$/);
  if (applicationReportsMatch && method === "GET") {
    const user = requireUser(store, req);
    const application = getOwnedJobApplication(store, user, applicationReportsMatch[1]);
    if (!application) return send(res, 404, { message: "求职分析任务不存在" });
    const items = store.matchReports
      .filter((report) => report.userId === user.id && report.jobApplicationId === application.id)
      .sort((left, right) => (right.reportVersion - left.reportVersion) || String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
      .map(publicMatchReportSummary);
    return send(res, 200, { items });
  }

  if (applicationReportsMatch && method === "POST") {
    const user = requireUser(store, req);
    const application = getOwnedJobApplication(store, user, applicationReportsMatch[1]);
    if (!application) return send(res, 404, { message: "求职分析任务不存在", failureCode: "REPORT_INPUT_INVALID" });
    const body = await readJson(req);
    const matchId = Number(body.matchId);
    if (!Number.isInteger(matchId) || matchId < 1) return send(res, 400, { message: "matchId 必须是正整数", failureCode: "REPORT_INPUT_INVALID" });
    const searchMode = String(body.searchMode || "HYBRID").toUpperCase();
    if (!["KEYWORD", "VECTOR", "HYBRID"].includes(searchMode)) return send(res, 400, { message: "searchMode 不合法", failureCode: "REPORT_INPUT_INVALID" });
    if (body.useReranker !== undefined && typeof body.useReranker !== "boolean") return send(res, 400, { message: "useReranker 必须为布尔值", failureCode: "REPORT_INPUT_INVALID" });
    const match = getOwnedResumeJobMatch(store, user, matchId);
    try {
      const item = await executeGroundedMatchReport(store, user, application, match, { searchMode, useReranker: body.useReranker === true });
      return send(res, 201, { item: publicMatchReport(store, item) });
    } catch (error) {
      return send(res, error.status || 502, { message: error.message || "报告生成失败", failureCode: error.code || "REPORT_RETRIEVAL_FAILED" });
    }
  }

  const reportSuggestionsMatch = pathname.match(/^\/api\/match-reports\/(\d+)\/resume-suggestions$/);
  if (reportSuggestionsMatch && method === "GET") {
    const user = requireUser(store, req);
    const reportId = Number(reportSuggestionsMatch[1]);
    const report = Number.isInteger(reportId) ? store.matchReports.find((item) => item.id === reportId && item.userId === user.id) : null;
    if (!report) return send(res, 404, { message: "岗位匹配报告不存在", failureCode: "SUGGESTION_REPORT_NOT_FOUND" });
    const items = store.suggestionRuns.filter((item) => item.userId === user.id && item.matchReportId === report.id).sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || ""))).map((item) => publicSuggestionRun(store, item));
    return send(res, 200, { items });
  }

  if (reportSuggestionsMatch && method === "POST") {
    const user = requireUser(store, req);
    const reportId = Number(reportSuggestionsMatch[1]);
    const report = Number.isInteger(reportId) ? store.matchReports.find((item) => item.id === reportId && item.userId === user.id) : null;
    try {
      const item = await executeResumeSuggestionRun(store, user, report);
      return send(res, 201, { item: publicSuggestionRun(store, item) });
    } catch (error) {
      return send(res, error.status || 422, { message: error.message || "简历建议生成失败", failureCode: error.code || "SUGGESTION_INVALID_OUTPUT" });
    }
  }

  const suggestionRunDetail = pathname.match(/^\/api\/suggestion-runs\/(\d+)$/);
  if (suggestionRunDetail && method === "GET") {
    const user = requireUser(store, req);
    const runId = Number(suggestionRunDetail[1]);
    const item = Number.isInteger(runId) ? store.suggestionRuns.find((run) => run.id === runId && run.userId === user.id) : null;
    if (!item) return send(res, 404, { message: "简历建议生成记录不存在", failureCode: "SUGGESTION_RUN_NOT_FOUND" });
    return send(res, 200, { item: publicSuggestionRun(store, item) });
  }

  const suggestionDecision = pathname.match(/^\/api\/resume-suggestions\/(\d+)\/(accept|reject)$/);
  if (suggestionDecision && method === "POST") {
    const user = requireUser(store, req);
    const suggestionId = Number(suggestionDecision[1]);
    const action = suggestionDecision[2];
    if (!Number.isInteger(suggestionId) || suggestionId < 1) return send(res, 400, { message: "suggestionId 必须是正整数", failureCode: "SUGGESTION_INPUT_INVALID" });
    if (action === "reject") {
      try {
        const item = await rejectResumeSuggestion(store, user, suggestionId);
        return send(res, 200, { item });
      } catch (error) {
        return send(res, error.status || 409, { message: error.message || "拒绝简历建议失败", failureCode: error.code || "SUGGESTION_ALREADY_DECIDED" });
      }
    }
    if (suggestionDecisionLocks.has(suggestionId)) return send(res, 409, { message: "建议正在被处理，请刷新后重试", failureCode: "RESUME_VERSION_CONFLICT" });
    suggestionDecisionLocks.add(suggestionId);
    try {
      const body = await readJson(req);
      const result = await acceptResumeSuggestion(store, user, suggestionId, body);
      return send(res, 201, { item: result.suggestion, resumeVersion: result.resumeVersion });
    } catch (error) {
      return send(res, error.status || 409, { message: error.message || "接受简历建议失败", failureCode: error.code || "RESUME_VERSION_CONFLICT" });
    } finally {
      suggestionDecisionLocks.delete(suggestionId);
    }
  }

  const matchReportDetail = pathname.match(/^\/api\/match-reports\/(\d+)$/);
  if (matchReportDetail && method === "GET") {
    const user = requireUser(store, req);
    const reportId = Number(matchReportDetail[1]);
    const item = Number.isInteger(reportId) && reportId > 0 ? store.matchReports.find((report) => report.id === reportId && report.userId === user.id) : null;
    if (!item) return send(res, 404, { message: "岗位匹配报告不存在" });
    return send(res, 200, { item: publicMatchReport(store, item) });
  }

  const resumeJobMatchDetail = pathname.match(/^\/api\/resume-job-matches\/(\d+)$/);
  if (resumeJobMatchDetail && method === "GET") {
    const user = requireUser(store, req);
    const item = getOwnedResumeJobMatch(store, user, resumeJobMatchDetail[1]);
    if (!item) return send(res, 404, { message: "岗位匹配报告不存在" });
    return send(res, 200, { item });
  }

  const resumeJobMatchRetry = pathname.match(/^\/api\/resume-job-matches\/(\d+)\/retry$/);
  if (resumeJobMatchRetry && method === "POST") {
    const user = requireUser(store, req);
    const previous = getOwnedResumeJobMatch(store, user, resumeJobMatchRetry[1]);
    if (!previous) return send(res, 404, { message: "岗位匹配报告不存在" });
    if (previous.status !== "FAILED") return send(res, 409, { message: "仅失败的匹配任务可以重试" });
    const application = getOwnedJobApplication(store, user, previous.jobApplicationId);
    if (!application) return send(res, 409, { message: "原求职分析任务已不可用，无法重试" });
    const item = await executeResumeJobMatch(store, user, application);
    return send(res, 201, { item });
  }

  if (key === "GET /api/resumes") {
    const user = requireUser(store, req);
    return send(res, 200, { items: store.resumes.filter((item) => item.userId === user.id) });
  }

  const resumeMatch = pathname.match(/^\/api\/resumes\/([^/]+)$/);
  if (method === "GET" && resumeMatch) {
    const user = requireUser(store, req);
    const resume = getOwnedResume(store, user, resumeMatch[1], { createIfMissing: true });
    if (!resume) return send(res, 404, { message: "简历不存在" });
    await writeStore(store);
    return send(res, 200, { item: { ...resume, resumeDTO: buildResumeDTO(resume) } });
  }

  if (method === "POST" && pathname === "/api/resumes") {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const resume = {
      id: nextId(store.resumes),
      userId: user.id,
      title: body.title || "未命名简历",
      targetPositionId: body.targetPositionId || 1,
      version: 1,
      updatedAt: now(),
      sections: body.sections || { skills: [], projects: [], work: [] },
      ...body,
    };
    store.resumes.push(resume);
    createResumeHistoryRecord(store, resume, "创建新简历");
    await writeStore(store);
    return send(res, 201, { item: { ...resume, resumeDTO: buildResumeDTO(resume) } });
  }

  if (method === "PUT" && resumeMatch) {
    const user = requireUser(store, req);
    const oldResume = getOwnedResume(store, user, resumeMatch[1], { createIfMissing: true });
    if (!oldResume) return send(res, 404, { message: "简历不存在" });
    const resumeIndex = store.resumes.findIndex((item) => item.id === oldResume.id);
    const body = await readJson(req);
    const nextVersion = Number(oldResume.version || 1) + 1;
    const resume = { ...oldResume, ...body, id: oldResume.id, userId: user.id, version: nextVersion, updatedAt: now() };
    store.resumes[resumeIndex] = resume;
    createResumeHistoryRecord(store, resume, body.summary || "自动保存简历修改");
    await writeStore(store);
    return send(res, 200, { item: { ...resume, resumeDTO: buildResumeDTO(resume) } });
  }

  if (method === "DELETE" && resumeMatch) {
    const user = requireUser(store, req);
    if (resumeMatch[1] === "current") return send(res, 400, { message: "请指定要删除的简历" });
    const resume = getOwnedResume(store, user, resumeMatch[1]);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    store.resumes = store.resumes.filter((item) => item.id !== resume.id);
    store.resumeHistories = store.resumeHistories.filter((item) => item.resumeId !== resume.id);
    store.analysisRecords = store.analysisRecords.filter((item) => item.resumeId !== resume.id);
    store.optimizeRecords = store.optimizeRecords.filter((item) => item.resumeId !== resume.id);
    store.grammarRecords = store.grammarRecords.filter((item) => item.resumeId !== resume.id);
    store.mockInterviews = store.mockInterviews.filter((item) => item.resumeId !== resume.id);
    store.interviewAnswers = store.interviewAnswers.filter((item) => item.resumeId !== resume.id);
    const applicationIds = new Set(store.jobApplications.filter((item) => item.resumeId === resume.id).map((item) => item.id));
    store.jobApplications = store.jobApplications.filter((item) => item.resumeId !== resume.id);
    store.resumeJobMatches = store.resumeJobMatches.filter((item) => item.resumeId !== resume.id);
    store.matchReports = store.matchReports.filter((item) => !applicationIds.has(item.jobApplicationId) && item.resumeId !== resume.id);
    const suggestionRunIds = new Set(store.suggestionRuns.filter((run) => applicationIds.has(run.jobApplicationId) || run.resumeId === resume.id).map((run) => run.id));
    store.suggestionRuns = store.suggestionRuns.filter((run) => !suggestionRunIds.has(run.id));
    store.resumeSuggestions = store.resumeSuggestions.filter((suggestion) => !suggestionRunIds.has(suggestion.suggestionRunId));
    await writeStore(store);
    return send(res, 204, {});
  }

  const historyMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/history$/);
  if (method === "GET" && historyMatch) {
    const user = requireUser(store, req);
    const resume = getOwnedResume(store, user, historyMatch[1]);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    return send(res, 200, { items: store.resumeHistories.filter((item) => item.resumeId === resume.id) });
  }

  const versionsMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/versions$/);
  if (method === "GET" && versionsMatch) {
    const user = requireUser(store, req);
    const resume = getOwnedResume(store, user, versionsMatch[1]);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const items = store.resumeHistories
      .filter((item) => item.resumeId === resume.id)
      .map(({ snapshot, ...item }) => {
        const sourceSuggestion = store.resumeSuggestions.find((suggestion) => suggestion.userId === user.id && suggestion.appliedResumeVersionId === item.id && suggestion.status === "ACCEPTED");
        return {
          ...item,
          hasSnapshot: Boolean(snapshot),
          sourceSuggestion: sourceSuggestion ? { id: sourceSuggestion.id, suggestionRunId: sourceSuggestion.suggestionRunId, sectionType: sourceSuggestion.sectionType, suggestionType: sourceSuggestion.suggestionType } : null,
        };
      });
    return send(res, 200, { items });
  }

  const versionMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/versions\/(\d+)$/);
  if (method === "GET" && versionMatch) {
    const user = requireUser(store, req);
    const resume = getOwnedResume(store, user, versionMatch[1]);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const versionId = Number(versionMatch[2]);
    const item = store.resumeHistories.find((history) => history.id === versionId && history.resumeId === resume.id);
    if (!item) return send(res, 404, { message: "简历版本不存在" });
    return send(res, 200, { item });
  }

  const analysisMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/analyze$/);
  if (method === "POST" && analysisMatch) {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const resume = getOwnedResume(store, user, analysisMatch[1], { createIfMissing: true });
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const requestedTargetPosition = typeof body.targetPosition === "string" ? body.targetPosition.trim() : "";
    const savedTargetPosition = typeof resume.targetPosition === "string" ? resume.targetPosition.trim() : "";
    const matchingPosition = store.jobPositions.find((item) => item.positionName === requestedTargetPosition || item.positionName === savedTargetPosition);
    const targetPositionId = matchingPosition?.id || body.targetPositionId || resume.targetPositionId || 1;
    const fallbackPosition = store.jobPositions.find((item) => item.id === targetPositionId) || store.jobPositions[0];
    const targetPosition = requestedTargetPosition || savedTargetPosition || fallbackPosition.positionName;
    const position = {
      ...fallbackPosition,
      positionName: targetPosition,
      keywords: matchingPosition?.keywords || [],
    };
    const result = await generateAiAnalysis(store, user.id, resume, position);
    const record = {
      id: nextId(store.analysisRecords),
      userId: user.id,
      resumeId: resume.id,
      resumeVersion: Number(resume.version) || 1,
      resumeContentHash: buildResumeDTO(resume).contentHash,
      targetPositionId,
      targetPosition,
      ...result,
      createdAt: now(),
    };
    store.analysisRecords.push(record);
    await writeStore(store);
    return send(res, 201, { item: record });
  }

  const optimizeMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/optimize$/);
  if (method === "POST" && optimizeMatch) {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const resume = getOwnedResume(store, user, optimizeMatch[1], { createIfMissing: true });
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const result = await generateAiOptimize(store, user.id, resume, body.content || "", body.optimizeType || "general");
    const record = {
      id: nextId(store.optimizeRecords),
      userId: user.id,
      resumeId: resume.id,
      resumeVersion: Number(resume.version) || 1,
      resumeContentHash: buildResumeDTO(resume).contentHash,
      optimizeType: body.optimizeType || "general",
      originalContent: body.content || "",
      optimizedContent: result.optimizedContent,
      aiMode: result.aiMode,
      promptText: body.promptText || "",
      createdAt: now(),
    };
    store.optimizeRecords.push(record);
    await writeStore(store);
    return send(res, 201, { item: record });
  }

  const grammarMatch = pathname.match(/^\/api\/resumes\/([^/]+)\/grammar-check$/);
  if (method === "POST" && grammarMatch) {
    const user = requireUser(store, req);
    const body = await readJson(req);
    const resume = getOwnedResume(store, user, grammarMatch[1], { createIfMissing: true });
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const result = await generateAiGrammar(store, user.id, resume, body.content || "");
    const record = {
      id: nextId(store.grammarRecords),
      userId: user.id,
      resumeId: resume.id,
      resumeVersion: Number(resume.version) || 1,
      resumeContentHash: buildResumeDTO(resume).contentHash,
      content: body.content || "",
      ...result,
      createdAt: now(),
    };
    store.grammarRecords.push(record);
    await writeStore(store);
    return send(res, 201, { item: record });
  }

  if (key === "GET /api/records/analysis") {
    const user = requireUser(store, req);
    const resumeId = parseOptionalPositiveInteger(url.searchParams.get("resumeId"), "resumeId");
    const items = store.analysisRecords.filter((item) => item.userId === user.id && (resumeId === null || item.resumeId === resumeId));
    return send(res, 200, { items });
  }

  if (key === "GET /api/records/optimize") {
    const user = requireUser(store, req);
    const resumeId = parseOptionalPositiveInteger(url.searchParams.get("resumeId"), "resumeId");
    const items = store.optimizeRecords.filter((item) => item.userId === user.id && (resumeId === null || item.resumeId === resumeId));
    return send(res, 200, { items });
  }

  if (key === "GET /api/records/grammar") {
    const user = requireUser(store, req);
    const resumeId = parseOptionalPositiveInteger(url.searchParams.get("resumeId"), "resumeId");
    const items = store.grammarRecords.filter((item) => item.userId === user.id && (resumeId === null || item.resumeId === resumeId));
    return send(res, 200, { items });
  }

  if (key === "GET /api/records/interviews") {
    const user = requireUser(store, req);
    const resumeId = parseOptionalPositiveInteger(url.searchParams.get("resumeId"), "resumeId");
    return send(res, 200, {
      items: store.mockInterviews.filter((item) => item.userId === user.id && (resumeId === null || item.resumeId === resumeId)).map((item) => ({
        ...item,
        answerCount: store.interviewAnswers.filter((answer) => answer.interviewId === item.id).length,
      })),
    });
  }

  if (key === "GET /api/interview-questions") {
    const positionId = Number(url.searchParams.get("positionId") || 1);
    return send(res, 200, { items: store.interviewQuestions.filter((item) => item.positionId === positionId) });
  }

  if (key === "POST /api/interviews") {
    const user = requireUser(store, req);
    const body = await readJson(req);
    let requestedResumeId;
    try {
      requestedResumeId = parseOptionalPositiveInteger(body.resumeId, "resumeId");
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { message: error.message });
      throw error;
    }
    if (!requestedResumeId) {
      return send(res, 400, { message: "resumeId is required" });
    }
    const resume = getOwnedResume(store, user, requestedResumeId);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const requestedTargetPosition = typeof body.targetPosition === "string" ? body.targetPosition.trim() : "";
    const savedTargetPosition = typeof resume.targetPosition === "string" ? resume.targetPosition.trim() : "";
    const matchingPosition = store.jobPositions.find((item) => item.positionName === requestedTargetPosition || item.positionName === savedTargetPosition);
    let requestedPositionId;
    try {
      requestedPositionId = parseOptionalPositiveInteger(body.positionId, "positionId");
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { message: error.message });
      throw error;
    }
    const targetPosition = requestedTargetPosition || savedTargetPosition || matchingPosition?.positionName || "目标岗位";
    const questionCount = Math.max(2, Math.min(6, Number(body.questionCount) || 4));
    const opening = await generateAiInterviewOpening(store, user.id, { resume, targetPosition });
    const interview = {
      id: nextId(store.mockInterviews),
      userId: user.id,
      resumeId: resume.id,
      resumeVersion: Number(resume.version) || 1,
      resumeContentHash: buildResumeDTO(resume).contentHash,
      resumeSnapshot: createInterviewResumeSnapshot(resume),
      positionId: requestedPositionId || matchingPosition?.id || resume.targetPositionId || null,
      targetPosition,
      title: body.title || `${targetPosition}模拟面试`,
      questionCount,
      questions: [{ id: "q-1", questionText: opening.questionText, questionType: opening.questionType, source: "opening" }],
      status: "IN_PROGRESS",
      totalScore: null,
      overallFeedback: "",
      report: null,
      createdAt: now(),
    };
    store.mockInterviews.push(interview);
    await writeStore(store);
    return send(res, 201, { item: interview });
  }

  if (key === "GET /api/interviews") {
    const user = requireUser(store, req);
    return send(res, 200, { items: store.mockInterviews.filter((item) => item.userId === user.id) });
  }

  const answerMatch = pathname.match(/^\/api\/interviews\/(\d+)\/answers$/);
  if (method === "POST" && answerMatch) {
    const user = requireUser(store, req);
    const interviewId = Number(answerMatch[1]);
    const body = await readJson(req);
    const interview = store.mockInterviews.find((item) => item.id === interviewId && item.userId === user.id);
    if (!interview) return send(res, 404, { message: "模拟面试不存在" });
    if (interview.status !== "IN_PROGRESS") return send(res, 409, { message: "当前面试已完成，请查看报告或重新开始" });
    const resume = interview.resumeSnapshot || getOwnedResume(store, user, interview.resumeId);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const answerText = requireNonEmptyText(body.answerText, "answerText");
    const question = interview.questions?.find((item) => item.id === body.questionId) || interview.questions?.at(-1);
    if (!question) return send(res, 400, { message: "当前面试题不存在" });
    const feedback = await generateAiInterviewFeedback(store, user.id, {
      targetPosition: interview.targetPosition,
      resume,
      questionText: question.questionText,
      answerText,
      referenceAnswer: question.referenceAnswer || "",
    });
    const answer = {
      id: nextId(store.interviewAnswers),
      interviewId,
      resumeId: interview.resumeId,
      resumeVersion: interview.resumeVersion || Number(resume.version) || 1,
      resumeContentHash: interview.resumeContentHash || buildResumeDTO(resume).contentHash,
      questionId: question.id,
      questionText: question.questionText,
      answerText,
      score: feedback.score,
      feedback: feedback.feedback,
      referenceAnswer: feedback.referenceAnswer,
      followUpQuestion: feedback.followUpQuestion,
      aiMode: feedback.aiMode,
      createdAt: now(),
    };
    store.interviewAnswers.push(answer);
    const related = store.interviewAnswers.filter((item) => item.interviewId === interviewId);
    interview.totalScore = Math.round(related.reduce((sum, item) => sum + item.score, 0) / related.length);
    interview.overallFeedback = feedback.feedback;
    let nextQuestion = null;
    if (related.length < interview.questionCount) {
      nextQuestion = {
        id: `q-${related.length + 1}`,
        questionText: feedback.followUpQuestion,
        questionType: "AI 追问",
        source: "follow_up",
      };
      interview.questions = [...(interview.questions || []), nextQuestion];
    } else {
      interview.status = "READY_FOR_REPORT";
    }
    await writeStore(store);
    return send(res, 201, { item: answer, interview, nextQuestion });
  }

  const reportMatch = pathname.match(/^\/api\/interviews\/(\d+)\/report$/);
  if (method === "POST" && reportMatch) {
    const user = requireUser(store, req);
    const interviewId = Number(reportMatch[1]);
    const interview = store.mockInterviews.find((item) => item.id === interviewId && item.userId === user.id);
    if (!interview) return send(res, 404, { message: "模拟面试不存在" });
    const resume = interview.resumeSnapshot || getOwnedResume(store, user, interview.resumeId);
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const answers = store.interviewAnswers.filter((item) => item.interviewId === interviewId);
    if (answers.length < interview.questionCount) return send(res, 409, { message: "请先完成全部面试题" });
    const report = await generateAiInterviewReport(store, user.id, { resume, targetPosition: interview.targetPosition, answers });
    interview.totalScore = report.totalScore;
    interview.overallFeedback = report.summary;
    interview.report = report;
    interview.status = "COMPLETED";
    interview.completedAt = now();
    await writeStore(store);
    return send(res, 201, { item: interview, report });
  }

  if (key === "GET /api/notices") {
    return send(res, 200, { items: store.systemNotices.filter((item) => item.status === 1) });
  }

  if (key === "GET /api/admin/knowledge-retrieval/status") {
    requireAdmin(store, req);
    return send(res, 200, await knowledgeRetrievalService().status());
  }

  if (key === "POST /api/admin/knowledge-retrieval/search") {
    const user = requireAdmin(store, req);
    try { return send(res, 200, await knowledgeRetrievalService().search(store, await readJson(req), user.id)); }
    catch (error) { return send(res, error.status || 502, { message: error.message || "检索服务不可用", failureCode: error.code || "RETRIEVAL_FAILED" }); }
  }

  if (key === "GET /api/admin/knowledge-retrieval/runs") {
    requireAdmin(store, req);
    return send(res, 200, { items: [...store.knowledgeRetrievalRuns].sort((a, b) => b.id - a.id) });
  }

  const retrievalRunMatch = pathname.match(/^\/api\/admin\/knowledge-retrieval\/runs\/([^/]+)$/);
  if (method === "GET" && retrievalRunMatch) {
    requireAdmin(store, req);
    const runId = parseOptionalPositiveInteger(retrievalRunMatch[1], "runId");
    const item = store.knowledgeRetrievalRuns.find((run) => run.id === runId);
    if (!item) return send(res, 404, { message: "检索运行记录不存在" });
    return send(res, 200, { item });
  }

  if (key === "GET /api/admin/knowledge-documents") {
    requireAdmin(store, req);
    const documentType = String(url.searchParams.get("documentType") || "").trim();
    const jobFamily = String(url.searchParams.get("jobFamily") || "").trim();
    const status = String(url.searchParams.get("status") || "").trim();
    if (documentType && !knowledgeDocumentTypes.has(documentType)) throw new HttpError(400, "documentType不合法");
    if (status && !knowledgeStatuses.has(status)) throw new HttpError(400, "status不合法");
    const items = store.knowledgeDocuments
      .filter((document) => (!documentType || document.documentType === documentType)
        && (!jobFamily || document.jobFamily === jobFamily)
        && (!status || document.status === status))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .map(knowledgeDocumentSummary);
    return send(res, 200, { items });
  }

  if (key === "POST /api/admin/knowledge-documents") {
    const user = requireAdmin(store, req);
    const input = validateKnowledgeDocumentInput(await readJson(req), { isCreate: true });
    const timestamp = now();
    const document = {
      id: nextId(store.knowledgeDocuments),
      ...input,
      rawTextHash: contentHash(input.rawText),
      normalizedText: "",
      status: "DRAFT",
      processingVersion: 0,
      chunkCount: 0,
      createdBy: user.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      processedAt: null,
      failureCode: "",
      failureMessage: "",
      vectorStatus: "NOT_INDEXED",
      activeIndexRunId: null,
      indexedProcessingVersion: null,
      indexedChunkCount: 0,
      embeddingProfileId: null,
      vectorCollection: null,
      indexedAt: null,
      indexFailureCode: "",
      indexFailureMessage: "",
    };
    store.knowledgeDocuments.push(document);
    await writeStore(store);
    return send(res, 201, { item: knowledgeDocumentSummary(document) });
  }

  if (key === "GET /api/admin/vector-index/status") {
    requireAdmin(store, req);
    return send(res, 200, await vectorIndexService().status());
  }

  const knowledgeIndexMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/index$/);
  if (knowledgeIndexMatch && ["POST", "DELETE"].includes(method)) {
    const user = requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeIndexMatch[1], "documentId");
    const document = store.knowledgeDocuments.find((item) => item.id === documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    try {
      if (method === "DELETE") {
        const result = await vectorIndexService().deleteDocumentIndex(store, document);
        return send(res, 200, { ok: true, ...result, item: knowledgeDocumentSummary(document) });
      }
      const result = await vectorIndexService().indexDocument(store, document, user.id);
      return send(res, 200, { ...result, item: knowledgeDocumentSummary(document) });
    } catch (error) { const response = vectorIndexErrorResponse(error); return send(res, response.status, { message: response.message, failureCode: response.failureCode }); }
  }

  const knowledgeRebuildMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/index\/rebuild$/);
  if (method === "POST" && knowledgeRebuildMatch) {
    const user = requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeRebuildMatch[1], "documentId");
    const document = store.knowledgeDocuments.find((item) => item.id === documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    try { const result = await vectorIndexService().indexDocument(store, document, user.id, { force: true }); return send(res, 200, { ...result, item: knowledgeDocumentSummary(document) }); }
    catch (error) { const response = vectorIndexErrorResponse(error); return send(res, response.status, { message: response.message, failureCode: response.failureCode }); }
  }

  const knowledgeIndexRunsMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/index-runs$/);
  if (method === "GET" && knowledgeIndexRunsMatch) {
    requireAdmin(store, req); const documentId = parseOptionalPositiveInteger(knowledgeIndexRunsMatch[1], "documentId");
    if (!store.knowledgeDocuments.some((item) => item.id === documentId)) return send(res, 404, { message: "知识资料不存在" });
    return send(res, 200, { items: store.knowledgeIndexRuns.filter((run) => run.documentId === documentId).sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt))) });
  }

  const knowledgeVectorRecordsMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/vector-records$/);
  if (method === "GET" && knowledgeVectorRecordsMatch) {
    requireAdmin(store, req); const documentId = parseOptionalPositiveInteger(knowledgeVectorRecordsMatch[1], "documentId");
    if (!store.knowledgeDocuments.some((item) => item.id === documentId)) return send(res, 404, { message: "知识资料不存在" });
    return send(res, 200, { items: store.knowledgeVectorRecords.filter((record) => record.documentId === documentId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }

  const knowledgeIndexRetryMatch = pathname.match(/^\/api\/admin\/knowledge-index-runs\/([^/]+)\/retry$/);
  if (method === "POST" && knowledgeIndexRetryMatch) {
    const user = requireAdmin(store, req); const runId = parseOptionalPositiveInteger(knowledgeIndexRetryMatch[1], "indexRunId");
    const failedRun = store.knowledgeIndexRuns.find((run) => run.id === runId);
    if (!failedRun) return send(res, 404, { message: "索引运行记录不存在" });
    if (failedRun.status !== "FAILED") return send(res, 409, { message: "只有失败的索引运行可以重试", failureCode: "INDEX_RUN_NOT_FAILED" });
    const document = store.knowledgeDocuments.find((item) => item.id === failedRun.documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    try { const result = await vectorIndexService().indexDocument(store, document, user.id, { force: true }); return send(res, 200, { ...result, item: knowledgeDocumentSummary(document) }); }
    catch (error) { const response = vectorIndexErrorResponse(error); return send(res, response.status, { message: response.message, failureCode: response.failureCode }); }
  }

  const knowledgeDocumentMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)$/);
  if (knowledgeDocumentMatch) {
    requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeDocumentMatch[1], "documentId");
    const document = store.knowledgeDocuments.find((item) => item.id === documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    if (method === "GET") return send(res, 200, { item: document });
    if (method === "PUT") {
      const input = validateKnowledgeDocumentInput(await readJson(req), { current: document });
      const rawTextChanged = input.rawText !== document.rawText;
      Object.assign(document, input, { updatedAt: now() });
      if (rawTextChanged) {
        document.rawTextHash = contentHash(input.rawText);
        document.normalizedText = "";
        document.status = "DRAFT";
        document.failureCode = "";
        document.failureMessage = "原文已修改，等待重新处理";
      }
      await writeStore(store);
      return send(res, 200, { item: knowledgeDocumentSummary(document) });
    }
    if (method === "DELETE") {
      try { await vectorIndexService().deleteDocumentIndex(store, document); }
      catch (error) { const response = vectorIndexErrorResponse(error); return send(res, response.status, { message: response.message, failureCode: response.failureCode }); }
      store.knowledgeDocuments = store.knowledgeDocuments.filter((item) => item.id !== documentId);
      store.knowledgeChunks = store.knowledgeChunks.filter((item) => item.documentId !== documentId);
      store.knowledgeProcessingRecords = store.knowledgeProcessingRecords.filter((item) => item.documentId !== documentId);
      store.knowledgeIndexRuns = store.knowledgeIndexRuns.filter((item) => item.documentId !== documentId);
      store.knowledgeVectorRecords = store.knowledgeVectorRecords.filter((item) => item.documentId !== documentId);
      await writeStore(store);
      return send(res, 200, { ok: true, deletedId: documentId });
    }
  }

  const knowledgeProcessMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/process$/);
  if (method === "POST" && knowledgeProcessMatch) {
    requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeProcessMatch[1], "documentId");
    const document = store.knowledgeDocuments.find((item) => item.id === documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    const inputHash = contentHash(document.rawText);
    const existing = store.knowledgeProcessingRecords.find((record) => record.documentId === documentId
      && record.status === "PROCESSED"
      && record.inputHash === inputHash
      && record.strategy === knowledgeProcessingStrategy
      && record.processingVersion === document.processingVersion);
    if (existing) {
      document.status = "PROCESSED";
      document.normalizedText = normalizeKnowledgeText(document.rawText);
      document.chunkCount = store.knowledgeChunks.filter((chunk) => chunk.documentId === documentId).length;
      document.failureCode = "";
      document.failureMessage = "";
      document.updatedAt = now();
      await writeStore(store);
      return send(res, 200, { item: document, record: existing, idempotent: true });
    }
    const processingVersion = nextKnowledgeProcessingVersion(store, documentId);
    const timestamp = now();
    const record = {
      id: nextId(store.knowledgeProcessingRecords),
      documentId,
      processingVersion,
      status: "PROCESSING",
      inputHash,
      chunkCount: 0,
      strategy: knowledgeProcessingStrategy,
      failureCode: "",
      failureMessage: "",
      createdAt: timestamp,
      completedAt: null,
    };
    document.status = "PROCESSING";
    document.failureCode = "";
    document.failureMessage = "";
    try {
      if (!String(document.rawText || "").trim()) throw new HttpError(400, "原始内容为空，无法处理", "EMPTY_RAW_TEXT");
      const normalizedText = normalizeKnowledgeText(document.rawText);
      if (!normalizedText) throw new HttpError(400, "清洗后内容为空，无法处理", "EMPTY_NORMALIZED_TEXT");
      const generated = createKnowledgeChunks(document, normalizedText, processingVersion);
      if (!generated.length) throw new HttpError(400, "未生成有效切片", "NO_VALID_CHUNKS");
      let nextChunkId = nextId(store.knowledgeChunks);
      const chunks = generated.map((chunk) => ({ ...chunk, id: nextChunkId++ }));
      record.status = "PROCESSED";
      record.chunkCount = chunks.length;
      record.completedAt = now();
      document.normalizedText = normalizedText;
      document.rawTextHash = inputHash;
      document.status = "PROCESSED";
      document.processingVersion = processingVersion;
      document.chunkCount = chunks.length;
      if (document.activeIndexRunId || store.knowledgeVectorRecords.some((item) => item.documentId === documentId)) {
        document.vectorStatus = "STALE";
        document.activeIndexRunId = null;
        document.indexFailureCode = "";
        document.indexFailureMessage = "文档已重新处理，请重新建立向量索引";
        store.knowledgeVectorRecords.filter((item) => item.documentId === documentId && item.status === "ACTIVE").forEach((item) => { item.status = "STALE"; item.updatedAt = record.completedAt; });
      }
      document.processedAt = record.completedAt;
      document.updatedAt = record.completedAt;
      store.knowledgeChunks = [...store.knowledgeChunks.filter((chunk) => chunk.documentId !== documentId), ...chunks];
      store.knowledgeProcessingRecords.push(record);
      await writeStore(store);
      return send(res, 200, { item: knowledgeDocumentSummary(document), record, idempotent: false });
    } catch (error) {
      record.status = "FAILED";
      record.failureCode = error instanceof HttpError && error.detail ? error.detail : "KNOWLEDGE_PROCESSING_FAILED";
      record.failureMessage = error.message || "知识资料处理失败";
      record.completedAt = now();
      document.status = "FAILED";
      document.failureCode = record.failureCode;
      document.failureMessage = record.failureMessage;
      document.updatedAt = record.completedAt;
      store.knowledgeProcessingRecords.push(record);
      await writeStore(store);
      return send(res, 400, { message: record.failureMessage, failureCode: record.failureCode, item: knowledgeDocumentSummary(document), record });
    }
  }

  const knowledgeChunksMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/chunks$/);
  if (method === "GET" && knowledgeChunksMatch) {
    requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeChunksMatch[1], "documentId");
    const document = store.knowledgeDocuments.find((item) => item.id === documentId);
    if (!document) return send(res, 404, { message: "知识资料不存在" });
    const items = store.knowledgeChunks.filter((item) => item.documentId === documentId).sort((a, b) => a.chunkIndex - b.chunkIndex);
    return send(res, 200, { items, document: knowledgeDocumentSummary(document) });
  }

  const knowledgeRecordsMatch = pathname.match(/^\/api\/admin\/knowledge-documents\/([^/]+)\/processing-records$/);
  if (method === "GET" && knowledgeRecordsMatch) {
    requireAdmin(store, req);
    const documentId = parseOptionalPositiveInteger(knowledgeRecordsMatch[1], "documentId");
    if (!store.knowledgeDocuments.some((item) => item.id === documentId)) return send(res, 404, { message: "知识资料不存在" });
    const items = store.knowledgeProcessingRecords.filter((item) => item.documentId === documentId)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return send(res, 200, { items });
  }

  const knowledgeChunkMatch = pathname.match(/^\/api\/admin\/knowledge-chunks\/([^/]+)$/);
  if (method === "GET" && knowledgeChunkMatch) {
    requireAdmin(store, req);
    const chunkId = parseOptionalPositiveInteger(knowledgeChunkMatch[1], "chunkId");
    const item = store.knowledgeChunks.find((chunk) => chunk.id === chunkId);
    if (!item) return send(res, 404, { message: "知识切片不存在" });
    return send(res, 200, { item });
  }

  if (key === "GET /api/admin/overview") {
    const user = requireUser(store, req);
    if (user.role !== "ADMIN") return send(res, 403, { message: "仅管理员可访问后台数据" });
    return send(res, 200, {
      metrics: {
        users: store.users.length,
        resumes: store.resumes.length,
        analysisRecords: store.analysisRecords.length,
        optimizeRecords: store.optimizeRecords.length,
        grammarRecords: store.grammarRecords.length,
        interviews: store.mockInterviews.length,
        positions: store.jobPositions.length,
        knowledgeDocuments: store.knowledgeDocuments.length,
      },
    });
  }

  return send(res, 404, { message: "接口不存在", path: pathname });
}

const server = createServer((req, res) => {
  handleApi(req, res).catch((error) => {
    console.error(error);
    if (error instanceof HttpError) {
      send(res, error.status, { message: error.message, detail: error.detail });
      return;
    }
    send(res, 500, { message: "服务器内部错误", detail: error.message });
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AI Resume Coach API running at http://127.0.0.1:${port}`);
});
