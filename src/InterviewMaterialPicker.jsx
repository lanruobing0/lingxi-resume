import { useEffect, useState } from "react";
import { materialModeLabel, readMaterialDraft, saveMaterialDraft, selectionForApi } from "./interviewMaterialDraft";

export function InterviewMaterialPicker({ request, working, onConfirm, onCancel }) {
  const [options, setOptions] = useState(null);
  const [selection, setSelection] = useState({ mode: "AUTO", documentIds: [] });
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false;
    setOptions(null); setError("");
    request("/api/interview-material-options").then(data => {
      if (!disposed) { setOptions(data); setSelection(readMaterialDraft(data.userId)); }
    }).catch(cause => { if (!disposed) setError(cause.message); });
    return () => { disposed = true; };
  }, [request, revision]);
  const change = value => { setSelection(value); saveMaterialDraft(options.userId, value); };
  const eligible = (options?.items || []).filter(item => item.available);
  const missing = selection.documentIds.filter(id => !eligible.some(item => item.id === id));
  const invalid = selection.mode === "MANUAL" && (!selection.documentIds.length || missing.length > 0);
  return <section className="interview-material-picker" aria-label="确认本次面试资料">
    <h4>确认本次面试资料</h4><p>资料只提供知识依据。面试始终使用岗位报告绑定的简历版本和岗位要求。</p>
    {error && <p role="alert">读取资料失败：{error} <button className="white-small" onClick={() => setRevision(value => value + 1)}>重试</button></p>}
    {!options && !error && <p role="status">正在读取可用资料…</p>}
    {options && <>
      <fieldset disabled={working}><legend>资料使用方式</legend><div className="interview-material-modes">{["AUTO", "MANUAL", "NONE"].map(mode => <label key={mode}><input type="radio" name="interview-material-mode" value={mode} checked={selection.mode === mode} onChange={() => change({ ...selection, mode })} />{materialModeLabel(mode)}</label>)}</div></fieldset>
      <p>{selection.mode === "AUTO" ? "从当前可用公共资料及已启用的个人资料中，按简历、岗位和匹配缺口检索；实际命中的资料会记录在面试中。" : selection.mode === "NONE" ? "不检索公共或个人资料，仅根据简历、岗位要求和匹配缺口生成题目。" : `本次仅检索你勾选的 ${selection.documentIds.length} 份资料。`}</p>
      {selection.mode !== "NONE" && <div className="interview-material-options">{["PUBLIC", "PRIVATE"].map(scope => <fieldset key={scope} disabled={working}><legend>{scope === "PUBLIC" ? "公共资料" : "个人资料"}</legend>{options.items.filter(item => item.scope === scope).length ? options.items.filter(item => item.scope === scope).map(item => <label key={item.id} className="interview-material-option">{selection.mode === "MANUAL" && <input type="checkbox" disabled={!item.available} checked={selection.documentIds.includes(item.id)} onChange={event => change({ mode: "MANUAL", documentIds: event.target.checked ? [...selection.documentIds, item.id] : selection.documentIds.filter(id => id !== item.id) })} />}<span><strong>{item.title}</strong><small>{item.available ? item.summary : "尚未启用或索引未完成，请先在我的资料中启用。"}</small></span></label>) : <p>暂无{scope === "PUBLIC" ? "公共" : "个人"}资料</p>}</fieldset>)}</div>}
      {invalid && <p role="alert">{missing.length ? "部分所选资料已变更或不可用，请清空后重新选择。" : "请至少勾选一份资料，或选择不使用资料。"}{missing.length > 0 && <button className="white-small" onClick={() => change({ mode: "MANUAL", documentIds: [] })}>清空选择</button>}</p>}
    </>}
    <div className="knowledge-form-actions"><button className="white-small" disabled={working} onClick={onCancel}>取消</button><button className="black-small" disabled={working || !options || invalid} onClick={() => onConfirm(selectionForApi(selection))}>{working ? "正在生成题目…" : "确认资料并创建面试"}</button></div>
  </section>;
}

export function InterviewMaterialHistory({ selection }) {
  return <details className="interview-material-history"><summary>本次资料：{materialModeLabel(selection?.mode)}{selection?.mode !== "NONE" && selection && ` · 实际召回 ${selection.usedDocumentIds?.length || 0} 份`}</summary>{selection ? <><p>{selection.mode === "NONE" ? "创建时选择不使用资料，没有进行知识检索。" : "以下为创建时确认的资料范围；实际召回的片段见逐题知识来源。"}</p><ul>{selection.documents.map(item => <li key={item.id}>{item.title} · {item.scope === "PUBLIC" ? "公共" : "个人"} · 版本 {item.processingVersion} · {selection.usedDocumentIds.includes(item.id) ? "已召回" : "未召回"}</li>)}</ul></> : <p>这份历史记录早于资料选择功能，仍可查看原有逐题来源。</p>}</details>;
}
