import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, RefreshCw, Search } from "lucide-react";

export function PublicMaterialLibrary({ request, go }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await request("/api/interview-materials")).items); }
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

  return <section className="public-material-library">
    <header className="material-section-head"><h2>公共面试资料</h2><p>管理员维护，自动参与岗位分析与面试检索。</p></header>
    <div className="personal-material-toolbar"><label className="material-search"><Search size={16} aria-hidden="true" /><input aria-label="搜索公共面试资料" placeholder="搜索名称、岗位或技能" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="white-small material-refresh" aria-label="刷新公共资料" title="刷新公共资料" disabled={loading} onClick={load}><RefreshCw size={16} /></button></div>
    {error ? <div className="knowledge-empty" role="alert"><strong>资料暂时无法读取</strong><p>{error}</p><button className="white-small" onClick={load}>重新读取</button></div> : loading ? <div className="material-skeletons" aria-label="正在加载公共资料">{[1, 2, 3].map((id) => <div className="skeleton" key={id} />)}</div> : groups.length ? <div className="public-material-groups">{groups.map(([name, documents]) => <details className="public-material-group" key={name}><summary><BookOpen size={20} /><strong>{name}</strong><span>{documents.length} 份资料</span><ChevronDown size={17} /></summary><div>{documents.map((document) => <article key={document.id}><h3>{document.title}</h3><p>{document.description || "已建立索引，可用于面试准备与岗位分析。"}</p><div className="public-material-tags">{document.skillTags?.map((tag) => <span key={tag}>{tag}</span>)}</div><small>{document.characterCount.toLocaleString()} 字 · 更新于 {new Date(document.updatedAt).toLocaleDateString("zh-CN")}</small></article>)}</div></details>)}</div> : <div className="knowledge-empty"><BookOpen size={26} /><strong>{query ? "没有找到匹配的资料" : "公共资料库还在准备中"}</strong><p>{query ? "试试岗位名称或其他技能关键词。" : "管理员上传并建立索引后，资料会出现在这里。已有简历与岗位面试流程仍可使用。"}</p></div>}
    <footer className="public-material-footer"><p>资料提供知识依据，不能证明你已有相关项目或工作经历。</p><button className="black-small" onClick={() => go("interview")}>前往模拟面试</button></footer>
  </section>;
}
