import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const vite = await createServer({ logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
try {
  const { MockInterviewWorkspace } = await vite.ssrLoadModule("/src/App.jsx");
  const { InterviewMaterialHistory } = await vite.ssrLoadModule("/src/InterviewMaterialPicker.jsx");
  const selectedHistory = renderToStaticMarkup(React.createElement(InterviewMaterialHistory, { selection: { mode: "MANUAL", documentIds: [1, 2], usedDocumentIds: [1], documents: [{ id: 1, title: "公共准备", scope: "PUBLIC", processingVersion: 2 }, { id: 2, title: "个人笔记", scope: "PRIVATE", processingVersion: 3 }] } }));
  assert.match(selectedHistory, /公共准备/); assert.match(selectedHistory, /个人笔记/); assert.match(selectedHistory, /已召回/); assert.match(selectedHistory, /未召回/);
  assert.match(renderToStaticMarkup(React.createElement(InterviewMaterialHistory)), /早于资料选择功能/);
  const handlers = { onCreate() {}, onSelectSession() {}, onSelectQuestion() {}, onSubmitAnswer() {}, onComplete() {}, onRefresh() {} };
  const questions = [
    { id: 1, sequence: 1, question: "请介绍简历中的接口项目。", category: "RESUME", difficulty: "MEDIUM", rationale: "核实项目取舍", answerId: 11, sourceRefs: [{ sourceType: "RESUME" }] },
    { id: 2, sequence: 2, question: "针对岗位要求的高并发，你会如何处理？", category: "JD", difficulty: "HARD", rationale: "考察岗位要求", answerId: 12, sourceRefs: [{ sourceType: "JD" }] },
    { id: 3, sequence: 3, question: "你会如何弥补当前技能缺口？", category: "MATCH_GAP", difficulty: "MEDIUM", rationale: "考察改进计划", answerId: 13, sourceRefs: [{ sourceType: "MATCH_GAP" }] },
    { id: 4, sequence: 4, question: "请解释缓存一致性。", category: "KNOWLEDGE", difficulty: "EASY", rationale: "考察知识理解", answerId: 14, sourceRefs: [{ sourceType: "KNOWLEDGE", sourceTitle: "缓存设计指南", quote: "缓存需要说明一致性与失效策略。", availability: "AVAILABLE", sourceId: "private-id", contentHash: "private-hash" }] },
  ];
  const feedback = Object.fromEntries(questions.map((question, index) => [question.id, {
    answer: { id: question.answerId, answerText: `用户回答 ${index + 1}` },
    feedback: { id: 20 + index, status: index === 3 ? "DEGRADED" : "COMPLETED", score: 80 + index, strengths: [{ text: "结构清晰", sourceRefs: [] }], weaknesses: [{ text: "论证可更具体", sourceRefs: [] }], missingPoints: [{ text: "补充取舍", sourceRefs: [] }], improvedAnswer: "建议按背景、行动和结果组织回答。", improvedAnswerIsSuggestion: true, followUpQuestion: "你如何验证结果？", sourceRefs: question.sourceRefs },
  }]));
  const session = { id: 8, status: "DEGRADED", resumeVersion: 3, answeredCount: 4, questionCount: 4, completedAt: "2026-08-08T01:00:00.000Z", averageScore: 82, questions };
  const html = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { id: 6, status: "COMPLETED" }, sessions: [session], session, feedbackByQuestion: feedback, activeQuestionIndex: 3, ...handlers }));
  assert.match(html, /简历经历/);
  assert.match(html, /岗位要求/);
  assert.match(html, /匹配缺口/);
  assert.match(html, /知识拓展/);
  assert.match(html, /建议回答/);
  assert.match(html, /不会写回简历/);
  assert.match(html, /不代表新增或已验证的用户经历/);
  assert.match(html, /查看知识来源/);
  assert.doesNotMatch(html, /private-id|private-hash|sourceId|contentHash/);
  assert.match(html, /降级可用/);
  assert.match(html, /后端最终平均分/);
  assert.match(html, />82</);
  assert.doesNotMatch(html, /当前求职任务的历史面试|interview-session-history|删除面试/);

  const failed = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [{ id: 9, status: "FAILED", resumeVersion: 3, questionCount: 4, answeredCount: 0 }], session: { id: 9, status: "FAILED", resumeVersion: 3, questionCount: 4, answeredCount: 0, failureCode: "INTERVIEW_PROVIDER_UNAVAILABLE", questions: [] }, feedbackByQuestion: {}, ...handlers }));
  assert.match(failed, /本次题目生成失败/);
  assert.doesNotMatch(failed, /提交本题回答/);
  const preparing = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { session: { id: 7, status: "PENDING", questions: [] }, ...handlers }));
  assert.match(preparing, /正在生成面试题目/); assert.match(preparing, /刷新生成状态/);
  const interrupted = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { session: { id: 7, status: "FAILED", failureCode: "INTERVIEW_GENERATION_INTERRUPTED", questions: [] }, ...handlers }));
  assert.match(interrupted, /服务重启中断了本次题目生成/);

  const duplicate = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [], session: null, feedbackByQuestion: {}, error: { code: "INTERVIEW_ANSWER_DUPLICATE", message: "raw" }, ...handlers }));
  assert.match(duplicate, /已经提交过回答/);
  const grounding = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [], session: null, feedbackByQuestion: {}, error: { code: "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT", message: "恶意 improvedAnswer 内容" }, ...handlers }));
  assert.match(grounding, /系统已拦截/);
  assert.doesNotMatch(grounding, /恶意 improvedAnswer 内容/);
  const retrySession = { ...session, completedAt: null, status: "IN_PROGRESS" };
  const retryFeedback = { ...feedback, [questions[0].id]: { answer: feedback[questions[0].id].answer, feedback: { status: "FAILED", failureCode: "INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT", improvedAnswer: "不应显示的失败内容" } } };
  const retryHtml = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", session: retrySession, feedbackByQuestion: retryFeedback, activeQuestionIndex: 0, onRetryFeedback: () => {}, working: true, ...handlers }));
  assert.match(retryHtml, /<button[^>]*disabled[^>]*>正在重新生成反馈/);
  assert.doesNotMatch(retryHtml, /不应显示的失败内容/);

  const loading = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [], session: null, feedbackByQuestion: {}, loading: true, ...handlers }));
  assert.match(loading, /正在恢复面试记录/);
  const empty = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [], session: null, feedbackByQuestion: {}, ...handlers }));
  assert.match(empty, /尚未开始岗位模拟面试/);
  const unansweredSession = { id: 10, status: "IN_PROGRESS", resumeVersion: 3, answeredCount: 0, questionCount: 1, questions: [{ ...questions[0], answerId: null }] };
  const working = renderToStaticMarkup(React.createElement(MockInterviewWorkspace, { applicationId: "5", report: { status: "COMPLETED" }, sessions: [unansweredSession], session: unansweredSession, feedbackByQuestion: {}, working: true, ...handlers }));
  assert.match(working, /AI 正在评估/);
  assert.match(working, /<textarea[^>]*disabled/);
  assert.match(working, /<button[^>]*disabled[^>]*>.*AI 正在评估/s);
} finally {
  await vite.close();
}

console.log("interview UI render tests passed");
