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
import { useAnimatedNumber } from "./hooks/useAnimatedNumber";
import { useInViewOnce } from "./hooks/useInViewOnce";
import { usePresence } from "./hooks/usePresence";

const appNav = [
  { id: "resume", label: "我的简历", icon: FileText },
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
  const [displayedMessage, setDisplayedMessage] = useState(message);
  const { isMounted, isExiting } = usePresence(Boolean(message));

  useEffect(() => {
    if (message) setDisplayedMessage(message);
  }, [message]);

  if (!isMounted || !displayedMessage) return null;
  return <div className={`app-toast ${isExiting ? "is-exiting" : ""}`} role="status" aria-live="polite">{displayedMessage}</div>;
}

function LoginRequiredDialog({ open, onClose, onLogin }) {
  const { isMounted, isExiting } = usePresence(open);
  if (!isMounted) return null;
  return (
    <div className={`login-required-backdrop modal-backdrop ${isExiting ? "is-exiting" : ""}`} role="presentation" onMouseDown={onClose}>
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
  if (!response.ok) throw new Error(data.detail ? `${data.message}: ${data.detail}` : data.message || "请求失败");
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
  const [featuresRef, areFeaturesVisible] = useInViewOnce();
  const [progressRef, isProgressVisible] = useInViewOnce();
  const [ctaRef, isCtaVisible] = useInViewOnce();

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

      <section className="landing-hero landing-hero-enter">
        <span className="hero-badge fade-up" style={{ "--stagger": 0 }}>
          <Sparkles size={16} />
          AI 求职准备工作台
        </span>
        <h1 className="fade-up" style={{ "--stagger": 1 }}>简历、岗位、面试，在一张工作台准备</h1>
        <p className="fade-up" style={{ "--stagger": 2 }}>从简历编辑、AI 诊断、岗位匹配到模拟面试，帮你把求职准备变成可保存、可追踪、可优化的完整流程。</p>
        <div className="hero-buttons fade-up" style={{ "--stagger": 3 }}>
          <button className="black-cta" onClick={() => go("templates")}>
            浏览简历模板
            <span>→</span>
          </button>
          <button className="white-cta" onClick={() => go("templates")}>
            <Play size={15} />
            浏览模板
          </button>
        </div>
        <div className="hero-workbench-enter"><FluxHeroWorkbench go={go} currentUser={currentUser} /></div>
      </section>

      <section ref={featuresRef} className={`landing-section reveal-on-scroll ${areFeaturesVisible ? "is-visible" : ""}`}>
        <h2>为什么选择灵犀简历?</h2>
        <div className="section-rule" />
        <p className="section-subtitle">一站式求职解决方案，让简历制作、AI 优化和面试训练连成完整闭环。</p>
        <FeatureShowcase />
      </section>

      <section ref={progressRef} className={`landing-split reveal-on-scroll ${isProgressVisible ? "is-visible" : ""}`}>
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
      </section>

      <section ref={ctaRef} className={`final-cta reveal-on-scroll ${isCtaVisible ? "is-visible" : ""}`}>
        <span className="final-cta-wordmark">MAGIC RESUME</span>
        <h2>开启你的新职业篇章</h2>
        <p>创建一份能展示能力、匹配岗位、支撑面试表达的智能简历。</p>
        <button className="black-cta" onClick={() => go(currentUser ? "resume" : "auth")}>
          创建我的简历
          <span>→</span>
        </button>
      </section>
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
            {insights.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title}>
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
          {active === "resume-edit" && activeResumeId && <ResumeEditor key={`${currentUser?.id || "guest"}-${activeResumeId}`} resumeId={activeResumeId} go={go} notify={notify} appliedTemplate={appliedTemplate} />}
          {active === "templates" && <TemplateGallery go={go} notify={notify} appliedTemplate={appliedTemplate} onApplyTemplate={onApplyTemplate} />}
          {active === "ai-tools" && <AiToolsPanel notify={notify} go={go} />}
          {active === "providers" && <ProviderSettings notify={notify} />}
          {active === "interview" && <InterviewPractice notify={notify} go={go} />}
          {active === "history" && <HistoryPage notify={notify} />}
          {active === "admin" && currentUser?.role === "ADMIN" && <AdminPanel notify={notify} />}
          {active === "settings" && <GeneralSettings notify={notify} currentUser={currentUser} onUserUpdated={onUserUpdated} />}
          {active === "analysis" && <AnalysisPanel notify={notify} go={go} resumeId={activeResumeId} />}
          {active === "optimize" && <OptimizePanel notify={notify} />}
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
    if (!window.confirm(`确定删除“${resumeItem.title || "未命名简历"}”吗？此操作不能撤销。`)) return;
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
              <button type="button" className="danger" disabled={workingId === resumeItem.id} onClick={() => deleteResume(resumeItem)}><Trash2 size={15} />删除</button>
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
  const { isMounted, isExiting } = usePresence(open);
  if (!isMounted) return null;
  const isCreating = Boolean(creating);
  return (
    <div className={`create-resume-backdrop modal-backdrop ${isExiting ? "is-exiting" : ""}`} role="presentation" onMouseDown={() => !isCreating && onClose()}>
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
  const [isSaving, setIsSaving] = useState(false);
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
    setIsSaving(true);
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
      notify("简历已保存到历史版本");
      return true;
    } catch (error) {
      notify(`保存失败: ${error.message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const changeLayout = async (nextLayout) => {
    if (nextLayout === layout) return;
    layoutTouchedRef.current = true;
    setLayout(nextLayout);
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
              <button className={`link-button ${isSaving ? "is-loading" : ""}`} disabled={isSaving} onClick={() => saveResume()}>
                {isSaving ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                {isSaving ? "正在保存" : "自动保存"}
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
        <ResumePaper form={form} selfEvaluation={selfEvaluation} photoDataUrl={photoDataUrl} layout={layout} themeColor={themeColor} templateTone={templateTone} visibleSections={visibleSections} sectionOrder={moduleOrder} sectionContent={sectionContent} sectionDetails={sectionDetails} profileFields={profileFields} />
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: item.label });
  const transformValue = `${CSS.Transform.toString(transform) || ""}${isDragging ? " scale(1.01)" : ""}`.trim();
  const style = {
    transform: transformValue || undefined,
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={`module-row ${isActive ? "active" : ""} ${!isVisible ? "muted" : ""} ${isDragging ? "is-dragging" : ""} ${isOver && !isDragging ? "is-drop-target" : ""}`}>
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
  const { isMounted, isExiting } = usePresence(open);
  if (!isMounted) return null;
  return (
    <div className={`template-preview-backdrop modal-backdrop ${isExiting ? "is-exiting" : ""}`} role="presentation" onMouseDown={onClose}>
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

function AiToolsPanel({ notify, go }) {
  const generatePositionKeywords = () => {
    const targetPosition = readWorkspaceValue("lingxi-target-position", resume.title);
    window.sessionStorage.setItem(workspaceStorageKey("lingxi-analysis-request"), targetPosition);
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
      <GrammarPanel notify={notify} />
    </section>
  );
}

function GrammarPanel({ notify }) {
  const [content, setContent] = useState("负责招聘平台页面开发，完成筛选和面试排期功能，Thier 页面响应比较快。");
  const [checking, setChecking] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [result, setResult] = useState({
    score: 82,
    issues: [
      { type: "拼写", original: "Thier", suggestion: "Their", reason: "英文拼写错误" },
      { type: "表达", original: "负责", suggestion: "主导", reason: "动词更有行动感" },
    ],
  });

  const runCheck = async () => {
    setChecking(true);
    try {
      const data = await apiRequest("/api/resumes/current/grammar-check", {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      setResult(data.item);
      setHasChecked(true);
      notify("语法检查完成，记录已归档");
    } catch (error) {
      notify(`语法检查失败: ${error.message}`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <section className={`grammar-page ${checking ? "is-loading" : ""} ${hasChecked ? "has-live-result" : ""}`}>
      <div className="grammar-input">
        <h2>AI 语法检查</h2>
        <p>检查错别字、英文拼写、标点和简历表达问题。</p>
        <textarea value={content} onChange={(event) => setContent(event.target.value)} />
        <button className="black-small" onClick={runCheck} disabled={checking}>
          <Check size={16} />
          {checking ? "检查中..." : "开始检查"}
        </button>
      </div>
      <div className="grammar-result" aria-busy={checking}>
        {checking ? (
          <div className="ai-skeleton-stack" aria-label="AI 正在检查文本">
            <i /><i /><i /><i />
          </div>
        ) : <>
        <span>{Number.isFinite(Number(result.score)) ? Number(result.score) : "--"} 分</span>
        <h3>检查结果</h3>
        {(result.issues || []).length === 0 && (
          <article>
            <strong>未发现明显问题</strong>
            <p>当前文本没有返回可修改项。</p>
            <small>可以换成完整简历段落继续检查。</small>
          </article>
        )}
        {(result.issues || []).map((issue, index) => (
          <article key={`${issue.original}-${index}`}>
            <strong>{issue.type}</strong>
            <p>{issue.original} → {issue.suggestion}</p>
            <small>{issue.reason}</small>
          </article>
        ))}
        </>}
      </div>
    </section>
  );
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

function InterviewPractice({ notify, go }) {
  const [targetPosition, setTargetPosition] = useState(() => {
    if (typeof window === "undefined") return resume.title;
    return readWorkspaceValue("lingxi-target-position", resume.title);
  });
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
    const nextTargetPosition = targetPosition.trim();
    if (!nextTargetPosition) {
      notify("请先填写目标岗位");
      return;
    }
    setIsStarting(true);
    try {
      const data = await apiRequest("/api/interviews", {
        method: "POST",
        body: JSON.stringify({ resumeId: 1, targetPosition: nextTargetPosition, questionCount }),
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
        <div className="report-score">{report.totalScore}</div>
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
      <div className={`feedback-card ${feedback ? "has-live-feedback" : ""}`}>
        {feedback ? (
          <>
            <span>{feedback.score} 分</span>
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

function HistoryPage({ notify }) {
  const [history, setHistory] = useState([]);
  const [analysis, setAnalysis] = useState([]);
  const [optimize, setOptimize] = useState([]);
  const [grammar, setGrammar] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);

  const loadHistory = async () => {
    try {
      const [resumeHistory, analysisRecords, optimizeRecords, grammarRecords, interviewRecords] = await Promise.all([
        apiRequest("/api/resumes/current/history"),
        apiRequest("/api/records/analysis"),
        apiRequest("/api/records/optimize"),
        apiRequest("/api/records/grammar"),
        apiRequest("/api/records/interviews"),
      ]);
      setHistory(resumeHistory.items || []);
      setAnalysis(analysisRecords.items || []);
      setOptimize(optimizeRecords.items || []);
      setGrammar(grammarRecords.items || []);
      setInterviews(interviewRecords.items || []);
      setSelectedAnalysis(null);
      notify("历史记录已刷新");
    } catch (error) {
      notify(`历史记录加载失败: ${error.message}`);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <section className="records-page">
      <div className="records-head">
        <div>
          <span className="section-kicker">记录归档</span>
          <p>保存简历版本、AI 诊断、润色和面试反馈归档。</p>
        </div>
        <button className="black-small" onClick={loadHistory}>刷新记录</button>
      </div>
      <div className="records-grid">
        <RecordColumn title="简历版本" items={history.map((item) => `v${item.version} · ${item.summary}`)} />
        <AnalysisRecordColumn records={analysis} onSelect={setSelectedAnalysis} />
        <RecordColumn title="润色记录" items={optimize.map((item) => item.optimizedContent)} />
        <RecordColumn title="语法检查" items={grammar.map((item) => `${item.score} 分 · ${(item.issues || []).length} 个问题`)} />
        <RecordColumn title="模拟面试" items={interviews.map((item) => `${item.targetPosition || item.title} · ${item.totalScore ?? "进行中"} 分 · ${item.overallFeedback || `${item.answerCount || 0} 题已完成`}`)} />
      </div>
      {selectedAnalysis && <AnalysisHistoryDetail record={selectedAnalysis} onClose={() => setSelectedAnalysis(null)} />}
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

function AnalysisRecordColumn({ records, onSelect }) {
  return (
    <section className="record-column analysis-record-column">
      <h3>诊断记录</h3>
      {records.length ? records.map((record) => (
        <button type="button" key={record.id} onClick={() => onSelect(record)}>
          <strong>{record.totalScore} 分 · {record.targetPosition || "目标岗位"}</strong>
          <span>{record.analysisResult}</span>
          <small>{Array.isArray(record.dimensions) ? "查看完整维度" : "旧版记录仅保留摘要"}</small>
        </button>
      )) : <p>暂无记录</p>}
    </section>
  );
}

function AnalysisHistoryDetail({ record, onClose }) {
  const [expandedKey, setExpandedKey] = useState(null);
  const hasDimensions = Array.isArray(record.dimensions) && record.dimensions.length === 6;
  return (
    <section className="analysis-history-detail">
      <div className="mini-heading">
        <div>
          <strong>{record.targetPosition || "目标岗位"}诊断详情</strong>
          <span>简历 v{record.resumeVersion || "-"} · {record.modelProvider || "历史记录"}{record.modelId ? ` / ${record.modelId}` : ""}</span>
        </div>
        <button type="button" className="plain-icon" onClick={onClose} aria-label="关闭诊断详情" title="关闭诊断详情"><X size={18} /></button>
      </div>
      <p>{record.analysisResult}</p>
      {hasDimensions ? <AnalysisDimensionList dimensions={record.dimensions} expandedKey={expandedKey} onToggle={setExpandedKey} /> : <div className="analysis-empty-state"><Gauge size={22} /><span>这是一条旧版诊断记录，未保存可展开的维度详情。</span></div>}
    </section>
  );
}

function AdminPanel({ notify }) {
  const [metrics, setMetrics] = useState(null);

  const loadOverview = async () => {
    try {
      const data = await apiRequest("/api/admin/overview");
      setMetrics(data.metrics);
      notify("后台数据已刷新");
    } catch (error) {
      notify(`后台数据加载失败: ${error.message}`);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const cards = [
    ["用户数", metrics?.users ?? 0],
    ["简历数", metrics?.resumes ?? 0],
    ["诊断记录", metrics?.analysisRecords ?? 0],
    ["润色记录", metrics?.optimizeRecords ?? 0],
    ["语法检查", metrics?.grammarRecords ?? 0],
    ["模拟面试", metrics?.interviews ?? 0],
    ["岗位方向", metrics?.positions ?? 0],
  ];

  return (
    <section className="admin-page">
      <div className="records-head">
        <div>
          <span className="section-kicker">数据概览</span>
          <p>查看用户、简历、AI 记录、岗位方向和模拟面试数据概览。</p>
        </div>
        <button className="black-small" onClick={loadOverview}>刷新统计</button>
      </div>
      <div className="admin-grid">
        {cards.map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

function AnalysisPanel({ notify, go, resumeId }) {
  const [targetPosition, setTargetPosition] = useState(() => {
    if (typeof window === "undefined") return resume.title;
    return readWorkspaceValue("lingxi-target-position", resume.title);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasLiveResult, setHasLiveResult] = useState(false);
  const [needsAiConfig, setNeedsAiConfig] = useState(false);
  const [applyingKeyword, setApplyingKeyword] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedDimension, setExpandedDimension] = useState(null);
  const displayScore = useAnimatedNumber(analysis?.totalScore, hasLiveResult);

  const runAnalysis = useCallback(async (requestedTargetPosition = targetPosition) => {
    const nextTargetPosition = requestedTargetPosition.trim();
    if (!nextTargetPosition) {
      notify("请先在我的简历中填写目标岗位");
      return;
    }

    setIsLoading(true);
    setAnalysis(null);
    setHasLiveResult(false);
    setErrorMessage("");
    setExpandedDimension(null);
    try {
      const analysisResumeId = Number.isInteger(Number(resumeId)) && Number(resumeId) > 0 ? resumeId : "current";
      const data = await apiRequest(`/api/resumes/${analysisResumeId}/analyze`, {
        method: "POST",
        body: JSON.stringify({ targetPosition: nextTargetPosition }),
      });
      if (!Array.isArray(data.item?.dimensions) || data.item.dimensions.length !== 6 || !Number.isFinite(Number(data.item.totalScore))) {
        throw new Error("AI 返回的诊断维度不完整，请稍后重试");
      }
      setAnalysis(data.item);
      setHasLiveResult(true);
      setTargetPosition(data.item.targetPosition || nextTargetPosition);
      setNeedsAiConfig(false);
      notify("AI 诊断已完成并保存记录");
    } catch (error) {
      const isAiNotConfigured = error.message.includes("AI 服务未配置") || error.message.includes("API Key");
      setNeedsAiConfig(isAiNotConfigured);
      setAnalysis(null);
      setErrorMessage(isAiNotConfigured ? "尚未配置可用的 AI 服务，暂时无法生成真实诊断。" : error.message);
      notify(isAiNotConfigured ? "AI 尚未配置，请先配置服务商 API Key" : `诊断失败: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [notify, resumeId, targetPosition]);

  useEffect(() => {
    const analysisRequestKey = workspaceStorageKey("lingxi-analysis-request");
    const requestedTargetPosition = window.sessionStorage.getItem(analysisRequestKey);
    if (!requestedTargetPosition) return;
    window.sessionStorage.removeItem(analysisRequestKey);
    runAnalysis(requestedTargetPosition);
  }, [runAnalysis]);

  const applyKeyword = async (keyword) => {
    if (!keyword || applyingKeyword) return;
    setApplyingKeyword(keyword);
    try {
      const resumeData = await apiRequest("/api/resumes/current");
      const currentSummary = String(resumeData.item?.selfEvaluation || readWorkspaceValue("lingxi-resume-summary") || "").trim();
      if (currentSummary.toLowerCase().includes(keyword.toLowerCase())) {
        notify(`个人简介已包含“${keyword}”`);
        return;
      }

      const nextSummary = currentSummary ? `${currentSummary}；${keyword}` : keyword;
      await apiRequest("/api/resumes/current", {
        method: "PUT",
        body: JSON.stringify({
          selfEvaluation: nextSummary,
          summary: `将 AI 关键词“${keyword}”加入个人简介`,
        }),
      });
      writeWorkspaceValue("lingxi-resume-summary", nextSummary);
      notify(`已将“${keyword}”加入个人简介`);
    } catch (error) {
      notify(`加入关键词失败: ${error.message}`);
    } finally {
      setApplyingKeyword("");
    }
  };

  return (
    <section className={`simple-panel analysis-panel ${isLoading ? "is-loading" : ""} ${hasLiveResult ? "has-live-result" : ""}`} aria-busy={isLoading}>
      {isLoading && <>
        <div className="score-circle is-loading"><LoaderCircle size={44} /></div>
        <h2>正在生成岗位匹配结果</h2>
        <div className="ai-skeleton-stack analysis-skeleton" aria-label="AI 正在生成岗位匹配结果"><i /><i /><i /><i /></div>
      </>}
      {!isLoading && !analysis && <div className={`analysis-empty-state ${errorMessage ? "is-error" : ""}`} role={errorMessage ? "alert" : undefined}>
        <Gauge size={26} />
        <strong>{errorMessage ? "本次诊断未完成" : "尚未生成 AI 诊断"}</strong>
        <span>{errorMessage || "填写并保存简历内容后，基于当前简历和目标岗位生成六项真实诊断维度。"}</span>
      </div>}
      {!isLoading && analysis && <>
        <div className="score-circle">{displayScore}</div>
        <h2>{`${analysis.targetPosition || targetPosition}匹配度${analysis.totalScore >= 85 ? "较高" : "待提升"}`}</h2>
        <div className="analysis-target">
          <span>岗位方向</span>
          <strong>{analysis.targetPosition || targetPosition}</strong>
        </div>
        <p>{analysis.analysisResult}</p>
        <AnalysisDimensionList dimensions={analysis.dimensions} expandedKey={expandedDimension} onToggle={setExpandedDimension} animate />
      </>}
      {needsAiConfig && !isLoading && (
        <div className="ai-config-callout">
          <span>尚未配置可用的 AI 服务，无法生成真实关键词和匹配度。</span>
          <button className="white-small" onClick={() => go("providers")}>去配置 AI 服务商</button>
        </div>
      )}
      <div className="analysis-keywords">
        <span>AI 生成的岗位关键词，点击加入个人简介</span>
        <div className="simple-list">
          {(analysis?.keywords || []).map((item) => (
            <button
              className="keyword-chip"
              key={item}
              type="button"
              disabled={Boolean(applyingKeyword)}
              onClick={() => applyKeyword(item)}
            >
              {applyingKeyword === item ? "正在加入" : item}
            </button>
          ))}
          {!isLoading && !analysis?.keywords?.length && <span>完成诊断后显示</span>}
        </div>
      </div>
      <div className="simple-list">
        {(analysis?.suggestions || []).map((item) => <span key={item}>{item}</span>)}
      </div>
      <button className="black-small" onClick={() => runAnalysis()} disabled={isLoading}>
        {isLoading ? <LoaderCircle className="spin" size={16} /> : <Gauge size={16} />}
        {isLoading ? "AI 正在诊断" : analysis ? "重新诊断" : "开始 AI 诊断"}
      </button>
    </section>
  );
}

function AnalysisDimensionList({ dimensions, expandedKey, onToggle, animate = false }) {
  return (
    <div className={`analysis-dimensions ${animate ? "is-animated" : ""}`}>
      {dimensions.map((dimension, index) => {
        const isExpanded = expandedKey === dimension.key;
        return (
          <article className="analysis-dimension-card" key={dimension.key} style={{ "--index": index, "--score-scale": String(Number(dimension.score || 0) / 100) }}>
            <button type="button" className="analysis-dimension-summary" onClick={() => onToggle(isExpanded ? null : dimension.key)} aria-expanded={isExpanded}>
              <span><strong>{dimension.label}</strong><small>{dimension.weight}% 权重</small></span>
              <b>{dimension.score}</b>
              <span className="dimension-progress" aria-label={`${dimension.label} ${dimension.score} 分`}><i /></span>
              <p>{dimension.summary}</p>
              <ChevronDown className={isExpanded ? "is-open" : ""} size={16} />
            </button>
            {isExpanded && <div className="analysis-dimension-detail">
              <div><strong>评分依据</strong><ul>{dimension.evidence.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div><strong>修改建议</strong><ul>{dimension.suggestions.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </div>}
          </article>
        );
      })}
    </div>
  );
}

function OptimizePanel({ notify }) {
  const [content, setContent] = useState("负责招聘平台页面开发，完成筛选和面试排期功能。");
  const [optimized, setOptimized] = useState("将项目经历改为结果导向表达，补充性能提升、组件复用和接口联调等关键词。");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [hasLiveResult, setHasLiveResult] = useState(false);

  const runOptimize = async () => {
    setIsOptimizing(true);
    try {
      const data = await apiRequest("/api/resumes/current/optimize", {
        method: "POST",
        body: JSON.stringify({ optimizeType: "project_experience", content }),
      });
      setOptimized(data.item.optimizedContent);
      setHasLiveResult(true);
      notify("AI 润色已完成并保存记录");
    } catch (error) {
      notify(`润色失败: ${error.message}`);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <section className={`simple-panel optimize-panel ${isOptimizing ? "is-loading" : ""} ${hasLiveResult ? "has-live-result" : ""}`} aria-busy={isOptimizing}>
      <Sparkles size={42} />
      <h2>AI 优化建议</h2>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} />
      {isOptimizing ? <div className="ai-skeleton-stack analysis-skeleton" aria-label="AI 正在生成润色建议"><i /><i /><i /></div> : <p className="ai-result-copy">{optimized}</p>}
      <button className="black-small" disabled={isOptimizing} onClick={runOptimize}>
        {isOptimizing ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
        {isOptimizing ? "AI 正在润色" : "生成润色"}
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
