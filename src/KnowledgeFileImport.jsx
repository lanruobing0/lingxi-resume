import { useEffect, useRef, useState } from "react";
import { FileText, LoaderCircle, Upload } from "lucide-react";

export function KnowledgeFileImport({ request, disabled, onImported, onReadingChange }) {
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);

  const readFile = async (file) => {
    if (!file || reading || disabled) return;
    setError(""); setResult(null);
    if (!/\.(pdf|docx|txt|md)$/i.test(file.name)) { setError("请选择 PDF、DOCX、TXT 或 Markdown 文件。"); return; }
    if (!file.size || file.size > 6 * 1024 * 1024) { setError("请选择非空且不超过 6 MB 的文件。"); return; }
    const controller = new AbortController(); requestRef.current = controller;
    setReading(true); onReadingChange(true);
    try {
      const data = await request("/api/admin/knowledge-documents/extract", {
        method: "POST", body: file, signal: controller.signal,
        headers: { "Content-Type": "application/octet-stream", "X-File-Name": encodeURIComponent(file.name) },
      });
      if (controller.signal.aborted) return;
      setResult(data); onImported(data);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || "提取失败，请重新选择文件。");
    } finally { if (!controller.signal.aborted) { setReading(false); onReadingChange(false); } }
  };

  return <div className="knowledge-upload">
    <label className={`knowledge-upload-picker ${reading ? "is-reading" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); readFile(event.dataTransfer.files[0]); }}>
      {reading ? <LoaderCircle size={22} className="spin" /> : <Upload size={22} />}
      <strong>{reading ? "正在提取文件文字…" : "选择文件或拖放到这里"}</strong>
      <span>PDF、DOCX、TXT、Markdown · 最大 6 MB</span>
      <small>不支持扫描图片或加密文件。仅导入正文，不保留原始文件。</small>
      <input type="file" aria-label="上传公共面试资料文件" accept=".pdf,.docx,.txt,.md" disabled={disabled || reading} onChange={(event) => { readFile(event.target.files?.[0]); event.target.value = ""; }} />
    </label>
    {error && <p className="knowledge-upload-error" role="alert">{error}</p>}
    {result && <div className="knowledge-upload-result" role="status"><FileText size={17} /><div><strong>{result.fileName}</strong><span>已提取 {result.characterCount.toLocaleString()} 字，请核对下方正文后保存。</span>{result.warnings.map((warning) => <small key={warning}>{warning}</small>)}</div></div>}
  </div>;
}
