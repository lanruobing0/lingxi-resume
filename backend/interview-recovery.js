// Called once before accepting requests. In-process generation cannot survive restart.
export function recoverInterruptedInterviews(store, timestamp = new Date().toISOString()) {
  let changed = false;
  for (const session of store.interviewSessions || []) {
    if (session.deletedAt || !["PENDING", "RUNNING"].includes(session.status)) continue;
    session.status = "FAILED";
    session.failureCode = "INTERVIEW_GENERATION_INTERRUPTED";
    session.failureMessage = "服务重启中断了本次题目生成。请重新确认资料并创建面试。";
    session.completedAt = timestamp;
    changed = true;
  }
  return changed;
}
