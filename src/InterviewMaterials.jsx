import { useCallback, useEffect, useState } from "react";
import { FileText, FolderOpen, LoaderCircle, Pencil, Plus, RefreshCw, Search, Trash2, Upload, X } from "lucide-react";
import { KnowledgeFileImport } from "./KnowledgeFileImport";
import { PublicMaterialLibrary } from "./PublicMaterialLibrary";

const endpoint = "/api/personal-materials";
const blank = () => ({ title: "", description: "", jobFamily: "", rawText: "", skillTags: "", documentType: "INTERVIEW_QUESTION", sourceType: "TEXT_ENTRY", sourceName: "", sourceUrl: "", seniority: "", language: "zh-CN", aiConsent: false });
const stateLabel = (item) => !item.aiConsent ? "已保存 · 未启用检索" : item.status === "PROCESSED" && item.vectorStatus === "INDEXED" ? "可用于面试" : item.vectorStatus === "FAILED" || item.status === "FAILED" ? "处理失败 · 可重试" : "待建立索引";

export function InterviewMaterials({ request, go, adminPanel }) {
  const [tab, setTab] = useState("personal");
  const [personalBusy, setPersonalBusy] = useState(false);
  return <div className="interview-materials"><div className="material-tabs" role="tablist" aria-label="面试资料范围">
    {[['personal', '我的资料'], ['public', '公共资料库'], ...(adminPanel ? [['admin', '公共资料管理']] : [])].map(([value, label]) => <button key={value} disabled={personalBusy} role="tab" id={`materials-tab-${value}`} aria-controls="materials-panel" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</button>)}
  </div><div id="materials-panel" role="tabpanel" aria-labelledby={`materials-tab-${tab}`}>{tab === "personal" ? <PersonalMaterials request={request} onBusyChange={setPersonalBusy} /> : tab === "public" ? <PublicMaterialLibrary request={request} go={go} /> : adminPanel}</div></div>;
}

function PersonalMaterials({ request, onBusyChange }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(blank);
  const [upload, setUpload] = useState(false);
  const [query, setQuery] = useState("");
  const [deleteItem, setDeleteItem] = useState(null);
  const [notice, setNotice] = useState("");
  const busy = Boolean(working) || extracting;
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems((await request(endpoint)).items); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);
  const open = async (item = null, fromFile = false) => {
    if (busy) return;
    setError(""); setNotice(""); setWorking("read");
    try {
      const value = item ? (await request(`${endpoint}/${item.id}`)).item : blank();
      setForm({ ...value, skillTags: Array.isArray(value.skillTags) ? value.skillTags.join(", ") : value.skillTags });
      setEditor({ id: item?.id || null }); setUpload(fromFile);
    } catch (cause) { setError(cause.message); }
    finally { setWorking(""); }
  };
  const publish = async (id) => {
    setWorking("正在整理资料…");
    await request(`${endpoint}/${id}/process`, { method: "POST" });
    setWorking("正在建立向量索引…");
    await request(`${endpoint}/${id}/index`, { method: "POST" });
  };
  const save = async (event) => {
    event.preventDefault(); if (busy) return;
    let savedId = null;
    setError(""); setNotice(""); setWorking("正在保存…");
    try {
      const result = await request(editor.id ? `${endpoint}/${editor.id}` : endpoint, {
        method: editor.id ? "PUT" : "POST", body: JSON.stringify({ ...form, skillTags: form.skillTags.split(",").map((tag) => tag.trim()).filter(Boolean) }),
      });
      savedId = result.item.id; setEditor(null);
      if (form.aiConsent) await publish(savedId);
      setNotice(form.aiConsent ? "资料已启用，仅你的新模拟面试可以检索使用。" : "资料已保存，尚未提交给向量模型。");
    } catch (cause) { setError(savedId ? `资料已保存，索引未完成：${cause.message}。可以稍后重试。` : cause.message); }
    finally { await load(); setWorking(""); }
  };
  const retry = async (item) => {
    if (busy) return; setError(""); setNotice("");
    try { await publish(item.id); setNotice("资料已启用，可用于你的新模拟面试。"); }
    catch (cause) { setError(`索引未完成：${cause.message}`); }
    finally { await load(); setWorking(""); }
  };
  const remove = async (item) => {
    if (busy) return; setWorking("正在删除…"); setError(""); setNotice("");
    try { await request(`${endpoint}/${item.id}`, { method: "DELETE" }); setDeleteItem(null); setNotice("资料及向量索引已删除。"); }
    catch (cause) { setError(cause.message); }
    finally { await load(); setWorking(""); }
  };
  const field = (name) => ({ value: form[name], disabled: busy, onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })) });
  const visible = items.filter((item) => [item.title, item.description, item.jobFamily, ...(item.skillTags || [])].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  return <section className="personal-materials" aria-labelledby="personal-materials-title">
    <header className="material-section-head"><h2 id="personal-materials-title">题目与复习笔记</h2><p>资料仅自己可见，启用后用于你的新模拟面试。</p></header>
    <div className="personal-material-toolbar">
      {items.length > 0 || query ? <label className="material-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索我的面试资料" placeholder="搜索名称、岗位或标签" value={query} onChange={(event) => setQuery(event.target.value)} /></label> : <span className="material-count">{loading ? "正在读取资料…" : "0 份资料"}</span>}
      <div className="material-toolbar-actions"><button className="white-small material-refresh" aria-label="刷新个人资料" title="刷新个人资料" disabled={busy || loading} onClick={() => { setError(""); load(); }}><RefreshCw size={16} /></button><button className="white-small" disabled={busy} onClick={() => open()}><Plus size={16} />新建资料</button>{items.length > 0 && <button className="black-small" disabled={busy} onClick={() => open(null, true)}><Upload size={16} />上传文件</button>}</div>
    </div>
    {error && <p role="alert" className="knowledge-operation-error">{error}</p>}
    {notice && <p role="status" className="material-notice">{notice}</p>}
    {working && working !== "read" && <p role="status" className="knowledge-operation-status"><LoaderCircle className="spin" size={16} />{working}</p>}
    {editor && <form className="personal-material-form" onSubmit={save}>
      <div className="knowledge-form-head"><h3>{editor.id ? "编辑个人资料" : upload ? "上传个人资料" : "新建个人资料"}</h3><button type="button" aria-label="关闭个人资料表单" className="plain-icon" disabled={busy} onClick={() => setEditor(null)}><X size={18} /></button></div>
      {upload && <KnowledgeFileImport request={request} endpoint={`${endpoint}/extract`} personal disabled={Boolean(working)} onReadingChange={setExtracting} onImported={(data) => setForm((current) => ({ ...current, rawText: data.rawText, sourceName: data.fileName, sourceType: "FILE_IMPORT", title: current.title || data.fileName.replace(/\.[^.]+$/, "").slice(0, 160) }))} />}
      <div className="personal-material-fields"><label>资料标题<input required maxLength={160} {...field("title")} /></label><label>岗位方向<input maxLength={100} placeholder="例如：AI Agent 工程" {...field("jobFamily")} /></label><label>资料类型<select {...field("documentType")}><option value="INTERVIEW_QUESTION">面试题</option><option value="ROLE_SKILL_DESCRIPTION">技术笔记</option><option value="STAR_TEMPLATE">表达提纲</option><option value="INTERVIEW_RUBRIC">面试评价要点</option></select></label><label>技能标签<input maxLength={1000} placeholder="用英文逗号分隔" {...field("skillTags")} /></label></div>
      <label className="personal-material-wide">简介<textarea maxLength={2000} rows={2} {...field("description")} /></label>
      <label className="personal-material-wide">资料正文<textarea required maxLength={300000} rows={12} placeholder="输入题目或复习资料，不要填写姓名、联系方式、密钥或其他私人信息。" {...field("rawText")} /></label>
      <p className="personal-material-privacy">系统会隐藏可识别的联系方式和账号资料；仍请逐项核对，不要上传个人简历、第三方隐私或密钥。建立索引会将核对后的资料发送给已配置的向量模型，模拟面试也可能将相关片段发送给所选 AI 服务商。</p>
      <label className="knowledge-publish-option"><input type="checkbox" checked={form.aiConsent} disabled={busy} onChange={(event) => setForm((current) => ({ ...current, aiConsent: event.target.checked }))} />我已核对内容，允许提交给模型并用于自己的面试检索</label>
      <div className="knowledge-form-actions"><button type="button" className="white-small" disabled={busy} onClick={() => setEditor(null)}>取消</button><button className="black-small" disabled={busy}>{form.aiConsent ? "保存并建立索引" : "保存资料"}</button></div>
    </form>}
    {loading ? <div className="material-skeletons" aria-label="正在读取个人资料">{[1, 2].map((id) => <div className="skeleton" key={id} />)}</div> : visible.length ? <div className="personal-material-list">{visible.map((item) => <article key={item.id}>
      <div className="personal-material-row"><FileText size={19} /><h3>{item.title}</h3><span className="personal-material-state">{stateLabel(item)}</span></div><p>{item.description || item.jobFamily || "个人面试准备资料"}</p><small>{item.characterCount.toLocaleString()} 字 · {item.sourceType === "FILE_IMPORT" ? "文件导入" : "自建"} · 更新于 {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</small>
      {item.aiConsent && (item.indexFailureMessage || item.failureMessage) && <p className="personal-material-failure">{item.indexFailureMessage || item.failureMessage}</p>}
      <div className="personal-material-actions"><button className="white-small" disabled={busy} onClick={() => open(item)}><Pencil size={14} />查看 / 编辑</button>{item.aiConsent && !(item.status === "PROCESSED" && item.vectorStatus === "INDEXED") && <button className="white-small" disabled={busy} onClick={() => retry(item)}>重试索引</button>}<button className="danger-text-button" disabled={busy} onClick={() => setDeleteItem(item)}><Trash2 size={14} />删除</button></div>
      {deleteItem?.id === item.id && <div className="personal-material-delete" role="group" aria-label="确认删除个人资料"><p>删除「{item.title}」及其向量索引？已有面试记录保留，来源将显示为不可用。</p><button className="white-small" disabled={busy} onClick={() => setDeleteItem(null)}>取消删除</button><button className="danger-action" disabled={busy} onClick={() => remove(item)}>确认删除</button></div>}
    </article>)}</div> : !editor && <div className="material-empty"><span className="material-empty-icon"><FolderOpen size={24} aria-hidden="true" /></span><h3>{query ? "没有找到匹配资料" : "还没有个人资料"}</h3><p>{query ? "换个名称、岗位或技能关键词试试。" : "上传面试题、技术笔记或复习提纲，集中整理你的面试准备。"}</p>{query ? <button className="white-small" onClick={() => setQuery("")}>清空搜索</button> : <><button className="black-small" disabled={busy} onClick={() => open(null, true)}><Upload size={16} />上传第一份资料</button><small>支持 TXT、Markdown、PDF、Word 文字版文件</small></>}</div>}
  </section>;
}
