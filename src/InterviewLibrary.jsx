import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { interviewStatusLabel } from "./interviewUiState";
import { jobWorkspaceHash } from "./jobWorkspaceState";

// Uses the existing owned application APIs; never selects a current resume implicitly.
export function InterviewLibrary({ request, formatDate, ConfirmationDialog }) {
  const [records, setRecords] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [selection, setSelection] = useState("");
  const [revision, setRevision] = useState(0);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [jobs, applications] = await Promise.all([request("/api/job-descriptions"), request("/api/job-applications")]);
        const groups = await Promise.all((applications.items || []).map(async application => {
          const [sessions, reportList] = await Promise.all([
            request(`/api/job-applications/${application.id}/interview-sessions`),
            request(`/api/job-applications/${application.id}/reports`),
          ]);
          const job = (jobs.items || []).find(item => item.id === application.jobDescriptionId);
          if (!job) return { records: [], reports: [] };
          const context = { application, job };
          return { records: (sessions.items || []).map(session => ({ ...context, session })),
            reports: (reportList.items || []).filter(report => ["COMPLETED", "DEGRADED"].includes(report.status)).map(report => ({ ...context, report })) };
        }));
        if (disposed) return;
        setRecords(groups.flatMap(group => group.records).sort((a, b) => Number(b.session.id) - Number(a.session.id)));
        setReports(groups.flatMap(group => group.reports));
      } catch (failure) {
        if (!disposed) setError(`读取面试记录失败：${failure.message}`);
      } finally { if (!disposed) setLoading(false); }
    }
    load();
    return () => { disposed = true; };
  }, [request, revision]);
  const open = (item, session) => {
    window.location.hash = jobWorkspaceHash({ tab: "interview", jobId: item.job.id,
      applicationId: item.application.id, sessionId: session?.id, reportId: session?.matchReportId || item.report?.id });
  };
  const deleteRecord = async () => {
    if (!deleteCandidate || deleting) return;
    const id = deleteCandidate.session.id;
    setDeleting(true); setDeleteError(""); setNotice("");
    try {
      await request(`/api/interview-sessions/${id}`, { method: "DELETE" });
      setRecords(items => items.filter(item => item.session.id !== id));
      setDeleteCandidate(null); setNotice(`面试 #${id} 已删除。`);
      setRevision(value => value + 1);
    } catch (failure) {
      setDeleteCandidate(null); setDeleteError(`删除失败：${failure.message}`);
    } finally { setDeleting(false); }
  };
  return <section className="job-page interview-library">
    <div className="job-page-head"><div><h2>我的模拟面试</h2><p>继续练习、回看反馈，或选择岗位报告开始新面试。</p></div><button className="black-small" disabled={loading || deleting} onClick={() => setChoosing(value => !value)}>新建模拟面试</button></div>
    {deleteError && <p role="alert">{deleteError}</p>}
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">正在读取面试记录与岗位报告…</p>}
    {error && <div className="job-prerequisite" role="alert"><span>{error}</span><button className="white-small" onClick={() => setRevision(value => value + 1)}>重新读取</button></div>}
    {!loading && !error && choosing && <section className="interview-report-picker">
      <h3>选择岗位报告</h3><p>面试沿用报告绑定的简历版本与岗位要求。</p>
      {reports.length ? <><label htmlFor="interview-report">可用报告</label><select id="interview-report" value={selection} onChange={event => setSelection(event.target.value)}><option value="">请选择岗位报告</option>{reports.map(item => <option key={`${item.application.id}-${item.report.id}`} value={`${item.application.id}-${item.report.id}`}>{item.job.title} · 简历 v{item.report.resumeVersion} · 报告 #{item.report.id}{item.report.status === "DEGRADED" ? " · 降级可用" : ""}</option>)}</select><button className="black-small" disabled={!reports.some(item => `${item.application.id}-${item.report.id}` === selection)} onClick={() => open(reports.find(item => `${item.application.id}-${item.report.id}` === selection))}>进入面试准备</button></> : <><p>暂无可用的岗位报告，先完成岗位匹配，再开始练习。</p><button className="white-small" onClick={() => { window.location.hash = "#jobs"; }}>先完成岗位匹配</button></>}
    </section>}
    {!loading && !error && (records.length ? <div className="interview-record-list">{records.map(item => <div className="interview-record-row" key={item.session.id}><button className="interview-record" disabled={deleting} onClick={() => open(item, item.session)}>
      <span><strong>{item.job.title}</strong><small>面试 #{item.session.id} · 简历 v{item.session.resumeVersion} · {formatDate(item.session.createdAt)}</small></span>
      <span>{interviewStatusLabel(item.session.status)} · {item.session.answeredCount || 0}/{item.session.questionCount || 0} 题</span><b>{item.session.completedAt || item.session.status === "COMPLETED" ? "查看反馈" : item.session.status === "FAILED" ? "查看失败详情" : "继续面试"}</b>
    </button><button className="history-delete" aria-label={`删除面试 #${item.session.id}`} title={["PENDING", "RUNNING"].includes(item.session.status) ? "面试生成中，请完成后再删除" : "删除记录"} disabled={deleting || ["PENDING", "RUNNING"].includes(item.session.status)} onClick={() => { setDeleteError(""); setNotice(""); setDeleteCandidate(item); }}><Trash2 size={15} /><span>删除</span></button></div>)}</div> : <div className="job-empty"><strong>还没有模拟面试记录</strong><p>点击“新建模拟面试”，选择一份已完成的岗位报告。</p></div>)}
    {ConfirmationDialog && <ConfirmationDialog open={Boolean(deleteCandidate)} title="删除历史面试" description={`删除面试 #${deleteCandidate?.session.id}？本次题目、回答和反馈将一并删除，无法恢复。简历和岗位报告会保留。`} confirmLabel="删除记录" isWorking={deleting} onClose={() => !deleting && setDeleteCandidate(null)} onConfirm={deleteRecord} />}
  </section>;
}
