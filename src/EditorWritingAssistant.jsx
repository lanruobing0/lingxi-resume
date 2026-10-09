import { useState } from "react";

export function redactWritingText(text, privateValues = []) {
  let safe = String(text || "");
  for (const value of privateValues.filter(value => typeof value === "string" && value.trim())) safe = safe.split(value).join("[已移除个人信息]");
  return safe.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[已移除邮箱]")
    .replace(/https?:\/\/\S+/gi, "[已移除链接]").replace(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g, "[已移除电话]");
}

export function EditorWritingAssistant({ resumeId, content, passage, prepare, request, notify }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const run = async kind => {
    const original = kind === "grammar-check" ? content : passage;
    if (working || !resumeId || !original?.trim()) return;
    setWorking(true); setError(""); setResult(null);
    try {
      if (!await prepare()) throw new Error("简历未保存成功，请重试保存后再使用。");
      const response = await request(`/api/resumes/${resumeId}/${kind}`, { method: "POST", body: JSON.stringify({ content: original, ...(kind === "optimize" ? { optimizeType: "general" } : {}) }) });
      setResult({ kind, original, item: response.item });
      notify("结果已保存到该简历的历史记录");
    } catch (failure) { setError(failure.message); }
    finally { setWorking(false); }
  };
  return <section className="editor-writing-assistant" aria-label="简历检查与润色">
    <div className="mini-heading"><strong>检查与润色</strong><button className="white-small" disabled={!resumeId || working || !content.trim()} onClick={() => run("grammar-check")}>检查简历</button></div>
    <p>检查正文的错别字、标点和表达。建议供你核对后手动修改。</p>
    <div className="editor-passage"><strong>待润色段落</strong><p>{passage || "在个人简介或经历要点旁点击“润色这段”，也可以选中文本只润色其中一段。"}</p><button className="white-small" disabled={!resumeId || working || !passage.trim()} onClick={() => run("optimize")}>生成段落润色</button></div>
    {working && <p role="status">正在保存简历并生成结果…</p>}
    {error && <p className="job-error" role="alert">本次操作失败：{error}</p>}
    {result && <div className="editor-writing-result">
      <h4>{result.kind === "optimize" ? "段落润色建议" : "简历检查结果"}</h4>
      <details><summary>查看本次提交原文</summary><pre>{result.original}</pre></details>
      {result.kind === "optimize" ? <><p>{result.item.optimizedContent}</p><button className="white-small" onClick={async () => { try { await navigator.clipboard.writeText(result.item.optimizedContent); notify("润色建议已复制"); } catch { notify("复制失败，请手动选择建议文本"); } }}>复制建议</button></> : <>{result.item.issues?.length ? <ul>{result.item.issues.map((issue, index) => <li key={index}><strong>{issue.type}</strong><p>{issue.original} → {issue.suggestion}</p><small>{issue.reason}</small></li>)}</ul> : <p>本次检查未发现明显文字问题。</p>}</>}
    </div>}
  </section>;
}
