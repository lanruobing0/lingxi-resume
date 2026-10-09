import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
import { jobWorkspaceHash, readJobWorkspaceRoute, collectJobGroupEvidence } from '../src/jobWorkspaceState.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
assert.deepEqual(collectJobGroupEvidence([{ text: 'Python 开发', evidence: 'Python\n开发' }]), []);
assert.equal(collectJobGroupEvidence([{ text: 'C', evidence: 'C++' }]).length, 1, 'different technical evidence must remain available');
assert.equal(readJobWorkspaceRoute('#interview').tab, 'interview');
assert.equal(readJobWorkspaceRoute('#jobs?job=-1&application=x&tab=unknown').jobId, '');
assert.deepEqual(readJobWorkspaceRoute(jobWorkspaceHash({ jobId: '7', applicationId: '9', tab: 'interview' })), { page: 'interview', jobId: '7', applicationId: '9', tab: 'interview' });
const vite = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const job = { id: 7, title: 'AI Agent 技术开发岗', companyName: '测试公司', parseStatus: 'SUCCEEDED', rawText: ('岗位职责：参与 AI 平台建设、任务规划和工具调用。\n岗位要求：掌握 Python、RAG 和向量检索。\n').repeat(12) };
const parsedData = { jobTitle: { text: job.title, evidence: '岗位原文' }, companyName: { text: job.companyName }, responsibilities: Array.from({ length: 6 }, (_, i) => ({ text: `参与平台研发与业务流程设计 ${i + 1}`, evidence: '参与 AI 平台建设、任务规划和工具调用。' })), requiredSkills: [{ text: '熟练使用 Python', evidence: '掌握 Python' }], preferredSkills: [], educationRequirements: [{ text: '本科及以上' }], experienceRequirements: [], technicalKeywords: ['Python', 'RAG', 'Embedding', '向量检索', 'Rerank', '工具调用', '工作流', '评测'].map(text => ({ text, evidence: text })), softSkills: [], seniority: { text: '未明确' }, uncertainties: [] };
const session = { id: 20, jobApplicationId: 9, matchReportId: 50, status: 'IN_PROGRESS', resumeVersion: 2, answeredCount: 0, questionCount: 1, questions: [{ id: 21, question: '请介绍你的项目取舍。', category: 'RESUME', difficulty: 'MEDIUM', rationale: '考察真实项目经历', answerId: null }] };
parsedData.responsibilities[0].evidence = parsedData.responsibilities[0].text;
parsedData.responsibilities[1].evidence = parsedData.responsibilities[1].text;
parsedData.requiredSkills = Array.from({ length: 10 }, (_, index) => ({ text: `必需技能 ${index + 1}`, evidence: `必需技能 ${index + 1}` }));
// Isolated UI fixture only; never written to the product store or used as an AI result.
const match = { id: 30, status: 'COMPLETED', totalScore: 12, report: {
  summary: '简历主要体现前端开发经历，目标岗位要求 AI Agent 研发能力。当前简历缺少 Python、RAG 与 Agent 的项目证据，需要先补充可核验的相关经历。',
  dimensions: ['必备技能', '项目相关性', '关键词覆盖', '工作经验', '教育背景', '表达与结构'].map((label, i) => ({ key: `dimension-${i}`, label, score: i === 5 ? 60 : 5, weight: 10, summary: '前端技术与目标岗位要求存在差距。'.repeat(8), resumeEvidence: ['前端项目原文证据'], jdEvidence: ['目标岗位 Python 原文证据'], missingEvidence: ['当前简历未找到相关证据', '当前简历未找到相关证据'], suggestions: ['补充可核验的项目成果'] })),
  matchedRequiredSkills: [], partiallyMatchedRequiredSkills: [{ skillName: '工程代码质量', matchStatus: 'PARTIALLY_MATCHED', confidence: 60, explanation: '有可迁移的工程经验', resumeEvidence: ['前端项目原文证据'], jdEvidence: ['工程代码质量要求'] }],
  missingRequiredSkills: Array.from({ length: 9 }, (_, i) => ({ skillName: `缺失的岗位能力 ${i + 1}`, matchStatus: 'NOT_FOUND', confidence: 100, explanation: '当前简历未找到相关证据', resumeEvidence: [], jdEvidence: [`岗位能力 ${i + 1} 原文依据`] })),
  matchedPreferredSkills: [], missingPreferredSkills: [], matchedKeywords: [], missingKeywords: [{ skillName: 'Python', matchStatus: 'NOT_FOUND', confidence: 100, jdEvidence: ['目标岗位 Python 原文证据'] }],
  strongestResumeEvidence: ['前端项目原文证据'], risks: ['缺少目标岗位相关实践证据'], prioritizedSuggestions: Array.from({ length: 5 }, (_, i) => `建议 ${i + 1}：补充可以核验的岗位实践成果。`),
} };
let detailReads = 0;
let feedbackRetryCount = 0;
let feedbackState = { id: 42, status: 'FAILED', failureCode: 'INTERVIEW_FEEDBACK_UNSUPPORTED_USER_FACT', improvedAnswer: '' };
const savedAnswer = { id: 41, questionId: 21, sessionId: 20, answerText: '保留的本题原始回答' };
let historySessions = [session, { ...session, id: 19, status: 'FAILED', questions: [] }];
const report = { id: 50, status: 'COMPLETED', resumeId: 3, resumeVersion: 2, reportVersion: 1, content: { dimensionReports: [], claims: [], gaps: [], recommendations: [] } };
let historyRuns = [{ id: 60, status: 'COMPLETED', resumeId: 3, baseResumeVersion: 2, suggestions: [], createdAt: '2026-10-09T01:40:00Z' }, { id: 59, status: 'FAILED', baseResumeVersion: 2, suggestions: [] }];
const historyDeletes = [];
let historyAgents = [{ id: 70, status: 'DEGRADED', resumeVersion: 2, maxSteps: 6, finalResult: {}, createdAt: '2026-10-09T05:31:00Z' }, { id: 69, status: 'FAILED', resumeVersion: 2 }];
let offerReports = true;
let failLibrary = false;
let createCount = 0;
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if (failLibrary && path === '/api/job-applications') { await route.fulfill({ status: 503, json: { message: '测试读取失败' } }); return; }
  let data = { items: [] };
  if (path === '/api/users/me') data = { user: { id: 1, username: 'ui-test', role: 'USER' } };
  else if (path === '/api/job-descriptions') data = { items: [job] };
  else if (path === '/api/job-descriptions/7') { detailReads++; data = { item: job, currentParseResult: { parsedData } }; }
  else if (path === '/api/resumes') data = { items: [{ id: 3, title: '前端开发工程师简历' }] };
  else if (path === '/api/resumes/3/versions') data = { items: [{ id: 4, resumeVersion: 2, isAnalysisReady: true }] };
  else if (path === '/api/job-applications') data = { items: [{ id: 9, jobDescriptionId: 7, resumeId: 3, resumeVersion: 2, resumeVersionId: 4, status: 'READY_FOR_MATCH' }, { id: 10, jobDescriptionId: 7, resumeId: 3, resumeVersion: 1, resumeVersionId: 5, status: 'READY_FOR_MATCH' }] };
  else if (route.request().method() === 'DELETE') {
    historyDeletes.push(path);
    if (path.startsWith('/api/interview-sessions/')) historySessions = historySessions.filter(item => item.id !== Number(path.split('/').at(-1)));
    if (path.startsWith('/api/suggestion-runs/')) historyRuns = historyRuns.filter(item => item.id !== Number(path.split('/').at(-1)));
    if (path.startsWith('/api/agent-runs/')) historyAgents = historyAgents.filter(item => item.id !== Number(path.split('/').at(-1)));
    data = { deletedId: Number(path.split('/').at(-1)) };
  }
  else if (path === '/api/job-applications/9/interview-sessions' && route.request().method() === 'POST') {
    assert.deepEqual(route.request().postDataJSON(), { matchReportId: 50, questionCount: 4, searchMode: 'HYBRID', useReranker: false });
    createCount++;
    const created = { ...session, id: 22, answeredCount: 0, questions: [{ ...session.questions[0], id: 23, answerId: null }] };
    historySessions.unshift(created);
    data = { item: created };
  }
  else if (path === '/api/job-applications/9/interview-sessions') data = { items: historySessions };
  else if (path === '/api/interview-sessions/20') data = { item: session };
  else if (path === '/api/interview-sessions/22') data = { item: historySessions.find(item => item.id === 22) };
  else if (path === '/api/job-applications/9/reports') data = { items: offerReports ? [report] : [] };
  else if (path === '/api/job-applications/9/agent-runs') data = { items: historyAgents };
  else if (/^\/api\/agent-runs\/\d+$/.test(path)) data = { item: historyAgents.find(item => item.id === Number(path.split('/').at(-1))) };
  else if (path === '/api/match-reports/50') data = { item: report };
  else if (path === '/api/match-reports/50/resume-suggestions') data = { items: historyRuns };
  else if (path.startsWith('/api/suggestion-runs/')) data = { item: historyRuns.find(item => item.id === Number(path.split('/').at(-1))) };
  else if (path === '/api/interview-sessions/20/answers/41/feedback') data = { item: feedbackState, answer: savedAnswer };
  else if (path === '/api/interview-sessions/20/answers/41/feedback/retry') {
    assert.equal(route.request().method(), 'POST');
    assert.deepEqual(route.request().postDataJSON(), {});
    feedbackRetryCount++;
    feedbackState = { id: 43, status: 'COMPLETED', score: 82, strengths: [], weaknesses: [], missingPoints: [], improvedAnswer: '建议补充可验证的取舍依据。', followUpQuestion: '' };
    data = { item: savedAnswer, feedback: feedbackState };
  }
  else if (path === '/api/job-applications/9/matches') data = { items: [match] };
  else if (path === '/api/resume-job-matches/30') data = { item: match };
  await route.fulfill({ json: data });
});
const visible = async selector => { await page.locator(selector).waitFor({ state: 'visible' }); };
try {
  await page.goto(`${origin}/#jobs?job=7&tab=requirements`);
  await visible('.job-workspace-tabs');
  assert.equal(await page.locator('.job-match-panel').count(), 0);
  assert.equal(await page.locator('.job-source-panel').getAttribute('open'), null);
  assert.equal(await page.locator('.job-evidence[open]').count(), 0);
  assert.equal(await page.locator('.job-keyword-list li').count(), 8);
  const requiredSkills = page.locator('.job-parse-groups > section').filter({ has: page.locator('h4', { hasText: '必需技能' }) });
  assert.equal(await requiredSkills.locator(':scope > ul > li').count(), 10);
  assert.equal(await requiredSkills.locator('.job-more-requirements').count(), 0);
  assert.equal(await requiredSkills.locator(':scope > ul > li').last().isVisible(), true, 'all required skills visible without expansion');
  assert.equal(await page.locator('.job-keyword-list details').count(), 0, 'keywords have no per-item evidence controls');
  assert.equal(await page.locator('.job-keyword-group .job-evidence').count(), 0, 'identical keyword quotes add no duplicate disclosure');
  const responsibilities = page.locator('.job-parse-groups > section').filter({ has: page.locator('h4', { hasText: '职责' }) });
  assert.equal(await responsibilities.locator('.job-evidence').count(), 1, 'one disclosure per group');
  await responsibilities.locator('.job-evidence summary').click();
  assert.equal(await responsibilities.locator('blockquote').count(), 1, 'shared quote appears only once');
  assert.match(await responsibilities.locator('blockquote').innerText(), /参与 AI 平台建设/);
  await responsibilities.locator('.job-evidence summary').click();
  const reads = detailReads;
  assert.equal(await page.locator('.job-more-requirements[open]').count(), 0);
  await page.locator('.job-more-requirements > summary').click();
  assert.equal(await page.locator('.job-more-requirements[open] li').count(), 2);
  await page.locator('.job-more-requirements > summary').click();
  await page.locator('.job-evidence summary').first().click();
  assert.equal(await page.locator('.job-evidence[open]').count(), 1);
  await page.locator('.job-source-panel summary').click();
  assert.equal(await page.locator('.job-source-panel pre').isVisible(), true);
  await page.locator('.job-source-panel summary').click();
  await page.locator('.job-workspace-tabs').getByRole('button', { name: '匹配报告', exact: true }).click();
  await visible('.job-match-panel');
  assert.equal(await page.locator('.job-parse-panel').count(), 0);
  await visible('.job-match-compact');
  assert.equal(await page.locator('.job-match-dimensions article').count(), 6);
  assert.equal(await page.locator('.job-match-dimensions details[open]').count(), 0);
  assert.equal(await page.locator('.match-priority > ol > li').count(), 3);
  await page.locator('.job-match-dimensions summary').first().click();
  assert.match(await page.locator('.job-match-dimensions details[open]').innerText(), /前端项目原文证据/);
  assert.match(await page.locator('.job-match-dimensions details[open]').innerText(), /补充可核验的项目成果/);
  await page.locator('.job-match-dimensions summary').first().click();
  await page.locator('.match-priority summary').click();
  assert.equal(await page.locator('.match-priority details[open] li').count(), 2);
  await page.locator('.match-priority summary').click();
  await page.locator('.match-report-nav').getByRole('button', { name: '技能与关键词' }).click();
  assert.equal(await page.locator('.match-skill-group[open]').count(), 0);
  assert.equal(await page.locator('.match-empty-group').count(), 4);
  await page.locator('.match-skill-group > summary').filter({ hasText: '当前简历未找到的必备项' }).click();
  assert.equal(await page.locator('.match-skill-group[open] > ul > li').count(), 9);
  await page.locator('.match-skill-group[open] li summary').first().click();
  assert.match(await page.locator('.match-skill-group[open] li details[open]').innerText(), /岗位能力 1 原文依据/);
  await page.locator('.match-report-nav').getByRole('button', { name: '优势与风险' }).click();
  assert.match(await page.locator('.job-match-suggestions').innerText(), /缺少目标岗位相关实践证据/);
  await page.locator('.match-report-nav').getByRole('button', { name: '匹配概览' }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const box = await page.locator('.job-match-compact').boundingBox();
    assert.ok(box.height < (width === 1440 ? 800 : 1250), `overview should remain compact at ${width}px: ${box.height}`);
    if (process.env.UI_SCREENSHOT_DIR) {
      await mkdir(process.env.UI_SCREENSHOT_DIR, { recursive: true });
      await page.locator('.job-match-panel').screenshot({ path: `${process.env.UI_SCREENSHOT_DIR}/match-${width}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: '针对这个岗位练习', exact: true }).click();
  await visible('.interview-page-head');
  assert.match(page.url(), /#interview\?/);
  assert.equal(await page.locator('.job-match-panel').count(), 0);
  assert.equal(await page.getByRole('button', { name: '编辑 JD', exact: true }).isVisible(), false);
  assert.equal(await page.getByRole('button', { name: '创建分析任务', exact: true }).isVisible(), false);
  await page.locator('.interview-session-history .history-select').first().click();
  await visible('.interview-answer-area textarea');
  await page.locator('.interview-answer-area textarea').fill('尚未提交的真实项目回答');
  await page.getByRole('button', { name: '查看岗位报告', exact: true }).click();
  await visible('.job-match-panel');
  assert.equal(await page.locator('.job-workspace-tabs button').count(), 4);
  await page.getByRole('button', { name: '针对这个岗位练习', exact: true }).click();
  await visible('.interview-answer-area textarea');
  assert.equal(await page.locator('.interview-answer-area textarea').inputValue(), '尚未提交的真实项目回答');
  await page.reload();
  await visible('.interview-session-history');
  await page.locator('.interview-session-history .history-select').first().click();
  await visible('.interview-answer-area textarea');
  await page.getByRole('button', { name: '查看岗位报告', exact: true }).click();
  await page.locator('.job-application-list button').nth(1).click();
  await page.evaluate(() => { location.hash = '#interview?job=7&application=10&tab=interview'; });
  await visible('.job-prerequisite');
  await page.reload();
  await visible('.job-prerequisite');
  await page.getByRole('button', { name: '去分析岗位', exact: true }).click();
  await visible('.job-match-panel');
  await page.goBack();
  await visible('.job-prerequisite');
  await page.getByRole('button', { name: '查看岗位报告', exact: true }).click();
  await page.locator('.job-workspace-tabs').getByRole('button', { name: '岗位要求', exact: true }).click();
  const output = process.env.UI_SCREENSHOT_DIR;
  if (output) { await mkdir(output, { recursive: true }); await page.screenshot({ path: `${output}/jd-desktop.png`, fullPage: true }); }
  const overflow = () => document.documentElement.scrollWidth > innerWidth;
  assert.equal(await page.evaluate(overflow), false);
  await page.setViewportSize({ width: 390, height: 900 });
  assert.equal(await page.evaluate(overflow), false, 'mobile page must not overflow');
  const button = page.getByRole('button', { name: '创建分析任务', exact: true });
  const box = await button.boundingBox();
  assert.ok(box.width > 100 && box.height < 70, 'create button should remain horizontal');
  if (output) await page.screenshot({ path: `${output}/jd-mobile.png`, fullPage: true });
  await page.goto(origin + '/#interview');
  await visible('.interview-record-list');
  assert.match(await page.locator('.job-page-head').innerText(), /我的模拟面试/);
  assert.equal(await page.getByRole('button', { name: '新建岗位 JD', exact: true }).count(), 0);
  assert.equal(await page.locator('.interview-record').count(), 2);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(overflow), false);
    if (output) await page.screenshot({ path: output + '/interview-library-' + width + '.png', fullPage: true });
  }
  await page.getByRole('button', { name: '新建模拟面试', exact: true }).click();
  await visible('#interview-report');
  assert.equal(await page.locator('#interview-report option').count(), 2, 'only usable reports offered');
  await page.locator('#interview-report').selectOption('9-50');
  await page.getByRole('button', { name: '进入面试准备', exact: true }).click();
  await visible('.interview-page-head');
  assert.match(page.url(), /report=50/);
  assert.equal(await page.locator('.interview-answer-area textarea').count(), 0, 'new interview preparation must not present an existing session as new');
  await page.getByRole('button', { name: '返回面试记录', exact: true }).click();
  await visible('.interview-record-list');
  await page.locator('.interview-record').first().click();
  await visible('.interview-answer-area textarea');
  assert.match(page.url(), /session=20/);
  await page.reload();
  await visible('.interview-answer-area textarea');
  assert.match(await page.locator('.interview-session-summary').innerText(), /面试 #20/);
  assert.equal(await page.locator('.job-parse-panel').count(), 0);
  if (output) await page.screenshot({ path: output + '/interview-session-mobile.png', fullPage: true });
  session.questions[0].answerId = savedAnswer.id;
  session.answeredCount = 1;
  await page.reload();
  await visible('.interview-feedback-failed');
  await page.getByRole('button', { name: '重新生成本题反馈', exact: true }).click();
  await visible('.interview-feedback-content');
  assert.equal(feedbackRetryCount, 1);
  assert.match(await page.locator('.interview-answer-area').innerText(), /保留的本题原始回答/);
  assert.match(await page.locator('.suggested-answer').innerText(), /建议补充可验证的取舍依据/);
  assert.equal(await page.locator('.interview-answer-area textarea').count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: '删除面试 #19', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(historyDeletes.length, 0);
  await page.getByRole('button', { name: '删除面试 #19', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.getByRole('button', { name: '删除面试 #19', exact: true }).waitFor({ state: 'detached' });
  assert.match(await page.locator('.interview-session-summary').innerText(), /面试 #20/);
  await page.getByRole('button', { name: '删除面试 #20', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.locator('.interview-session-summary').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.interview-answer-area').count(), 0);
  await page.getByRole('button', { name: '查看岗位报告', exact: true }).click();
  await page.locator('.job-workspace-tabs').getByRole('button', { name: '简历建议', exact: true }).click();
  await page.getByRole('button', { name: '删除建议运行 #60', exact: true }).waitFor({ state: 'visible' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.getByRole('button', { name: '删除建议运行 #60', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /已接受的简历修改和版本快照会保留/);
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.getByRole('button', { name: '删除建议运行 #60', exact: true }).waitFor({ state: 'detached' });
  assert.ok(await page.locator('.suggestion-run-history .history-select.active').innerText().then(text => text.includes('运行 #59')));
  await page.getByRole('button', { name: '删除建议运行 #59', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.locator('.suggestion-run-history').waitFor({ state: 'detached' });
  assert.match(await page.locator('.resume-suggestion-panel .job-empty').innerText(), /尚未生成/);
  assert.deepEqual(historyDeletes, ['/api/interview-sessions/19', '/api/interview-sessions/20', '/api/suggestion-runs/60', '/api/suggestion-runs/59']);
  await page.locator('.job-workspace-tabs').getByRole('button', { name: 'Agent 分析', exact: true }).click();
  await page.getByRole('button', { name: '删除 Agent 分析 #69', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
  assert.equal(historyDeletes.length, 4);
  await page.getByRole('button', { name: '删除 Agent 分析 #69', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.getByRole('button', { name: '删除 Agent 分析 #69', exact: true }).waitFor({ state: 'detached' });
  assert.match(await page.locator('.agent-run-history .history-select.active').innerText(), /Run #70/);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  }
  await page.getByRole('button', { name: '删除 Agent 分析 #70', exact: true }).click();
  assert.match(await page.getByRole('dialog').innerText(), /分析步骤和结果将一并删除/);
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.locator('.agent-run-history').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.agent-run-summary').count(), 0);
  assert.deepEqual(historyDeletes.slice(-2), ['/api/agent-runs/69', '/api/agent-runs/70']);
  await page.goto(`${origin}/#interview`);
  await visible('.interview-library .job-empty');
  assert.match(await page.locator('.interview-library .job-empty').innerText(), /还没有模拟面试记录/);
  historySessions = [session];
  await page.getByRole('button', { name: '新建模拟面试', exact: true }).click();
  await page.locator('#interview-report').selectOption('9-50');
  await page.getByRole('button', { name: '进入面试准备', exact: true }).click();
  await visible('.interview-page-head');
  await page.getByRole('button', { name: '开始新的模拟面试', exact: true }).click();
  await visible('.interview-answer-area textarea');
  assert.equal(createCount, 1);
  assert.match(page.url(), /session=22/);
  await page.reload();
  await visible('.interview-answer-area textarea');
  assert.match(await page.locator('.interview-session-summary').innerText(), /面试 #22/);
  await page.getByRole('button', { name: '删除面试 #22', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除记录', exact: true }).click();
  await page.getByRole('button', { name: '删除面试 #22', exact: true }).waitFor({ state: 'detached' });
  assert.match(await page.locator('.interview-session-summary').innerText(), /面试 #20/);
  assert.doesNotMatch(page.url(), /session=22/);
  offerReports = false;
  await page.goto(`${origin}/#interview`);
  await visible('.interview-record-list');
  await page.getByRole('button', { name: '新建模拟面试', exact: true }).click();
  await visible('.interview-report-picker');
  await page.getByRole('button', { name: '先完成岗位匹配', exact: true }).click();
  await visible('.job-list');
  failLibrary = true;
  await page.goto(`${origin}/#interview`);
  await visible('.interview-library [role=alert]');
  failLibrary = false;
  await page.getByRole('button', { name: '重新读取', exact: true }).click();
  await visible('.interview-record-list');
  assert.deepEqual(errors, []);
  console.log('PASS: job tabs, interview entry, draft retention, refresh, task selection, back navigation and desktop/mobile layout');
} finally {
  await browser.close();
  await vite.close();
}
