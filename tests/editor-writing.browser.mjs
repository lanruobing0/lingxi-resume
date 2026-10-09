import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { mkdir } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const vite = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const origin = `http://127.0.0.1:${vite.httpServer.address().port}`;
const errors = [], calls = [];
let failSave = false, failAi = false;
page.on('pageerror', error => errors.push(error.message));
await page.addInitScript(() => {
  localStorage.setItem('lingxi-user', JSON.stringify({ id: 1, username: 'editor-test' }));
  localStorage.setItem('lingxi-active-resume:1', '3');
  localStorage.setItem('lingxi-active-resume', '3');
});
const resume = { id: 3, title: '工程师简历', realName: '隐私测试姓名', email: 'private@example.test', phone: '13812345678', selfEvaluation: '负责前端组件开发。', targetPosition: '前端工程师', visibleSections: ['基本信息', '项目经历'], moduleOrder: ['基本信息', '项目经历'], sectionContent: {}, sectionDetails: { 项目经历: [{ id: 'project-a', name: '平台项目', role: '开发', highlights: ['负责组件设计。'], startDate: '', endDate: '' }] } };
await page.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname, method = route.request().method();
  let data = { items: [] };
  if (path === '/api/users/me') data = { user: { id: 1, username: 'editor-test', role: 'USER' } };
  if (path === '/api/resumes') data = { items: [resume] };
  if (path === '/api/resumes/3') {
    if (method === 'PUT') { calls.push('save'); if (failSave) { await route.fulfill({ status: 500, json: { message: '保存测试失败' } }); return; } Object.assign(resume, route.request().postDataJSON()); }
    data = { item: resume };
  }
  if (path.endsWith('/grammar-check') || path.endsWith('/optimize')) {
    const body = route.request().postDataJSON();
    assert.doesNotMatch(body.content, /隐私测试姓名|private@example|13812345678/);
    assert.equal(calls.at(-1), 'save');
    calls.push(path);
    if (failAi) { await route.fulfill({ status: 502, json: { message: 'AI 测试失败' } }); return; }
    data = { item: path.endsWith('/grammar-check') ? { score: 90, issues: [{ type: '表达', original: '负责前端组件开发', suggestion: '开发前端组件', reason: '更直接' }] } : { optimizedContent: '开发并维护前端组件。' } };
  }
  await route.fulfill({ json: data });
});
try {
  await page.goto(origin + '/#resume');
  await page.getByRole('button', { name: '编辑', exact: true }).first().click();
  await page.locator('.editor-writing-assistant').waitFor();
  assert.equal(await page.getByRole('button', { name: 'AI 工具', exact: true }).count(), 0);
  const summary = page.locator('.resume-summary-editor textarea');
  await summary.fill('负责前端组件开发。联系方式 private@example.test 13812345678 隐私测试姓名');
  await page.getByRole('button', { name: '检查简历', exact: true }).click();
  await page.getByRole('heading', { name: '简历检查结果' }).waitFor();
  assert.equal(await summary.inputValue(), '负责前端组件开发。联系方式 private@example.test 13812345678 隐私测试姓名');
  await page.locator('.resume-summary-editor').getByRole('button', { name: '润色这段' }).click();
  await page.getByRole('button', { name: '生成段落润色' }).click();
  await page.getByRole('heading', { name: '段落润色建议' }).waitFor();
  assert.match(await page.locator('.editor-writing-result').innerText(), /开发并维护前端组件/);
  assert.match(await summary.inputValue(), /联系方式/);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mkdir('artifacts/editor-writing', { recursive: true });
    await page.screenshot({ path: `artifacts/editor-writing/editor-${width}.png`, fullPage: true });
  }
  failSave = true;
  const prior = calls.filter(item => item.includes('/api/')).length;
  await page.getByRole('button', { name: '检查简历', exact: true }).click();
  await page.locator('.editor-writing-assistant [role=alert]').waitFor();
  assert.equal(calls.filter(item => item.includes('/api/')).length, prior);
  failSave = false; failAi = true;
  await page.getByRole('button', { name: '检查简历', exact: true }).click();
  await page.locator('.editor-writing-assistant [role=alert]').waitFor();
  assert.equal(await page.locator('.editor-writing-result').count(), 0);
  await page.goto(origin + '/#ai-tools');
  await page.getByRole('button', { name: '编辑', exact: true }).first().waitFor();
  assert.equal(await page.locator('.ai-tools-page').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: editor writing actions, saved binding, privacy, unchanged draft, failures, old entry and responsive layout');
} finally { await browser.close(); await vite.close(); }
