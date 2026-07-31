import { createServer } from "node:http";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ANALYSIS_DIMENSIONS, calculateAnalysisTotalScore, normalizeAnalysisDimensions } from "./analysisDimensions.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dataFile = path.join(dataDir, "store.json");
const port = Number(process.env.API_PORT || 8787);
const maxJsonBodyBytes = 9 * 1024 * 1024;
const sessionCookieName = "lingxi_session";
const sessionLifetimeMs = 1000 * 60 * 60 * 24;
const passwordHashLength = 64;
const scrypt = promisify(scryptCallback);
const authRateLimits = new Map();
const captchaChallenges = new Map();
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
  store.resumeHistories.push({
    id: nextId(store.resumeHistories),
    resumeId: resume.id,
    version: resume.version,
    summary: "创建个人简历",
    createdAt: now(),
  });
  return resume;
}

function getOwnedResume(store, user, requestedId, { createIfMissing = false } = {}) {
  const ownedResumes = store.resumes.filter((item) => item.userId === user.id);
  if (requestedId === "current") {
    if (ownedResumes.length) return ownedResumes.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    return createIfMissing ? createStarterResume(store, user) : null;
  }
  const resumeId = Number(requestedId);
  if (!Number.isInteger(resumeId) || resumeId < 1) return null;
  return ownedResumes.find((item) => item.id === resumeId) || null;
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
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || data.message || `AI 请求失败: ${response.status}`);
  }
  return data;
}

async function runAiJson(store, userId, { system, user, schemaName, schema }) {
  const config = getAiConfig(store, userId);
  if (!config.enabled || !config.apiKey) {
    return { ok: false, status: 400, error: "AI 服务未配置 API Key，请先在 AI 服务商页面保存配置或设置 OPENAI_API_KEY。" };
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
    return {
      ok: true,
      mode: "live",
      data: unwrapAiPayload(parseJsonText(extractResponseText(responsesData)), schemaName),
      modelProvider: config.provider,
      modelId: config.modelId,
    };
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
      return {
        ok: true,
        mode: "live",
        data: unwrapAiPayload(parseJsonText(text), schemaName),
        modelProvider: config.provider,
        modelId: config.modelId,
      };
    } catch (chatError) {
      return { ok: false, status: 502, error: chatError.message || responsesError.message };
    }
  }
}

const analysisDimensionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "label", "score", "weight", "summary", "evidence", "suggestions"],
  properties: {
    key: { type: "string", enum: ANALYSIS_DIMENSIONS.map((item) => item.key) },
    label: { type: "string" },
    score: { type: "integer", minimum: 0, maximum: 100 },
    weight: { type: "integer", minimum: 0, maximum: 100 },
    summary: { type: "string" },
    evidence: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
    suggestions: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 },
  },
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["analysisResult", "dimensions", "keywords", "suggestions"],
  properties: {
    analysisResult: { type: "string" },
    dimensions: { type: "array", minItems: ANALYSIS_DIMENSIONS.length, maxItems: ANALYSIS_DIMENSIONS.length, items: analysisDimensionSchema },
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

function getResumeAnalysisContext(resume = {}) {
  const sectionContent = Object.entries(resume.sectionContent || {})
    .map(([label, lines]) => `${label}: ${Array.isArray(lines) ? lines.join("；") : String(lines || "")}`)
    .filter((item) => !item.endsWith(": "));
  const structuredContent = Object.entries(resume.sectionDetails || {})
    .map(([label, entries]) => `${label}: ${JSON.stringify(entries || [])}`)
    .filter((item) => !item.endsWith("[]"));
  const legacyContent = [
    `专业技能: ${(resume.sections?.skills || []).join("；")}`,
    `项目经历: ${JSON.stringify(resume.sections?.projects || [])}`,
    `工作经历: ${(resume.sections?.work || []).join("；")}`,
  ].filter((item) => !item.endsWith(": ") && !item.endsWith("[]"));
  const profileFields = (resume.profileFields || [])
    .map((item) => `${String(item.label || "").trim()}: ${String(item.value || "").trim()}`)
    .filter((item) => !item.endsWith(": "));

  return [
    `当前职位: ${resume.currentPosition || ""}`,
    `目标岗位: ${resume.targetPosition || ""}`,
    `个人简介: ${resume.selfEvaluation || ""}`,
    ...profileFields,
    ...sectionContent,
    ...structuredContent,
    ...legacyContent,
  ].filter((item) => !item.endsWith(": ")).join("\n");
}

async function generateAiAnalysis(store, userId, resume, position) {
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_analysis",
    schema: analysisSchema,
    system: "You are a senior resume coach for Chinese job seekers. Evaluate only the supplied resume against the target role. Do not invent skills, projects, employers, education, or metrics. When information is absent, lower the relevant score and state the missing information as evidence. Suggestions may ask the user to add verifiable facts, but must never ask them to fabricate experience or numbers. Return JSON only. Keep all strings non-empty and write Chinese.",
    user: [
      `Target role: ${position.positionName}`,
      `Reference keywords for this role, if available: ${(position.keywords || []).join(", ") || "None; infer them from the role."}`,
      "Resume content:",
      getResumeAnalysisContext(resume) || "(resume is blank)",
      `Return exactly six dimensions in this order: ${ANALYSIS_DIMENSIONS.map((item) => `${item.key} (${item.label}, ${item.weight}%)`).join(", ")}.`,
      'Return exactly this JSON shape: {"analysisResult":"非空中文总体评价","dimensions":[{"key":"completeness","label":"内容完整度","score":0,"weight":15,"summary":"非空中文评价","evidence":["基于简历的证据"],"suggestions":["仅补充可核实事实的建议"]}],"keywords":["关键词一","关键词二","关键词三","关键词四","关键词五"],"suggestions":["建议一","建议二","建议三"]}. Do not return totalScore; the server calculates it from the fixed weights. Every dimension must include at least one evidence item and one suggestion.',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 诊断失败", ai.error);
  const dimensions = normalizeAnalysisDimensions(ai.data.dimensions);
  return {
    totalScore: calculateAnalysisTotalScore(dimensions),
    dimensions,
    analysisResult: requireNonEmptyText(ai.data.analysisResult, "analysisResult"),
    keywords: normalizeTextList(ai.data.keywords, "keywords", 5, 10),
    suggestions: normalizeTextList(ai.data.suggestions, "suggestions", 3, 6),
    aiMode: ai.mode,
    modelProvider: ai.modelProvider,
    modelId: ai.modelId,
  };
}

async function generateAiOptimize(store, userId, content, optimizeType = "general") {
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_optimize",
    schema: optimizeSchema,
    system: "You are a professional Chinese resume editor. Rewrite the user input into one concise, professional, result-oriented Chinese resume bullet. Preserve facts. Do not invent company names, numbers, or project details. Return JSON only and keep optimizedContent non-empty.",
    user: [
      `Optimize type: ${optimizeType}`,
      "Original resume text:",
      content || "",
      'Return exactly this JSON shape: {"optimizedContent":"非空中文润色结果"}',
    ].join("\n"),
  });
  if (!ai.ok) throw new HttpError(ai.status || 502, "AI 润色失败", ai.error);
  return { optimizedContent: requireNonEmptyText(ai.data.optimizedContent, "optimizedContent"), aiMode: ai.mode };
}

async function generateAiGrammar(store, userId, content) {
  const ai = await runAiJson(store, userId, {
    schemaName: "resume_grammar_check",
    schema: grammarSchema,
    system: "You are a Chinese resume proofreading expert. Check typos, English spelling, punctuation, grammar, clarity, and resume wording. Return JSON only. Write issue reasons in Chinese.",
    user: [
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
  return [
    `Resume title: ${resume.title || ""}`,
    `Summary: ${resume.selfEvaluation || ""}`,
    `Skills: ${(resume.sections?.skills || []).join("；")}`,
    `Projects: ${JSON.stringify(resume.sections?.projects || [])}`,
    `Work: ${(resume.sections?.work || []).join("；")}`,
  ].join("\n");
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
    return send(res, 200, { item: resume });
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
    store.resumeHistories.push({
      id: nextId(store.resumeHistories),
      resumeId: resume.id,
      version: resume.version,
      summary: "创建新简历",
      createdAt: now(),
    });
    await writeStore(store);
    return send(res, 201, { item: resume });
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
    store.resumeHistories.push({
      id: nextId(store.resumeHistories),
      resumeId: oldResume.id,
      version: nextVersion,
      summary: body.summary || "自动保存简历修改",
      createdAt: now(),
    });
    await writeStore(store);
    return send(res, 200, { item: resume });
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
      resumeVersion: Number(resume.version || 1),
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
    const result = await generateAiOptimize(store, user.id, body.content || "", body.optimizeType || "general");
    const record = {
      id: nextId(store.optimizeRecords),
      userId: user.id,
      resumeId: resume.id,
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
    const result = await generateAiGrammar(store, user.id, body.content || "");
    const record = {
      id: nextId(store.grammarRecords),
      userId: user.id,
      resumeId: resume.id,
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
    return send(res, 200, { items: store.analysisRecords.filter((item) => item.userId === user.id) });
  }

  if (key === "GET /api/records/optimize") {
    const user = requireUser(store, req);
    return send(res, 200, { items: store.optimizeRecords.filter((item) => item.userId === user.id) });
  }

  if (key === "GET /api/records/grammar") {
    const user = requireUser(store, req);
    return send(res, 200, { items: store.grammarRecords.filter((item) => item.userId === user.id) });
  }

  if (key === "GET /api/records/interviews") {
    const user = requireUser(store, req);
    return send(res, 200, {
      items: store.mockInterviews.filter((item) => item.userId === user.id).map((item) => ({
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
    const resume = getOwnedResume(store, user, body.resumeId || 1, { createIfMissing: true });
    if (!resume) return send(res, 404, { message: "简历不存在" });
    const requestedTargetPosition = typeof body.targetPosition === "string" ? body.targetPosition.trim() : "";
    const savedTargetPosition = typeof resume.targetPosition === "string" ? resume.targetPosition.trim() : "";
    const matchingPosition = store.jobPositions.find((item) => item.positionName === requestedTargetPosition || item.positionName === savedTargetPosition);
    const targetPosition = requestedTargetPosition || savedTargetPosition || matchingPosition?.positionName || "目标岗位";
    const questionCount = Math.max(2, Math.min(6, Number(body.questionCount) || 4));
    const opening = await generateAiInterviewOpening(store, user.id, { resume, targetPosition });
    const interview = {
      id: nextId(store.mockInterviews),
      userId: user.id,
      resumeId: resume.id,
      positionId: matchingPosition?.id || body.positionId || resume.targetPositionId || 1,
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
    const resume = getOwnedResume(store, user, interview.resumeId);
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
    const resume = getOwnedResume(store, user, interview.resumeId);
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
