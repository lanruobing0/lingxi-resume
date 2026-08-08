import {
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  FolderOpen,
  Gauge,
  GripVertical,
  Home,
  KeyRound,
  LayoutTemplate,
  LoaderCircle,
  Mail,
  MapPin,
  MessageSquareText,
  Moon,
  PanelLeft,
  Phone,
  Play,
  Plus,
  RefreshCw,
  Search,
  Save,
  Send,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  UserRound,
  X,
  Globe2,
} from "lucide-react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCountUp } from "./hooks/useCountUp";
import { useInViewOnce } from "./hooks/useInViewOnce";
import { selectHistoryMatch, selectLatestFailedMatch } from "./matchState";
import { buildSuggestionDiff, suggestionActions, suggestionDecisionRequest, suggestionFailureMessage, suggestionStatusLabel, versionSourceLabel } from "./suggestionUiState";
import { feedbackTextItems, interviewApiRequest, interviewCategoryLabel, interviewDifficultyLabel, interviewFailureMessage, interviewStatusLabel, nextInterviewQuestionIndex, safeKnowledgeSources } from "./interviewUiState";
import { agentActionLabel, agentApiRequest, agentFailureMessage, agentResultTypes, agentStatusLabel, safeAgentStepSummary, safeRetrievalSources } from "./agentUiState";
import { usePresence } from "./hooks/usePresence";

const appNav = [
  { id: "resume", label: "我的简历", icon: FileText },
  { id: "jobs", label: "岗位 JD", icon: BriefcaseBusiness },
  { id: "templates", label: "简历模板", icon: LayoutTemplate },
  { id: "ai-tools", label: "AI 工具", icon: Sparkles },
  { id: "providers", label: "AI 服务商", icon: Bot },
  { id: "interview", label: "模拟面试", icon: MessageSquareText },
  { id: "history", label: "历史记录", icon: Save },
  { id: "admin", label: "后台管理", icon: Settings },
  { id: "settings", label: "通用设置", icon: Settings },
];

const resume = {
  name: "林澈",
  title: "前端开发工程师",
  email: "linche@example.com",
  phone: "13800138000",
  city: "杭州市西湖区",
  website: "https://linche.dev",
};

const resumeSections = [
  { label: "基本信息", icon: UserRound },
  { label: "专业技能", icon: Code2 },
  { label: "工作经历", icon: BriefcaseBusiness },
  { label: "项目经历", icon: FileText },
];

const templates = [
  { name: "ATS 单栏", desc: "参考 ATS 友好模板：无装饰、强标题、线性阅读，适合网申和大厂投递。", tone: "ats", layout: "左图右文", focus: "机器友好", defaultColor: "#171717" },
  { name: "高管双栏", desc: "参考 executive 两栏模板：左侧身份与技能，右侧承载经历，信息密度更高。", tone: "executive", layout: "左图右文", focus: "资深候选人", defaultColor: "#171717" },
  { name: "技能矩阵", desc: "参考 functional 简历：技能、工具和成果先行，适合转岗或项目型经历。", tone: "functional", layout: "紧凑排列", focus: "能力优先", defaultColor: "#171717" },
  { name: "时间轴经历", desc: "参考 chronological 模板：按阶段组织经历，突出成长路径和项目节奏。", tone: "timeline", layout: "紧凑排列", focus: "经历复盘", defaultColor: "#171717" },
  { name: "极简正式", desc: "参考 minimalist 模板：大留白、居中姓名、细分隔线，适合正式岗位。", tone: "minimal", layout: "居中信息", focus: "克制稳重", defaultColor: "#171717" },
  { name: "作品集卡片", desc: "参考 creative/portfolio 模板：项目卡片和强调区更鲜明，适合设计、运营、内容岗位。", tone: "portfolio", layout: "左图右文", focus: "作品表达", defaultColor: "#171717" },
];

// Template selection always renders this same data through the real resume component.
// It is preview-only and is never written into a visitor's personal resume.
const templatePreviewForm = {
  姓名: "林澈",
  当前职位: "前端开发工程师",
  邮箱: "linche@example.com",
  电话: "13800138000",
  城市: "杭州市西湖区",
  个人主页: "https://linche.dev",
};

const templatePreviewSections = {
  专业技能: ["React / TypeScript / Vite", "组件化设计与性能优化", "可访问性与响应式实现"],
  工作经历: ["负责招聘平台工作台建设，沉淀表单组件、权限配置和数据看板方案。", "与产品、设计协作迭代核心流程，持续改善交付效率与使用体验。"],
  项目经历: ["主导招聘平台核心页面重构，首屏加载效率提升 35%，并建立前端性能监控。", "搭建统一组件规范和发布流程，减少重复开发并提升跨团队协作效率。"],
};

const templatePreviewOrder = ["基本信息", "专业技能", "工作经历", "项目经历"];
const templatePreviewVisibleSections = new Set(templatePreviewOrder);
const templatePreviewSummary = "具备从需求拆解到稳定交付的前端开发经验，关注用户体验、代码质量与可持续维护。";

const structuredSectionConfig = {
  工作经历: { title: "工作经历", nameLabel: "公司名称", namePlaceholder: "例如：字节跳动", roleLabel: "职位", rolePlaceholder: "例如：高级前端工程师", addLabel: "添加工作经历" },
  项目经历: { title: "项目经历", nameLabel: "项目名称", namePlaceholder: "例如：灵犀简历", roleLabel: "项目角色", rolePlaceholder: "例如：前端负责人", addLabel: "添加项目经历" },
};

function getStructuredSectionConfig(section) {
  return structuredSectionConfig[section] || {
    title: section,
    nameLabel: "条目名称",
    namePlaceholder: "例如：资格证书、获奖经历、培训经历",
    roleLabel: "说明",
    rolePlaceholder: "例如：获得时间、组织角色或补充说明",
    addLabel: `添加${section}`,
  };
}

function createStructuredEntry(section, values = {}) {
  return {
    id: values.id || `${section}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: values.name || "",
    role: values.role || "",
    startDate: values.startDate || "",
    endDate: values.endDate || "",
    isCurrent: Boolean(values.isCurrent),
    highlights: Array.isArray(values.highlights) ? values.highlights : [],
  };
}

function legacyLinesToStructuredEntries(section, lines = []) {
  const firstLine = Array.isArray(lines) ? lines.find((line) => String(line).trim()) : "";
  return [createStructuredEntry(section, { highlights: firstLine ? [firstLine] : [] })];
}

function structuredEntriesToLines(entries = []) {
  return entries.flatMap((entry) => {
    const meta = [entry.name, entry.role, entry.startDate && `${entry.startDate} - ${entry.isCurrent ? "至今" : entry.endDate || ""}`].filter(Boolean).join(" · ");
    return [meta, ...(entry.highlights || [])].filter(Boolean);
  });
}

function createTemplateSectionDetails() {
  return {
    工作经历: [createStructuredEntry("工作经历", {
      name: "灵犀招聘科技",
      role: "前端开发工程师",
      startDate: "2022/07",
      isCurrent: true,
      highlights: [...templatePreviewSections.工作经历],
    })],
    项目经历: [createStructuredEntry("项目经历", {
      name: "招聘平台工作台",
      role: "前端负责人",
      startDate: "2023/03",
      endDate: "2024/12",
      highlights: [...templatePreviewSections.项目经历],
    })],
  };
}

function templateResumePayload(template) {
  return {
    realName: templatePreviewForm.姓名,
    title: `${templatePreviewForm.当前职位}简历`,
    currentPosition: templatePreviewForm.当前职位,
    email: templatePreviewForm.邮箱,
    phone: templatePreviewForm.电话,
    city: templatePreviewForm.城市,
    website: templatePreviewForm.个人主页,
    targetPosition: templatePreviewForm.当前职位,
    targetPositionId: jobDirections.find((item) => item.name === templatePreviewForm.当前职位)?.id || 1,
    themeColor: template.color,
    templateName: template.tone,
    templateLayout: template.layout,
    selfEvaluation: templatePreviewSummary,
    sectionContent: Object.fromEntries(Object.entries(templatePreviewSections).map(([label, items]) => [label, [...items]])),
    sectionDetails: createTemplateSectionDetails(),
    visibleSections: [...templatePreviewVisibleSections],
    customSections: [],
    moduleOrder: [...templatePreviewOrder],
    photoDataUrl: "",
    summary: `使用${template.name}初始化简历内容`,
  };
}

const providers = [
  { name: "DeepSeek", desc: "兼容 OpenAI 格式，适合简历诊断和面试反馈。", active: false },
  { name: "豆包", desc: "国内模型服务，可用于简历润色和语法检查。", active: true },
  { name: "OpenAI", desc: "支持通用文本生成和结构化 JSON 输出。", active: false },
  { name: "Gemini", desc: "适合多模态简历导入和文本理解。", active: false },
];

const providerDefaults = {
  DeepSeek: { provider: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-v4-flash", enabled: true, hasApiKey: false, apiKeyPreview: "", source: "local" },
  豆包: { provider: "豆包", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", modelId: "doubao-seed-2-0-lite-260215", enabled: true, hasApiKey: false, apiKeyPreview: "", source: "local" },
  OpenAI: { provider: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4.1-mini", enabled: true, hasApiKey: false, apiKeyPreview: "", source: "local" },
  Gemini: { provider: "Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", modelId: "gemini-3.5-flash", enabled: true, hasApiKey: false, apiKeyPreview: "", source: "local" },
};

const jobDirections = [
  { id: 1, name: "前端开发工程师" },
  { id: 2, name: "Java 后端开发" },
  { id: 3, name: "软件测试工程师" },
];

const questions = [
  "请介绍一个你主导或深度参与的前端项目，并说明你解决的核心问题。",
  "如果一个页面首屏加载很慢，你会从哪些角度定位和优化？",
  "你如何设计一个可复用的表单组件？需要考虑哪些状态？",
  "AI 工具在你的开发流程中能帮助什么？你如何避免直接照搬生成结果？",
];

function App() {
  const [view, setView] = useState(() => initialView());
  const [appearance, setAppearance] = useState(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("lingxi-landing-appearance") === "dark" ? "dark" : "light";
  });
  const [notice, setNotice] = useState("");
  const [loginPromptOpen, setLoginPromptOpen] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState(() => readSavedTemplate());
  const [activeResumeId, setActiveResumeId] = useState(() => readActiveResumeId());
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const isLanding = view === "landing";

  useEffect(() => {
    const onHash = () => setView(initialView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const requestLogin = () => setLoginPromptOpen(true);
    window.addEventListener("lingxi-login-required", requestLogin);
    return () => window.removeEventListener("lingxi-login-required", requestLogin);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("lingxi-landing-appearance", appearance);
  }, [appearance]);

  useEffect(() => {
    let disposed = false;
    apiRequest("/api/users/me", { suppressLoginPrompt: true })
      .then(({ user }) => {
        if (disposed || !user) return;
        setCurrentUser(user);
        window.localStorage.setItem("lingxi-user", JSON.stringify(user));
        window.localStorage.removeItem("lingxi-token");
      })
      .catch(() => {
        if (disposed) return;
        window.localStorage.removeItem("lingxi-user");
        window.localStorage.removeItem("lingxi-token");
      })
      .finally(() => {
        if (!disposed) setAuthChecked(true);
      });
    return () => {
      disposed = true;
    };
  }, []);

  const go = (id) => {
    setView(id);
    window.history.replaceState(null, "", id === "landing" ? "#landing" : `#${id}`);
  };

  useEffect(() => {
    if (!authChecked) return;
    if (view === "resume" && !currentUser) go("templates");
    if (view === "admin" && currentUser?.role !== "ADMIN") go(currentUser ? "resume" : "templates");
    if (currentUser?.passwordUpdateRequired && !["auth", "settings"].includes(view)) go("settings");
  }, [authChecked, currentUser, view]);

  const notify = (message) => {
    setNotice(message);
    window.clearTimeout(window.__resumeToastTimer);
    window.__resumeToastTimer = window.setTimeout(() => setNotice(""), 2200);
  };

  const loginUser = (user) => {
    setCurrentUser(user);
    window.localStorage.setItem("lingxi-user", JSON.stringify(user));
    window.localStorage.removeItem("lingxi-token");
    setAppliedTemplate(readSavedTemplate(user.id));
    setActiveResumeId(readActiveResumeId(user.id));
  };

  const updateCurrentUser = (user) => {
    setCurrentUser(user);
    window.localStorage.setItem("lingxi-user", JSON.stringify(user));
  };

  const applyResumeTemplate = async (template) => {
    if (!currentUser) {
      window.dispatchEvent(new CustomEvent("lingxi-login-required"));
      return false;
    }

    try {
      const { item } = await apiRequest("/api/resumes", {
        method: "POST",
        body: JSON.stringify(templateResumePayload(template)),
      });
      setAppliedTemplate(template);
      window.localStorage.setItem(workspaceStorageKey("lingxi-template"), JSON.stringify(template));
      setActiveResumeId(item.id);
      window.localStorage.setItem(workspaceStorageKey("lingxi-active-resume"), String(item.id));
      return item;
    } catch (error) {
      notify(`应用模板失败: ${error.message}`);
      return false;
    }
  };

  const openResume = (resumeId) => {
    setActiveResumeId(resumeId);
    window.localStorage.setItem(workspaceStorageKey("lingxi-active-resume"), String(resumeId));
    go("resume-edit");
  };

  const logoutUser = () => {
    apiRequest("/api/auth/logout", { method: "POST", suppressLoginPrompt: true }).catch(() => {});
    setCurrentUser(null);
    setActiveResumeId(null);
    window.localStorage.removeItem("lingxi-user");
    window.localStorage.removeItem("lingxi-token");
    notify("已退出登录");
    go("landing");
  };

  if (isLanding) {
    return (
      <>
        <LandingPage
          go={go}
          currentUser={currentUser}
          appearance={appearance}
          onToggleAppearance={() => setAppearance((current) => current === "dark" ? "light" : "dark")}
        />
        <Toast message={notice} />
      </>
    );
  }

  return (
    <>
      <AppStudio
        active={view}
        go={go}
        notify={notify}
        currentUser={currentUser}
        onLogin={loginUser}
        onUserUpdated={updateCurrentUser}
        onLogout={logoutUser}
        appliedTemplate={appliedTemplate}
        onApplyTemplate={applyResumeTemplate}
        activeResumeId={activeResumeId}
        onOpenResume={openResume}
      />
      <Toast message={notice} />
      <LoginRequiredDialog
        open={loginPromptOpen}
        onClose={() => setLoginPromptOpen(false)}
        onLogin={() => {
          setLoginPromptOpen(false);
          go("auth");
        }}
      />
    </>
  );
}

function initialView() {
  if (typeof window === "undefined") return "landing";
  const rawHash = window.location.hash.replace("#", "");
  const hash = rawHash === "grammar" ? "ai-tools" : rawHash === "sample" ? "templates" : rawHash;
  const allowed = ["landing", "auth", "resume-edit", ...appNav.map((item) => item.id), "analysis", "optimize"];
  return allowed.includes(hash) ? hash : "landing";
}

function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <span className="logo-mark">m</span>
      <strong>灵犀简历</strong>
    </div>
  );
}

function Toast({ message }) {
  const { isMounted, isLeaving } = usePresence(Boolean(message));
  const [announcedMessage, setAnnouncedMessage] = useState(message);

  useEffect(() => {
    if (message) setAnnouncedMessage(message);
  }, [message]);

  if (!isMounted) return null;
  return <div className={`app-toast ${isLeaving ? "is-leaving" : ""}`} role="status" aria-live="polite">{announcedMessage}</div>;
}

function LoginRequiredDialog({ open, onClose, onLogin }) {
  const { isMounted, isLeaving } = usePresence(open);
  if (!isMounted) return null;
  return (
    <div className={`login-required-backdrop ${isLeaving ? "is-leaving" : ""}`} role="presentation" onMouseDown={onClose}>
      <section className="login-required-dialog" role="dialog" aria-modal="true" aria-labelledby="login-required-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="section-kicker">需要登录</span>
        <h2 id="login-required-title">登录后即可使用此功能</h2>
        <p>游客可以浏览简历与模板；保存内容、调用 AI 和查看个人记录需要登录后进行。</p>
        <div className="login-required-actions">
          <button className="white-small" onClick={onClose}>暂不登录</button>
          <button className="black-small" onClick={onLogin}>去登录</button>
        </div>
      </section>
    </div>
  );
}

function RevealSection({ as: Tag = "section", className = "", children }) {
  const { ref, isReady, hasEntered } = useInViewOnce();
  return (
    <Tag
      ref={ref}
      className={`${className} reveal-on-scroll ${isReady ? "is-observing" : ""} ${hasEntered ? "is-revealed" : ""}`}
    >
      {children}
    </Tag>
  );
}

function AnimatedScore({ value, shouldAnimate = false, className = "" }) {
  const numericValue = Number(value);
  const displayedValue = useCountUp(Number.isFinite(numericValue) ? numericValue : 0, shouldAnimate);
  return <span className={className}>{Number.isFinite(numericValue) ? displayedValue : "--"}</span>;
}

async function apiRequest(path, options = {}) {
  const { suppressLoginPrompt = false, ...fetchOptions } = options;
  const response = await fetch(path, {
    ...fetchOptions,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(fetchOptions.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && typeof window !== "undefined") {
    window.localStorage.removeItem("lingxi-user");
    window.localStorage.removeItem("lingxi-token");
    if (!suppressLoginPrompt) window.dispatchEvent(new CustomEvent("lingxi-login-required"));
  }
  if (!response.ok) {
    const error = new Error(data.detail ? `${data.message}: ${data.detail}` : data.message || "请求失败");
    error.failureCode = typeof data.failureCode === "string" ? data.failureCode : "";
    error.status = response.status;
    error.answerId = data.answerId || null;
    error.feedbackId = data.feedbackId || null;
    error.agentRunId = data.agentRunId || null;
    throw error;
  }
  return data;
}

function hasActiveSession() {
  return typeof window !== "undefined" && Boolean(window.localStorage.getItem("lingxi-user"));
}

function workspaceStorageKey(key, userId) {
  if (typeof window === "undefined") return key;
  if (userId) return `${key}:${userId}`;
  try {
    const user = JSON.parse(window.localStorage.getItem("lingxi-user") || "null");
    return user?.id ? `${key}:${user.id}` : `${key}:guest`;
  } catch {
    return `${key}:guest`;
  }
}

function readWorkspaceValue(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(workspaceStorageKey(key)) || fallback;
}

function readActiveResumeId(userId) {
  if (typeof window === "undefined") return null;
  const value = Number(window.localStorage.getItem(workspaceStorageKey("lingxi-active-resume", userId)) || "");
  return Number.isInteger(value) && value > 0 ? value : null;
}

function writeWorkspaceValue(key, value) {
  if (typeof window !== "undefined") window.localStorage.setItem(workspaceStorageKey(key), value);
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("图片读取失败，请重新选择。"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function exportResumePdf(previewContainer, fileName, notify) {
  const paper = previewContainer?.querySelector(".resume-paper-modern");
  if (!paper) {
    notify("当前没有可导出的简历内容");
    return;
  }

  const printWindow = window.open("", "_blank", "width=920,height=980");
  if (!printWindow) {
    notify("浏览器拦截了导出窗口，请允许弹出窗口后重试");
    return;
  }

  const styles = [...document.querySelectorAll('style, link[rel="stylesheet"]')].map((node) => node.outerHTML).join("\n");
  const title = String(fileName || "简历").replace(/[\\/:*?"<>|]/g, "_");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="zh-CN"><head><meta charset="utf-8"><title>${title}</title>${styles}
    <style>
      @page { size: A4; margin: 0; }
      html, body { width: 210mm; min-height: 297mm; margin: 0; padding: 0; background: white; }
      .resume-paper-modern { box-sizing: border-box; width: 210mm !important; min-height: 297mm !important; margin: 0 !important; box-shadow: none !important; }
    </style></head><body>${paper.outerHTML}</body></html>`);
  printWindow.document.close();
  printWindow.onload = () => window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 160);
  notify("已打开 A4 简历 PDF 导出窗口");
}

function LandingPage({ go, currentUser, appearance, onToggleAppearance }) {
  const isDarkAppearance = appearance === "dark";

  return (
    <main className={`landing ${isDarkAppearance ? "landing--dark" : ""}`}>
      <header className="landing-nav landing-nav-enter">
        <Brand />
        <div className="landing-actions">
          <button
            className="plain-icon"
            type="button"
            aria-label={isDarkAppearance ? "切换为白色背景" : "切换为黑色背景"}
            aria-pressed={isDarkAppearance}
            title={isDarkAppearance ? "切换为白色背景" : "切换为黑色背景"}
            onClick={onToggleAppearance}
          >
            {isDarkAppearance ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="white-small" onClick={() => go("auth")}>{currentUser ? currentUser.realName || currentUser.username : "登录/注册"}</button>
          <button className="landing-start" onClick={() => go(currentUser ? "resume" : "auth")}>创建我的简历</button>
        </div>
      </header>

      <section className="landing-hero">
        <span className="hero-badge fade-up" style={{ "--enter-delay": "80ms" }}>
          <Sparkles size={16} />
          AI 求职准备工作台
        </span>
        <h1 className="fade-up" style={{ "--enter-delay": "140ms" }}>简历、岗位、面试，在一张工作台准备</h1>
        <p className="fade-up" style={{ "--enter-delay": "210ms" }}>从简历编辑、AI 诊断、岗位匹配到模拟面试，帮你把求职准备变成可保存、可追踪、可优化的完整流程。</p>
        <div className="hero-buttons fade-up" style={{ "--enter-delay": "280ms" }}>
          <button className="black-cta" onClick={() => go("templates")}>
            浏览简历模板
            <span>→</span>
          </button>
          <button className="white-cta" onClick={() => go("templates")}>
            <Play size={15} />
            浏览模板
          </button>
        </div>
        <div className="fade-up hero-workbench-enter" style={{ "--enter-delay": "360ms" }}><FluxHeroWorkbench go={go} currentUser={currentUser} /></div>
      </section>

      <RevealSection className="landing-section">
        <h2>为什么选择灵犀简历?</h2>
        <div className="section-rule" />
        <p className="section-subtitle">一站式求职解决方案，让简历制作、AI 优化和面试训练连成完整闭环。</p>
        <FeatureShowcase />
      </RevealSection>

      <RevealSection className="landing-split">
        <div className="progress-card">
          <div className="report-preview">
            <div className="report-head">
              <div>
                <span>岗位匹配报告</span>
                <strong>前端开发工程师</strong>
              </div>
              <em>86 分</em>
            </div>
            <div className="match-row">
              <span>React / TypeScript</span>
              <i style={{ "--score": "92%" }} />
            </div>
            <div className="match-row">
              <span>项目复杂度</span>
              <i style={{ "--score": "78%" }} />
            </div>
            <div className="match-row">
              <span>性能优化经验</span>
              <i style={{ "--score": "84%" }} />
            </div>
          </div>
          <div className="progress-stack">
            <div>
              <Save size={16} />
              <span>v3 已自动保存</span>
            </div>
            <div>
              <MessageSquareText size={16} />
              <span>5 道面试追问</span>
            </div>
          </div>
        </div>
        <div>
          <span className="green-badge">
            <Sparkles size={15} />
            求职进度
          </span>
          <h2>每一次优化，都能被看见</h2>
          <p>把简历版本、岗位匹配、AI 诊断和模拟面试反馈收在同一个工作台里，下一步该改什么一眼清楚。</p>
          <div className="soft-list active">
            <strong>多版本简历</strong>
            <span>按岗位保存不同版本，随时回到上一次更好的表达</span>
            <ChevronDown size={16} />
          </div>
          <div className="soft-list">
            <strong>优化记录归档</strong>
            <span>诊断评分、匹配结果和面试反馈自动沉淀</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </RevealSection>

      <RevealSection className="final-cta">
        <span className="final-cta-wordmark">MAGIC RESUME</span>
        <h2>开启你的新职业篇章</h2>
        <p>创建一份能展示能力、匹配岗位、支撑面试表达的智能简历。</p>
        <button className="black-cta" onClick={() => go(currentUser ? "resume" : "auth")}>
          创建我的简历
          <span>→</span>
        </button>
      </RevealSection>
    </main>
  );
}

function FluxHeroWorkbench({ go, currentUser }) {
  const openWorkspace = () => go(currentUser ? "resume" : "templates");
  const insights = [
    { title: "AI 诊断完成", value: "ATS 匹配评分 86 分", note: "项目结果还可以继续量化", icon: Gauge },
    { title: "岗位匹配较高", value: "React、TypeScript、性能优化已覆盖", note: "目标岗位: 前端开发工程师", icon: BriefcaseBusiness },
    { title: "已生成面试追问", value: "5 道项目深挖题", note: "围绕难点、协作和复盘提问", icon: MessageSquareText },
  ];

  return (
    <div className="flux-hero-stage" aria-label="灵犀简历 AI 求职准备工作台预览">
      <div className="flux-layer layer-one" />
      <div className="flux-layer layer-two" />
      <div className="flux-layer layer-three" />
      <div className="flux-workbench-card">
        <div className="flux-window-bar">
          <div>
            <span />
            <span />
            <span />
          </div>
          <strong>灵犀实时工作台</strong>
          <em>v3 · 自动保存 · 已保存 3 个版本</em>
        </div>

        <div className="flux-workbench-grid">
          <aside className="flux-sidebar">
            <button className="active" onClick={openWorkspace}><FileText size={15} /> 简历编辑</button>
            <button onClick={() => go("optimize")}><Sparkles size={15} /> AI 润色</button>
            <button onClick={() => go("analysis")}><BriefcaseBusiness size={15} /> 岗位匹配</button>
            <button onClick={() => go("interview")}><MessageSquareText size={15} /> 模拟面试</button>
          </aside>

          <section className="flux-editor">
            <div className="flux-editor-head">
              <div>
                <span>目标岗位</span>
                <strong>前端开发工程师</strong>
              </div>
              <button onClick={openWorkspace}><Download size={14} /> 导出 PDF</button>
            </div>
            <div className="flux-field">
              <span>项目经历</span>
              <p>负责招聘平台候选人看板、筛选流程和面试排期模块开发。</p>
            </div>
            <div className="flux-suggestion">
              <Sparkles size={17} />
              <div>
                <strong>发现 1 个可优化问题</strong>
                <p>项目经历缺少量化结果，建议补充效率提升、用户量或性能指标。</p>
              </div>
            </div>
            <div className="flux-keywords">
              <span>React</span>
              <span>TypeScript</span>
              <span>性能优化</span>
            </div>
          </section>

          <aside className="flux-insights">
            {insights.map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} style={{ "--stagger-index": index }}>
                  <Icon size={16} />
                  <span>{item.title}</span>
                  <strong>{item.value}</strong>
                  <p>{item.note}</p>
                </article>
              );
            })}
          </aside>
        </div>
      </div>
    </div>
  );
}

function FeatureShowcase() {
  const features = [
    { title: "智能识别，专业建议", text: "AI 自动识别不恰当表达，给出可直接应用的修改建议。", badge: "AI 驱动" },
    { title: "语法检查", text: "自动检测错别字、标点和语义不清的简历表述。" },
    { title: "岗位匹配", text: "根据目标岗位分析关键词覆盖和项目亮点。" },
  ];

  return (
    <div className="feature-showcase">
      <div className="feature-copy">
        <span className="hero-badge">
          <Sparkles size={15} />
          {features[0].badge}
        </span>
        <h3>{features[0].title}</h3>
        <p>{features[0].text}</p>
        {features.slice(1).map((item, index) => (
          <div className={`soft-list ${index === 0 ? "active" : ""}`} key={item.title}>
            <strong>{item.title}</strong>
            <span>{item.text}</span>
            <ChevronDown size={16} />
          </div>
        ))}
      </div>
      <div className="grammar-card">
        <div className="rewrite-preview">
          <div className="rewrite-head">
            <div>
              <span>AI 表达优化</span>
              <strong>项目经历已改写</strong>
            </div>
            <em>已优化</em>
          </div>
          <div className="rewrite-block muted">
            <span>原文</span>
            <p>负责招聘平台页面开发，完成筛选和面试排期功能。</p>
          </div>
          <div className="rewrite-block active">
            <span>优化后</span>
            <p>主导筛选与面试排期模块，减少 35% 操作步骤，页面响应提升 28%。</p>
          </div>
        </div>
        <div className="rewrite-stack">
          <div>
            <Check size={16} />
            <span>结果量化</span>
          </div>
          <div>
            <Check size={16} />
            <span>动词更有力</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppStudio({ active, go, notify, currentUser, onLogin, onLogout, onUserUpdated, appliedTemplate, onApplyTemplate, activeResumeId, onOpenResume }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigationItems = appNav.filter((item) => item.id !== "admin" || currentUser?.role === "ADMIN");
  const activeMeta = appNav.find((item) => item.id === active) || {
    analysis: { label: "AI 简历诊断" },
    optimize: { label: "AI 简历润色" },
    auth: { label: "用户登录注册" },
    "resume-edit": { label: "编辑简历" },
  }[active] || { label: "我的简历" };

  const openNavigationItem = (id) => {
    if (id === "admin" && currentUser?.role !== "ADMIN") {
      go(currentUser ? "resume" : "templates");
      return;
    }
    if (id === "resume" && !currentUser) {
      notify("登录后即可创建并保存自己的简历");
      go("auth");
      return;
    }
    go(id);
  };

  const requestGuestLogin = (event) => {
    if (currentUser || active === "auth") return;
    const control = event.target.closest("button, input, textarea, select");
    if (!control) return;
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new CustomEvent("lingxi-login-required"));
  };

  return (
    <div className={`studio ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="studio-sidebar">
        <button className="sidebar-logo" onClick={() => go("landing")}>
          <Brand compact />
        </button>
        <nav className="studio-nav">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id || (item.id === "resume" && active === "resume-edit") ? "active" : ""}
                aria-current={active === item.id || (item.id === "resume" && active === "resume-edit") ? "page" : undefined}
                aria-label={item.label}
                title={sidebarCollapsed ? item.label : undefined}
                onClick={() => openNavigationItem(item.id)}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="studio-main">
        <header className="studio-topbar">
          <button
            className="plain-icon"
            aria-label={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            title={sidebarCollapsed ? "展开菜单" : "折叠菜单"}
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            <PanelLeft size={18} />
          </button>
          <h1>{activeMeta.label}</h1>
          <div className="topbar-actions">
            {currentUser ? (
              <>
                <span>{currentUser.realName || currentUser.username}</span>
                <button className="white-small" onClick={onLogout}>退出</button>
              </>
            ) : (
              <button className="black-small" onClick={() => go("auth")}>登录/注册</button>
            )}
          </div>
        </header>

        <section key={active} className="workspace-content page-enter" onPointerDownCapture={requestGuestLogin} onClickCapture={requestGuestLogin} onKeyDownCapture={requestGuestLogin}>
          {active === "auth" && <AuthPage go={go} notify={notify} onLogin={onLogin} />}
          {active === "resume" && currentUser && <ResumeLibrary go={go} notify={notify} onOpenResume={onOpenResume} onApplyTemplate={onApplyTemplate} />}
          {active === "jobs" && currentUser && <JobDescriptionWorkspace notify={notify} activeResumeId={activeResumeId} onOpenResume={onOpenResume} go={go} />}
          {active === "resume-edit" && activeResumeId && <ResumeEditor key={`${currentUser?.id || "guest"}-${activeResumeId}`} resumeId={activeResumeId} go={go} notify={notify} appliedTemplate={appliedTemplate} />}
          {active === "templates" && <TemplateGallery go={go} notify={notify} appliedTemplate={appliedTemplate} onApplyTemplate={onApplyTemplate} />}
          {active === "ai-tools" && <AiToolsPanel notify={notify} go={go} resumeId={activeResumeId} />}
          {active === "providers" && <ProviderSettings notify={notify} />}
          {active === "interview" && <InterviewStageEntry go={go} />}
          {active === "history" && <HistoryPage notify={notify} resumeId={activeResumeId} />}
          {active === "admin" && currentUser?.role === "ADMIN" && <AdminPanel notify={notify} />}
          {active === "settings" && <GeneralSettings notify={notify} currentUser={currentUser} onUserUpdated={onUserUpdated} />}
          {active === "analysis" && <AnalysisPanel notify={notify} go={go} resumeId={activeResumeId} />}
          {active === "optimize" && <OptimizePanel notify={notify} resumeId={activeResumeId} />}
        </section>
      </main>
    </div>
  );
}

function AuthPage({ go, notify, onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username: "", password: "", email: "" });
  const [captcha, setCaptcha] = useState({ id: "", imageUrl: "", code: "" });
  const [captchaLoading, setCaptchaLoading] = useState(false);

  const refreshCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const data = await apiRequest("/api/auth/captcha", { suppressLoginPrompt: true });
      setCaptcha({ id: data.id || "", imageUrl: data.imageUrl || "", code: "" });
    } catch (error) {
      notify(`验证码加载失败: ${error.message}`);
    } finally {
      setCaptchaLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const submit = async () => {
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/register";
      const data = await apiRequest(path, {
        method: "POST",
        body: JSON.stringify({ ...form, captchaId: captcha.id, captchaCode: captcha.code }),
      });
      onLogin(data.user);
      if (data.user.passwordUpdateRequired) {
        notify("为保护账号安全，请先更新密码");
        go("settings");
        return;
      }
      notify(mode === "login" ? "登录成功" : "注册成功，已自动登录");
      go("resume");
    } catch (error) {
      notify(`${mode === "login" ? "登录" : "注册"}失败: ${error.message}`);
      refreshCaptcha();
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="segmented">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>登录</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>注册</button>
        </div>
        <h2>{mode === "login" ? "欢迎回到灵犀简历" : "创建灵犀简历账号"}</h2>
        <label>
          用户名
          <input autoComplete="username" maxLength={32} value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
        </label>
        <label>
          密码
          <input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 10 : undefined} maxLength={128} value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} />
        </label>
        <label>
          验证码
          <div className="captcha-field">
            <input autoComplete="off" inputMode="text" maxLength={5} placeholder="输入图中字符" value={captcha.code} onChange={(event) => setCaptcha((current) => ({ ...current, code: event.target.value.toUpperCase() }))} />
            <button className="captcha-image" type="button" aria-label="刷新验证码" title="刷新验证码" disabled={captchaLoading} onClick={refreshCaptcha}>
              {captcha.imageUrl ? <img src={captcha.imageUrl} alt="验证码，点击刷新" /> : <RefreshCw className={captchaLoading ? "spin" : ""} size={18} />}
            </button>
            <button className="plain-icon captcha-refresh" type="button" aria-label="刷新验证码" title="刷新验证码" disabled={captchaLoading} onClick={refreshCaptcha}><RefreshCw className={captchaLoading ? "spin" : ""} size={16} /></button>
          </div>
        </label>
        {mode === "register" && <p className="auth-security-note">密码需至少 10 位，并同时包含字母和数字。</p>}
        {mode === "register" && (
          <>
            <label>
              邮箱
              <input type="email" autoComplete="email" maxLength={100} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            </label>
          </>
        )}
        <button className="black-small" onClick={submit}>{mode === "login" ? "登录并进入工作台" : "注册并进入工作台"}</button>
      </div>
    </section>
  );
}

function ResumeLibrary({ go, notify, onOpenResume, onApplyTemplate }) {
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadResumes = useCallback(async () => {
    try {
      setLoading(true);
      const { items } = await apiRequest("/api/resumes");
      setResumes([...items].sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))));
    } catch (error) {
      notify(`读取简历列表失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadResumes();
  }, [loadResumes]);

  const createBlankResume = async () => {
    try {
      setWorkingId("new");
      const { item } = await apiRequest("/api/resumes", {
        method: "POST",
        body: JSON.stringify({
          title: "未命名简历",
          currentPosition: "",
          targetPosition: "",
          themeColor: "#171717",
          templateName: "classic",
          templateLayout: "左图右文",
          selfEvaluation: "",
          sectionContent: { 专业技能: [], 工作经历: [], 项目经历: [] },
          visibleSections: ["基本信息", "专业技能", "工作经历", "项目经历"],
          moduleOrder: ["基本信息", "专业技能", "工作经历", "项目经历"],
          summary: "新建空白简历",
        }),
      });
      notify("已创建空白简历");
      setCreateOpen(false);
      onOpenResume(item.id);
    } catch (error) {
      notify(`创建简历失败: ${error.message}`);
    } finally {
      setWorkingId(null);
    }
  };

  const createFromTemplate = async (template) => {
    try {
      setWorkingId(template.name);
      const item = await onApplyTemplate({
        name: template.name,
        tone: template.tone,
        layout: template.layout,
        color: template.defaultColor,
      });
      if (!item) return;
      setCreateOpen(false);
      notify(`已使用${template.name}创建简历`);
      onOpenResume(item.id);
    } finally {
      setWorkingId(null);
    }
  };

  const duplicateResume = async (resumeItem) => {
    try {
      setWorkingId(resumeItem.id);
      const { id, userId, version, updatedAt, createdAt, ...copy } = resumeItem;
      const { item } = await apiRequest("/api/resumes", {
        method: "POST",
        body: JSON.stringify({
          ...copy,
          title: `${resumeItem.title || "未命名简历"} 副本`,
          sectionContent: Object.fromEntries(Object.entries(resumeItem.sectionContent || {}).map(([label, entries]) => [label, [...entries]])),
          visibleSections: [...(resumeItem.visibleSections || [])],
          moduleOrder: [...(resumeItem.moduleOrder || [])],
          summary: `复制自${resumeItem.title || "未命名简历"}`,
        }),
      });
      notify("已创建简历副本");
      onOpenResume(item.id);
    } catch (error) {
      notify(`复制简历失败: ${error.message}`);
    } finally {
      setWorkingId(null);
    }
  };

  const deleteResume = async (resumeItem) => {
    try {
      setWorkingId(resumeItem.id);
      await apiRequest(`/api/resumes/${resumeItem.id}`, { method: "DELETE" });
      setResumes((current) => current.filter((item) => item.id !== resumeItem.id));
      notify("简历已删除");
    } catch (error) {
      notify(`删除简历失败: ${error.message}`);
    } finally {
      setWorkingId(null);
    }
  };

  return (
    <section className="resume-library-page">
      <div className="resume-library-head">
        <div>
          <span className="section-kicker">简历库</span>
          <p>按岗位保存不同版本；每张卡片都是实际可编辑、可导出的简历。</p>
        </div>
        <div className="resume-library-actions">
          <button type="button" className="white-small" onClick={() => setCreateOpen(true)}>从模板新建</button>
          <button type="button" className="black-small" onClick={() => setCreateOpen(true)} disabled={workingId === "new"}>
            {workingId === "new" ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}
            新建简历
          </button>
        </div>
      </div>
      <div className="resume-library-grid">
        <button type="button" className="resume-create-card" onClick={() => setCreateOpen(true)} disabled={workingId === "new"}>
          <span><Plus size={30} /></span>
          <strong>新建简历</strong>
          <small>从空白内容开始</small>
        </button>
        {loading ? (
          <div className="resume-library-loading"><LoaderCircle className="spin" size={20} /> 正在读取你的简历</div>
        ) : resumes.map((resumeItem) => (
          <article className="resume-library-card" key={resumeItem.id}>
            <button type="button" className="resume-library-preview" onClick={() => onOpenResume(resumeItem.id)} aria-label={`编辑${resumeItem.title || "未命名简历"}`}>
              <StoredResumePreview resumeItem={resumeItem} />
            </button>
            <div className="resume-library-card-meta">
              <strong>{resumeItem.title || "未命名简历"}</strong>
              <span>{resumeItem.currentPosition || "尚未填写岗位"} · 更新于 {formatResumeDate(resumeItem.updatedAt)}</span>
            </div>
            <div className="resume-library-card-actions">
              <button type="button" onClick={() => onOpenResume(resumeItem.id)}><FileText size={15} />编辑</button>
              <button type="button" disabled={workingId === resumeItem.id} onClick={() => duplicateResume(resumeItem)}><Copy size={15} />复制</button>
              <button type="button" className="danger" disabled={workingId === resumeItem.id} onClick={() => setDeleteCandidate(resumeItem)}><Trash2 size={15} />删除</button>
            </div>
          </article>
        ))}
      </div>
      <CreateResumeDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreateBlank={createBlankResume}
        onCreateFromTemplate={createFromTemplate}
        creating={workingId}
      />
      <ConfirmDialog
        open={Boolean(deleteCandidate)}
        title="删除这份简历？"
        description={`“${deleteCandidate?.title || "未命名简历"}”将被永久删除，无法撤销。`}
        confirmLabel="删除简历"
        isWorking={Boolean(deleteCandidate && workingId === deleteCandidate.id)}
        onClose={() => setDeleteCandidate(null)}
        onConfirm={async () => {
          if (!deleteCandidate) return;
          await deleteResume(deleteCandidate);
          setDeleteCandidate(null);
        }}
      />
    </section>
  );
}

function formatResumeDate(value) {
  if (!value) return "刚刚";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "刚刚";
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(parsed);
}

function CreateResumeDialog({ open, onClose, onCreateBlank, onCreateFromTemplate, creating }) {
  const { isMounted, isLeaving } = usePresence(open);
  if (!isMounted) return null;
  const isCreating = Boolean(creating);
  return (
    <div className={`create-resume-backdrop ${isLeaving ? "is-leaving" : ""}`} role="presentation" onMouseDown={() => !isCreating && onClose()}>
      <section className="create-resume-dialog" role="dialog" aria-modal="true" aria-labelledby="create-resume-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <span className="section-kicker">简历库</span>
            <h2 id="create-resume-title">新建简历</h2>
          </div>
          <button type="button" className="plain-icon" aria-label="关闭新建简历" title="关闭" disabled={isCreating} onClick={onClose}><X size={20} /></button>
        </header>
        <section className="create-resume-blank">
          <div className="create-resume-section-head"><h3>从空白开始</h3></div>
          <button type="button" className="create-resume-blank-option" disabled={isCreating} onClick={onCreateBlank}>
            <span><FileText size={30} /></span>
            <div><strong>空白简历</strong><small>从基础信息开始，按你的经历自由填写。</small></div>
            {creating === "new" ? <LoaderCircle className="spin" size={20} /> : <ChevronDown className="create-resume-arrow" size={20} />}
          </button>
        </section>
        <section className="create-resume-templates">
          <div className="create-resume-section-head"><h3>从模板开始</h3><span>选择后会创建一份可编辑的完整简历</span></div>
          <div className="create-resume-template-grid">
            {templates.map((template) => (
              <button type="button" className="create-resume-template-option" key={template.name} disabled={isCreating} onClick={() => onCreateFromTemplate(template)}>
                <ResumeTemplatePreview template={template} color="#1f2937" compact />
                <strong>{template.name}</strong>
                {creating === template.name && <span className="create-resume-template-loading"><LoaderCircle className="spin" size={15} />正在创建</span>}
              </button>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}

function ConfirmDialog({ open, title, description, confirmLabel, isWorking, onClose, onConfirm }) {
  const { isMounted, isLeaving } = usePresence(open);
  if (!isMounted) return null;
  return (
    <div className={`confirm-dialog-backdrop ${isLeaving ? "is-leaving" : ""}`} role="presentation" onMouseDown={() => !isWorking && onClose()}>
      <section className="confirm-dialog modal-enter" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <span className="section-kicker">确认操作</span>
        <h2 id="confirm-dialog-title">{title}</h2>
        <p>{description}</p>
        <div className="confirm-dialog-actions">
          <button type="button" className="white-small" disabled={isWorking} onClick={onClose}>取消</button>
          <button type="button" className="danger-action" disabled={isWorking} onClick={onConfirm}>{isWorking ? <LoaderCircle className="spin" size={16} /> : <Trash2 size={16} />}{isWorking ? "正在删除" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

function StoredResumePreview({ resumeItem }) {
  const paperScaleRef = useRef(null);
  const [paperHeight, setPaperHeight] = useState(760);
  const form = {
    姓名: resumeItem.realName || "未命名",
    当前职位: resumeItem.currentPosition || "",
    邮箱: resumeItem.email || "",
    电话: resumeItem.phone || "",
    城市: resumeItem.city || "",
    个人主页: resumeItem.website || "",
  };
  const order = Array.isArray(resumeItem.moduleOrder) && resumeItem.moduleOrder.length ? resumeItem.moduleOrder : templatePreviewOrder;
  const visible = new Set(Array.isArray(resumeItem.visibleSections) && resumeItem.visibleSections.length ? resumeItem.visibleSections : order);
  const scale = Math.min(230 / 760, 310 / paperHeight);

  useEffect(() => {
    const paper = paperScaleRef.current?.querySelector(".resume-paper-modern");
    if (!paper) return undefined;

    // The card preview must fit the complete rendered paper, not a fixed crop.
    const measurePaper = () => {
      const nextHeight = Math.max(760, Math.ceil(paper.scrollHeight));
      setPaperHeight((current) => current === nextHeight ? current : nextHeight);
    };

    measurePaper();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measurePaper);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [resumeItem.id, resumeItem.updatedAt]);

  return (
    <div className="resume-library-paper-stage" style={{ width: `${760 * scale}px`, height: `${paperHeight * scale}px` }}>
      <div className="resume-library-paper-scale" ref={paperScaleRef} style={{ transform: `scale(${scale})` }}>
        <ResumePaper
          form={form}
          selfEvaluation={resumeItem.selfEvaluation || ""}
          photoDataUrl={resumeItem.photoDataUrl || ""}
          layout={resumeItem.templateLayout || "左图右文"}
          themeColor={resumeItem.themeColor || "#171717"}
          templateTone={resumeItem.templateName || "classic"}
          visibleSections={visible}
          sectionOrder={order}
          sectionContent={resumeItem.sectionContent || {}}
          sectionDetails={resumeItem.sectionDetails || {}}
          profileFields={resumeItem.profileFields || []}
        />
      </div>
    </div>
  );
}

function ResumeEditor({ go, notify, appliedTemplate, resumeId }) {
  const savedTemplate = appliedTemplate || readSavedTemplate();
  const [activeSection, setActiveSection] = useState("基本信息");
  const [layout, setLayout] = useState(savedTemplate?.layout || "左图右文");
  const [themeColor, setThemeColor] = useState(savedTemplate?.color || "#171717");
  const [templateTone, setTemplateTone] = useState(savedTemplate?.tone || "classic");
  const layoutTouchedRef = useRef(false);
  const themeColorTouchedRef = useRef(false);
  const moduleStateTouchedRef = useRef(false);
  const profileFieldsTouchedRef = useRef(false);
  const [targetPosition, setTargetPosition] = useState(() => {
    if (typeof window === "undefined") return resume.title;
    return readWorkspaceValue("lingxi-target-position", resume.title);
  });
  const [selfEvaluation, setSelfEvaluation] = useState(() => {
    if (typeof window === "undefined") return "";
    return readWorkspaceValue("lingxi-resume-summary", "具备前端工程化和组件化开发经验，关注性能优化与用户体验。");
  });
  const photoInputRef = useRef(null);
  const resumePreviewRef = useRef(null);
  const [photoDataUrl, setPhotoDataUrl] = useState(() => {
    if (typeof window === "undefined") return "";
    return readWorkspaceValue("lingxi-resume-photo");
  });
  const [visibleSections, setVisibleSections] = useState(() => new Set(resumeSections.map((item) => item.label)));
  const [customSections, setCustomSections] = useState([]);
  const [moduleOrder, setModuleOrder] = useState(() => resumeSections.map((item) => item.label));
  const moduleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [sectionContent, setSectionContent] = useState({
    专业技能: [
      "熟悉 React、Vue、TypeScript、Vite、Pinia、Zustand 等前端技术栈。",
      "掌握组件化开发、权限控制、性能优化和可视化看板开发。",
      "了解 Spring Boot 接口联调、MySQL 数据建模和 RESTful API 设计。",
    ],
    工作经历: [
      "负责招聘平台候选人看板、筛选流程和面试排期模块开发。",
      "沉淀表单组件和权限配置方案，减少重复开发成本。",
      "优化列表渲染与接口缓存策略，核心页面加载效率提升 35%。",
    ],
    项目经历: [
      "实现简历编辑、AI 诊断、内容优化和模拟面试核心流程。",
      "设计三栏工作台，支持编辑信息与 A4 简历实时预览。",
    ],
  });
  const [sectionDetails, setSectionDetails] = useState(() => ({
    工作经历: [createStructuredEntry("工作经历", {
      name: "灵犀招聘科技",
      role: "前端开发工程师",
      startDate: "2023/06",
      isCurrent: true,
      highlights: ["负责招聘平台候选人看板、筛选流程和面试排期模块开发。", "沉淀表单组件和权限配置方案，减少重复开发成本。"],
    })],
    项目经历: [createStructuredEntry("项目经历", {
      name: "灵犀简历",
      role: "前端负责人",
      startDate: "2024/03",
      endDate: "2025/01",
      highlights: ["实现简历编辑、AI 诊断、内容优化和模拟面试核心流程。", "设计三栏工作台，支持编辑信息与 A4 简历实时预览。"],
    })],
  }));
  const [form, setForm] = useState({
    姓名: resume.name,
    当前职位: resume.title,
    邮箱: resume.email,
    电话: resume.phone,
    城市: resume.city,
    个人主页: resume.website,
  });
  const [profileFields, setProfileFields] = useState([]);
  const [saveState, setSaveState] = useState("idle");
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  const saveFeedbackTimerRef = useRef(null);
  const previewFeedbackTimerRef = useRef(null);

  useEffect(() => () => {
    window.clearTimeout(saveFeedbackTimerRef.current);
    window.clearTimeout(previewFeedbackTimerRef.current);
  }, []);

  useEffect(() => {
    if (!appliedTemplate) return;
    setLayout(appliedTemplate.layout || "左图右文");
    setThemeColor(appliedTemplate.color || "#171717");
    setTemplateTone(appliedTemplate.tone || "classic");
  }, [appliedTemplate]);

  useEffect(() => {
    if (!hasActiveSession()) return undefined;
    let disposed = false;
    apiRequest(`/api/resumes/${resumeId}`)
      .then(({ item }) => {
        if (disposed || !item) return;
        setForm({
          姓名: item.realName || resume.name,
          当前职位: item.currentPosition || item.title?.replace(/简历$/, "") || resume.title,
          邮箱: item.email || "",
          电话: item.phone || "",
          城市: item.city || "",
          个人主页: item.website || "",
        });
        setTargetPosition(item.targetPosition || resume.title);
        setSelfEvaluation(item.selfEvaluation || "");
        setPhotoDataUrl(item.photoDataUrl || "");
        if (!themeColorTouchedRef.current) setThemeColor(item.themeColor || "#171717");
        setTemplateTone(item.templateName || "classic");
        if (!layoutTouchedRef.current) setLayout(item.templateLayout || "左图右文");
        if (!profileFieldsTouchedRef.current && Array.isArray(item.profileFields)) setProfileFields(item.profileFields);
        if (!moduleStateTouchedRef.current) {
          if (item.sectionContent) setSectionContent(item.sectionContent);
          if (item.sectionDetails) {
            setSectionDetails(item.sectionDetails);
          } else if (item.sectionContent) {
            setSectionDetails({
              工作经历: legacyLinesToStructuredEntries("工作经历", item.sectionContent.工作经历),
              项目经历: legacyLinesToStructuredEntries("项目经历", item.sectionContent.项目经历),
            });
          }
          if (Array.isArray(item.visibleSections)) setVisibleSections(new Set(item.visibleSections));
          if (Array.isArray(item.customSections)) {
            setCustomSections(item.customSections.map((section) => ({ ...section, icon: FileText })));
          }
          if (Array.isArray(item.moduleOrder)) setModuleOrder(item.moduleOrder);
        }
      })
      .catch((error) => notify(`读取个人简历失败: ${error.message}`));
    return () => { disposed = true; };
  }, [notify, resumeId]);

  const saveResume = async (historySummary = "自动保存简历修改", changes = {}) => {
    setSaveState("saving");
    try {
      const nextPhotoDataUrl = Object.hasOwn(changes, "photoDataUrl") ? changes.photoDataUrl : photoDataUrl;
      const nextSelfEvaluation = Object.hasOwn(changes, "selfEvaluation") ? changes.selfEvaluation : selfEvaluation;
      await apiRequest(`/api/resumes/${resumeId}`, {
        method: "PUT",
        body: JSON.stringify({
          realName: form.姓名,
          title: `${form.当前职位}简历`,
          email: form.邮箱,
          phone: form.电话,
          city: form.城市,
          website: form.个人主页,
          currentPosition: form.当前职位,
          themeColor,
          templateName: templateTone,
          templateLayout: layout,
          targetPosition,
          targetPositionId: jobDirections.find((item) => item.name === targetPosition)?.id || 1,
          photoDataUrl: nextPhotoDataUrl,
          selfEvaluation: nextSelfEvaluation,
          sectionContent,
          sectionDetails,
          profileFields,
          visibleSections: [...visibleSections],
          customSections: customSections.map(({ label }) => ({ label })),
          moduleOrder,
          summary: historySummary,
        }),
      });
      setSaveState("saved");
      window.clearTimeout(saveFeedbackTimerRef.current);
      saveFeedbackTimerRef.current = window.setTimeout(() => setSaveState("idle"), 1600);
      notify("简历已保存到历史版本");
      return true;
    } catch (error) {
      setSaveState("idle");
      notify(`保存失败: ${error.message}`);
      return false;
    }
  };

  const triggerPreviewRefresh = () => {
    setPreviewRefreshing(true);
    window.clearTimeout(previewFeedbackTimerRef.current);
    previewFeedbackTimerRef.current = window.setTimeout(() => setPreviewRefreshing(false), 240);
  };

  const changeLayout = async (nextLayout) => {
    if (nextLayout === layout) return;
    layoutTouchedRef.current = true;
    setLayout(nextLayout);
    triggerPreviewRefresh();
    notify(`预览布局已切换为 ${nextLayout}`);
    try {
      await apiRequest(`/api/resumes/${resumeId}`, {
        method: "PUT",
        body: JSON.stringify({
          templateLayout: nextLayout,
          summary: `切换简历布局为${nextLayout}`,
        }),
      });
    } catch (error) {
      notify(`布局保存失败: ${error.message}`);
    }
  };

  const changeThemeColor = async (nextColor) => {
    if (nextColor === themeColor) return;
    themeColorTouchedRef.current = true;
    setThemeColor(nextColor);
    triggerPreviewRefresh();
    notify("主题色已应用到简历预览");
    try {
      await apiRequest(`/api/resumes/${resumeId}`, {
        method: "PUT",
        body: JSON.stringify({
          themeColor: nextColor,
          summary: "切换简历主题色",
        }),
      });
    } catch (error) {
      notify(`主题色保存失败: ${error.message}`);
    }
  };

  const allSections = moduleOrder
    .map((label) => [...resumeSections, ...customSections].find((item) => item.label === label))
    .filter(Boolean);

  const addCustomSection = () => {
    moduleStateTouchedRef.current = true;
    const nextLabel = `自定义模块 ${customSections.length + 1}`;
    setCustomSections((current) => [...current, { label: nextLabel, icon: FileText }]);
    setModuleOrder((current) => [...current, nextLabel]);
    setSectionContent((current) => ({ ...current, [nextLabel]: [] }));
    setSectionDetails((current) => ({ ...current, [nextLabel]: [createStructuredEntry(nextLabel)] }));
    setVisibleSections((current) => new Set([...current, nextLabel]));
    setActiveSection(nextLabel);
    notify(`已添加 ${nextLabel}`);
  };

  const restoreDefaultSection = (label) => {
    moduleStateTouchedRef.current = true;
    setModuleOrder((current) => [...current, label]);
    setVisibleSections((current) => new Set([...current, label]));
    setActiveSection(label);
    notify(`已恢复${label}`);
  };

  const removeSection = (label) => {
    moduleStateTouchedRef.current = true;
    const nextOrder = moduleOrder.filter((item) => item !== label);
    if (!nextOrder.length) {
      notify("请至少保留一个简历模块");
      return;
    }
    const isDefaultSection = resumeSections.some((item) => item.label === label);
    setModuleOrder(nextOrder);
    setVisibleSections((current) => {
      const next = new Set(current);
      next.delete(label);
      return next;
    });
    if (!isDefaultSection) {
      setCustomSections((current) => current.filter((item) => item.label !== label));
      setSectionContent((current) => {
        const next = { ...current };
        delete next[label];
        return next;
      });
      setSectionDetails((current) => {
        const next = { ...current };
        delete next[label];
        return next;
      });
    }
    if (activeSection === label) setActiveSection(nextOrder[0]);
    notify(`已移除${label}`);
  };

  const removedDefaultSections = resumeSections.filter((item) => !moduleOrder.includes(item.label));

  const reorderModules = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    moduleStateTouchedRef.current = true;
    setModuleOrder((current) => {
      const oldIndex = current.indexOf(active.id);
      const newIndex = current.indexOf(over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    notify(`${active.id}已移动到${over.id}的位置`);
  };

  const toggleSection = (label) => {
    moduleStateTouchedRef.current = true;
    setVisibleSections((current) => {
      const next = new Set(current);
      if (next.has(label)) {
        next.delete(label);
        notify(`已隐藏 ${label}`);
      } else {
        next.add(label);
        notify(`已显示 ${label}`);
      }
      return next;
    });
  };

  const updateSectionLines = (label, value) => {
    moduleStateTouchedRef.current = true;
    setSectionContent((current) => ({
      ...current,
      [label]: value.split("\n").filter((line) => line.trim()),
    }));
  };

  const updateStructuredEntries = (label, entries) => {
    moduleStateTouchedRef.current = true;
    setSectionDetails((current) => ({ ...current, [label]: entries }));
    setSectionContent((current) => ({ ...current, [label]: structuredEntriesToLines(entries) }));
  };

  const addProfileField = () => {
    profileFieldsTouchedRef.current = true;
    setProfileFields((current) => [...current, {
      id: `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      label: "自定义信息",
      value: "",
    }]);
  };

  const updateProfileField = (fieldId, changes) => {
    profileFieldsTouchedRef.current = true;
    setProfileFields((current) => current.map((field) => field.id === fieldId ? { ...field, ...changes } : field));
  };

  const removeProfileField = (fieldId) => {
    profileFieldsTouchedRef.current = true;
    setProfileFields((current) => current.filter((field) => field.id !== fieldId));
  };

  const importProfilePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      notify("请选择 PNG、JPG 或 WebP 格式的证件照");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      notify("证件照不能超过 2MB");
      return;
    }

    try {
      const imageDataUrl = await readImageAsDataUrl(file);
      setPhotoDataUrl(imageDataUrl);
      writeWorkspaceValue("lingxi-resume-photo", imageDataUrl);
      await saveResume("更新简历证件照", { photoDataUrl: imageDataUrl });
    } catch (error) {
      notify(`证件照上传失败: ${error.message}`);
    }
  };

  const removeProfilePhoto = async () => {
    setPhotoDataUrl("");
    window.localStorage.removeItem(workspaceStorageKey("lingxi-resume-photo"));
    await saveResume("移除简历证件照", { photoDataUrl: "" });
  };

  return (
    <div className="resume-editor-shell">
      <div className="resume-editor-bar">
        <button type="button" className="white-small" onClick={() => go("resume")}><ArrowLeft size={16} />返回我的简历</button>
        <span>当前编辑：{form.当前职位 || "未命名简历"}</span>
      </div>
    <section className="resume-editor">
      <aside className="resume-modules">
        <div className="mini-heading">
          <strong>布局</strong>
          <button type="button" aria-label="添加自定义模块" onClick={addCustomSection}><Plus size={18} /></button>
        </div>
        <DndContext sensors={moduleSensors} collisionDetection={closestCenter} onDragEnd={reorderModules}>
          <SortableContext items={allSections.map((item) => item.label)} strategy={verticalListSortingStrategy}>
            {allSections.map((item) => (
              <SortableModuleRow
                key={item.label}
                item={item}
                isActive={activeSection === item.label}
                isVisible={visibleSections.has(item.label)}
                onSelect={() => setActiveSection(item.label)}
                onToggle={() => toggleSection(item.label)}
                onRemove={() => removeSection(item.label)}
              />
            ))}
          </SortableContext>
        </DndContext>
        {removedDefaultSections.length > 0 && (
          <div className="removed-module-list">
            <span>已移除模块</span>
            <div>
              {removedDefaultSections.map((item) => (
                <button type="button" key={item.label} onClick={() => restoreDefaultSection(item.label)}>
                  <Plus size={13} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="theme-box">
          <strong>主题色</strong>
          <div className="color-row">
            {["#171717", "#2f7de1", "#4fb37e", "#7c5ce6", "#e06b48", "#d64b4b"].map((color) => (
              <button
                type="button"
                className={themeColor === color ? "selected" : ""}
                key={color}
                style={{ background: color }}
                aria-label={`使用主题色 ${color}`}
                onClick={() => changeThemeColor(color)}
              />
            ))}
          </div>
        </div>
      </aside>

      <section className="editor-form">
        <div className="form-card">
          <div className="mini-heading">
            <strong>{activeSection}</strong>
            <div className="form-heading-actions">
              {activeSection === "基本信息" && <button type="button" className="link-button" onClick={addProfileField}><Plus size={14} />添加信息</button>}
              <button className={`link-button ${saveState === "saved" ? "is-saved" : ""}`} disabled={saveState === "saving"} onClick={() => saveResume()}>
                {saveState === "saving" ? <LoaderCircle className="spin" size={14} /> : saveState === "saved" ? <Check size={14} /> : <Save size={14} />}
                {saveState === "saving" ? "正在保存" : saveState === "saved" ? "已保存" : "自动保存"}
              </button>
            </div>
          </div>
          {!visibleSections.has(activeSection) && (
            <div className="section-state-note">
              当前模块已隐藏，点击左侧眼睛图标可重新显示在简历预览中。
            </div>
          )}
          {activeSection === "基本信息" ? (
            <>
              <div className="resume-photo-import">
                <div>
                  <strong>证件照</strong>
                  <span>支持 PNG、JPG、WebP，最大 2MB；上传后会显示在简历头像位置。</span>
                </div>
                <div className="resume-photo-import-actions">
                  <input ref={photoInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={importProfilePhoto} aria-hidden="true" tabIndex={-1} />
                  <button type="button" className="link-button" onClick={() => photoInputRef.current?.click()}>
                    <Upload size={14} />
                    {photoDataUrl ? "更换照片" : "上传证件照"}
                  </button>
                  {photoDataUrl && <button type="button" className="link-button" onClick={removeProfilePhoto}>移除</button>}
                </div>
                {photoDataUrl && <img src={photoDataUrl} alt="证件照预览" />}
              </div>
              <div className="layout-switch">
                {["左图右文", "居中信息", "右图左文"].map((item) => (
                  <button type="button" className={layout === item ? "active" : ""} key={item} onClick={() => changeLayout(item)}>{item}</button>
                ))}
              </div>
              {Object.entries(form).map(([label, value]) => (
                <label className="input-row" key={label}>
                  <span>{label}</span>
                  <input value={value} onChange={(event) => setForm((current) => ({ ...current, [label]: event.target.value }))} />
                </label>
              ))}
              {profileFields.map((field) => (
                <div className="input-row custom-profile-field" key={field.id}>
                  <input aria-label="信息名称" value={field.label} onChange={(event) => updateProfileField(field.id, { label: event.target.value })} />
                  <input aria-label={field.label || "自定义信息"} value={field.value} placeholder="填写信息内容" onChange={(event) => updateProfileField(field.id, { value: event.target.value })} />
                  <button type="button" aria-label="删除自定义信息" title="删除" onClick={() => removeProfileField(field.id)}><Trash2 size={15} /></button>
                </div>
              ))}
              <label className="input-row">
                <span>目标岗位</span>
                <input
                  value={targetPosition}
                  placeholder="例如：软件测试工程师"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setTargetPosition(nextValue);
                    writeWorkspaceValue("lingxi-target-position", nextValue);
                  }}
                />
              </label>
              <label className="section-editor resume-summary-editor">
                <span>个人简介</span>
                <textarea
                  value={selfEvaluation}
                  placeholder="用两三句话概括你的能力和求职优势"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSelfEvaluation(nextValue);
                    writeWorkspaceValue("lingxi-resume-summary", nextValue);
                  }}
                />
              </label>
            </>
          ) : (structuredSectionConfig[activeSection] || customSections.some((section) => section.label === activeSection)) ? (
            <StructuredSectionEditor
              section={activeSection}
              entries={sectionDetails[activeSection] || legacyLinesToStructuredEntries(activeSection, sectionContent[activeSection])}
              onChange={(entries) => updateStructuredEntries(activeSection, entries)}
            />
          ) : (
            <label className="section-editor">
              <span>每行一条内容，会实时同步到右侧预览</span>
              <textarea
                value={(sectionContent[activeSection] || []).join("\n")}
                onChange={(event) => updateSectionLines(activeSection, event.target.value)}
              />
            </label>
          )}
        </div>
        <div className="form-card ai-card">
          <strong>AI 工具</strong>
          <div>
            <button onClick={() => go("ai-tools")}>打开 AI 工具</button>
          </div>
        </div>
      </section>

      <section className="resume-preview" ref={resumePreviewRef}>
        <div className="preview-actions">
          <span>A4 实时预览</span>
          <button type="button" onClick={() => exportResumePdf(resumePreviewRef.current, form.姓名 ? `${form.姓名}的简历` : "简历", notify)} aria-label="导出简历 PDF" title="导出简历 PDF"><Download size={16} /></button>
        </div>
        <div className={previewRefreshing ? "resume-paper-update" : ""}><ResumePaper form={form} selfEvaluation={selfEvaluation} photoDataUrl={photoDataUrl} layout={layout} themeColor={themeColor} templateTone={templateTone} visibleSections={visibleSections} sectionOrder={moduleOrder} sectionContent={sectionContent} sectionDetails={sectionDetails} profileFields={profileFields} /></div>
      </section>
    </section>
    </div>
  );
}

function StructuredSectionEditor({ section, entries, onChange }) {
  const config = getStructuredSectionConfig(section);
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  const updateEntry = (entryId, changes) => {
    onChange(entries.map((entry) => entry.id === entryId ? { ...entry, ...changes } : entry));
  };

  const removeEntry = (entryId) => {
    if (entries.length <= 1) return;
    onChange(entries.filter((entry) => entry.id !== entryId));
  };

  const toggleCollapsed = (entryId) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  return (
    <div className="structured-section-editor">
      {entries.map((entry, index) => {
        const isCollapsed = collapsedIds.has(entry.id);
        return (
          <article className="experience-entry" key={entry.id}>
            <div className="experience-entry-head">
              <button type="button" className="experience-entry-title" onClick={() => toggleCollapsed(entry.id)} aria-expanded={!isCollapsed}>
                <strong>{entry.name || `${config.title} ${index + 1}`}</strong>
                <span>{entry.role || "待填写"}</span>
              </button>
              <div className="experience-entry-actions">
                <button type="button" title={isCollapsed ? "展开" : "收起"} aria-label={isCollapsed ? "展开" : "收起"} onClick={() => toggleCollapsed(entry.id)}><ChevronDown className={isCollapsed ? "" : "is-open"} size={17} /></button>
                <button type="button" className="danger" title="删除此条经历" aria-label="删除此条经历" disabled={entries.length <= 1} onClick={() => removeEntry(entry.id)}><Trash2 size={16} /></button>
              </div>
            </div>
            {!isCollapsed && (
              <div className="experience-entry-body">
                <div className="experience-fields">
                  <label>
                    <span>{config.nameLabel}</span>
                    <input value={entry.name} placeholder={config.namePlaceholder} onChange={(event) => updateEntry(entry.id, { name: event.target.value })} />
                  </label>
                  <label>
                    <span>{config.roleLabel}</span>
                    <input value={entry.role} placeholder={config.rolePlaceholder} onChange={(event) => updateEntry(entry.id, { role: event.target.value })} />
                  </label>
                </div>
                <div className="experience-period">
                  <span>起止时间</span>
                  <div>
                    <input value={entry.startDate} placeholder="2021/07" onChange={(event) => updateEntry(entry.id, { startDate: event.target.value })} />
                    <b>至</b>
                    <input value={entry.endDate} placeholder="2024/12" disabled={entry.isCurrent} onChange={(event) => updateEntry(entry.id, { endDate: event.target.value })} />
                    <label className="current-role-toggle">
                      <input type="checkbox" checked={entry.isCurrent} onChange={(event) => updateEntry(entry.id, { isCurrent: event.target.checked })} />
                      至今
                    </label>
                  </div>
                </div>
                <label className="experience-highlights">
                  <span>经历要点</span>
                  <textarea value={(entry.highlights || []).join("\n")} placeholder="每行一条，建议写清职责、成果和量化指标" onChange={(event) => updateEntry(entry.id, { highlights: event.target.value.split("\n").filter((line) => line.trim()) })} />
                </label>
              </div>
            )}
          </article>
        );
      })}
      <button type="button" className="structured-entry-add" onClick={() => onChange([...entries, createStructuredEntry(section)])}>
        <Plus size={16} />{config.addLabel}
      </button>
    </div>
  );
}

function SortableModuleRow({ item, isActive, isVisible, onSelect, onToggle, onRemove }) {
  const Icon = item.icon;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.label });
  const style = {
    transform: `${CSS.Transform.toString(transform) || ""}${isDragging ? " scale(1.01)" : ""}`,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`module-row ${isActive ? "active" : ""} ${!isVisible ? "muted" : ""} ${isDragging ? "is-dragging" : ""}`}>
      <button
        type="button"
        className="module-drag-handle"
        aria-label={`拖动${item.label}调整顺序`}
        title="拖动排序"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button type="button" className="module-main" onClick={onSelect}>
        <Icon size={18} />
        <span>{item.label}</span>
      </button>
      <div className="module-actions">
        <button
          type="button"
          className="module-eye"
          aria-label={`${isVisible ? "隐藏" : "显示"}${item.label}`}
          title={`${isVisible ? "隐藏" : "显示"}${item.label}`}
          onClick={onToggle}
        >
          {isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
        </button>
        <button
          type="button"
          className="module-remove"
          aria-label={`删除${item.label}`}
          title={`删除${item.label}`}
          onClick={onRemove}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

function readSavedTemplate(userId) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(workspaceStorageKey("lingxi-template", userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function ResumePaper({ form = {}, selfEvaluation = "", photoDataUrl = "", layout = "左图右文", themeColor = "#171717", templateTone = "classic", visibleSections, sectionOrder = [], sectionContent = {}, sectionDetails = {}, profileFields = [] }) {
  const visible = visibleSections || new Set(resumeSections.map((item) => item.label));
  const orderedSections = sectionOrder.length
    ? sectionOrder
    : ["基本信息", "专业技能", "工作经历", "项目经历", ...Object.keys(sectionContent).filter((label) => !["专业技能", "工作经历", "项目经历"].includes(label))];

  return (
    <article className={`resume-paper-modern ${layoutClass(layout)} resume-template-${templateTone}`} style={{ "--resume-accent": themeColor }}>
      {orderedSections.filter((label) => visible.has(label)).map((label) => {
        if (label === "基本信息") {
          return <ResumeBasicBlock key={label} form={form} selfEvaluation={selfEvaluation} photoDataUrl={photoDataUrl} profileFields={profileFields} />;
        }
        if (Array.isArray(sectionDetails[label]) && sectionDetails[label].length) {
          return <ResumeStructuredBlock title={label} entries={sectionDetails[label]} key={label} />;
        }
        return (
          <ResumeBlock title={label} key={label}>
            {(sectionContent[label] || []).map((item, index) => <li key={`${label}-${index}`}>{item}</li>)}
          </ResumeBlock>
        );
      })}
      {orderedSections.every((label) => !visible.has(label)) && (
        <div className="empty-resume-paper">左侧模块都已隐藏，请至少显示一个模块。</div>
      )}
    </article>
  );
}

function ResumeStructuredBlock({ title, entries }) {
  return (
    <section className="resume-structured-block" data-section={title}>
      <h3>{title}</h3>
      {entries.map((entry) => (
        <article className="resume-structured-entry" key={entry.id}>
          <div>
            <strong>{entry.name || "未填写"}</strong>
            <span>{entry.role}</span>
          </div>
          <time>{[entry.startDate, entry.isCurrent ? "至今" : entry.endDate].filter(Boolean).join(" - ")}</time>
          {(entry.highlights || []).length > 0 && (
            <ul>{entry.highlights.map((highlight, index) => <li key={`${entry.id}-${index}`}>{highlight}</li>)}</ul>
          )}
        </article>
      ))}
    </section>
  );
}

function ResumeBasicBlock({ form, selfEvaluation, photoDataUrl, profileFields = [] }) {
  const contacts = [
    { icon: Mail, value: form.邮箱 || resume.email },
    { icon: Phone, value: form.电话 || resume.phone },
    { icon: MapPin, value: form.城市 || resume.city },
    { icon: Globe2, value: form.个人主页 || resume.website },
    ...profileFields.filter((field) => field.label && field.value).map((field) => ({ icon: FileText, value: `${field.label}：${field.value}` })),
  ].filter((item) => item.value);

  return (
    <>
      <header>
        <div className={`avatar ${photoDataUrl ? "has-photo" : ""}`}>
          {photoDataUrl ? <img src={photoDataUrl} alt="证件照" /> : (form.姓名 || resume.name).slice(0, 1)}
        </div>
        <div className="resume-identity">
          <h2>{form.姓名 || resume.name}</h2>
          <p>{form.当前职位 || resume.title}</p>
        </div>
        <ul>
          {contacts.map(({ icon: Icon, value }) => (
            <li key={value}><Icon size={14} strokeWidth={1.8} /><span>{value}</span></li>
          ))}
        </ul>
      </header>
      {selfEvaluation.trim() && (
        <section className="resume-summary">
          <h3>个人简介</h3>
          <p>{selfEvaluation}</p>
        </section>
      )}
    </>
  );
}

function layoutClass(layout) {
  return {
    左图右文: "layout-left",
    居中信息: "layout-center",
    右图左文: "layout-right",
    紧凑排列: "layout-compact",
  }[layout] || "layout-left";
}

function ResumeBlock({ title, children }) {
  return (
    <section data-section={title}>
      <h3>{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function TemplateGallery({ go, notify, appliedTemplate, onApplyTemplate }) {
  const initialTemplate = templates.find((template) => template.name === appliedTemplate?.name) || templates[0];
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate.name);
  const [selectedColor, setSelectedColor] = useState("#171717");
  const [previewOpen, setPreviewOpen] = useState(false);
  const activeTemplate = templates.find((template) => template.name === selectedTemplate) || templates[0];

  const previewTemplate = (template, openDialog = false) => {
    setSelectedTemplate(template.name);
    setSelectedColor(template.defaultColor);
    if (openDialog) setPreviewOpen(true);
  };

  const applyTemplate = async (template = activeTemplate, color = selectedColor) => {
    const payload = { name: template.name, tone: template.tone, layout: template.layout, color };
    const createdResume = await onApplyTemplate(payload);
    if (!createdResume) return;
    setSelectedTemplate(template.name);
    setSelectedColor(color);
    notify(`已使用${template.name}填入简历内容`);
    go("resume-edit");
  };

  return (
    <section className="template-page">
      <div className="template-toolbar">
        <div>
          <span className="section-kicker">选择版式</span>
          <p>每个模板都带同一份示例简历，直接比较排版、信息密度与阅读体验；确定后再创建自己的简历。</p>
        </div>
        <div className="color-row large" aria-label="模板主题色">
          {["#f8f8f6", "#477ee8", "#56b987", "#7d5df0", "#e87930", "#e4584f", "#4b5563", "#000"].map((color) => (
            <button
              type="button"
              className={selectedColor === color ? "selected" : ""}
              key={color}
              style={{ background: color }}
              aria-label={`选择模板主题色 ${color}`}
              onClick={() => {
                setSelectedColor(color);
                notify("模板主题色已更新");
              }}
            />
          ))}
        </div>
      </div>
      <div className="template-current">
        <ResumeTemplatePreview template={activeTemplate} color={selectedColor} featured />
        <div>
          <span className="template-kicker">示例简历预览</span>
          <h3>{activeTemplate.name}</h3>
          <p>{activeTemplate.desc}</p>
          <div className="template-meta">
            <span>{activeTemplate.focus}</span>
            <span>{activeTemplate.layout}</span>
            <span>ATS 友好</span>
          </div>
          <div className="template-actions">
            <button className="white-cta" onClick={() => setPreviewOpen(true)}>
              查看示例排版
            </button>
            <button className="black-small" onClick={() => applyTemplate()}>
              使用当前模板
            </button>
          </div>
        </div>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <article className={`template-card ${selectedTemplate === template.name ? "selected" : ""}`} data-template={template.tone} key={template.name}>
            <ResumeTemplatePreview template={template} color={selectedColor} />
            <div className="template-card-copy">
              <span>{template.focus}</span>
              <h3>{template.name}</h3>
              <p>{template.desc}</p>
            </div>
            <div className="template-card-actions">
              <button className="white-cta" onClick={() => {
                previewTemplate(template, true);
              }}>预览</button>
              <button className="black-small" onClick={() => {
                applyTemplate(template, template.name === selectedTemplate ? selectedColor : template.defaultColor);
              }}>使用此模板</button>
            </div>
          </article>
        ))}
      </div>
      <TemplatePreviewDialog
        open={previewOpen}
        template={activeTemplate}
        color={selectedColor}
        onClose={() => setPreviewOpen(false)}
        onApply={() => applyTemplate()}
      />
    </section>
  );
}

function ResumeTemplatePreview({ template, color, featured = false, compact = false }) {
  const scale = featured ? 0.42 : compact ? 0.22 : 0.34;
  return (
    <div className={`template-preview ${featured ? "featured" : ""}`}>
      <div className="template-preview-stage" style={{ width: `${760 * scale}px`, height: `${760 * scale}px` }}>
        <div className="template-preview-scale" style={{ transform: `scale(${scale})` }}>
          <ResumePaper
            form={templatePreviewForm}
            selfEvaluation={templatePreviewSummary}
            layout={template.layout}
            themeColor={color}
            templateTone={template.tone}
            visibleSections={templatePreviewVisibleSections}
            sectionOrder={templatePreviewOrder}
            sectionContent={templatePreviewSections}
          />
        </div>
      </div>
    </div>
  );
}

function TemplatePreviewDialog({ open, template, color, onClose, onApply }) {
  const { isMounted, isLeaving } = usePresence(open);
  if (!isMounted) return null;
  return (
    <div className={`template-preview-backdrop ${isLeaving ? "is-leaving" : ""}`} role="presentation" onMouseDown={onClose}>
      <section className="template-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="template-preview-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="template-preview-dialog-head">
          <div>
            <span className="template-kicker">示例简历预览</span>
            <h2 id="template-preview-title">{template.name}</h2>
            <p>{template.desc}</p>
          </div>
          <button className="plain-icon template-preview-close" type="button" onClick={onClose} aria-label="关闭预览" title="关闭预览">
            <X size={20} />
          </button>
        </header>
        <div className="template-preview-dialog-body">
          <ResumePaper
            form={templatePreviewForm}
            selfEvaluation={templatePreviewSummary}
            layout={template.layout}
            themeColor={color}
            templateTone={template.tone}
            visibleSections={templatePreviewVisibleSections}
            sectionOrder={templatePreviewOrder}
            sectionContent={templatePreviewSections}
          />
        </div>
        <footer className="template-preview-dialog-actions">
          <button type="button" className="white-cta" onClick={onClose}>返回模板列表</button>
          <button type="button" className="black-small" onClick={onApply}>使用此模板</button>
        </footer>
      </section>
    </div>
  );
}

function AiToolsPanel({ notify, go, resumeId }) {
  const generatePositionKeywords = () => {
    go("analysis");
  };

  return (
    <section className="ai-tools-page">
      <div className="ai-tools-head">
        <div>
          <span className="section-kicker">AI 工具</span>
          <h2>简历优化与检查</h2>
        </div>
        <div className="ai-tools-actions">
          <button className="white-small" onClick={generatePositionKeywords}>岗位关键词</button>
          <button className="white-small" onClick={() => go("optimize")}>项目润色</button>
          <button className="black-small" onClick={() => go("interview")}>模拟面试</button>
        </div>
      </div>
      <GrammarPanel notify={notify} resumeId={resumeId} />
    </section>
  );
}

function GrammarPanel({ notify, resumeId }) {
  const [content, setContent] = useState("");
  const [checking, setChecking] = useState(false);
  const [resultVersion, setResultVersion] = useState(0);
  const [result, setResult] = useState(null);

  const runCheck = async () => {
    if (!resumeId) {
      notify("请先在我的简历中选择一份简历");
      return;
    }
    setChecking(true);
    try {
      const data = await apiRequest(`/api/resumes/${resumeId}/grammar-check`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setResult(data.item);
      setResultVersion((current) => current + 1);
      notify("语法检查完成，记录已归档");
    } catch (error) {
      notify(`语法检查失败: ${error.message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className="grammar-page">
      <div className="grammar-input">
        <h2>AI 语法检查</h2>
        <p>检查错别字、英文拼写、标点和简历表达问题。</p>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        <button className="black-small" onClick={runCheck} disabled={checking}>
          <Check size={16} />
          {checking ? "检查中..." : "开始检查"}
        </button>
      </div>
      <div className={`grammar-result ${resultVersion ? "ai-result-enter" : ""}`} key={resultVersion}>
        {checking ? <ResultSkeleton lines={3} /> : result ? <>
        <span><AnimatedScore value={result.score} shouldAnimate={resultVersion > 0} /> 分</span>
        <h3>检查结果</h3>
        {(result.issues || []).length === 0 && (
          <article>
            <strong>未发现明显问题</strong>
            <p>当前文本没有返回可修改项。</p>
            <small>可以换成完整简历段落继续检查。</small>
          </article>
        )}
        {(result.issues || []).map((issue, index) => (
          <article className={resultVersion ? "card-stagger" : ""} style={{ "--stagger-index": index }} key={`${issue.original}-${index}`}>
            <strong>{issue.type}</strong>
            <p>{issue.original} → {issue.suggestion}</p>
            <small>{issue.reason}</small>
          </article>
        ))}
        </> : <article><strong>尚未开始检查</strong><p>输入需要检查的简历段落后开始检查，结果会绑定当前选中的简历。</p></article>}
      </div>
    </section>
  );
}

function ResultSkeleton({ lines = 3 }) {
  return <div className="result-skeleton" aria-label="正在加载结果">{Array.from({ length: lines }, (_, index) => <span className="skeleton" key={index} style={{ "--skeleton-width": `${92 - index * 12}%` }} />)}</div>;
}

function JobDescriptionWorkspace({ notify, activeResumeId, onOpenResume, go }) {
  const [mode, setMode] = useState("list");
  const [jobs, setJobs] = useState([]);
  const [detail, setDetail] = useState(null);
  const [resumes, setResumes] = useState([]);
  const [resumeVersions, setResumeVersions] = useState([]);
  const [applications, setApplications] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(activeResumeId || "");
  const [selectedResumeVersionId, setSelectedResumeVersionId] = useState("");
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [matchFailureMessage, setMatchFailureMessage] = useState("");
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportFailure, setReportFailure] = useState(null);
  const [reportWorking, setReportWorking] = useState(false);
  const [suggestionRuns, setSuggestionRuns] = useState([]);
  const [selectedSuggestionRun, setSelectedSuggestionRun] = useState(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionWorking, setSuggestionWorking] = useState(false);
  const [suggestionError, setSuggestionError] = useState(null);
  const [suggestionSuccess, setSuggestionSuccess] = useState("");
  const [resumeVersionHistory, setResumeVersionHistory] = useState([]);
  const [selectedVersionSnapshot, setSelectedVersionSnapshot] = useState(null);
  const [versionHistoryLoading, setVersionHistoryLoading] = useState(false);
  const [versionHistoryError, setVersionHistoryError] = useState(null);
  const [agentRuns, setAgentRuns] = useState([]);
  const [selectedAgentRun, setSelectedAgentRun] = useState(null);
  const [agentSteps, setAgentSteps] = useState([]);
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentWorking, setAgentWorking] = useState(false);
  const [agentError, setAgentError] = useState(null);
  const [interviewSessions, setInterviewSessions] = useState([]);
  const [selectedInterview, setSelectedInterview] = useState(null);
  const [interviewFeedback, setInterviewFeedback] = useState({});
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewWorking, setInterviewWorking] = useState(false);
  const [interviewError, setInterviewError] = useState(null);
  const [activeInterviewQuestion, setActiveInterviewQuestion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [form, setForm] = useState({ title: "", companyName: "", sourceUrl: "", rawText: "" });
  const [editingId, setEditingId] = useState(null);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/job-descriptions");
      setJobs(data.items || []);
    } catch (error) {
      notify(`读取岗位 JD 失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadResumeVersionHistory = useCallback(async (resumeId) => {
    if (!resumeId) {
      setResumeVersionHistory([]);
      setSelectedVersionSnapshot(null);
      return [];
    }
    try {
      setVersionHistoryLoading(true);
      setVersionHistoryError(null);
      const data = await apiRequest(`/api/resumes/${resumeId}/versions`);
      const items = data.items || [];
      setResumeVersionHistory(items);
      return items;
    } catch (error) {
      setResumeVersionHistory([]);
      setVersionHistoryError(error.message);
      return [];
    } finally {
      setVersionHistoryLoading(false);
    }
  }, []);

  const openResumeVersionSnapshot = useCallback(async (resumeId, versionId) => {
    if (!resumeId || !versionId) return;
    try {
      setVersionHistoryError(null);
      const data = await apiRequest(`/api/resumes/${resumeId}/versions/${versionId}`);
      setSelectedVersionSnapshot(data.item || null);
    } catch (error) {
      setSelectedVersionSnapshot(null);
      setVersionHistoryError(`读取版本内容失败：${error.message}`);
    }
  }, []);

  const openSuggestionRun = useCallback(async (runId) => {
    if (!runId) return;
    try {
      setSuggestionError(null);
      const data = await apiRequest(`/api/suggestion-runs/${runId}`);
      const item = data.item || null;
      setSelectedSuggestionRun(item);
      if (item?.resumeId) await loadResumeVersionHistory(item.resumeId);
    } catch (error) {
      setSelectedSuggestionRun(null);
      setSuggestionError({ code: error.failureCode || "SUGGESTION_RUN_NOT_FOUND", message: error.message });
    }
  }, [loadResumeVersionHistory]);

  const loadSuggestionRuns = useCallback(async (reportId, { autoSelect = true } = {}) => {
    if (!reportId) {
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      return [];
    }
    try {
      setSuggestionLoading(true);
      setSuggestionError(null);
      const data = await apiRequest(`/api/match-reports/${reportId}/resume-suggestions`);
      const items = data.items || [];
      setSuggestionRuns(items);
      if (autoSelect && items[0]?.id) await openSuggestionRun(items[0].id);
      if (!items.length) setSelectedSuggestionRun(null);
      return items;
    } catch (error) {
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      setSuggestionError({ code: error.failureCode || "SUGGESTION_RETRIEVAL_FAILED", message: error.message });
      return [];
    } finally {
      setSuggestionLoading(false);
    }
  }, [openSuggestionRun]);

  const openInterviewSession = useCallback(async (sessionId) => {
    if (!sessionId) return null;
    try {
      setInterviewLoading(true);
      setInterviewError(null);
      const request = interviewApiRequest("session", { sessionId });
      const data = await apiRequest(request.path);
      const session = data.item || null;
      const feedbackEntries = await Promise.all((session?.questions || []).filter((question) => question.answerId).map(async (question) => {
        try {
          const feedbackRequest = interviewApiRequest("feedback", { sessionId: session.id, answerId: question.answerId });
          const result = await apiRequest(feedbackRequest.path);
          return [question.id, { answer: result.answer, feedback: result.item }];
        } catch (error) {
          return [question.id, { answer: null, feedback: null, error: { code: error.failureCode, message: error.message } }];
        }
      }));
      setSelectedInterview(session);
      setInterviewFeedback(Object.fromEntries(feedbackEntries));
      setActiveInterviewQuestion(nextInterviewQuestionIndex(session?.questions || []));
      return session;
    } catch (error) {
      setSelectedInterview(null);
      setInterviewFeedback({});
      setInterviewError({ code: error.failureCode || "INTERVIEW_SESSION_NOT_FOUND", message: error.message });
      return null;
    } finally {
      setInterviewLoading(false);
    }
  }, []);

  const loadInterviewSessions = useCallback(async (applicationId, { autoSelect = true } = {}) => {
    if (!applicationId) {
      setInterviewSessions([]);
      setSelectedInterview(null);
      setInterviewFeedback({});
      return [];
    }
    try {
      setInterviewLoading(true);
      setInterviewError(null);
      const request = interviewApiRequest("history", { applicationId });
      const data = await apiRequest(request.path);
      const items = data.items || [];
      setInterviewSessions(items);
      if (autoSelect && items[0]?.id) await openInterviewSession(items[0].id);
      if (!items.length) {
        setSelectedInterview(null);
        setInterviewFeedback({});
      }
      return items;
    } catch (error) {
      setInterviewSessions([]);
      setSelectedInterview(null);
      setInterviewFeedback({});
      setInterviewError({ code: error.failureCode || "INTERVIEW_RETRIEVAL_FAILED", message: error.message });
      return [];
    } finally {
      setInterviewLoading(false);
    }
  }, [openInterviewSession]);

  const openAgentRun = useCallback(async (runId) => {
    if (!runId) return null;
    try {
      setAgentLoading(true);
      setAgentError(null);
      const detailRequest = agentApiRequest("detail", { runId });
      const stepsRequest = agentApiRequest("steps", { runId });
      const [detailData, stepsData] = await Promise.all([
        apiRequest(detailRequest.path),
        apiRequest(stepsRequest.path),
      ]);
      const item = detailData.item || null;
      setSelectedAgentRun(item);
      setAgentSteps(stepsData.items || []);
      return item;
    } catch (error) {
      setSelectedAgentRun(null);
      setAgentSteps([]);
      setAgentError({ code: error.failureCode || "AGENT_RUN_NOT_FOUND", message: error.message });
      return null;
    } finally {
      setAgentLoading(false);
    }
  }, []);

  const loadAgentRuns = useCallback(async (applicationId, { autoSelect = true } = {}) => {
    if (!applicationId) {
      setAgentRuns([]);
      setSelectedAgentRun(null);
      setAgentSteps([]);
      return [];
    }
    try {
      setAgentLoading(true);
      setAgentError(null);
      const request = agentApiRequest("history", { applicationId });
      const data = await apiRequest(request.path);
      const items = data.items || [];
      setAgentRuns(items);
      if (autoSelect && items[0]?.id) await openAgentRun(items[0].id);
      if (!items.length) {
        setSelectedAgentRun(null);
        setAgentSteps([]);
      }
      return items;
    } catch (error) {
      setAgentRuns([]);
      setSelectedAgentRun(null);
      setAgentSteps([]);
      setAgentError({ code: error.failureCode || "AGENT_HISTORY_FAILED", message: error.message });
      return [];
    } finally {
      setAgentLoading(false);
    }
  }, [openAgentRun]);

  const openGroundedReport = useCallback(async (reportId) => {
    try {
      setReportFailure(null);
      const data = await apiRequest(`/api/match-reports/${reportId}`);
      setSelectedReport(data.item || null);
      await loadSuggestionRuns(reportId);
    } catch (error) {
      setSelectedReport(null);
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      const code = error.failureCode || "REPORT_RETRIEVAL_FAILED";
      setReportFailure({ code, message: error.message });
      notify(`读取 AI 岗位匹配报告失败: ${reportFailureMessage(code)}`);
    }
  }, [loadSuggestionRuns, notify]);

  const loadGroundedReports = useCallback(async (applicationId, { autoSelect = true } = {}) => {
    if (!applicationId) {
      setReports([]);
      setSelectedReport(null);
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      return [];
    }
    try {
      const data = await apiRequest(`/api/job-applications/${applicationId}/reports`);
      const items = data.items || [];
      setReports(items);
      if (autoSelect && items[0]?.id) await openGroundedReport(items[0].id);
      return items;
    } catch (error) {
      setReports([]);
      setSelectedReport(null);
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      const code = error.failureCode || "REPORT_RETRIEVAL_FAILED";
      setReportFailure({ code, message: error.message });
      notify(`读取 AI 岗位匹配报告历史失败: ${reportFailureMessage(code)}`);
      return [];
    }
  }, [notify, openGroundedReport]);

  const loadMatches = useCallback(async (applicationId, { autoSelectCompleted = false } = {}) => {
    if (!applicationId) {
      setMatches([]);
      return [];
    }
    try {
      const data = await apiRequest(`/api/job-applications/${applicationId}/matches`);
      const items = data.items || [];
      setMatches(items);
      const historyMatch = selectHistoryMatch(items, { autoSelectCompleted });
      if (historyMatch) setSelectedMatch((await apiRequest(`/api/resume-job-matches/${historyMatch.id}`)).item);
      return items;
    } catch (error) {
      notify(`读取匹配历史失败: ${error.message}`);
      return [];
    }
  }, [notify]);

  const loadDetail = useCallback(async (jobId) => {
    try {
      setLoading(true);
      const [jobData, resumeData, applicationData] = await Promise.all([
        apiRequest(`/api/job-descriptions/${jobId}`),
        apiRequest("/api/resumes"),
        apiRequest("/api/job-applications"),
      ]);
      setDetail(jobData);
      setResumes(resumeData.items || []);
      const nextApplications = (applicationData.items || []).filter((item) => item.jobDescriptionId === Number(jobId));
      setApplications(nextApplications);
      const nextResumeId = String(activeResumeId || resumeData.items?.[0]?.id || "");
      setSelectedResumeId(nextResumeId);
      if (nextResumeId) {
        const versionData = await apiRequest(`/api/resumes/${nextResumeId}/versions`);
        setResumeVersions(versionData.items || []);
        setSelectedResumeVersionId(String(versionData.items?.[0]?.id || ""));
      } else {
        setResumeVersions([]);
        setSelectedResumeVersionId("");
      }
      const nextApplication = nextApplications.find((item) => item.resumeVersionId) || nextApplications[0];
      setSelectedApplicationId(String(nextApplication?.id || ""));
      setMatches([]);
      setSelectedMatch(null);
      setMatchFailureMessage("");
      setReports([]);
      setSelectedReport(null);
      setReportFailure(null);
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      setSuggestionError(null);
      setSuggestionSuccess("");
      setResumeVersionHistory([]);
      setSelectedVersionSnapshot(null);
      setAgentRuns([]);
      setSelectedAgentRun(null);
      setAgentSteps([]);
      setAgentError(null);
      setInterviewSessions([]);
      setSelectedInterview(null);
      setInterviewFeedback({});
      setInterviewError(null);
      if (nextApplication?.id) await Promise.all([
        loadMatches(String(nextApplication.id), { autoSelectCompleted: true }),
        loadGroundedReports(String(nextApplication.id)),
        loadAgentRuns(String(nextApplication.id)),
        loadInterviewSessions(String(nextApplication.id)),
      ]);
      setMode("detail");
    } catch (error) {
      notify(`读取岗位详情失败: ${error.message}`);
      setMode("list");
    } finally {
      setLoading(false);
    }
  }, [activeResumeId, loadAgentRuns, loadGroundedReports, loadInterviewSessions, loadMatches, notify]);

  useEffect(() => { loadJobs(); }, [loadJobs]);
  useEffect(() => { if (activeResumeId) setSelectedResumeId(activeResumeId); }, [activeResumeId]);

  const selectResume = async (resumeId) => {
    setSelectedResumeId(resumeId);
    setSelectedResumeVersionId("");
    setResumeVersions([]);
    try {
      const data = await apiRequest(`/api/resumes/${resumeId}/versions`);
      setResumeVersions(data.items || []);
      setSelectedResumeVersionId(String(data.items?.[0]?.id || ""));
    } catch (error) {
      notify(`读取简历版本失败: ${error.message}`);
    }
  };

  const selectApplication = async (applicationId, { autoSelectCompleted = true } = {}) => {
    setSelectedApplicationId(applicationId);
    setSelectedMatch(null);
    setMatchFailureMessage("");
    setMatches([]);
    setSelectedReport(null);
    setReportFailure(null);
    setReports([]);
    setSuggestionRuns([]);
    setSelectedSuggestionRun(null);
    setSuggestionError(null);
    setSuggestionSuccess("");
    setResumeVersionHistory([]);
    setSelectedVersionSnapshot(null);
    setAgentRuns([]);
    setSelectedAgentRun(null);
    setAgentSteps([]);
    setAgentError(null);
    setInterviewSessions([]);
    setSelectedInterview(null);
    setInterviewFeedback({});
    setInterviewError(null);
    setActiveInterviewQuestion(0);
    if (!applicationId) return;
    await Promise.all([
      loadMatches(applicationId, { autoSelectCompleted }),
      loadGroundedReports(applicationId),
      loadAgentRuns(applicationId),
      loadInterviewSessions(applicationId),
    ]);
  };

  const saveJob = async () => {
    if (!form.rawText.trim()) {
      notify("请粘贴完整岗位 JD 原文");
      return;
    }
    setWorking(true);
    try {
      const data = await apiRequest(editingId ? `/api/job-descriptions/${editingId}` : "/api/job-descriptions", { method: editingId ? "PUT" : "POST", body: JSON.stringify(form) });
      notify(editingId ? "岗位 JD 已更新，请重新解析" : "岗位 JD 已保存，可开始 AI 解析");
      await loadJobs();
      await loadDetail(data.item.id);
      setForm({ title: "", companyName: "", sourceUrl: "", rawText: "" });
      setEditingId(null);
    } catch (error) {
      notify(`保存岗位 JD 失败: ${error.message}`);
    } finally {
      setWorking(false);
    }
  };

  const parseJob = async () => {
    if (!detail?.item?.id) return;
    setWorking(true);
    try {
      await apiRequest(`/api/job-descriptions/${detail.item.id}/parse`, { method: "POST" });
      notify("JD 已解析，所有结论均附带原文依据");
      await loadJobs();
      await loadDetail(detail.item.id);
    } catch (error) {
      notify(`JD 解析失败，已保留原始 JD，可修改后重试: ${error.message}`);
      await loadDetail(detail.item.id);
    } finally {
      setWorking(false);
    }
  };

  const createApplication = async () => {
    if (!detail?.item?.id || !selectedResumeId || !selectedResumeVersionId) {
      notify("请先选择一份简历及其明确版本");
      return;
    }
    setWorking(true);
    try {
      const data = await apiRequest("/api/job-applications", {
        method: "POST",
        body: JSON.stringify({ resumeId: Number(selectedResumeId), resumeVersionId: Number(selectedResumeVersionId), jobDescriptionId: detail.item.id }),
      });
      notify("求职分析任务已建立，已锁定简历版本与 JD 解析结果");
      await loadDetail(detail.item.id);
      await selectApplication(String(data.item.id));
    } catch (error) {
      notify(`创建分析任务失败: ${error.message}`);
    } finally {
      setWorking(false);
    }
  };

  const openMatch = async (matchId) => {
    try {
      setMatchFailureMessage("");
      setSelectedMatch((await apiRequest(`/api/resume-job-matches/${matchId}`)).item);
    } catch (error) { notify(`读取匹配报告失败: ${error.message}`); }
  };

  const createMatch = async (retryMatchId = "") => {
    const application = applications.find((item) => item.id === Number(selectedApplicationId));
    if (!application) { notify("请先选择一个已锁定版本的求职分析任务"); return; }
    setWorking(true);
    setSelectedMatch(null);
    setMatchFailureMessage("");
    try {
      const path = retryMatchId ? `/api/resume-job-matches/${retryMatchId}/retry` : `/api/job-applications/${application.id}/matches`;
      const data = await apiRequest(path, { method: "POST" });
      setSelectedMatch(data.item);
      notify("基础岗位匹配报告已生成并保存");
      await loadMatches(String(application.id), { autoSelectCompleted: false });
      await openMatch(data.item.id);
    } catch (error) {
      setSelectedMatch(null);
      setMatchFailureMessage(error.message);
      notify(`岗位匹配失败: ${error.message}`);
      const refreshedMatches = await loadMatches(String(application.id), { autoSelectCompleted: false });
      const failedMatch = selectLatestFailedMatch(refreshedMatches);
      if (failedMatch) setSelectedMatch(failedMatch);
    } finally { setWorking(false); }
  };

  const createGroundedReport = async () => {
    const application = applications.find((item) => item.id === Number(selectedApplicationId));
    if (!application || !selectedMatch?.id || selectedMatch.status !== "COMPLETED") {
      notify("请先选择一份已完成的基础岗位匹配报告。");
      return;
    }
    setReportWorking(true);
    setReportFailure(null);
    try {
      const data = await apiRequest(`/api/job-applications/${application.id}/reports`, {
        method: "POST",
        body: JSON.stringify({ matchId: selectedMatch.id, searchMode: "HYBRID", useReranker: false }),
      });
      setSelectedReport(data.item || null);
      setSuggestionRuns([]);
      setSelectedSuggestionRun(null);
      setSuggestionSuccess("");
      await loadGroundedReports(String(application.id), { autoSelect: false });
      notify("AI 岗位匹配报告已生成并保存为新版本。");
    } catch (error) {
      const failure = { code: error.failureCode || "REPORT_RETRIEVAL_FAILED", message: error.message };
      setReportFailure(failure);
      await loadGroundedReports(String(application.id));
      notify(`AI 岗位匹配报告生成失败: ${reportFailureMessage(failure.code)}`);
    } finally {
      setReportWorking(false);
    }
  };

  const createResumeSuggestions = async () => {
    if (!selectedReport?.id || !["COMPLETED", "DEGRADED"].includes(selectedReport.status)) {
      notify("请先打开一份已完成或已降级的 AI 岗位匹配报告。");
      return;
    }
    setSuggestionWorking(true);
    setSuggestionError(null);
    setSuggestionSuccess("");
    try {
      const data = await apiRequest(`/api/match-reports/${selectedReport.id}/resume-suggestions`, { method: "POST" });
      const run = data.item || null;
      if (run) {
        setSelectedSuggestionRun(run);
        await loadResumeVersionHistory(run.resumeId);
      }
      await loadSuggestionRuns(selectedReport.id, { autoSelect: false });
      if (run?.id) await openSuggestionRun(run.id);
      notify("简历优化建议已生成，请逐条查看差异后决定是否接受。");
    } catch (error) {
      const code = error.failureCode || "SUGGESTION_INVALID_OUTPUT";
      setSuggestionError({ code, message: error.message });
      notify(`生成简历优化建议失败：${suggestionFailureMessage(code)}`);
    } finally {
      setSuggestionWorking(false);
    }
  };

  const decideSuggestion = async (suggestion, action) => {
    if (!selectedSuggestionRun || !suggestion) return;
    const request = suggestionDecisionRequest(suggestion, action, selectedSuggestionRun.baseResumeVersion);
    if (!request) return;
    setSuggestionWorking(true);
    setSuggestionError(null);
    setSuggestionSuccess("");
    try {
      const data = await apiRequest(request.path, {
        method: "POST",
        ...(request.body ? { body: JSON.stringify(request.body) } : {}),
      });
      if (action === "accept") {
        const createdVersion = data.resumeVersion;
        setSuggestionSuccess(`已生成新简历版本 v${createdVersion?.resumeVersion || createdVersion?.version || Number(selectedSuggestionRun.baseResumeVersion) + 1}。同一轮其余待处理建议已失效。`);
        const refreshedVersions = await loadResumeVersionHistory(selectedSuggestionRun.resumeId);
        if (String(selectedResumeId) === String(selectedSuggestionRun.resumeId)) {
          setResumeVersions(refreshedVersions);
          setSelectedResumeVersionId(String(createdVersion?.id || refreshedVersions.find((item) => Number(item.resumeVersion || item.version) === Number(createdVersion?.resumeVersion || createdVersion?.version))?.id || ""));
        }
      } else {
        setSuggestionSuccess("已拒绝该建议，简历版本未发生变化。");
      }
      await loadSuggestionRuns(selectedReport?.id, { autoSelect: false });
      await openSuggestionRun(selectedSuggestionRun.id);
    } catch (error) {
      const code = error.failureCode || "SUGGESTION_ACTION_FAILED";
      setSuggestionError({ code, message: error.message });
      notify(`${action === "accept" ? "接受" : "拒绝"}建议失败：${suggestionFailureMessage(code)}`);
    } finally {
      setSuggestionWorking(false);
    }
  };

  const createAgentRun = async () => {
    const application = applications.find((item) => item.id === Number(selectedApplicationId));
    if (!application || !selectedReport?.id || !["COMPLETED", "DEGRADED"].includes(selectedReport.status)) {
      setAgentError({ code: "AGENT_REPORT_NOT_READY", message: "请先打开一份已完成或降级可用的 AI 岗位匹配报告。" });
      return;
    }
    setAgentWorking(true);
    setAgentError(null);
    try {
      const request = agentApiRequest("create", { applicationId: application.id, matchReportId: selectedReport.id });
      const data = await apiRequest(request.path, request.options);
      const run = data.item || null;
      setSelectedAgentRun(run);
      setAgentSteps(run?.steps || []);
      await loadAgentRuns(String(application.id), { autoSelect: false });
      if (run?.id) await openAgentRun(run.id);
      notify(run?.status === "DEGRADED" ? "Agent 分析已完成，部分检索或步骤处于降级状态。" : run?.status === "STOPPED_LIMIT" ? "Agent 已达到服务器允许的最大步骤数并停止。" : "Agent 分析已完成，可查看步骤、来源与建议计划。");
    } catch (error) {
      const code = error.failureCode || "AGENT_EXECUTION_FAILED";
      await loadAgentRuns(String(application.id), { autoSelect: false });
      if (error.agentRunId) await openAgentRun(error.agentRunId);
      else setAgentError({ code, message: error.message });
    } finally {
      setAgentWorking(false);
    }
  };

  const createInterviewSession = async () => {
    const application = applications.find((item) => item.id === Number(selectedApplicationId));
    if (!application || !selectedReport?.id || !["COMPLETED", "DEGRADED"].includes(selectedReport.status)) {
      setInterviewError({ code: "INTERVIEW_REPORT_NOT_READY", message: "请先打开一份已完成或降级可用的 AI 岗位匹配报告。" });
      return;
    }
    setInterviewWorking(true);
    setInterviewError(null);
    try {
      const request = interviewApiRequest("create", { applicationId: application.id, matchReportId: selectedReport.id });
      const data = await apiRequest(request.path, request.options);
      const session = data.item || null;
      setSelectedInterview(session);
      setInterviewFeedback({});
      setActiveInterviewQuestion(0);
      await loadInterviewSessions(String(application.id), { autoSelect: false });
      notify(session?.status === "DEGRADED" ? "模拟面试已创建，知识检索降级但仍可继续。" : "模拟面试已创建，题目已绑定当前简历版本与岗位报告。");
    } catch (error) {
      await loadInterviewSessions(String(application.id), { autoSelect: false });
      setInterviewError({ code: error.failureCode || "INTERVIEW_GENERATION_FAILED", message: error.message });
    } finally {
      setInterviewWorking(false);
    }
  };

  const submitInterviewAnswer = async (question, answerText) => {
    if (!selectedInterview || !question || !answerText.trim()) return;
    setInterviewWorking(true);
    setInterviewError(null);
    try {
      const request = interviewApiRequest("answer", { sessionId: selectedInterview.id, questionId: question.id, answerText: answerText.trim() });
      const data = await apiRequest(request.path, request.options);
      const nextSession = {
        ...selectedInterview,
        answeredCount: Number(selectedInterview.answeredCount || 0) + 1,
        questions: selectedInterview.questions.map((item) => item.id === question.id ? { ...item, answerId: data.item.id } : item),
      };
      setSelectedInterview(nextSession);
      setInterviewFeedback((current) => ({ ...current, [question.id]: { answer: data.item, feedback: data.feedback } }));
      await loadInterviewSessions(String(selectedInterview.jobApplicationId), { autoSelect: false });
      notify(data.feedback?.status === "DEGRADED" ? "本题反馈已保存，但知识依据处于降级状态。" : "本题回答与 AI 反馈已保存。");
    } catch (error) {
      await openInterviewSession(selectedInterview.id);
      setInterviewError({ code: error.failureCode || "FEEDBACK_GENERATION_FAILED", message: error.message });
    } finally {
      setInterviewWorking(false);
    }
  };

  const completeInterviewSession = async () => {
    if (!selectedInterview) return;
    setInterviewWorking(true);
    setInterviewError(null);
    try {
      const request = interviewApiRequest("complete", { sessionId: selectedInterview.id });
      const data = await apiRequest(request.path, request.options);
      setSelectedInterview(data.item || null);
      await loadInterviewSessions(String(selectedInterview.jobApplicationId), { autoSelect: false });
      notify("模拟面试已完成，最终成绩来自后端保存结果。");
    } catch (error) {
      setInterviewError({ code: error.failureCode || "INTERVIEW_SESSION_INCOMPLETE", message: error.message });
    } finally {
      setInterviewWorking(false);
    }
  };

  if (mode === "create") {
    return (
      <section className="job-page job-editor-page">
        <div className="job-page-head">
          <div><span className="section-kicker">{editingId ? "编辑岗位 JD" : "新建岗位 JD"}</span><h2>{editingId ? "更新真实招聘信息" : "保存真实招聘信息"}</h2><p>原始 JD 会被完整保留，AI 解析失败后也可以修改并重新解析。</p></div>
          <button className="white-small" onClick={() => { setEditingId(null); setMode("list"); }}>返回岗位列表</button>
        </div>
        <div className="job-editor-form">
          <label>岗位名称<input value={form.title} placeholder="例如：Java 后端开发工程师" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
          <label>公司名称<input value={form.companyName} placeholder="例如：灵犀科技" onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} /></label>
          <label className="job-form-wide">来源链接<input type="url" value={form.sourceUrl} placeholder="https://..." onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></label>
          <label className="job-form-wide">完整 JD 原文<textarea value={form.rawText} placeholder="粘贴职位职责、任职要求、加分项等完整招聘信息" onChange={(event) => setForm((current) => ({ ...current, rawText: event.target.value }))} /></label>
          <div className="job-editor-actions"><button className="black-small" disabled={working} onClick={saveJob}>{working ? "正在保存" : editingId ? "保存修改" : "保存岗位 JD"}</button></div>
        </div>
      </section>
    );
  }

  if (mode === "detail" && detail?.item) {
    const job = detail.item;
    const parsed = detail.currentParseResult?.parsedData;
    return (
      <section className="job-page job-detail-page">
        <div className="job-page-head">
          <div><span className="section-kicker">岗位详情</span><h2>{job.title}</h2><p>{job.companyName || "未填写公司名称"} · {job.parseStatus === "SUCCEEDED" ? "已完成结构化解析" : job.parseStatus === "FAILED" ? "上次解析失败" : "尚未解析"}</p></div>
          <div className="job-page-actions"><button className="white-small" onClick={() => setMode("list")}>岗位列表</button><button className="white-small" onClick={() => { setEditingId(job.id); setForm({ title: job.title || "", companyName: job.companyName || "", sourceUrl: job.sourceUrl || "", rawText: job.rawText || "" }); setMode("create"); }}>编辑 JD</button><button className="black-small" disabled={working} onClick={parseJob}>{working ? "AI 正在解析" : parsed ? "重新解析" : "开始 AI 解析"}</button></div>
        </div>
        <div className="job-detail-grid">
          <section className="job-source-panel"><h3>原始 JD</h3>{job.sourceUrl && <a href={job.sourceUrl} target="_blank" rel="noreferrer">打开来源链接</a>}<pre>{job.rawText}</pre>{job.lastParseError && <p className="job-error">上次失败：{job.lastParseError}</p>}</section>
          <section className="job-parse-panel">
            <h3>结构化解析</h3>
            {parsed ? <JobParseResult parsed={parsed} /> : <div className="job-empty"><strong>尚未生成解析结果</strong><p>先保存原始 JD，再使用 AI 提取职责、必需条件和加分项。</p></div>}
          </section>
        </div>
        <section className="job-application-panel">
          <div><h3>建立求职分析任务</h3><p>选择明确的简历版本；任务会锁定该快照与当前有效的 JD 解析结果。</p></div>
          <div className="job-application-controls"><select value={selectedResumeId} onChange={(event) => selectResume(event.target.value)}><option value="">选择简历</option>{resumes.map((resumeItem) => <option key={resumeItem.id} value={resumeItem.id}>{resumeItem.title || `简历 #${resumeItem.id}`}</option>)}</select><select value={selectedResumeVersionId} onChange={(event) => setSelectedResumeVersionId(event.target.value)} disabled={!selectedResumeId}><option value="">选择明确版本</option>{resumeVersions.map((version) => <option key={version.id} value={version.id}>v{version.resumeVersion || version.version} · {formatResumeDate(version.createdAt)}</option>)}</select><button className="black-small" disabled={working || !parsed || !selectedResumeId || !selectedResumeVersionId} onClick={createApplication}>创建分析任务</button></div>
          {activeResumeId && <button className="link-button" onClick={() => onOpenResume?.(activeResumeId)}>打开当前简历</button>}
          {!resumes.length && <button className="link-button" onClick={() => go?.("resume")}>先创建简历</button>}
          {selectedResumeId && !resumeVersions.length && <p className="job-error">该简历暂无可选版本，请先保存简历后再创建任务。</p>}
          {applications.length > 0 && <div className="job-application-list">{applications.map((item) => <button className={String(item.id) === String(selectedApplicationId) ? "active" : ""} key={item.id} onClick={() => selectApplication(String(item.id))}>简历 #{item.resumeId} · v{item.resumeVersion} · {item.status}{item.resumeVersionId ? "" : " · 旧任务不可匹配"}</button>)}</div>}
        </section>
        <section className="job-match-panel">
          <div className="job-match-head"><div><h3>基础岗位匹配</h3><p>{selectedApplicationId ? "基于已锁定的简历版本与 JD 解析结果生成，不会修改你的简历。" : "先创建并选择一个求职分析任务。"}</p></div><button className="black-small" disabled={working || !selectedApplicationId} onClick={() => createMatch()}>{working ? <><LoaderCircle className="spin" size={16} />正在生成报告</> : <><Gauge size={16} />生成匹配报告</>}</button></div>
          {working && <ResultSkeleton lines={5} />}
          {!working && selectedMatch?.status === "COMPLETED" && <ResumeJobMatchReport match={selectedMatch} />}
          {!working && (selectedMatch?.status === "FAILED" || matchFailureMessage) && <p className="job-error">本次匹配失败：{selectedMatch?.failureMessage || matchFailureMessage}</p>}
          {matches.length > 0 && <div className="job-match-history"><strong>匹配历史</strong>{matches.map((item) => <div key={item.id}><button className={selectedMatch?.id === item.id ? "active" : ""} onClick={() => item.status === "FAILED" ? (setMatchFailureMessage(""), setSelectedMatch(item)) : openMatch(item.id)}><span>{item.status === "COMPLETED" ? `${item.totalScore} 分` : item.status === "FAILED" ? "失败" : "处理中"}</span><small>{formatResumeDate(item.createdAt)}</small></button>{item.status === "FAILED" && <button className="link-button" onClick={() => createMatch(item.id)}>重试</button>}</div>)}</div>}
          {!working && !selectedMatch && !matches.length && <div className="job-empty"><strong>尚未生成匹配报告</strong><p>报告仅会在真实 AI 返回并通过证据校验后显示分数与建议。</p></div>}
        </section>
        <section className="grounded-report-panel" aria-labelledby="grounded-report-title">
          <div className="job-match-head">
            <div>
              <span className="section-kicker">可引用报告</span>
              <h3 id="grounded-report-title">AI 岗位匹配报告</h3>
              <p>{selectedApplicationId && selectedMatch?.status === "COMPLETED" ? `将基于简历 v${selectedMatch.resumeVersion}、当前 JD 与基础匹配 ${selectedMatch.totalScore} 分生成；不会修改简历。` : "请先选择一份已完成的基础岗位匹配报告。"}</p>
            </div>
            <button className="black-small" disabled={reportWorking || selectedReport?.status === "PENDING" || selectedMatch?.status !== "COMPLETED" || !selectedApplicationId} onClick={createGroundedReport}>
              {reportWorking ? <><LoaderCircle className="spin" size={16} />正在生成</> : <><Sparkles size={16} />生成 AI 岗位匹配报告</>}
            </button>
          </div>
          {reportWorking && <div className="grounded-report-loading" role="status" aria-live="polite"><strong>正在生成可引用报告</strong><p>正在检索并验证知识证据，请勿重复提交。</p><ResultSkeleton lines={5} /></div>}
          {!reportWorking && reportFailure && <GroundedReportFailure failure={reportFailure} onRetry={createGroundedReport} canRetry={selectedMatch?.status === "COMPLETED"} />}
          {!reportWorking && selectedReport?.status === "PENDING" && <div className="grounded-report-loading" role="status"><strong>报告处理中</strong><p>报告尚未完成，完成后可在历史版本中重新打开。</p><ResultSkeleton lines={4} /></div>}
          {!reportWorking && selectedReport?.status === "FAILED" && <GroundedReportFailure failure={{ code: selectedReport.failureCode, message: selectedReport.failureMessage }} onRetry={createGroundedReport} canRetry={selectedMatch?.status === "COMPLETED"} />}
          {!reportWorking && (selectedReport?.status === "COMPLETED" || selectedReport?.status === "DEGRADED") && <GroundedMatchReport report={selectedReport} match={selectedMatch} />}
          {!reportWorking && !selectedReport && !reportFailure && !reports.length && <div className="job-empty"><strong>尚未生成 AI 岗位匹配报告</strong><p>选择明确的求职分析任务与基础匹配报告后，再生成基于本地可验证引用的报告。</p></div>}
          {reports.length > 0 && <GroundedReportHistory reports={reports} selectedReportId={selectedReport?.id} onSelect={openGroundedReport} />}
        </section>
        <ResumeSuggestionWorkspace
          report={selectedReport}
          runs={suggestionRuns}
          selectedRun={selectedSuggestionRun}
          loading={suggestionLoading}
          working={suggestionWorking}
          error={suggestionError}
          success={suggestionSuccess}
          versions={resumeVersionHistory}
          versionLoading={versionHistoryLoading}
          versionError={versionHistoryError}
          selectedVersion={selectedVersionSnapshot}
          onGenerate={createResumeSuggestions}
          onSelectRun={openSuggestionRun}
          onDecision={decideSuggestion}
          onRefresh={() => selectedReport?.id && loadSuggestionRuns(selectedReport.id)}
          onSelectVersion={openResumeVersionSnapshot}
        />
        <AgentRunWorkspace
          applicationId={selectedApplicationId}
          report={selectedReport}
          runs={agentRuns}
          run={selectedAgentRun}
          steps={agentSteps}
          loading={agentLoading}
          working={agentWorking}
          error={agentError}
          onCreate={createAgentRun}
          onSelectRun={openAgentRun}
          onRefresh={() => selectedApplicationId && loadAgentRuns(selectedApplicationId)}
        />
        <MockInterviewWorkspace
          applicationId={selectedApplicationId}
          report={selectedReport}
          sessions={interviewSessions}
          session={selectedInterview}
          feedbackByQuestion={interviewFeedback}
          activeQuestionIndex={activeInterviewQuestion}
          loading={interviewLoading}
          working={interviewWorking}
          error={interviewError}
          onCreate={createInterviewSession}
          onSelectSession={openInterviewSession}
          onSelectQuestion={setActiveInterviewQuestion}
          onSubmitAnswer={submitInterviewAnswer}
          onComplete={completeInterviewSession}
          onRefresh={() => selectedApplicationId && loadInterviewSessions(selectedApplicationId)}
        />
      </section>
    );
  }

  return (
    <section className="job-page">
      <div className="job-page-head"><div><span className="section-kicker">岗位 JD</span><h2>针对真实招聘信息准备简历</h2><p>保存原文、解析明确要求，再与具体简历建立分析任务。</p></div><button className="black-small" onClick={() => { setEditingId(null); setForm({ title: "", companyName: "", sourceUrl: "", rawText: "" }); setMode("create"); }}>新建岗位 JD</button></div>
      {loading ? <ResultSkeleton lines={4} /> : jobs.length ? <div className="job-list">{jobs.map((job) => <button className="job-list-item" key={job.id} onClick={() => loadDetail(job.id)}><span>{job.parseStatus === "SUCCEEDED" ? "已解析" : job.parseStatus === "FAILED" ? "解析失败" : "待解析"}</span><strong>{job.title}</strong><small>{job.companyName || "未填写公司"} · 更新于 {formatResumeDate(job.updatedAt)}</small></button>)}</div> : <div className="job-empty"><strong>还没有岗位 JD</strong><p>粘贴第一份真实招聘信息，即可保存原文并生成结构化要求。</p><button className="black-small" onClick={() => setMode("create")}>新建岗位 JD</button></div>}
    </section>
  );
}

const reportFailureLabels = {
  REPORT_PROVIDER_NOT_CONFIGURED: "AI 服务尚未配置。",
  REPORT_PROVIDER_UNAVAILABLE: "AI 服务暂时不可用，请稍后重试。",
  REPORT_RETRIEVAL_FAILED: "知识检索失败，请稍后重试。",
  REPORT_NO_SUPPORTED_CLAIMS: "当前证据不足，无法生成可靠报告。",
  REPORT_CITATION_INVALID: "部分引用未通过验证，报告已降级。",
  REPORT_MATCH_NOT_COMPLETED: "基础岗位匹配尚未完成。",
  REPORT_INPUT_INVALID: "当前报告请求无效，请重新选择匹配记录。",
  REPORT_INVALID_RESPONSE: "AI 返回的报告格式无效，请重新生成。",
  REPORT_NO_KNOWLEDGE_EVIDENCE: "当前没有可用的知识证据，报告已降级。",
  REPORT_RETRIEVAL_DEGRADED: "部分知识检索不可用，报告已降级。",
};

const reportDimensionLabels = {
  required_skills: "必需技能",
  project_relevance: "项目相关性",
  keyword_coverage: "关键词覆盖",
  experience: "经验匹配",
  education: "教育背景",
  expression: "表达质量",
};

function reportFailureMessage(code) {
  return reportFailureLabels[code] || "报告暂时无法生成，请稍后重试。";
}

function reportStatusLabel(status) {
  return status === "COMPLETED" ? "已完成" : status === "DEGRADED" ? "已降级" : status === "FAILED" ? "生成失败" : "处理中";
}

function GroundedReportFailure({ failure, onRetry, canRetry }) {
  const code = failure?.code || "REPORT_RETRIEVAL_FAILED";
  return <div className="grounded-report-failure" role="alert"><div><strong>报告未能完整生成</strong><p>{reportFailureMessage(code)}</p><small>错误代码：{code}</small></div>{canRetry && <button className="white-small" onClick={onRetry}><RefreshCw size={15} />重新生成</button>}</div>;
}

function GroundedReportHistory({ reports, selectedReportId, onSelect }) {
  return <div className="grounded-report-history"><strong>报告历史版本</strong><div>{reports.map((report) => <button key={report.id} className={selectedReportId === report.id ? "active" : ""} onClick={() => onSelect(report.id)}><span><b>v{report.reportVersion}</b><em className={`report-status status-${String(report.status || "").toLowerCase()}`}>{reportStatusLabel(report.status)}</em></span><small>{formatResumeDate(report.createdAt)} · {report.model || "未记录模型"} · 证据覆盖 {formatEvidenceCoverage(report.evidenceCoverage)}</small></button>)}</div></div>;
}

function formatEvidenceCoverage(coverage) {
  if (!coverage || !Number.isFinite(Number(coverage.ratio))) return "--";
  return `${Math.round(Number(coverage.ratio) * 100)}%`;
}

function ResumeSuggestionWorkspace({ report, runs, selectedRun, loading, working, error, success, versions, versionLoading, versionError, selectedVersion, onGenerate, onSelectRun, onDecision, onRefresh, onSelectVersion }) {
  const [diffSuggestionId, setDiffSuggestionId] = useState(null);
  const canGenerate = ["COMPLETED", "DEGRADED"].includes(report?.status);

  useEffect(() => { setDiffSuggestionId(null); }, [selectedRun?.id]);

  return (
    <section className="resume-suggestion-panel" aria-labelledby="resume-suggestion-title">
      <div className="job-match-head">
        <div>
          <span className="section-kicker">简历优化建议</span>
          <h3 id="resume-suggestion-title">逐条确认，不会自动改写简历</h3>
          <p>{canGenerate ? `建议绑定报告 v${report.reportVersion} 与简历 v${report.resumeVersion}。接受前请核对每一处差异。` : "先打开一份已完成或已降级的 AI 岗位匹配报告，才能生成建议。"}</p>
        </div>
        <button className="black-small" disabled={working || !canGenerate} onClick={onGenerate}>
          {working ? <><LoaderCircle className="spin" size={16} />正在处理</> : <><Sparkles size={16} />生成简历优化建议</>}
        </button>
      </div>

      {success && <div className="suggestion-success" role="status">{success}</div>}
      {error && <div className="suggestion-error" role="alert"><div><strong>建议操作未完成</strong><p>{suggestionFailureMessage(error.code)}</p><small>错误代码：{error.code}</small></div><button className="white-small" onClick={onRefresh} disabled={loading || working}>刷新建议</button></div>}
      {loading && <div className="suggestion-loading" role="status"><strong>正在读取建议记录</strong><ResultSkeleton lines={4} /></div>}

      {!loading && canGenerate && !error && !runs.length && <div className="job-empty"><strong>尚未生成简历优化建议</strong><p>建议会以当前匹配报告和锁定简历版本为依据生成；不会自动应用。</p></div>}

      {!loading && runs.length > 0 && <div className="suggestion-run-history"><strong>Suggestion Run 历史</strong><div>{runs.map((run) => <button key={run.id} className={selectedRun?.id === run.id ? "active" : ""} onClick={() => onSelectRun(run.id)}><span><b>运行 #{run.id}</b><em className={`suggestion-status suggestion-run-${String(run.status || "").toLowerCase()}`}>{run.status === "COMPLETED" ? "已完成" : run.status === "FAILED" ? "生成失败" : "处理中"}</em></span><small>简历 v{run.baseResumeVersion} · {formatResumeDate(run.createdAt)} · {run.suggestions?.length || 0} 条建议</small></button>)}</div></div>}

      {!loading && selectedRun?.status === "PENDING" && <div className="suggestion-loading" role="status"><strong>建议处理中</strong><p>请勿重复提交，完成后可从本报告的历史结果重新打开。</p><ResultSkeleton lines={3} /></div>}
      {!loading && selectedRun?.status === "FAILED" && <div className="suggestion-error" role="alert"><div><strong>本次建议生成失败</strong><p>{suggestionFailureMessage(selectedRun.failureCode)}</p><small>错误代码：{selectedRun.failureCode || "SUGGESTION_INVALID_OUTPUT"}</small></div></div>}

      {!loading && selectedRun?.status === "COMPLETED" && <div className="suggestion-content">
        <div className="suggestion-run-summary"><span>本轮绑定简历版本 <b>v{selectedRun.baseResumeVersion}</b></span><span>生成于 {formatResumeDate(selectedRun.completedAt || selectedRun.createdAt)}</span></div>
        {!selectedRun.suggestions?.length && <div className="job-empty"><strong>本轮未返回可展示的建议</strong><p>系统没有将缺少安全校验的结果当作可应用修改。</p></div>}
        <div className="suggestion-list">{(selectedRun.suggestions || []).map((suggestion) => {
          const actions = suggestionActions(suggestion);
          const displayStatus = actions.factRequired ? "FACT_REQUIRED" : suggestion.status;
          const showDiff = diffSuggestionId === suggestion.id;
          return <article key={suggestion.id} className="suggestion-item">
            <header><div><strong>{suggestion.sectionType}</strong><small>{suggestion.suggestionType}</small></div><em className={`suggestion-status suggestion-${String(displayStatus || "").toLowerCase()}`}>{suggestionStatusLabel(displayStatus)}</em></header>
            <p className="suggestion-rationale">{suggestion.rationale}</p>
            {actions.factRequired ? <div className="fact-required-note"><strong>需要补充真实信息</strong><p>该建议需要你补充真实信息后才能应用。</p></div> : <>
              <dl className="suggestion-before-after"><div><dt>修改前</dt><dd>{suggestion.before || "—"}</dd></div><div><dt>修改后</dt><dd>{suggestion.after || "—"}</dd></div></dl>
              {actions.invalidated && <p className="suggestion-invalidated">该建议已失效：同一轮中已有建议被接受并生成新简历版本，原基础版本不再可安全应用。</p>}
              <div className="suggestion-actions">
                {actions.canPreview && <button className="white-small" onClick={() => setDiffSuggestionId(showDiff ? null : suggestion.id)}>{showDiff ? "收起差异" : "查看差异"}</button>}
                {actions.canAccept && <button className="black-small" disabled={working} onClick={() => onDecision(suggestion, "accept")}>{working ? "处理中" : "接受并生成新版本"}</button>}
                {actions.canReject && <button className="link-button" disabled={working} onClick={() => onDecision(suggestion, "reject")}>拒绝</button>}
              </div>
              {showDiff && <SuggestionDiff before={suggestion.before} after={suggestion.after} />}
            </>}
          </article>;
        })}</div>
      </div>}

      <ResumeVersionHistoryPanel versions={versions} loading={versionLoading} error={versionError} selectedVersion={selectedVersion} onSelect={onSelectVersion} />
    </section>
  );
}

function SuggestionDiff({ before, after }) {
  const parts = buildSuggestionDiff(before, after);
  return <section className="suggestion-diff" aria-label="修改差异预览"><h4>差异预览</h4><p><span className="diff-legend diff-removed">删除</span><span className="diff-legend diff-added">新增</span></p><pre>{parts.map((part, index) => <span className={`diff-${part.type}`} key={`${part.type}-${index}`}>{part.text}</span>)}</pre></section>;
}

export function MockInterviewWorkspace({
  applicationId,
  report,
  sessions = [],
  session,
  feedbackByQuestion = {},
  activeQuestionIndex = 0,
  loading = false,
  working = false,
  error = null,
  onCreate,
  onSelectSession,
  onSelectQuestion,
  onSubmitAnswer,
  onComplete,
  onRefresh,
}) {
  const [answerDraft, setAnswerDraft] = useState("");
  const [showSources, setShowSources] = useState(false);
  const questions = session?.questions || [];
  const currentQuestion = questions[activeQuestionIndex] || questions[0] || null;
  const currentRecord = currentQuestion ? feedbackByQuestion[currentQuestion.id] : null;
  const currentFeedback = currentRecord?.feedback || null;
  const currentAnswer = currentRecord?.answer || null;
  const firstUnansweredIndex = questions.findIndex((question) => !question.answerId);
  const allAnswered = questions.length > 0 && questions.every((question) => question.answerId);
  const allFeedbackReady = allAnswered && questions.every((question) => ["COMPLETED", "DEGRADED"].includes(feedbackByQuestion[question.id]?.feedback?.status));
  const isCompleted = Boolean(session?.completedAt) || session?.status === "COMPLETED";
  const safeSources = safeKnowledgeSources([
    ...(currentQuestion?.sourceRefs || []),
    ...(currentFeedback?.sourceRefs || []),
    ...(currentFeedback?.strengths || []).flatMap((item) => item.sourceRefs || []),
    ...(currentFeedback?.weaknesses || []).flatMap((item) => item.sourceRefs || []),
    ...(currentFeedback?.missingPoints || []).flatMap((item) => item.sourceRefs || []),
  ]).filter((source, index, items) => items.findIndex((item) => item.title === source.title && item.summary === source.summary) === index);

  useEffect(() => {
    setAnswerDraft("");
    setShowSources(false);
  }, [session?.id, currentQuestion?.id]);

  const nextQuestion = () => {
    const nextIndex = questions.findIndex((question, index) => index > activeQuestionIndex && !question.answerId);
    if (nextIndex >= 0) onSelectQuestion?.(nextIndex);
  };

  return (
    <section className="mock-interview-panel" aria-labelledby="mock-interview-title">
      <div className="job-match-head">
        <div>
          <span className="section-kicker">RAG 模拟面试</span>
          <h3 id="mock-interview-title">围绕岗位报告逐题练习</h3>
          <p>{applicationId ? "题目绑定当前求职任务的简历版本、JD、匹配缺口与知识检索结果；刷新后可从后端恢复。" : "请先选择一个求职分析任务。"}</p>
        </div>
        <button className="black-small" disabled={working || loading || !applicationId || !["COMPLETED", "DEGRADED"].includes(report?.status)} onClick={onCreate}>
          {working && !session ? <LoaderCircle className="spin" size={16} /> : <MessageSquareText size={16} />}
          {working && !session ? "正在生成题目" : "开始新的模拟面试"}
        </button>
      </div>

      {error && <div className="interview-state-error" role="alert"><div><strong>面试操作未完成</strong><p>{interviewFailureMessage(error.code, error.message)}</p>{error.code && <small>错误代码：{error.code}</small>}</div><button className="white-small" disabled={loading || working} onClick={onRefresh}>从后端刷新</button></div>}
      {loading && <div className="interview-state-loading" role="status"><strong>正在恢复面试记录</strong><ResultSkeleton lines={4} /></div>}

      {!loading && sessions.length > 0 && <div className="interview-session-history"><strong>当前求职任务的历史面试</strong><div>{sessions.map((item) => <button key={item.id} className={session?.id === item.id ? "active" : ""} onClick={() => onSelectSession?.(item.id)}><span><b>面试 #{item.id}</b><em className={`interview-status status-${String(item.status || "pending").toLowerCase()}`}>{interviewStatusLabel(item.status)}</em></span><small>简历 v{item.resumeVersion} · {item.answeredCount || 0}/{item.questionCount || 0} 题 · {formatResumeDate(item.createdAt)}</small></button>)}</div></div>}

      {!loading && !session && !sessions.length && <div className="job-empty"><strong>尚未开始岗位模拟面试</strong><p>{["COMPLETED", "DEGRADED"].includes(report?.status) ? "从当前 AI 岗位匹配报告生成第一组可追溯题目。" : "先完成并打开一份 AI 岗位匹配报告，才可生成面试题。"}</p></div>}

      {!loading && session && <div className="interview-session-shell">
        <header className="interview-session-summary">
          <div><span className={`interview-status status-${String(session.status || "pending").toLowerCase()}`}>{interviewStatusLabel(session.status)}</span><strong>面试 #{session.id}</strong><small>锁定简历 v{session.resumeVersion} · {session.answeredCount || 0}/{session.questionCount || questions.length} 题</small></div>
          {session.status === "DEGRADED" && <p role="status">知识检索或反馈依据处于降级状态；已保存的可用题目仍可继续，来源状态会明确标注。</p>}
          {session.status === "FAILED" && <p role="alert">本次题目生成失败，系统没有把失败结果显示为正常面试。{session.failureCode ? ` 错误代码：${session.failureCode}` : ""}</p>}
        </header>

        {session.status !== "FAILED" && questions.length > 0 && <div className="interview-workspace">
          <nav aria-label="面试题目进度">
            {questions.map((question, index) => {
              const feedbackStatus = feedbackByQuestion[question.id]?.feedback?.status;
              const canOpen = isCompleted || question.answerId || firstUnansweredIndex < 0 || index <= firstUnansweredIndex;
              return <button key={question.id} className={index === activeQuestionIndex ? "active" : ""} disabled={!canOpen} onClick={() => onSelectQuestion?.(index)}><span>{index + 1}</span><div><strong>{interviewCategoryLabel(question.category)}</strong><small>{question.answerId ? feedbackStatus === "FAILED" ? "反馈失败" : "已回答" : "待回答"}</small></div></button>;
            })}
          </nav>

          <div className="interview-question-column">
            <article className="interview-question-detail">
              <header><span>{interviewCategoryLabel(currentQuestion?.category)}</span><span>{interviewDifficultyLabel(currentQuestion?.difficulty)}</span></header>
              <h4>{currentQuestion?.question}</h4>
              <div className="interview-rationale"><strong>为什么问这题</strong><p>{currentQuestion?.rationale}</p><small>来源类型：{interviewCategoryLabel(currentQuestion?.category)}</small></div>
            </article>

            <div className="interview-answer-area">
              <label htmlFor={`interview-answer-${currentQuestion?.id}`}>你的回答</label>
              {currentAnswer ? <p className="saved-interview-answer">{currentAnswer.answerText}</p> : <textarea id={`interview-answer-${currentQuestion?.id}`} value={answerDraft} maxLength={12000} disabled={working || Boolean(currentQuestion?.answerId) || isCompleted} placeholder="结合真实经历或说明你的分析思路；不确定的经历不要编造。" onChange={(event) => setAnswerDraft(event.target.value)} />}
              {!currentQuestion?.answerId && !isCompleted && <div className="interview-answer-actions"><small>{answerDraft.length}/12000</small><button className="black-small" disabled={working || !answerDraft.trim()} onClick={() => onSubmitAnswer?.(currentQuestion, answerDraft)}>{working ? <><LoaderCircle className="spin" size={16} />AI 正在评估</> : <><Send size={16} />提交本题回答</>}</button></div>}
              {currentQuestion?.answerId && !currentRecord && <p className="interview-inline-note">回答已保存，正在从后端恢复反馈。</p>}
            </div>
          </div>

          <aside className="interview-feedback-column" aria-live="polite">
            {!currentFeedback && !currentQuestion?.answerId && <div className="interview-feedback-empty"><Bot size={20} /><strong>提交后查看 AI 反馈</strong><p>评分依据包括问题、你的回答、预期要点与可用 RAG 证据。</p></div>}
            {currentRecord?.error && <div className="interview-feedback-failed" role="alert"><strong>反馈读取失败</strong><p>{interviewFailureMessage(currentRecord.error.code, currentRecord.error.message)}</p></div>}
            {currentFeedback?.status === "FAILED" && <div className="interview-feedback-failed" role="alert"><strong>本题反馈未通过校验</strong><p>{interviewFailureMessage(currentFeedback.failureCode, currentFeedback.failureMessage)}</p><small>失败内容不会作为建议回答展示。</small></div>}
            {currentFeedback && ["COMPLETED", "DEGRADED"].includes(currentFeedback.status) && <div className="interview-feedback-content">
              <header><div><strong>{currentFeedback.score}</strong><span>本题得分</span></div><span className={`interview-status status-${String(currentFeedback.status).toLowerCase()}`}>{interviewStatusLabel(currentFeedback.status)}</span></header>
              <FeedbackList title="表达优势（AI 反馈）" items={currentFeedback.strengths} />
              <FeedbackList title="可改进处（AI 反馈）" items={currentFeedback.weaknesses} />
              <FeedbackList title="遗漏要点（AI 反馈）" items={currentFeedback.missingPoints} />
              <section className="suggested-answer"><div><strong>建议回答</strong><span>不会写回简历</span></div><p>{currentFeedback.improvedAnswer}</p><small>这是基于锁定简历版本与本题回答整理的表达建议，不代表新增或已验证的用户经历。</small></section>
              {currentFeedback.followUpQuestion && <section className="follow-up-question"><strong>可继续追问</strong><p>{currentFeedback.followUpQuestion}</p></section>}
              {safeSources.length > 0 && <section className="interview-source-viewer"><button className="white-small" onClick={() => setShowSources((current) => !current)}>{showSources ? "收起知识来源" : `查看知识来源（${safeSources.length}）`}</button>{showSources && <div>{safeSources.map((source, index) => <article key={`${source.title}-${index}`}><header><strong>{source.title}</strong><span>{source.sourceType} · {source.availability === "AVAILABLE" ? "可用" : "当前不可用"}</span></header><p>{source.summary || "该来源未提供可展示摘要。"}</p></article>)}</div>}</section>}
              {!isCompleted && !allAnswered && <button className="black-small" onClick={nextQuestion}>下一题</button>}
            </div>}
          </aside>
        </div>}

        {!isCompleted && allFeedbackReady && <div className="interview-complete-action"><div><strong>所有题目均已取得有效反馈</strong><p>完成后由后端汇总并保存最终平均分。</p></div><button className="black-small" disabled={working} onClick={onComplete}>{working ? "正在完成" : "完成本次面试"}</button></div>}
        {isCompleted && <InterviewCompletionSummary session={session} questions={questions} feedbackByQuestion={feedbackByQuestion} onSelectQuestion={onSelectQuestion} />}
      </div>}
    </section>
  );
}

function FeedbackList({ title, items = [] }) {
  const values = feedbackTextItems(items);
  return <section className="interview-feedback-list"><strong>{title}</strong>{values.length ? <ul>{values.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>本题暂无该项反馈。</p>}</section>;
}

function InterviewCompletionSummary({ session, questions, feedbackByQuestion, onSelectQuestion }) {
  const strengths = feedbackTextItems(questions.flatMap((question) => feedbackByQuestion[question.id]?.feedback?.strengths || [])).slice(0, 4);
  const weaknesses = feedbackTextItems(questions.flatMap((question) => feedbackByQuestion[question.id]?.feedback?.weaknesses || [])).slice(0, 4);
  return <section className="interview-completion" aria-labelledby="interview-completion-title"><div className="interview-completion-score"><span>后端最终平均分</span><strong>{Number.isFinite(Number(session.averageScore)) ? session.averageScore : "--"}</strong><small id="interview-completion-title">本次模拟面试已保存，可从历史记录恢复回看。</small></div><div className="interview-completion-summary"><FeedbackList title="本次优势摘要（AI 反馈）" items={strengths} /><FeedbackList title="本次改进摘要（AI 反馈）" items={weaknesses} /></div><div className="interview-score-list">{questions.map((question, index) => <button key={question.id} onClick={() => onSelectQuestion?.(index)}><span>第 {index + 1} 题 · {interviewCategoryLabel(question.category)}</span><strong>{feedbackByQuestion[question.id]?.feedback?.score ?? "--"} 分</strong></button>)}</div></section>;
}

function AgentRunWorkspace({ applicationId, report, runs = [], run, steps = [], loading, working, error, onCreate, onSelectRun, onRefresh }) {
  const canCreate = Boolean(applicationId) && ["COMPLETED", "DEGRADED"].includes(report?.status);
  const canShowResult = ["COMPLETED", "DEGRADED"].includes(run?.status) && run?.finalResult;

  return (
    <section className="agent-run-panel" aria-labelledby="agent-run-title">
      <div className="job-match-head agent-run-head">
        <div>
          <h3 id="agent-run-title">Agent 证据分析</h3>
          <p>基于锁定简历、岗位、匹配报告与知识证据规划下一步。全程只读，不会修改简历或自动执行建议。</p>
        </div>
        <div className="agent-run-actions">
          <button className="white-small" disabled={loading || working || !applicationId} onClick={onRefresh}><RefreshCw size={15} />刷新状态</button>
          <button className="black-small" disabled={working || !canCreate} onClick={onCreate}>{working ? <><LoaderCircle className="spin" size={16} />Agent 正在分析</> : <><Bot size={16} />启动 Agent 分析</>}</button>
        </div>
      </div>

      {!canCreate && <div className="agent-empty"><strong>等待可用的岗位匹配报告</strong><p>先选择一份已完成或降级可用的 AI 岗位匹配报告，再启动只读 Agent 分析。</p></div>}
      {loading && <div className="agent-loading" role="status" aria-live="polite"><strong>正在从后端恢复 AgentRun</strong><p>运行状态、步骤与来源均以后端保存记录为准。</p><ResultSkeleton lines={4} /></div>}
      {!loading && error && <div className="agent-error" role="alert"><div><strong>Agent 记录读取或执行失败</strong><p>{agentFailureMessage(error.code)}</p><small>错误代码：{error.code}</small></div><button className="white-small" onClick={onRefresh}>重新读取</button></div>}

      {!loading && runs.length > 0 && <div className="agent-run-history"><strong>历史 AgentRun</strong><div>{runs.map((item) => <button key={item.id} className={run?.id === item.id ? "active" : ""} aria-pressed={run?.id === item.id} onClick={() => onSelectRun(item.id)}><span><b>Run #{item.id}</b><em className={`agent-status status-${String(item.status || "").toLowerCase()}`}>{agentStatusLabel(item.status)}</em></span><small>简历 v{item.resumeVersion} · {formatResumeDate(item.createdAt)}</small></button>)}</div></div>}

      {!loading && canCreate && !runs.length && !run && !error && <div className="agent-empty"><Search size={20} /><strong>尚未开始 Agent 分析</strong><p>启动后可回看每一步行动、检索来源与最终建议；刷新页面也能恢复记录。</p></div>}

      {!loading && run && <div className="agent-run-detail">
        <header className="agent-run-summary">
          <div><span className={`agent-status status-${String(run.status || "").toLowerCase()}`}>{agentStatusLabel(run.status)}</span><strong>Run #{run.id}</strong></div>
          <dl><div><dt>锁定简历</dt><dd>v{run.resumeVersion}</dd></div><div><dt>执行进度</dt><dd>{run.currentStep || 0} / {run.maxSteps || "--"}</dd></div><div><dt>开始时间</dt><dd>{formatResumeDate(run.createdAt)}</dd></div><div><dt>完成时间</dt><dd>{run.completedAt ? formatResumeDate(run.completedAt) : "尚未完成"}</dd></div></dl>
        </header>

        {["PENDING", "RUNNING"].includes(run.status) && <div className="agent-active-state" role="status"><LoaderCircle className="spin" size={18} /><div><strong>{run.status === "PENDING" ? "AgentRun 等待开始" : "Agent 正在执行有界分析"}</strong><p>刷新后会从后端恢复最新状态，页面不会自行选择或执行工具。</p></div></div>}
        {run.status === "STOPPED_LIMIT" && <div className="agent-limit-state" role="status"><strong>Agent 已达到服务器允许的最大步骤数并停止。</strong><p>这是独立的安全停止状态，不表示失败或已完成最终计划。</p></div>}
        {run.status === "DEGRADED" && <div className="agent-degraded-state" role="status"><strong>部分检索或步骤已降级</strong><p>剩余有效证据与最终结果仍可查看；降级内容不会被伪装为完整成功。</p></div>}
        {run.status === "FAILED" && <div className="agent-failed-state" role="alert"><strong>本次 Agent 分析失败</strong><p>{agentFailureMessage(run.failureCode)}</p><small>失败运行不会展示为成功计划。</small></div>}

        <AgentStepTimeline steps={steps} />
        {canShowResult && <AgentFinalResult result={run.finalResult} />}
        {["COMPLETED", "DEGRADED"].includes(run.status) && !run.finalResult && <div className="agent-empty"><strong>暂无可展示的最终计划</strong><p>后端没有保存通过校验的 finalResult，页面不会补造成功内容。</p></div>}
      </div>}
    </section>
  );
}

function AgentStepTimeline({ steps = [] }) {
  return <section className="agent-timeline" aria-labelledby="agent-timeline-title"><div><h4 id="agent-timeline-title">步骤时间线</h4><p>仅展示审计记录中的安全摘要，不显示内部提示词或工具定义。</p></div>{!steps.length ? <div className="agent-empty compact"><strong>暂无步骤记录</strong><p>运行开始后，后端会按顺序保存每一步。</p></div> : <ol>{steps.map((step) => <AgentStepItem key={step.id || step.stepIndex} step={step} />)}</ol>}</section>;
}

function AgentStepItem({ step }) {
  const summary = safeAgentStepSummary(step);
  const sources = safeRetrievalSources(step);
  const retrievalLabel = step.actionType === "RETRIEVE_KNOWLEDGE" ? step.status === "DEGRADED" ? "检索降级" : step.retrievalRunId ? "检索已记录" : "未记录检索" : null;
  return <li className={`agent-step step-${String(step.status || "").toLowerCase()}`}><span className="agent-step-index">{step.stepIndex}</span><article><header><div><strong>{agentActionLabel(step.actionType)}</strong>{retrievalLabel && <em>{retrievalLabel}</em>}</div><span className={`agent-status status-${String(step.status || "").toLowerCase()}`}>{agentStatusLabel(step.status)}</span></header><p className="agent-step-reason">{step.reason || "该步骤未保存可展示的原因说明。"}</p><div className="agent-step-times"><span>开始 {formatResumeDate(step.startedAt)}</span><span>{step.completedAt ? `完成 ${formatResumeDate(step.completedAt)}` : "尚未完成"}</span></div>{(summary.input.length > 0 || summary.output.length > 0) && <div className="agent-step-safe-summary">{summary.input.length > 0 && <AgentSummaryRows title="安全输入摘要" rows={summary.input} />}{summary.output.length > 0 && <AgentSummaryRows title="安全输出摘要" rows={summary.output} />}</div>}{step.actionType === "RETRIEVE_KNOWLEDGE" && <details className="agent-sources"><summary>查看检索来源（{sources.length}）</summary>{sources.length ? <div>{sources.map((source, index) => <article key={`${source.title}-${index}`}><header><strong>{source.title}</strong><span>{source.sourceType} · {source.availability === "AVAILABLE" ? "可用" : "当前不可用"}</span></header><p>{source.summary || "该来源未提供可展示摘要。"}</p></article>)}</div> : <p>本步骤没有可安全展示的知识来源。</p>}</details>}</article></li>;
}

function AgentSummaryRows({ title, rows }) {
  return <dl><dt>{title}</dt>{rows.map((row) => <div key={`${title}-${row.label}`}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>;
}

function AgentFinalResult({ result }) {
  return <section className="agent-final-result" aria-labelledby="agent-final-title"><div><h4 id="agent-final-title">最终计划与建议</h4><p>四类内容保持事实边界，不会写回简历或自动执行。</p></div><div className="agent-result-grid">{Object.entries(agentResultTypes).map(([type, meta]) => <section className={`agent-result-card result-${type.toLowerCase()}`} key={type}><header><strong>{meta.label}</strong><span>{meta.note}</span></header>{(result?.[type] || []).length ? <ul>{result[type].map((item, index) => <li key={`${type}-${index}`}><p>{item.text}</p><small>已绑定 {item.sourceRefs?.length || 0} 条后端验证来源</small></li>)}</ul> : <p className="agent-result-empty">本类暂无通过校验的内容。</p>}</section>)}</div></section>;
}

function ResumeVersionHistoryPanel({ versions, loading, error, selectedVersion, onSelect }) {
  return <section className="resume-version-history" aria-labelledby="resume-version-history-title"><div><h4 id="resume-version-history-title">简历版本历史（只读）</h4><p>查看由接受建议生成的版本及原始快照；此处不能回写或覆盖内容。</p></div>{loading && <ResultSkeleton lines={2} />}{error && <p className="job-error">{error}</p>}{!loading && !error && !versions.length && <p className="grounded-empty-claims">暂无可读取的版本历史。</p>}{!loading && versions.length > 0 && <div className="resume-version-list">{versions.map((version) => <button key={version.id} className={selectedVersion?.id === version.id ? "active" : ""} onClick={() => onSelect(version.resumeId, version.id)}><span><b>v{version.resumeVersion || version.version}</b><small>{formatResumeDate(version.createdAt)}</small></span><em>{versionSourceLabel(version)}</em></button>)}</div>}{selectedVersion?.snapshot && <div className="resume-version-snapshot"><div><strong>v{selectedVersion.resumeVersion || selectedVersion.version} 内容快照</strong><small>{selectedVersion.summary || "历史版本"}</small></div><pre>{JSON.stringify(selectedVersion.snapshot, null, 2)}</pre></div>}</section>;
}

export { AgentRunWorkspace, AgentStepTimeline, AgentFinalResult, ResumeSuggestionWorkspace, SuggestionDiff, ResumeVersionHistoryPanel };

function GroundedMatchReport({ report, match }) {
  const [citation, setCitation] = useState(null);
  const content = report.content;
  if (!content) return null;
  const claims = content.claims || [];
  const claimsFor = (sectionKey) => claims.filter((claim) => claim.sectionKey === sectionKey);
  const baseDimensions = match?.report?.dimensions || [];
  return <div className="grounded-match-report">
    <div className="grounded-report-overview">
      <div><span className={`report-status status-${report.status.toLowerCase()}`}>{reportStatusLabel(report.status)}</span><strong>{Number.isFinite(Number(match?.totalScore)) ? `${match.totalScore} 分` : "--"}</strong><small>基础匹配分</small></div>
      <dl><div><dt>简历版本</dt><dd>v{report.resumeVersion}</dd></div><div><dt>报告版本</dt><dd>v{report.reportVersion}</dd></div><div><dt>岗位 / JD</dt><dd>已锁定</dd></div><div><dt>生成时间</dt><dd>{formatResumeDate(report.completedAt || report.createdAt)}</dd></div><div><dt>证据覆盖</dt><dd>{formatEvidenceCoverage(report.evidenceCoverage)}</dd></div></dl>
    </div>
    {report.status === "DEGRADED" && <div className="grounded-report-degraded" role="status"><strong>部分知识证据不可用</strong><p>报告仅保留已通过验证的内容；未通过验证的知识主张不会显示为事实。</p></div>}
    <section className="grounded-summary"><h4>综合结论</h4><p>{content.executiveSummary}</p></section>
    <section className="grounded-dimensions"><h4>六维分析</h4><div>{(content.dimensionReports || []).map((dimension) => {
      const base = baseDimensions.find((item) => item.key === dimension.key);
      const dimensionClaims = claimsFor(dimension.key);
      return <article key={dimension.key}><header><div><strong>{reportDimensionLabels[dimension.key] || dimension.key}</strong>{base && <small>基础匹配 {base.score} 分 · 权重 {base.weight}%</small>}</div></header><p>{dimension.summary}</p>{base?.summary && <small className="grounded-base-summary">基础匹配情况：{base.summary}</small>}<ClaimList claims={dimensionClaims} onCitation={setCitation} /></article>;
    })}</div></section>
    <section className="grounded-list-grid"><GroundedTextList title="优势" items={content.strengths} claims={claimsFor("strengths")} onCitation={setCitation} /><GroundedTextList title="差距" items={content.gaps} claims={claimsFor("gaps")} onCitation={setCitation} /><GroundedTextList title="建议" items={content.recommendations} claims={claimsFor("recommendations")} onCitation={setCitation} /></section>
    <section className="grounded-claims"><h4>报告依据</h4><ClaimList claims={claims.filter((claim) => !["strengths", "gaps", "recommendations", ...(content.dimensionReports || []).map((item) => item.key)].includes(claim.sectionKey))} onCitation={setCitation} emptyLabel="本报告未提供额外主张。" /></section>
    <CitationDrawer citation={citation} onClose={() => setCitation(null)} />
  </div>;
}

function GroundedTextList({ title, items = [], claims = [], onCitation }) {
  return <section><h4>{title}</h4>{items?.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul> : <p>暂无可展示内容。</p>}<ClaimList claims={claims} onCitation={onCitation} /></section>;
}

function ClaimList({ claims = [], onCitation, emptyLabel = "" }) {
  if (!claims.length) return emptyLabel ? <p className="grounded-empty-claims">{emptyLabel}</p> : null;
  return <div className="grounded-claim-list">{claims.map((claim) => {
    const type = claim.claimType;
    const label = type === "BASE_MATCH_FACT" ? "来自简历/JD 的事实" : type === "KNOWLEDGE_CLAIM" ? "来自知识资料" : "AI 建议";
    const citations = claim.citations || [];
    return <article key={claim.claimId}><span className={`claim-type claim-${String(type || "").toLowerCase()}`}>{label}</span><p>{claim.text}</p>{type === "BASE_MATCH_FACT" && claim.baseEvidence?.length > 0 && <small>依据：{claim.baseEvidence.join("；")}</small>}{type === "KNOWLEDGE_CLAIM" && citations.length > 0 && <button className="citation-link" onClick={() => onCitation(citations[0])}>查看引用 {citations.length > 1 ? `(${citations.length})` : ""}</button>}</article>;
  })}</div>;
}

function CitationDrawer({ citation, onClose }) {
  useEffect(() => {
    if (!citation) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [citation, onClose]);
  if (!citation) return null;
  const available = citation.availability === "AVAILABLE";
  const heading = Array.isArray(citation.headingPath) ? citation.headingPath.filter(Boolean).join(" / ") : "";
  const metadata = [citation.documentType, citation.jobFamily, citation.seniority, ...(citation.skillTags || [])].filter(Boolean);
  return <div className="citation-drawer-backdrop" role="presentation" onMouseDown={onClose}><aside className="citation-drawer" role="dialog" aria-modal="true" aria-labelledby="citation-drawer-title" onMouseDown={(event) => event.stopPropagation()}><header><div><span className="section-kicker">知识引用</span><h3 id="citation-drawer-title">{citation.sourceTitle || "知识资料"}</h3></div><button className="plain-icon" aria-label="关闭引用抽屉" title="关闭" onClick={onClose}><X size={19} /></button></header><span className={`citation-availability ${available ? "is-available" : "is-unavailable"}`}>{available ? "来源当前可用" : "该来源生成报告时有效，目前已不可用。"}</span><blockquote>“{citation.quote}”</blockquote><dl>{heading && <div><dt>章节</dt><dd>{heading}</dd></div>}{metadata.length > 0 && <div><dt>资料信息</dt><dd>{metadata.join(" · ")}</dd></div>}{citation.language && <div><dt>语言</dt><dd>{citation.language}</dd></div>}</dl></aside></div>;
}

function ResumeJobMatchReport({ match }) {
  const report = match.report;
  if (!report) return null;
  return <div className="job-match-report"><div className="job-match-score"><strong>{match.totalScore}</strong><span>综合匹配度</span></div><div><h4>匹配结论</h4><p>{report.summary}</p></div><div className="job-match-dimensions">{(report.dimensions || []).map((dimension) => <article key={dimension.key}><div><strong>{dimension.label}</strong><span>{dimension.score} 分 · 权重 {dimension.weight}%</span></div><i><b style={{ "--match-score": `${dimension.score}%` }} /></i><p>{dimension.summary}</p>{dimension.resumeEvidence?.length > 0 && <small>简历证据：{dimension.resumeEvidence.join("；")}</small>}{dimension.jdEvidence?.length > 0 && <small>JD 证据：{dimension.jdEvidence.join("；")}</small>}{dimension.missingEvidence?.length > 0 && <small>缺失：{dimension.missingEvidence.join("；")}</small>}</article>)}</div><div className="job-match-evidence"><MatchEvidenceGroup title="已证实必备项" items={report.matchedRequiredSkills} /><MatchEvidenceGroup title="部分匹配" items={report.partiallyMatchedRequiredSkills} /><MatchEvidenceGroup title="当前简历未找到的必备项" items={report.missingRequiredSkills} /><MatchEvidenceGroup title="已覆盖加分项" items={report.matchedPreferredSkills} /><MatchEvidenceGroup title="未覆盖加分项" items={report.missingPreferredSkills} /><MatchEvidenceGroup title="关键词覆盖" items={report.matchedKeywords} /></div><div className="job-match-suggestions"><div><h4>最有力的简历证据</h4><ul>{report.strongestResumeEvidence?.map((item) => <li key={item}>{item}</li>)}</ul></div><div><h4>优先修改建议</h4><ul>{report.prioritizedSuggestions?.map((item) => <li key={item}>{item}</li>)}</ul></div></div></div>;
}

function MatchEvidenceGroup({ title, items = [] }) {
  return <section><h4>{title}</h4>{items.length ? <ul>{items.map((item, index) => <li key={`${item.skillName}-${index}`}><strong>{item.skillName || "--"}</strong><small className="match-evidence-meta">状态：{item.matchStatus || "--"} · 置信度：{Number.isFinite(item.confidence) ? `${item.confidence}%` : "--"}</small><span>{item.explanation || "--"}</span>{item.resumeEvidence?.length > 0 && <small>简历：{item.resumeEvidence.join("；")}</small>}{item.jdEvidence?.length > 0 && <small>JD：{item.jdEvidence.join("；")}</small>}</li>)}</ul> : <p>暂无相关项</p>}</section>;
}

function JobParseResult({ parsed }) {
  const groups = [
    ["岗位名称", [parsed.jobTitle]], ["公司名称", [parsed.companyName]], ["职责", parsed.responsibilities], ["必需技能", parsed.requiredSkills], ["加分技能", parsed.preferredSkills], ["学历要求", parsed.educationRequirements], ["经验要求", parsed.experienceRequirements], ["技术关键词", parsed.technicalKeywords], ["软技能", parsed.softSkills], ["级别", [parsed.seniority]], ["不确定项", parsed.uncertainties],
  ];
  return <div className="job-parse-groups">{groups.map(([label, items]) => <section key={label}><h4>{label}</h4>{items?.length ? <ul>{items.map((item, index) => <li key={`${label}-${index}`}><strong>{item.text}</strong>{item.evidence && <small>原文：{item.evidence}</small>}</li>)}</ul> : <p>JD 未明确说明</p>}</section>)}</div>;
}

function ProviderSettings({ notify }) {
  const [selectedProvider, setSelectedProvider] = useState("DeepSeek");
  const [activeProvider, setActiveProvider] = useState("DeepSeek");
  const [providerConfigs, setProviderConfigs] = useState(providerDefaults);
  const [apiKey, setApiKey] = useState("");
  const provider = providers.find((item) => item.name === selectedProvider) || providers[0];
  const config = providerConfigs[selectedProvider] || providerDefaults[selectedProvider];

  useEffect(() => {
    if (!hasActiveSession()) return undefined;
    apiRequest("/api/ai-config")
      .then((data) => {
        const config = data.item || {};
        setSelectedProvider(config.activeProvider || config.provider || "DeepSeek");
        setActiveProvider(config.activeProvider || config.provider || "DeepSeek");
        setProviderConfigs((current) => ({ ...current, ...(config.providerConfigs || {}) }));
      })
      .catch((error) => notify(`读取 AI 配置失败: ${error.message}`));
  }, []);

  const saveConfig = async () => {
    try {
      const data = await apiRequest("/api/ai-config", {
        method: "PUT",
        body: JSON.stringify({
          provider: selectedProvider,
          baseUrl: config.baseUrl,
          modelId: config.modelId,
          apiKey,
          enabled: config.enabled,
        }),
      });
      setApiKey("");
      setActiveProvider(data.item?.activeProvider || selectedProvider);
      setProviderConfigs((current) => ({ ...current, ...(data.item?.providerConfigs || {}) }));
      notify(`${selectedProvider} 配置已保存`);
    } catch (error) {
      notify(`保存 AI 配置失败: ${error.message}`);
    }
  };

  return (
    <section className="providers-page">
      <div className="provider-list">
        {providers.map((provider) => (
          <button
            className={`${selectedProvider === provider.name ? "active" : ""} ${activeProvider === provider.name ? "current" : ""}`}
            key={provider.name}
            onClick={() => {
              setSelectedProvider(provider.name);
              setApiKey("");
            }}
          >
            <Bot size={20} />
            <span>
              <strong>{provider.name}</strong>
              <small>{activeProvider === provider.name ? "正在使用" : (providerConfigs[provider.name]?.hasApiKey ? "已配置" : "待配置")}</small>
            </span>
            <i />
          </button>
        ))}
      </div>
      <div className="provider-form">
        <div className="provider-title">
          <Sparkles size={30} />
          <div>
            <h2>{provider.name}</h2>
            <p>{provider.desc}</p>
          </div>
        </div>
        <label>
          Base URL
          <input placeholder="https://api.openai.com/v1" value={config.baseUrl} onChange={(event) => setProviderConfigs((current) => ({ ...current, [selectedProvider]: { ...config, baseUrl: event.target.value } }))} />
        </label>
        <label>
          模型 ID
          <input placeholder="模型 ID" value={config.modelId} onChange={(event) => setProviderConfigs((current) => ({ ...current, [selectedProvider]: { ...config, modelId: event.target.value } }))} />
        </label>
        <label>
          API Key
          <input type="password" placeholder={config.hasApiKey ? `已保存: ${config.apiKeyPreview}` : "sk-..."} value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
        </label>
        <label className="inline-check">
          <input type="checkbox" checked={config.enabled} onChange={(event) => setProviderConfigs((current) => ({ ...current, [selectedProvider]: { ...config, enabled: event.target.checked } }))} />
          启用真实 AI 调用
        </label>
        <p className="provider-note">
          {config.source === "env" ? "当前配置由环境变量 OPENAI_API_KEY 接管，保存不会覆盖环境变量。" : `保存后会切换真实调用到 ${selectedProvider}；完整 API Key 不会返回到前端。`}
        </p>
        <button className="black-small" onClick={saveConfig}>
          <KeyRound size={16} />
          保存配置
        </button>
      </div>
    </section>
  );
}

function InterviewStageEntry({ go }) {
  return <section className="interview-stage-entry"><MessageSquareText size={28} /><div><span className="section-kicker">RAG 模拟面试</span><h2>从真实岗位匹配报告开始</h2><p>选择岗位 JD 与已锁定的求职分析任务，在可引用匹配报告下创建、恢复和完成模拟面试。题目不会脱离简历版本与岗位依据单独生成。</p></div><button className="black-small" onClick={() => go("jobs")}><BriefcaseBusiness size={16} />进入岗位 JD</button></section>;
}

function InterviewPractice({ notify, go, resumeId }) {
  const [targetPosition, setTargetPosition] = useState("");
  const [questionCount, setQuestionCount] = useState(4);
  const [interview, setInterview] = useState(null);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [report, setReport] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [needsAiConfig, setNeedsAiConfig] = useState(false);
  const [feedbackVersion, setFeedbackVersion] = useState(0);
  const [reportVersion, setReportVersion] = useState(0);

  useEffect(() => {
    if (!resumeId) {
      setTargetPosition("");
      return undefined;
    }
    let disposed = false;
    apiRequest(`/api/resumes/${resumeId}`)
      .then(({ item }) => {
        if (!disposed) setTargetPosition(item.targetPosition || item.currentPosition || "");
      })
      .catch((error) => !disposed && notify(`读取当前简历失败: ${error.message}`));
    return () => { disposed = true; };
  }, [notify, resumeId]);

  const currentQuestion = interview?.questions?.[activeQuestionIndex];
  const progress = interview ? Math.round((answers.length / interview.questionCount) * 100) : 0;
  const hasNextQuestion = interview?.status === "IN_PROGRESS" && Boolean(feedback);
  const finishedQuestions = interview?.status === "READY_FOR_REPORT" && Boolean(feedback);

  const handleAiError = (error, prefix) => {
    const isAiNotConfigured = error.message.includes("AI 服务未配置") || error.message.includes("API Key");
    setNeedsAiConfig(isAiNotConfigured);
    notify(isAiNotConfigured ? "AI 尚未配置，请先配置服务商 API Key" : `${prefix}: ${error.message}`);
  };

  const startInterview = async () => {
    if (!resumeId) {
      notify("请先在我的简历中选择一份简历");
      return;
    }
    const nextTargetPosition = targetPosition.trim();
    if (!nextTargetPosition) {
      notify("请先填写目标岗位");
      return;
    }
    setIsStarting(true);
    try {
      const data = await apiRequest("/api/interviews", {
        method: "POST",
        body: JSON.stringify({ resumeId, targetPosition: nextTargetPosition, questionCount }),
      });
      writeWorkspaceValue("lingxi-target-position", nextTargetPosition);
      setInterview(data.item);
      setAnswers([]);
      setActiveQuestionIndex(0);
      setAnswer("");
      setFeedback(null);
      setReport(null);
      setNeedsAiConfig(false);
      notify("AI 已根据简历生成第一道面试题");
    } catch (error) {
      handleAiError(error, "生成面试题失败");
    } finally {
      setIsStarting(false);
    }
  };

  const submitAnswer = async () => {
    if (!interview || !currentQuestion || !answer.trim()) {
      notify("请先完成当前回答");
      return;
    }
    setIsSubmitting(true);
    try {
      const data = await apiRequest(`/api/interviews/${interview.id}/answers`, {
        method: "POST",
        body: JSON.stringify({ questionId: currentQuestion.id, answerText: answer.trim() }),
      });
      setInterview(data.interview);
      setAnswers((current) => [...current, data.item]);
      setFeedback(data.item);
      setFeedbackVersion((current) => current + 1);
      setNeedsAiConfig(false);
      notify(data.nextQuestion ? "AI 已评分并生成追问" : "本轮回答已评分，可以生成面试报告");
    } catch (error) {
      handleAiError(error, "生成面试反馈失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueInterview = () => {
    if (!interview?.questions?.[activeQuestionIndex + 1]) return;
    setActiveQuestionIndex((current) => current + 1);
    setAnswer("");
    setFeedback(null);
  };

  const generateReport = async () => {
    if (!interview) return;
    setIsReporting(true);
    try {
      const data = await apiRequest(`/api/interviews/${interview.id}/report`, { method: "POST" });
      setInterview(data.item);
      setReport(data.report);
      setReportVersion((current) => current + 1);
      setNeedsAiConfig(false);
      notify("AI 面试报告已生成并保存到历史记录");
    } catch (error) {
      handleAiError(error, "生成面试报告失败");
    } finally {
      setIsReporting(false);
    }
  };

  const restartInterview = () => {
    setInterview(null);
    setAnswers([]);
    setAnswer("");
    setFeedback(null);
    setReport(null);
    setActiveQuestionIndex(0);
    setNeedsAiConfig(false);
  };

  if (!interview) {
    return (
      <section className="interview-setup">
        <div>
          <span className="section-kicker">AI 模拟面试</span>
          <h2>从你的简历开始提问</h2>
          <p>填写目标岗位后，AI 会读取当前简历生成首题，并根据每次回答继续追问。</p>
        </div>
        <label>
          目标岗位
          <input value={targetPosition} placeholder="例如：前端开发工程师" onChange={(event) => setTargetPosition(event.target.value)} />
        </label>
        <label>
          面试题数
          <input type="number" min="2" max="6" value={questionCount} onChange={(event) => setQuestionCount(Math.max(2, Math.min(6, Number(event.target.value) || 2)))} />
        </label>
        {needsAiConfig && (
          <div className="ai-config-callout">
            <span>尚未配置可用的 AI 服务，无法生成面试题。</span>
            <button className="white-small" onClick={() => go("providers")}>去配置 AI 服务商</button>
          </div>
        )}
        <button className="black-small" disabled={isStarting} onClick={startInterview}>
          {isStarting ? <LoaderCircle className="spin" size={16} /> : <MessageSquareText size={16} />}
          {isStarting ? "AI 正在生成题目" : "开始模拟面试"}
        </button>
      </section>
    );
  }

  if (report) {
    return (
      <section className="interview-report">
        <div className="report-score"><AnimatedScore value={report.totalScore} shouldAnimate={reportVersion > 0} /></div>
        <span className="section-kicker">{interview.targetPosition} 面试报告</span>
        <h2>本次模拟面试已完成</h2>
        <p>{report.summary}</p>
        <div className="report-grid">
          <article>
            <h3>表现优势</h3>
            <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article>
            <h3>下一步改进</h3>
            <ul>{report.improvements.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        <div className="report-actions">
          <button className="white-small" onClick={restartInterview}>重新开始</button>
          <button className="black-small" onClick={() => go("history")}>查看历史记录</button>
        </div>
      </section>
    );
  }

  return (
    <section className="interview-page">
      <aside>
        <div className="mini-heading">
          <strong>面试进度</strong>
          <span>{progress}%</span>
        </div>
        {(interview.questions || []).map((question, questionIndex) => {
          const answered = Boolean(answers[questionIndex]);
          const isCurrent = activeQuestionIndex === questionIndex;
          return (
            <button
              className={`${isCurrent ? "active" : ""} ${answered ? "answered" : ""}`}
              disabled={questionIndex > activeQuestionIndex}
              onClick={() => {
                if (questionIndex <= activeQuestionIndex) setActiveQuestionIndex(questionIndex);
              }}
              key={question.id}
            >
              <span>{questionIndex + 1}</span>
              <small>{question.questionType}</small>
            </button>
          );
        })}
      </aside>
      <div className="answer-card">
        <div className="mini-heading">
          <strong>第 {activeQuestionIndex + 1} 题</strong>
          <span>{interview.targetPosition}</span>
        </div>
        <div className="question-bubble">
          <Bot size={22} />
          <p>{currentQuestion?.questionText}</p>
        </div>
        <textarea disabled={Boolean(feedback)} value={answer} placeholder="输入你的回答" onChange={(event) => setAnswer(event.target.value)} />
        {!feedback && (
          <button className="black-small" disabled={isSubmitting} onClick={submitAnswer}>
            {isSubmitting ? <LoaderCircle className="spin" size={16} /> : <Send size={16} />}
            {isSubmitting ? "AI 正在评分" : "提交回答"}
          </button>
        )}
      </div>
      <div className={`feedback-card ${feedbackVersion ? "ai-result-enter" : ""}`} key={feedbackVersion}>
        {feedback ? (
          <>
            <span><AnimatedScore value={feedback.score} shouldAnimate={feedbackVersion > 0} /> 分</span>
            <h3>AI 反馈</h3>
            <p>{feedback.feedback}</p>
            <h4>改进后的回答思路</h4>
            <p>{feedback.referenceAnswer}</p>
            {hasNextQuestion && <button className="black-small" onClick={continueInterview}>进入 AI 追问</button>}
            {finishedQuestions && <button className="black-small" disabled={isReporting} onClick={generateReport}>{isReporting ? "正在生成报告" : "生成面试报告"}</button>}
          </>
        ) : (
          <p>提交当前回答后，AI 会给出评分、改进建议和下一道追问。</p>
        )}
      </div>
    </section>
  );
}

function GeneralSettings({ notify, currentUser, onUserUpdated }) {
  const [directory, setDirectory] = useState("");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const changePassword = async () => {
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      notify("两次输入的新密码不一致");
      return;
    }
    setSavingPassword(true);
    try {
      const data = await apiRequest("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          nextPassword: passwordForm.nextPassword,
        }),
      });
      onUserUpdated?.(data.user);
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      notify("密码已更新，其他旧登录会话已失效");
    } catch (error) {
      notify(`更新密码失败: ${error.message}`);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <section className="settings-page">
      <div className={`settings-card security-settings-card${currentUser?.passwordUpdateRequired ? " required" : ""}`}>
        <div>
          <KeyRound size={28} />
          <div>
            <strong>账号安全</strong>
            <p>{currentUser?.passwordUpdateRequired ? "该账号使用过旧密码，请先更新后再继续使用个人功能。" : "定期更新密码可以保护你的简历、AI 配置和面试记录。"}</p>
          </div>
        </div>
        <div className="password-fields">
          <input type="password" autoComplete="current-password" placeholder="当前密码" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
          <input type="password" autoComplete="new-password" minLength={10} maxLength={128} placeholder="新密码（至少 10 位，含字母和数字）" value={passwordForm.nextPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, nextPassword: event.target.value }))} />
          <input type="password" autoComplete="new-password" minLength={10} maxLength={128} placeholder="确认新密码" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
          <button className="black-small" disabled={savingPassword} onClick={changePassword}>{savingPassword ? "正在更新" : "更新密码"}</button>
        </div>
      </div>
      <div className="settings-card">
        <div>
          <FolderOpen size={28} />
          <div>
            <strong>同步目录</strong>
            <p>选择一个文件夹来同步和备份你的简历。</p>
          </div>
        </div>
        <div className="directory-row">
          <input placeholder="尚未配置同步文件夹" value={directory} onChange={(event) => setDirectory(event.target.value)} />
          <button className="black-small" onClick={() => {
            const value = directory || "C:/Users/Lucas/Documents/灵犀简历";
            setDirectory(value);
            notify("同步目录已保存");
          }}>选择文件夹</button>
        </div>
      </div>
    </section>
  );
}

function HistoryPage({ notify, resumeId }) {
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [optimize, setOptimize] = useState([]);
  const [grammar, setGrammar] = useState([]);
  const [interviews, setInterviews] = useState([]);

  const loadHistory = async () => {
    if (!resumeId) {
      setHistory([]);
      setAnalysis([]);
      setOptimize([]);
      setGrammar([]);
      setInterviews([]);
      return;
    }
    try {
      const [resumeHistory, analysisRecords, optimizeRecords, grammarRecords, interviewRecords] = await Promise.all([
        apiRequest(`/api/resumes/${resumeId}/history`),
        apiRequest(`/api/records/analysis?resumeId=${resumeId}`),
        apiRequest(`/api/records/optimize?resumeId=${resumeId}`),
        apiRequest(`/api/records/grammar?resumeId=${resumeId}`),
        apiRequest(`/api/records/interviews?resumeId=${resumeId}`),
      ]);
      setHistory(resumeHistory.items || []);
      setAnalysis(analysisRecords.items || []);
      setOptimize(optimizeRecords.items || []);
      setGrammar(grammarRecords.items || []);
      setInterviews(interviewRecords.items || []);
      notify("历史记录已刷新");
    } catch (error) {
      notify(`历史记录加载失败: ${error.message}`);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [resumeId]);

  return (
    <section className="records-page">
      <div className="records-head">
        <div>
          <span className="section-kicker">记录归档</span>
          <p>{resumeId ? `展示简历 #${resumeId} 的版本、AI 诊断、润色和面试反馈。` : "请先在我的简历中选择一份简历。"}</p>
        </div>
        <button className="black-small" onClick={loadHistory}>刷新记录</button>
      </div>
      <div className="records-grid">
        <RecordColumn title="简历版本" items={history.map((item) => `v${item.version} · ${item.summary}`)} />
        <RecordColumn title="诊断记录" items={analysis.map((item) => `${item.totalScore} 分 · ${item.analysisResult}`)} />
        <RecordColumn title="润色记录" items={optimize.map((item) => item.optimizedContent)} />
        <RecordColumn title="语法检查" items={grammar.map((item) => `${item.score} 分 · ${(item.issues || []).length} 个问题`)} />
        <RecordColumn title="模拟面试" items={interviews.map((item) => `${item.targetPosition || item.title} · ${item.totalScore ?? "进行中"} 分 · ${item.overallFeedback || `${item.answerCount || 0} 题已完成`}`)} />
      </div>
    </section>
  );
}

function RecordColumn({ title, items }) {
  return (
    <section className="record-column">
      <h3>{title}</h3>
      {items.length ? items.map((item, index) => <p key={`${title}-${index}`}>{item}</p>) : <p>暂无记录</p>}
    </section>
  );
}

function AdminPanel({ notify }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async (showNotice = false) => {
    try {
      setLoading(true);
      const data = await apiRequest("/api/admin/overview");
      setMetrics(data.metrics);
      if (showNotice) notify("后台数据已刷新");
    } catch (error) {
      notify(`后台数据加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const cards = [
    ["用户数", metrics?.users ?? 0],
    ["简历数", metrics?.resumes ?? 0],
    ["诊断记录", metrics?.analysisRecords ?? 0],
    ["润色记录", metrics?.optimizeRecords ?? 0],
    ["语法检查", metrics?.grammarRecords ?? 0],
    ["模拟面试", metrics?.interviews ?? 0],
    ["岗位方向", metrics?.positions ?? 0],
    ["知识资料", metrics?.knowledgeDocuments ?? 0],
  ];

  return (
    <section className="admin-page">
      <div className="records-head">
        <div>
          <span className="section-kicker">数据概览</span>
          <p>查看用户、简历、AI 记录、岗位方向和模拟面试数据概览。</p>
        </div>
        <button type="button" className="black-small" disabled={loading} onClick={() => loadOverview(true)}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}刷新统计</button>
      </div>
      <div className="admin-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <KnowledgeBaseManager notify={notify} onChanged={() => loadOverview()} />
    </section>
  );
}

const knowledgeDocumentTypeOptions = [
  ["ROLE_SKILL_DESCRIPTION", "岗位技能说明"],
  ["COMPETENCY_STANDARD", "岗位能力标准"],
  ["INDUSTRY_ROLE_REQUIREMENT", "行业岗位要求"],
  ["RESUME_EXAMPLE", "优秀简历案例"],
  ["PROJECT_CASE", "项目经历案例"],
  ["STAR_TEMPLATE", "STAR 表达模板"],
  ["INTERVIEW_QUESTION", "面试题"],
  ["INTERVIEW_RUBRIC", "面试评分标准"],
  ["RESUME_COMMON_ISSUE", "常见简历问题"],
  ["RESUME_WRITING_GUIDELINE", "简历表达规范"],
];

const emptyKnowledgeDocumentForm = () => ({
  title: "", description: "", sourceType: "TEXT_ENTRY", documentType: "ROLE_SKILL_DESCRIPTION", jobFamily: "", seniority: "", skillTags: "", language: "zh-CN", sourceName: "", sourceUrl: "", rawText: "",
});

function KnowledgeBaseManager({ notify, onChanged }) {
  const [documents, setDocuments] = useState([]);
  const [filters, setFilters] = useState({ documentType: "", jobFamily: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyKnowledgeDocumentForm);
  const [selected, setSelected] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [records, setRecords] = useState([]);
  const [indexRuns, setIndexRuns] = useState([]);
  const [vectorRecords, setVectorRecords] = useState([]);
  const [vectorStatus, setVectorStatus] = useState(null);
  const [expandedChunkId, setExpandedChunkId] = useState(null);
  const [working, setWorking] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState(null);

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const data = await apiRequest(`/api/admin/knowledge-documents${query.size ? `?${query}` : ""}`);
      setDocuments(data.items);
    } catch (error) {
      notify(`知识资料加载失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  const loadDetail = useCallback(async (documentId) => {
    try {
      setWorking(`detail-${documentId}`);
      const [detail, chunkData, recordData, runData, vectorData] = await Promise.all([
        apiRequest(`/api/admin/knowledge-documents/${documentId}`),
        apiRequest(`/api/admin/knowledge-documents/${documentId}/chunks`),
        apiRequest(`/api/admin/knowledge-documents/${documentId}/processing-records`),
        apiRequest(`/api/admin/knowledge-documents/${documentId}/index-runs`),
        apiRequest(`/api/admin/knowledge-documents/${documentId}/vector-records`),
      ]);
      setSelected(detail.item);
      setChunks(chunkData.items);
      setRecords(recordData.items);
      setIndexRuns(runData.items);
      setVectorRecords(vectorData.items);
      setExpandedChunkId(null);
    } catch (error) {
      notify(`读取知识资料失败: ${error.message}`);
    } finally {
      setWorking("");
    }
  }, [notify]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    apiRequest("/api/admin/vector-index/status").then(setVectorStatus).catch(() => setVectorStatus(null));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyKnowledgeDocumentForm());
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditingId(selected.id);
    setForm({ ...selected, skillTags: (selected.skillTags || []).join(", ") });
    setFormOpen(true);
  };

  const submitForm = async (event) => {
    event.preventDefault();
    try {
      setWorking("save");
      const payload = { ...form, skillTags: form.skillTags.split(",").map((item) => item.trim()).filter(Boolean) };
      const response = await apiRequest(editingId ? `/api/admin/knowledge-documents/${editingId}` : "/api/admin/knowledge-documents", {
        method: editingId ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      setFormOpen(false);
      notify(editingId ? "知识资料已更新" : "知识资料已创建，等待处理");
      await loadDocuments();
      await loadDetail(response.item.id);
      onChanged();
    } catch (error) {
      notify(`保存知识资料失败: ${error.message}`);
    } finally {
      setWorking("");
    }
  };

  const processDocument = async () => {
    if (!selected) return;
    try {
      setWorking("process");
      const response = await apiRequest(`/api/admin/knowledge-documents/${selected.id}/process`, { method: "POST" });
      notify(response.idempotent ? "原文和策略未变，已复用现有切片" : `文档处理完成，生成 ${response.item.chunkCount} 个切片`);
      await loadDocuments();
      await loadDetail(selected.id);
      onChanged();
    } catch (error) {
      notify(`处理失败: ${error.message}`);
      await loadDetail(selected.id);
      await loadDocuments();
    } finally {
      setWorking("");
    }
  };

  const deleteDocument = async () => {
    if (!deleteCandidate) return;
    try {
      setWorking("delete");
      await apiRequest(`/api/admin/knowledge-documents/${deleteCandidate.id}`, { method: "DELETE" });
      notify("知识资料、切片和处理记录已删除");
      if (selected?.id === deleteCandidate.id) {
        setSelected(null);
        setChunks([]);
        setRecords([]);
        setIndexRuns([]);
        setVectorRecords([]);
      }
      setDeleteCandidate(null);
      await loadDocuments();
      onChanged();
    } catch (error) {
      notify(`删除知识资料失败: ${error.message}`);
    } finally {
      setWorking("");
    }
  };

  const manageIndex = async (action) => {
    if (!selected) return;
    const path = action === "delete" ? `/api/admin/knowledge-documents/${selected.id}/index` : `/api/admin/knowledge-documents/${selected.id}/index${action === "rebuild" ? "/rebuild" : ""}`;
    try {
      setWorking(`index-${action}`);
      const response = await apiRequest(path, { method: action === "delete" ? "DELETE" : "POST" });
      notify(action === "delete" ? "向量索引已删除" : response.idempotent ? "当前索引未变化，已复用现有索引" : "向量索引已建立");
      await Promise.all([loadDocuments(), loadDetail(selected.id)]);
    } catch (error) { notify(`向量索引操作失败: ${error.message}`); }
    finally { setWorking(""); }
  };

  return (
    <section className="knowledge-manager" aria-labelledby="knowledge-manager-title">
      <div className="knowledge-manager-head">
        <div>
          <span className="section-kicker">知识库管理</span>
          <h2 id="knowledge-manager-title">岗位资料与切片</h2>
          <p>仅管理员可维护。文本会在服务端清洗、识别章节并按语义边界切片；不会调用 AI 改写资料。</p>
        </div>
        <button type="button" className="black-small" onClick={openCreate}><Plus size={16} />新建资料</button>
      </div>

      {formOpen && (
        <form className="knowledge-form" onSubmit={submitForm}>
          <div className="knowledge-form-head"><h3>{editingId ? "编辑知识资料" : "新建知识资料"}</h3><button type="button" className="plain-icon" aria-label="关闭资料表单" onClick={() => setFormOpen(false)}><X size={18} /></button></div>
          <div className="knowledge-form-grid">
            <label>标题<input required maxLength={160} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>资料类型<select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))}>{knowledgeDocumentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>来源类型<select value={form.sourceType} onChange={(event) => setForm((current) => ({ ...current, sourceType: event.target.value }))}><option value="TEXT_ENTRY">文本录入</option><option value="INTERNAL">内部资料</option><option value="EXTERNAL">外部资料</option></select></label>
            <label>岗位族<input maxLength={100} placeholder="例如：研发 / 产品 / 运营" value={form.jobFamily} onChange={(event) => setForm((current) => ({ ...current, jobFamily: event.target.value }))} /></label>
            <label>职级<input maxLength={80} placeholder="例如：初级 / 中级 / 资深" value={form.seniority} onChange={(event) => setForm((current) => ({ ...current, seniority: event.target.value }))} /></label>
            <label>语言<input maxLength={32} value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))} /></label>
            <label>来源名称<input maxLength={200} value={form.sourceName} onChange={(event) => setForm((current) => ({ ...current, sourceName: event.target.value }))} /></label>
            <label>来源链接<input type="url" maxLength={2048} placeholder="https://" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} /></label>
            <label className="knowledge-form-span">技能标签（用英文逗号分隔）<input maxLength={1900} placeholder="React, TypeScript, Spring Boot" value={form.skillTags} onChange={(event) => setForm((current) => ({ ...current, skillTags: event.target.value }))} /></label>
            <label className="knowledge-form-span">简介<textarea maxLength={2000} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
            <label className="knowledge-form-span">原始内容<textarea required maxLength={300000} rows={12} placeholder="粘贴可追溯的岗位资料。支持 Markdown 和常见中文标题。" value={form.rawText} onChange={(event) => setForm((current) => ({ ...current, rawText: event.target.value }))} /></label>
          </div>
          <div className="knowledge-form-actions"><button type="button" className="white-small" disabled={working === "save"} onClick={() => setFormOpen(false)}>取消</button><button className="black-small" disabled={working === "save"}>{working === "save" ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}{editingId ? "保存修改" : "创建资料"}</button></div>
        </form>
      )}

      <div className="knowledge-filterbar">
        <select aria-label="按资料类型筛选" value={filters.documentType} onChange={(event) => setFilters((current) => ({ ...current, documentType: event.target.value }))}><option value="">全部资料类型</option>{knowledgeDocumentTypeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <input aria-label="按岗位族筛选" placeholder="筛选岗位族" value={filters.jobFamily} onChange={(event) => setFilters((current) => ({ ...current, jobFamily: event.target.value }))} />
        <select aria-label="按处理状态筛选" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">全部状态</option><option value="DRAFT">待处理</option><option value="PROCESSING">处理中</option><option value="PROCESSED">已处理</option><option value="FAILED">处理失败</option></select>
        <button type="button" className="white-small" disabled={loading} onClick={loadDocuments}>{loading ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}刷新</button>
      </div>

      <div className="vector-index-summary" role="status">
        <span className={`knowledge-status ${vectorStatus?.embedding?.configured ? "indexed" : "failed"}`}>Embedding {vectorStatus?.embedding?.configured ? "已配置" : "未配置"}</span>
        <span className={`knowledge-status ${vectorStatus?.qdrant?.healthy ? "indexed" : "failed"}`}>Qdrant {vectorStatus?.qdrant?.healthy ? "健康" : "不可用"}</span>
        {vectorStatus?.embedding?.configured && <small>{vectorStatus.embedding.model} · {vectorStatus.embedding.dimension} 维</small>}
        {vectorStatus?.collectionName && <small className="vector-index-collection">Collection：{vectorStatus.collectionName}</small>}
        {!vectorStatus?.embedding?.configured && <small>请在服务端环境变量中配置 Embedding 后再建立索引。</small>}
      </div>

      <RetrievalLab notify={notify} />

      <div className="knowledge-workspace">
        <div className="knowledge-list" aria-label="知识资料列表">
          {loading ? <div className="knowledge-loading"><LoaderCircle className="spin" size={18} />正在读取知识资料</div> : documents.length ? documents.map((document) => (
            <button type="button" key={document.id} className={`knowledge-list-item ${selected?.id === document.id ? "active" : ""}`} onClick={() => loadDetail(document.id)}>
              <span className={`knowledge-status ${document.status.toLowerCase()}`}>{knowledgeStatusLabel(document.status)}</span>
              <strong>{document.title}</strong>
              <small>{knowledgeDocumentTypeLabel(document.documentType)} · {document.jobFamily || "未标注岗位族"}</small>
              <span>{document.chunkCount || 0} 个切片 · v{document.processingVersion || 0}</span>
            </button>
          )) : <div className="knowledge-empty"><FolderOpen size={22} /><strong>还没有知识资料</strong><p>先录入一份可追溯的岗位或面试资料，再在此处处理为可查看的切片。</p><button type="button" className="white-small" onClick={openCreate}><Plus size={16} />录入资料</button></div>}
        </div>
        <div className="knowledge-detail">
          {!selected ? <div className="knowledge-empty"><FileText size={24} /><strong>选择一份资料查看详情</strong><p>这里将展示服务端生成的章节路径、切片内容和不可覆写的处理历史。</p></div> : (
            <>
              <div className="knowledge-detail-head">
                <div><span className={`knowledge-status ${selected.status.toLowerCase()}`}>{knowledgeStatusLabel(selected.status)}</span><h3>{selected.title}</h3><p>{selected.description || "暂无资料说明"}</p></div>
                <div className="knowledge-detail-actions"><button type="button" className="white-small" disabled={working === "process"} onClick={processDocument}>{working === "process" ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}处理文档</button><button type="button" className="white-small" disabled={selected.status !== "PROCESSED" || !vectorStatus?.embedding?.configured || !vectorStatus?.qdrant?.healthy || working.startsWith("index-")} onClick={() => manageIndex("create")}>建立索引</button><button type="button" className="white-small" disabled={selected.status !== "PROCESSED" || !vectorStatus?.embedding?.configured || !vectorStatus?.qdrant?.healthy || working.startsWith("index-")} onClick={() => manageIndex("rebuild")}>重新索引</button>{selected.vectorStatus && selected.vectorStatus !== "NOT_INDEXED" && <button type="button" className="danger-text-button" disabled={working.startsWith("index-")} onClick={() => manageIndex("delete")}>删除索引</button>}<button type="button" className="white-small" onClick={openEdit}>编辑</button><button type="button" className="danger-text-button" onClick={() => setDeleteCandidate(selected)}><Trash2 size={16} />删除</button></div>
              </div>
              <div className="knowledge-meta"><span>来源：{selected.sourceName || "未填写"}</span><span>语言：{selected.language}</span><span>标签：{selected.skillTags?.join("、") || "未填写"}</span><span>原文哈希：{selected.rawTextHash?.slice(0, 12)}…</span></div>
              <section className="knowledge-detail-section vector-index-detail"><header><h4>向量索引</h4><span className={`knowledge-status ${(selected.vectorStatus || "NOT_INDEXED").toLowerCase()}`}>{vectorStatusLabel(selected.vectorStatus)}</span></header><div className="vector-index-facts"><span>索引版本：{selected.indexedProcessingVersion ? `v${selected.indexedProcessingVersion}` : "—"}</span><span>有效记录：{selected.indexedChunkCount || 0}</span><span>模型：{vectorStatus?.embedding?.model || "未配置"}</span><span>Collection：{selected.vectorCollection || "—"}</span><span>最后索引：{selected.indexedAt ? formatResumeDate(selected.indexedAt) : "—"}</span></div>{selected.vectorStatus === "STALE" && <p className="vector-index-note">文档切片已更新，旧向量不再代表当前版本；请重新建立索引。</p>}{selected.indexFailureMessage && <p className="vector-index-note error">{selected.indexFailureCode}: {selected.indexFailureMessage}</p>}</section>
              {selected.status === "FAILED" && <div className="knowledge-error"><strong>{selected.failureCode || "处理失败"}</strong><span>{selected.failureMessage || "请检查原始内容后重新处理。"}</span></div>}
              <section className="knowledge-detail-section"><header><h4>当前有效切片</h4><span>{chunks.length} 个</span></header>{chunks.length ? chunks.map((chunk) => <article key={chunk.id} className="knowledge-chunk"><button type="button" onClick={() => setExpandedChunkId((current) => current === chunk.id ? null : chunk.id)}><span>#{chunk.chunkIndex + 1}</span><strong>{chunk.title}</strong><small>{chunk.tokenEstimate} 估算 token · {chunk.startOffset}–{chunk.endOffset}</small><ChevronDown size={16} className={expandedChunkId === chunk.id ? "rotated" : ""} /></button>{expandedChunkId === chunk.id && <div><p className="knowledge-heading-path">{chunk.headingPath?.length ? chunk.headingPath.join(" / ") : "未识别章节标题"}</p><pre>{chunk.content}</pre><small>内容哈希：{chunk.contentHash}</small></div>}</article>) : <p className="knowledge-empty-inline">尚未生成切片。保存后点击“处理文档”。</p>}</section>
              <section className="knowledge-detail-section"><header><h4>处理历史</h4><span>{records.length} 次</span></header>{records.length ? <div className="knowledge-history">{records.map((record) => <article key={record.id}><span className={`knowledge-status ${record.status.toLowerCase()}`}>{knowledgeStatusLabel(record.status)}</span><strong>v{record.processingVersion}</strong><small>{record.chunkCount} 个切片 · {formatResumeDate(record.createdAt)}</small>{record.failureMessage && <p>{record.failureCode}: {record.failureMessage}</p>}</article>)}</div> : <p className="knowledge-empty-inline">尚无处理记录。</p>}</section>
              <section className="knowledge-detail-section"><header><h4>索引历史</h4><span>{indexRuns.length} 次</span></header>{indexRuns.length ? <div className="knowledge-history">{indexRuns.map((run) => <article key={run.id}><span className={`knowledge-status ${run.status === "COMPLETED" ? "indexed" : run.status === "FAILED" ? "failed" : "processing"}`}>{run.status}</span><strong>v{run.processingVersion} · {run.upsertedCount} points</strong><small>{run.model} · 清理 {run.cleanupStatus}</small>{run.failureMessage && <p>{run.failureCode}: {run.failureMessage}</p>}</article>)}</div> : <p className="knowledge-empty-inline">尚无索引记录。</p>}</section>
              <section className="knowledge-detail-section"><header><h4>VectorRecord 元数据</h4><span>{vectorRecords.length} 条</span></header>{vectorRecords.length ? <div className="vector-record-list">{vectorRecords.map((record) => <article key={record.id}><span className={`knowledge-status ${record.status.toLowerCase()}`}>{record.status}</span><code>{record.pointId}</code><small>chunk #{record.chunkId} · run #{record.indexRunId}</small></article>)}</div> : <p className="knowledge-empty-inline">没有向量记录，且不会展示向量数组。</p>}</section>
            </>
          )}
        </div>
      </div>
      <ConfirmDialog open={Boolean(deleteCandidate)} title="删除这份知识资料？" description={`“${deleteCandidate?.title || "知识资料"}”及其全部切片、处理历史会被永久删除，无法撤销。`} confirmLabel="删除资料" isWorking={working === "delete"} onClose={() => setDeleteCandidate(null)} onConfirm={deleteDocument} />
    </section>
  );
}

function RetrievalLab({ notify }) {
  const [query, setQuery] = useState(""); const [mode, setMode] = useState("HYBRID"); const [topK, setTopK] = useState(10); const [useReranker, setUseReranker] = useState(false); const [status, setStatus] = useState(null); const [result, setResult] = useState(null); const [runs, setRuns] = useState([]); const [working, setWorking] = useState(false);
  const refresh = useCallback(async () => { try { const [nextStatus, nextRuns] = await Promise.all([apiRequest("/api/admin/knowledge-retrieval/status"), apiRequest("/api/admin/knowledge-retrieval/runs")]); setStatus(nextStatus); setRuns(nextRuns.items.slice(0, 5)); } catch (error) { notify(`读取检索状态失败: ${error.message}`); } }, [notify]);
  useEffect(() => { refresh(); }, [refresh]);
  const search = async (event) => { event.preventDefault(); try { setWorking(true); const data = await apiRequest("/api/admin/knowledge-retrieval/search", { method: "POST", body: JSON.stringify({ query, mode, topK: Number(topK), useReranker }) }); setResult(data); await refresh(); } catch (error) { notify(`检索失败: ${error.message}`); } finally { setWorking(false); } };
  return <section className="retrieval-lab" aria-labelledby="retrieval-lab-title"><header><div><h3 id="retrieval-lab-title">检索实验室</h3><p>仅查询当前有效知识；不生成回答，不修改简历。</p></div><div className="retrieval-status"><span className={`knowledge-status ${status?.keyword?.available ? "indexed" : "failed"}`}>关键词</span><span className={`knowledge-status ${status?.qdrant?.healthy ? "indexed" : "failed"}`}>向量</span><span className={`knowledge-status ${status?.reranker?.configured ? "indexed" : "not_indexed"}`}>Reranker</span></div></header><form onSubmit={search} className="retrieval-form"><input aria-label="检索查询" maxLength={300} required value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：Java 后端事务与高并发能力" /><select value={mode} onChange={(event) => setMode(event.target.value)}><option value="HYBRID">混合检索</option><option value="KEYWORD">关键词检索</option><option value="VECTOR">向量检索</option></select><input aria-label="返回条数" type="number" min="1" max="50" value={topK} onChange={(event) => setTopK(event.target.value)} /><label><input type="checkbox" checked={useReranker} onChange={(event) => setUseReranker(event.target.checked)} />重排序</label><button className="black-small" disabled={working}>{working ? "检索中…" : "运行检索"}</button></form>{result && <div className="retrieval-output"><p>{result.degraded ? `已降级：${result.degradedReason}` : "检索完成"} · {result.durationMs}ms · 关键词 {result.keywordCandidateCount} / 向量 {result.vectorCandidateCount} · 重排序 {result.rerankerApplied ? "已应用" : result.rerankerFallback ? `回退 ${result.rerankerFailureCode}` : "未应用"}</p>{result.results.map((item) => <article key={item.chunkId}><strong>#{item.finalRank} {item.documentTitle}</strong><small>{item.headingPath.join(" / ") || "未识别章节"} · {item.retrievalSources} · hash {item.contentHash.slice(0, 12)}…</small><p>{item.content.slice(0, 220)}{item.content.length > 220 ? "…" : ""}</p><footer>关键词 {item.keywordRank || "—"}/{item.keywordScore ?? "—"} · 向量 {item.vectorRank || "—"}/{item.vectorScore?.toFixed?.(3) || "—"} · RRF {item.rrfScore?.toFixed?.(4) || "—"} · 重排 {item.rerankScore?.toFixed?.(4) || "—"}</footer></article>)}</div>}<details className="retrieval-history"><summary>最近检索运行（{runs.length}）</summary>{runs.map((run) => <p key={run.id}>#{run.id} · {run.searchMode} · {run.status} · {run.returnedCount} 条 · {run.durationMs}ms</p>)}</details></section>;
}

function knowledgeDocumentTypeLabel(value) {
  return knowledgeDocumentTypeOptions.find(([key]) => key === value)?.[1] || value;
}

function knowledgeStatusLabel(value) {
  return ({ DRAFT: "待处理", PROCESSING: "处理中", PROCESSED: "已处理", FAILED: "处理失败" })[value] || value;
}

function vectorStatusLabel(value) {
  return ({ NOT_INDEXED: "未建立索引", INDEXING: "索引中", INDEXED: "已建立索引", STALE: "需要重建", FAILED: "索引失败" })[value] || value || "未建立索引";
}

function AnalysisPanel({ notify, go, resumeId }) {
  const [targetPosition, setTargetPosition] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [needsAiConfig, setNeedsAiConfig] = useState(false);
  const [applyingKeyword, setApplyingKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [resultVersion, setResultVersion] = useState(0);
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    if (!resumeId) {
      setTargetPosition("");
      setAnalysis(null);
      return undefined;
    }
    let disposed = false;
    apiRequest(`/api/resumes/${resumeId}`)
      .then(({ item }) => {
        if (!disposed) setTargetPosition(item.targetPosition || item.currentPosition || "");
      })
      .catch((error) => !disposed && notify(`读取当前简历失败: ${error.message}`));
    return () => { disposed = true; };
  }, [notify, resumeId]);

  const runAnalysis = useCallback(async (requestedTargetPosition = targetPosition) => {
    if (!resumeId) {
      notify("请先在我的简历中选择一份简历");
      return;
    }
    const nextTargetPosition = requestedTargetPosition.trim();
    if (!nextTargetPosition) {
      notify("请先在我的简历中填写目标岗位");
      return;
    }

    // A new request must never leave an older result visible if the provider
    // rejects the new request.
    setAnalysis(null);
    setResultVersion(0);
    setNeedsAiConfig(false);
    setIsLoading(true);
    try {
      const data = await apiRequest(`/api/resumes/${resumeId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ targetPosition: nextTargetPosition }),
      });
      setAnalysis(data.item);
      setResultVersion((current) => current + 1);
      setTargetPosition(data.item.targetPosition || nextTargetPosition);
      setNeedsAiConfig(false);
      notify("AI 诊断已完成并保存记录");
    } catch (error) {
      const isAiNotConfigured = error.message.includes("AI 服务未配置") || error.message.includes("API Key");
      setNeedsAiConfig(isAiNotConfigured);
      notify(isAiNotConfigured ? "AI 尚未配置，请先配置服务商 API Key" : `诊断失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [notify, resumeId, targetPosition]);

  const applyKeyword = async (keyword) => {
    if (!keyword || applyingKeyword) return;
    setApplyingKeyword(keyword);
    try {
      if (!resumeId) {
        notify("请先在我的简历中选择一份简历");
        return;
      }
      const resumeData = await apiRequest(`/api/resumes/${resumeId}`);
      const currentSummary = String(resumeData.item?.selfEvaluation || "").trim();
      if (currentSummary.toLowerCase().includes(keyword.toLowerCase())) {
        notify(`个人简介已包含“${keyword}”`);
        return;
      }

      const nextSummary = currentSummary ? `${currentSummary}；${keyword}` : keyword;
      await apiRequest(`/api/resumes/${resumeId}`, {
        method: "PUT",
        body: JSON.stringify({
          selfEvaluation: nextSummary,
          summary: `将 AI 关键词“${keyword}”加入个人简介`,
        }),
      });
      setAppliedKeyword(keyword);
      notify(`已将“${keyword}”加入个人简介`);
    } catch (error) {
      notify(`加入关键词失败: ${error.message}`);
    } finally {
      setApplyingKeyword("");
    }
  };

  return (
    <section className={`simple-panel analysis-panel ${resultVersion ? "has-ai-result" : ""}`}>
      <div className={`score-circle ${isLoading ? "is-loading" : ""}`}>
        {isLoading ? <LoaderCircle size={44} /> : <AnimatedScore value={analysis?.totalScore} shouldAnimate={resultVersion > 0} />}
      </div>
      <h2>{isLoading ? "正在生成岗位匹配结果" : analysis ? `${analysis.targetPosition || targetPosition}匹配度${analysis.totalScore >= 85 ? "较高" : "待提升"}` : "尚未生成岗位匹配结果"}</h2>
      <div className="analysis-target">
        <span>岗位方向</span>
        <strong>{analysis?.targetPosition || targetPosition || "请先选择简历"}</strong>
      </div>
      {isLoading ? <ResultSkeleton lines={3} /> : <p>{analysis?.analysisResult || "选择简历后可生成真实 AI 诊断，不展示默认分数或建议。"}</p>}
      {needsAiConfig && (
        <div className="ai-config-callout">
          <span>尚未配置可用的 AI 服务，无法生成真实关键词和匹配度。</span>
          <button className="white-small" onClick={() => go("providers")}>去配置 AI 服务商</button>
        </div>
      )}
      <div className="analysis-keywords">
        <span>AI 生成的岗位关键词，点击加入个人简介</span>
        <div className="simple-list">
          {(analysis?.keywords || []).map((item, index) => (
            <button
              className={`keyword-chip ${resultVersion ? "card-stagger" : ""} ${appliedKeyword === item ? "is-applied" : ""}`}
              style={{ "--stagger-index": index }}
              key={item}
              type="button"
              disabled={Boolean(applyingKeyword)}
              onClick={() => applyKeyword(item)}
            >
              {applyingKeyword === item ? "正在加入" : appliedKeyword === item ? "已加入" : item}
            </button>
          ))}
          {!isLoading && !analysis?.keywords?.length && <span>生成诊断后显示岗位关键词</span>}
        </div>
      </div>
      {analysis && resultVersion > 0 && <div className="analysis-metrics" aria-label="诊断维度">
        {[["岗位匹配", "matchScore"], ["关键词覆盖", "keywordScore"], ["项目成果", "projectScore"], ["完整度", "completenessScore"]].map(([label, field], index) => {
          const rawScore = analysis[field];
          const score = typeof rawScore === "number" && Number.isFinite(rawScore) ? Math.max(0, Math.min(100, rawScore)) : null;
          return <div className="analysis-metric card-stagger" style={{ "--stagger-index": index }} key={field}><span>{label}</span><i>{score !== null && <b style={{ "--metric-value": `${score}%` }} />}</i><strong>{score === null ? "--" : `${score}%`}</strong></div>;
        })}
      </div>}
      <div className="simple-list">
        {(analysis?.suggestions || []).map((item, index) => <span className={resultVersion ? "card-stagger" : ""} style={{ "--stagger-index": index }} key={item}>{item}</span>)}
      </div>
      <button className="black-small" onClick={() => runAnalysis()} disabled={isLoading}>
        {isLoading ? <LoaderCircle className="spin" size={16} /> : <Gauge size={16} />}
        {isLoading ? "AI 正在诊断" : "重新诊断"}
      </button>
    </section>
  );
}

function OptimizePanel({ notify, resumeId }) {
  const [content, setContent] = useState("");
  const [optimized, setOptimized] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [resultVersion, setResultVersion] = useState(0);

  const runOptimize = async () => {
    if (!resumeId) {
      notify("请先在我的简历中选择一份简历");
      return;
    }
    setOptimizing(true);
    try {
      const data = await apiRequest(`/api/resumes/${resumeId}/optimize`, {
        method: "POST",
        body: JSON.stringify({ optimizeType: "project_experience", content }),
      });
      setOptimized(data.item.optimizedContent);
      setResultVersion((current) => current + 1);
      notify("AI 润色已完成并保存记录");
    } catch (error) {
      notify(`润色失败: ${error.message}`);
    } finally {
      setOptimizing(false);
    }
  };

  return (
    <section className="simple-panel">
      <Sparkles size={42} />
      <h2>AI 优化建议</h2>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} />
      {optimizing ? <ResultSkeleton lines={3} /> : <p className={resultVersion ? "ai-result-enter" : ""} key={resultVersion}>{optimized || "输入简历内容后生成真实润色结果。"}</p>}
      <button className="black-small" disabled={optimizing} onClick={runOptimize}>
        {optimizing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
        {optimizing ? "AI 正在润色" : "生成润色"}
      </button>
    </section>
  );
}

function MiniWorkbench() {
  return (
    <div className="mini-workbench">
      <div>
        <span />
        <span />
        <span />
        <span />
      </div>
      <div>
        <b />
        <i />
        <i />
        <i />
      </div>
      <ResumePaper />
    </div>
  );
}

export default App;
