import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deleteWorkspaceAnalysis } from '../backend/workspace-history-delete.js';

const fixture = () => ({
  users: [{ id: 1, username: 'test', role: 'USER', status: 1 }, { id: 2, username: 'other', role: 'USER', status: 1 }],
  sessions: [{ id: 1, userId: 1, tokenHash: createHash('sha256').update('history-test-token').digest('base64url'), expiresAt: new Date(Date.now() + 600000).toISOString() }],
  jobApplications: [{ id: 1, userId: 1, jobDescriptionId: 1 }, { id: 2, userId: 2 }, { id: 3, userId: 1 }],
  matchReports: [{ id: 1, userId: 1, jobApplicationId: 1, resumeJobMatchId: 1, reportVersion: 1, status: 'FAILED' }, { id: 2, userId: 2, jobApplicationId: 2, status: 'FAILED' }, { id: 3, userId: 1, jobApplicationId: 1, resumeJobMatchId: 1, reportVersion: 2, status: 'FAILED' }],
  resumeJobMatches: [{ id: 1, userId: 1, jobApplicationId: 1, status: 'COMPLETED' }],
  suggestionRuns: [{ id: 1, userId: 1, jobApplicationId: 1, matchReportId: 1, status: 'COMPLETED' }],
  resumeSuggestions: [{ id: 1, userId: 1, suggestionRunId: 1, status: 'ACCEPTED', after: 'accepted' }, { id: 2, userId: 1, suggestionRunId: 1, status: 'PENDING' }],
  interviewSessions: [{ id: 1, userId: 1, jobApplicationId: 1, matchReportId: 1, status: 'COMPLETED' }],
  interviewSessionQuestions: [{ id: 1, userId: 1, sessionId: 1 }], interviewAnswers: [{ id: 1, userId: 1, sessionId: 1 }], answerFeedbacks: [{ id: 1, userId: 1, sessionId: 1, status: 'COMPLETED' }],
  agentRuns: [{ id: 1, userId: 1, jobApplicationId: 1, matchReportId: 1, status: 'COMPLETED' }], agentSteps: [{ id: 1, userId: 1, agentRunId: 1, status: 'COMPLETED' }],
  resumes: [{ id: 1, userId: 1, title: 'preserved' }], resumeHistories: [{ id: 1, resumeId: 1, resumeVersion: 1 }], jobDescriptions: [{ id: 1, userId: 1 }], knowledgeRetrievalRuns: [{ id: 1 }], jobs: [],
});
for (const job of [
  { type: 'GROUNDED_MATCH_REPORT', resourceId: 1 },
  { type: 'RESUME_SUGGESTIONS', resourceId: 1 },
  { type: 'MOCK_INTERVIEW_GENERATION', resourceId: 1, payload: { matchReportId: 1 } },
  { type: 'AGENT_RUN', resourceId: 1, payload: { matchReportId: 1 } },
]) {
  const store = fixture(); store.jobs.push({ ...job, userId: 1, status: 'PENDING' });
  const before = JSON.stringify(store);
  assert.equal(deleteWorkspaceAnalysis(store, 1, { applicationId: 1 }), false);
  assert.equal(JSON.stringify(store), before);
  if (job.type !== 'GROUNDED_MATCH_REPORT') assert.equal(deleteWorkspaceAnalysis(store, 1, { reportId: 1 }), false);
}
const locked = fixture(); assert.equal(deleteWorkspaceAnalysis(locked, 1, { reportId: 1 }, new Set([1])), false);
const running = fixture(); running.answerFeedbacks[0].status = 'RUNNING'; assert.equal(deleteWorkspaceAnalysis(running, 1, { reportId: 1 }), false);

const dir = await mkdtemp(path.join(tmpdir(), 'lingxi-analysis-delete-'));
const file = path.join(dir, 'store.json'); await writeFile(file, JSON.stringify(fixture()));
const probe = createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
const backend = spawn(process.execPath, ['backend/server.js'], { env: { ...process.env, API_PORT: String(port), LINGXI_DATA_DIR: dir, STORAGE_DRIVER: 'json', VECTOR_STORE_DRIVER: 'none' }, stdio: ['ignore', 'pipe', 'pipe'] });
let output = ''; backend.stderr.on('data', chunk => { output += chunk; });
const request = async (route, method = 'GET', status = 200) => {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, { method, headers: { Cookie: 'lingxi_session=history-test-token' } });
  assert.equal(response.status, status, `${method} ${route}: ${await response.clone().text()}`);
  return response.json();
};
try {
  let ready = false;
  for (let i = 0; i < 80; i++) { try { await request('/health'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); } }
  assert.ok(ready, output);
  await request('/api/match-reports/2', 'DELETE', 404);
  await request('/api/job-applications/2', 'DELETE', 404);
  await request('/api/match-reports/1', 'DELETE');
  await request('/api/match-reports/1', 'GET', 404);
  await request('/api/match-reports/1', 'DELETE', 404);
  await request('/api/match-reports/1/resume-suggestions', 'GET', 404);
  await request('/api/interview-sessions/1', 'GET', 404);
  await request('/api/agent-runs/1', 'GET', 404);
  await request('/api/suggestion-runs/1', 'GET', 404);
  assert.deepEqual((await request('/api/job-applications/1/reports')).items.map(item => item.id), [3]);
  assert.equal((await request('/api/job-applications/1/matches')).items.length, 1);
  let saved = JSON.parse(await readFile(file, 'utf8'));
  assert.equal(saved.resumeSuggestions.find(item => item.id === 1).after, 'accepted');
  assert.ok(saved.resumeSuggestions.find(item => item.id === 2).deletedAt);
  assert.equal(saved.matchReports.find(item => item.id === 1).reportVersion, 1);
  assert.equal(saved.matchReports.find(item => item.id === 2).status, 'FAILED');
  await request('/api/job-applications/1', 'DELETE');
  await request('/api/job-applications/1/reports', 'GET', 404);
  await request('/api/job-applications/1/matches', 'GET', 404);
  await request('/api/resume-job-matches/1', 'GET', 404);
  await request('/api/match-reports/3', 'GET', 404);
  assert.deepEqual((await request('/api/job-applications')).items.map(item => item.id), [3]);
  saved = JSON.parse(await readFile(file, 'utf8'));
  assert.ok(saved.jobApplications.find(item => item.id === 1).deletedAt);
  assert.equal(saved.resumes[0].title, 'preserved'); assert.equal(saved.resumeHistories.length, 1); assert.equal(saved.jobDescriptions.length, 1); assert.equal(saved.knowledgeRetrievalRuns.length, 1);
  console.log('Analysis history deletion passed: ownership, cascade, current lists, tombstones, accepted provenance and busy guards.');
} finally {
  backend.kill(); await new Promise(resolve => backend.once('exit', resolve)); await rm(dir, { recursive: true, force: true });
}
