import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronRight, RefreshCw, Search } from "lucide-react";
import { readMaterialDraft, saveMaterialDraft } from "./interviewMaterialDraft";

export function PublicMaterialLibrary({ request, go }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await request("/api/interview-materials"); setItems(data.items); setUserId(data.userId); setSelectedIds(readMaterialDraft(data.userId).documentIds); }
    catch (cause) { setError(cause.message); }
    finally { setLoading(false); }
  }, [request]);
  useEffect(() => { load(); }, [load]);
  const groups = useMemo(() => {
    const result = new Map(); const normalized = query.trim().toLowerCase();
    for (const item of items) {
      if (normalized && ![item.title, item.description, item.jobFamily, ...(item.skillTags || [])].join(" ").toLowerCase().includes(normalized)) continue;
      const name = item.jobFamily || "通用面试准备";
      if (!result.has(name)) result.set(name, []);
      result.get(name).push(item);
    }
    return [...result];
  }, [items, query]);
  const toggle = (id, checked) => {
    const ids = checked ? [...new Set([...selectedIds, id])] : selectedIds.filter(value => value !== id);
    setSelectedIds(ids); saveMaterialDraft(userId, { mode: "MANUAL", documentIds: ids });
  };

  return <section className="public-material-library">
    <header className="material-section-head"><h2>公共面试资料</h2><p>查看摘要并勾选资料，创建面试时还可确认个人资料和使用方式。</p></header>
    <div className="personal-material-toolbar"><label className="material-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索公共面试资料" placeholder="搜索名称、岗位或技能" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="white-small material-refresh" aria-label="刷新公共资料" title="刷新公共资料" disabled={loading} onClick={load}><RefreshCw size={16} /></button></div>
    {error ? <div className="knowledge-empty" role="alert"><strong>资料暂时无法读取</strong><p>{error}</p><button className="white-small" onClick={load}>重新读取</button></div> : loading ? <div className="material-skeletons" aria-label="正在加载公共资料">{[1, 2, 3].map((id) => <div className="skeleton" key={id} />)}</div> : groups.length ? <div className="public-material-groups">{groups.map(([name, documents]) => {
      const overview = [...new Set(documents.map(document => document.description || document.summary).filter(Boolean))].join("；");
      return <details className="public-material-group" key={name}>
        <summary className="public-material-group-heading"><ChevronRight size={18} aria-hidden="true" /><div className="public-material-group-overview"><div className="public-material-group-title"><strong>{name}</strong><span>{documents.length} 份资料</span></div><p>{overview.length > 240 ? `${overview.slice(0, 240)}…` : overview || "展开查看本组资料并选择本次面试内容。"}</p></div></summary>
        <div>{documents.map(document => <article key={document.id}><label className="public-material-select"><input type="checkbox" checked={selectedIds.includes(document.id)} onChange={event => toggle(document.id, event.target.checked)} /><span>{document.title}</span></label><p className="public-material-document-summary">{document.summary || document.description || "暂无摘要"}</p><div className="public-material-tags">{document.skillTags?.map(tag => <span key={tag}>{tag}</span>)}</div><small>{document.characterCount.toLocaleString()} 字 · 更新于 {new Date(document.updatedAt).toLocaleDateString("zh-CN")}</small></article>)}</div>
      </details>;
    })}</div> : <div className="knowledge-empty"><BookOpen size={26} /><strong>{query ? "没有找到匹配的资料" : "公共资料库还在准备中"}</strong><p>{query ? "试试岗位名称或其他技能关键词。" : "管理员上传并建立索引后，资料会出现在这里。已有简历与岗位面试流程仍可使用。"}</p></div>}
    <footer className="public-material-footer"><p>已选 {selectedIds.filter(id => items.some(item => item.id === id)).length} 份公共资料。先选择岗位报告，再确认本次资料。</p><button className="black-small" disabled={loading || Boolean(error)} onClick={() => go("interview")}>{selectedIds.length ? "使用所选资料准备面试" : "前往面试准备"}</button></footer>
  </section>;
}
