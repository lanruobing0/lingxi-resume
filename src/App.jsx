import {
  Bot,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  Home,
  KeyRound,
  Languages,
  LayoutTemplate,
  MessageSquareText,
  Moon,
  PanelLeft,
  Play,
  Plus,
  Save,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  UserRound,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const appNav = [
  { id: "resume", label: "我的简历", icon: FileText },
  { id: "templates", label: "简历模板", icon: LayoutTemplate },
  { id: "providers", label: "AI 服务商", icon: Sparkles },
  { id: "interview", label: "模拟面试", icon: MessageSquareText },
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
  { label: "专业技能", icon: Sparkles },
  { label: "工作经历", icon: BriefcaseBusiness },
  { label: "项目经历", icon: FileText },
];

const templates = [
  { name: "经典模板", desc: "传统简约的简历布局，适合大多数求职场景。", tone: "classic" },
  { name: "两栏布局", desc: "经典两栏，突出个人特色和技能标签。", tone: "dark" },
  { name: "模块标题背景色", desc: "模块标题带浅色背景，突出信息层次。", tone: "band" },
  { name: "时间轴布局", desc: "按时间组织经历，适合经历丰富的候选人。", tone: "timeline" },
  { name: "极简模板", desc: "大面积留白，适合正式岗位投递。", tone: "minimal" },
  { name: "创意模板", desc: "视觉更鲜明，适合作品集和设计岗位。", tone: "creative" },
];

const providers = [
  { name: "DeepSeek", desc: "兼容 OpenAI 格式，适合简历诊断和面试反馈。", active: false },
  { name: "豆包", desc: "国内模型服务，可用于简历润色和语法检查。", active: true },
  { name: "OpenAI", desc: "支持通用文本生成和结构化 JSON 输出。", active: false },
  { name: "Gemini", desc: "适合多模态简历导入和文本理解。", active: false },
];

const questions = [
  "请介绍一个你主导或深度参与的前端项目，并说明你解决的核心问题。",
  "如果一个页面首屏加载很慢，你会从哪些角度定位和优化？",
  "你如何设计一个可复用的表单组件？需要考虑哪些状态？",
  "AI 工具在你的开发流程中能帮助什么？你如何避免直接照搬生成结果？",
];

function App() {
  const [view, setView] = useState(() => initialView());
  const isLanding = view === "landing";

  useEffect(() => {
    const onHash = () => setView(initialView());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id) => {
    setView(id);
    window.history.replaceState(null, "", id === "landing" ? "#landing" : `#${id}`);
  };

  if (isLanding) return <LandingPage go={go} />;
  return <AppStudio active={view} go={go} />;
}

function initialView() {
  if (typeof window === "undefined") return "landing";
  const hash = window.location.hash.replace("#", "");
  const allowed = ["landing", ...appNav.map((item) => item.id), "analysis", "optimize"];
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

function LandingPage({ go }) {
  return (
    <main className="landing">
      <header className="landing-nav">
        <Brand />
        <div className="landing-actions">
          <button className="plain-icon" aria-label="切换语言">
            <Languages size={18} />
          </button>
          <button className="plain-icon" aria-label="切换主题">
            <Sun size={18} />
          </button>
          <a className="github-pill" href="https://github.com/JOYCEQL/magic-resume" target="_blank" rel="noreferrer">
            <Star size={15} />
            Star on GitHub
            <span>8,609</span>
          </a>
          <button className="landing-start" onClick={() => go("resume")}>开始使用</button>
        </div>
      </header>

      <section className="landing-hero">
        <span className="hero-badge">
          <Sparkles size={16} />
          AI 简历优化与模拟面试
        </span>
        <h1>让求职准备变得简单而智能</h1>
        <p>灵犀简历利用 AI 技术，帮助你快速创建专业简历，诊断岗位匹配度，并通过模拟面试提升表达能力。</p>
        <div className="hero-buttons">
          <button className="black-cta" onClick={() => go("resume")}>
            立即开始
            <span>→</span>
          </button>
          <button className="white-cta" onClick={() => go("templates")}>
            <Play size={15} />
            浏览模板
          </button>
        </div>
        <div className="hero-preview">
          <MiniWorkbench />
        </div>
      </section>

      <section className="landing-section">
        <h2>为什么选择灵犀简历?</h2>
        <div className="section-rule" />
        <p className="section-subtitle">一站式求职解决方案，让简历制作、AI 优化和面试训练连成完整闭环。</p>
        <FeatureShowcase />
      </section>

      <section className="landing-split">
        <div className="privacy-card">
          <ShieldCheck size={90} strokeWidth={1.2} />
          <span>LOCAL</span>
        </div>
        <div>
          <span className="green-badge">
            <ShieldCheck size={15} />
            隐私安全
          </span>
          <h2>数据安全，隐私优先</h2>
          <p>简历和面试记录可以保存在本地或数据库中，API Key 由用户自行配置，避免敏感信息直接暴露。</p>
          <div className="soft-list active">
            <strong>数据库记录</strong>
            <span>诊断、优化、面试反馈均可保存</span>
            <ChevronDown size={16} />
          </div>
          <div className="soft-list">
            <strong>多种导出格式</strong>
            <span>支持 PDF、SQL 数据和报告材料整理</span>
            <ChevronDown size={16} />
          </div>
        </div>
      </section>

      <section className="faq-section">
        <h2>常见问题</h2>
        <div className="section-rule" />
        {["使用灵犀简历需要付费吗?", "我的简历数据安全吗?", "支持哪些 AI 服务商?", "能否用于课程设计答辩?", "是否支持模拟面试?"].map((item) => (
          <button className="faq-item" key={item}>
            <span>{item}</span>
            <ChevronDown size={18} />
          </button>
        ))}
      </section>

      <section className="final-cta">
        <span>MAGIC RESUME</span>
        <h2>开启你的新职业篇章</h2>
        <p>创建一份能展示能力、匹配岗位、支撑面试表达的智能简历。</p>
        <button className="black-cta" onClick={() => go("resume")}>
          免费开始使用
          <span>→</span>
        </button>
      </section>
    </main>
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
        <div className="paper-note">
          <strong>Their</strong>
          <span>Thier</span>
          <i />
        </div>
      </div>
    </div>
  );
}

function AppStudio({ active, go }) {
  const activeMeta = appNav.find((item) => item.id === active) || { label: "我的简历" };

  return (
    <div className="studio">
      <aside className="studio-sidebar">
        <button className="sidebar-logo" onClick={() => go("landing")}>
          <Brand compact />
        </button>
        <nav className="studio-nav">
          {appNav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => go(item.id)}>
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="studio-main">
        <header className="studio-topbar">
          <button className="plain-icon" aria-label="折叠菜单">
            <PanelLeft size={18} />
          </button>
          <h1>{activeMeta.label}</h1>
        </header>

        {active === "resume" && <ResumeEditor />}
        {active === "templates" && <TemplateGallery />}
        {active === "providers" && <ProviderSettings />}
        {active === "interview" && <InterviewPractice />}
        {active === "settings" && <GeneralSettings />}
        {active === "analysis" && <AnalysisPanel />}
        {active === "optimize" && <OptimizePanel />}
      </main>
    </div>
  );
}

function ResumeEditor() {
  return (
    <section className="resume-editor">
      <aside className="resume-modules">
        <div className="mini-heading">
          <strong>布局</strong>
          <button><Plus size={18} /></button>
        </div>
        {resumeSections.map((item, index) => {
          const Icon = item.icon;
          return (
            <button className={index === 0 ? "active" : ""} key={item.label}>
              <Icon size={18} />
              <span>{item.label}</span>
              <Eye size={15} />
            </button>
          );
        })}
        <div className="theme-box">
          <strong>主题色</strong>
          <div className="color-row">
            {["#171717", "#2f7de1", "#4fb37e", "#7c5ce6", "#e06b48", "#d64b4b"].map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </div>
        </div>
      </aside>

      <section className="editor-form">
        <div className="form-card">
          <div className="mini-heading">
            <strong>基本信息</strong>
            <span>自动保存</span>
          </div>
          <div className="layout-switch">
            <button className="active">左图右文</button>
            <button>居中信息</button>
            <button>紧凑排列</button>
          </div>
          {[
            ["姓名", resume.name],
            ["职位", resume.title],
            ["邮箱", resume.email],
            ["电话", resume.phone],
            ["城市", resume.city],
            ["个人主页", resume.website],
          ].map(([label, value]) => (
            <label className="input-row" key={label}>
              <span>{label}</span>
              <input defaultValue={value} />
            </label>
          ))}
        </div>
        <div className="form-card ai-card">
          <strong>AI 快速建议</strong>
          <div>
            <button>优化项目经历</button>
            <button>生成岗位关键词</button>
            <button>进入模拟面试</button>
          </div>
        </div>
      </section>

      <section className="resume-preview">
        <div className="preview-actions">
          <span>A4 实时预览</span>
          <button><Download size={16} /></button>
        </div>
        <ResumePaper />
      </section>
    </section>
  );
}

function ResumePaper() {
  return (
    <article className="resume-paper-modern">
      <header>
        <div className="avatar">林</div>
        <div>
          <h2>{resume.name}</h2>
          <p>{resume.title}</p>
        </div>
        <ul>
          <li>{resume.email}</li>
          <li>{resume.phone}</li>
          <li>{resume.city}</li>
          <li>{resume.website}</li>
        </ul>
      </header>
      <ResumeBlock title="专业技能">
        <li>熟悉 React、Vue、TypeScript、Vite、Pinia、Zustand 等前端技术栈。</li>
        <li>掌握组件化开发、权限控制、性能优化和可视化看板开发。</li>
        <li>了解 Spring Boot 接口联调、MySQL 数据建模和 RESTful API 设计。</li>
      </ResumeBlock>
      <ResumeBlock title="工作经历">
        <li>负责招聘平台候选人看板、筛选流程和面试排期模块开发。</li>
        <li>沉淀表单组件和权限配置方案，减少重复开发成本。</li>
        <li>优化列表渲染与接口缓存策略，核心页面加载效率提升 35%。</li>
      </ResumeBlock>
      <ResumeBlock title="项目经历">
        <li>实现简历编辑、AI 诊断、内容优化和模拟面试核心流程。</li>
        <li>设计三栏工作台，支持编辑信息与 A4 简历实时预览。</li>
      </ResumeBlock>
    </article>
  );
}

function ResumeBlock({ title, children }) {
  return (
    <section>
      <h3>{title}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function TemplateGallery() {
  return (
    <section className="template-page">
      <div className="template-toolbar">
        <h2>模板</h2>
        <div className="color-row large">
          {["#f8f8f6", "#477ee8", "#56b987", "#7d5df0", "#e87930", "#e4584f", "#4b5563", "#000"].map((color) => (
            <span key={color} style={{ background: color }} />
          ))}
        </div>
      </div>
      <div className="template-grid">
        {templates.map((template) => (
          <article className="template-card" key={template.name}>
            <MiniResume tone={template.tone} />
            <h3>{template.name}</h3>
            <p>{template.desc}</p>
            <div>
              <button className="white-cta">预览</button>
              <button className="black-small">使用此模板</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MiniResume({ tone }) {
  return (
    <div className={`mini-resume ${tone}`}>
      <span />
      <i />
      <i />
      <i />
      <b />
      <i />
      <i />
      <i />
    </div>
  );
}

function ProviderSettings() {
  return (
    <section className="providers-page">
      <div className="provider-list">
        {providers.map((provider) => (
          <button className={provider.active ? "active" : ""} key={provider.name}>
            <Bot size={20} />
            <span>
              <strong>{provider.name}</strong>
              <small>{provider.active ? "已选择" : "未配置"}</small>
            </span>
            <i />
          </button>
        ))}
      </div>
      <div className="provider-form">
        <div className="provider-title">
          <Sparkles size={30} />
          <div>
            <h2>豆包</h2>
            <p>在火山引擎获取 API 密钥，用于简历润色和模拟面试反馈。</p>
          </div>
        </div>
        <label>
          API Key
          <input placeholder="API Key" />
        </label>
        <label>
          模型 ID
          <input placeholder="模型 ID" />
        </label>
        <button className="black-small">
          <KeyRound size={16} />
          保存配置
        </button>
      </div>
    </section>
  );
}

function InterviewPractice() {
  const [index, setIndex] = useState(0);
  const progress = useMemo(() => Math.round(((index + 1) / questions.length) * 100), [index]);

  return (
    <section className="interview-page">
      <aside>
        <div className="mini-heading">
          <strong>面试题</strong>
          <span>{progress}%</span>
        </div>
        {questions.map((question, questionIndex) => (
          <button className={index === questionIndex ? "active" : ""} onClick={() => setIndex(questionIndex)} key={question}>
            <span>{questionIndex + 1}</span>
            {question}
          </button>
        ))}
      </aside>
      <div className="answer-card">
        <div className="mini-heading">
          <strong>回答练习</strong>
          <span>前端开发工程师</span>
        </div>
        <div className="question-bubble">
          <Bot size={22} />
          <p>{questions[index]}</p>
        </div>
        <textarea defaultValue="我参与过一个招聘管理系统的前端开发，负责简历筛选、候选人看板和面试安排模块。" />
        <button className="black-small">
          <Send size={16} />
          提交回答并生成反馈
        </button>
      </div>
      <div className="feedback-card">
        <span>81 分</span>
        <h3>AI 反馈</h3>
        <p><strong>优点:</strong> 回答能说明项目背景和个人职责，表达比较完整。</p>
        <p><strong>问题:</strong> 缺少具体技术难点和量化结果。</p>
        <p><strong>建议:</strong> 补充性能优化、组件设计或复杂状态管理，并用数据说明效果。</p>
      </div>
    </section>
  );
}

function GeneralSettings() {
  return (
    <section className="settings-page">
      <h2>设置</h2>
      <div className="settings-card">
        <div>
          <FolderOpen size={28} />
          <div>
            <strong>同步目录</strong>
            <p>选择一个文件夹来同步和备份你的简历。</p>
          </div>
        </div>
        <div className="directory-row">
          <input placeholder="尚未配置同步文件夹" />
          <button className="black-small">选择文件夹</button>
        </div>
      </div>
    </section>
  );
}

function AnalysisPanel() {
  return (
    <section className="simple-panel">
      <div className="score-circle">86</div>
      <h2>前端开发工程师匹配度较高</h2>
      <p>简历基础完整，项目经历与目标岗位相关，但还需要补充量化成果和技术决策过程。</p>
    </section>
  );
}

function OptimizePanel() {
  return (
    <section className="simple-panel">
      <Sparkles size={42} />
      <h2>AI 优化建议</h2>
      <p>将项目经历改为结果导向表达，补充性能提升、组件复用和接口联调等关键词。</p>
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
