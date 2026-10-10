// Windows local launcher. Does not edit application source or invoke AI providers.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { parseEnv } = require('node:util');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME = path.resolve(process.env.LINGXI_LAUNCHER_RUNTIME || path.join(process.env.LOCALAPPDATA, 'LingxiResume/launcher'));
const STATE = path.join(RUNTIME, 'state.json');
const LOCK = path.join(RUNTIME, 'launcher.lock');
const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quotePS = value => "'" + value.replace(/'/g, "''") + "'";
const say = message => console.log(message);
const started = [];
let lockHeld = false;

function powershell(command) {
  const utf8 = '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding; ';
  return execFileSync(PS, ['-NoProfile', '-NonInteractive', '-Command', utf8 + command], { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
}
function processIdentity(pid) {
  if (!Number.isInteger(pid) || pid < 1) return null;
  try {
    return JSON.parse(powershell(`$p=Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if($p){ @{pid=$p.ProcessId; created=$p.CreationDate.ToUniversalTime().Ticks.ToString(); command=$p.CommandLine} | ConvertTo-Json -Compress }`));
  } catch { return null; }
}
function sameProcess(record) {
  if (!record || ![path.join(ROOT, 'backend/server.js'), path.join(ROOT, 'node_modules/vite/bin/vite.js')].includes(record.entry)) return false;
  const actual = processIdentity(record.pid);
  return Boolean(actual && actual.created === record.created && actual.command?.includes(record.entry));
}
function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { processes: [] }; }
}
function saveState(processes) {
  fs.writeFileSync(STATE, JSON.stringify({ root: ROOT, processes }, null, 2));
}
function lock() {
  fs.mkdirSync(RUNTIME, { recursive: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    try { fs.writeFileSync(LOCK, String(process.pid), { flag: 'wx' }); lockHeld = true; return; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const pid = Number(fs.readFileSync(LOCK, 'utf8'));
      if (processIdentity(pid)) throw new Error('另一个启动或停止操作正在进行，请等它完成。');
      fs.unlinkSync(LOCK);
    }
  }
  throw new Error('无法取得启动锁。');
}
function config() {
  const fromFiles = {};
  for (const file of ['.env', '.env.local']) {
    const full = path.join(ROOT, file);
    if (fs.existsSync(full)) Object.assign(fromFiles, parseEnv(fs.readFileSync(full, 'utf8')));
  }
  const env = { ...fromFiles, ...process.env };
  const apiPort = Number(env.PORT || env.API_PORT || 8876);
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535 || apiPort === 5173) throw new Error('后端端口配置无效，或与前端 5173 冲突。');
  env.API_PORT = String(apiPort);
  env.VITE_API_PROXY_TARGET = `http://127.0.0.1:${apiPort}`;
  const vectorDriver = String(env.VECTOR_STORE_DRIVER || 'qdrant').toLowerCase();
  if (vectorDriver !== 'upstash' && !env.QDRANT_URL) env.QDRANT_URL = 'http://127.0.0.1:6333';
  let localQdrant = false;
  if (vectorDriver !== 'upstash') {
    try { const u = new URL(env.QDRANT_URL); localQdrant = ['127.0.0.1', 'localhost'].includes(u.hostname) && u.port === '6333'; }
    catch { throw new Error('QDRANT_URL 配置不是有效 URL。'); }
  }
  return { env, apiPort, vectorDriver, localQdrant };
}
function fetchLocal(port, route) {
  return new Promise(resolve => {
    const req = http.get({ host: '127.0.0.1', port, path: route, timeout: 1800 }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', part => { if (body.length < 100000) body += part; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
      response.on('error', () => resolve(null));
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}
async function isReady(kind, port) {
  const result = await fetchLocal(port, kind === 'backend' ? '/health' : '/@vite/client');
  if (result?.status !== 200) return false;
  if (kind === 'frontend') return result.body.includes('vite');
  try { return JSON.parse(result.body).service === 'ai-resume-coach-api'; } catch { return false; }
}
function portFree(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });
}
function run(command, args, timeout = 8000) {
  return new Promise(resolve => {
    const log = fs.openSync(path.join(RUNTIME, 'docker.log'), 'a');
    const child = spawn(command, args, { cwd: ROOT, windowsHide: true, stdio: ['ignore', log, log] });
    fs.closeSync(log);
    const timer = setTimeout(() => { child.kill(); resolve(false); }, timeout);
    child.on('error', () => { clearTimeout(timer); resolve(false); });
    child.on('exit', code => { clearTimeout(timer); resolve(code === 0); });
  });
}
async function ensureQdrant(settings) {
  if (!settings.localQdrant) { say('向量服务使用现有远程配置，跳过本地 Docker。'); return; }
  if ((await fetchLocal(6333, '/healthz'))?.status === 200) { say('本地 Qdrant 已运行。'); return; }
  const docker = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/resources/bin/docker.exe');
  const desktop = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Docker/Docker/Docker Desktop.exe');
  if (!fs.existsSync(docker)) { say('提示：没有找到 Docker，继续启动网页；本地向量服务未启动。'); return; }
  say('正在检查 Docker…');
  let ready = await run(docker, ['info', '--format', '{{.ServerVersion}}']);
  if (!ready && fs.existsSync(desktop)) {
    // Only cold-start recovery; a running Desktop or engine is never stopped.
    const { recoverDockerRuntime, dockerStopped } = require('./docker-runtime-guard.cjs');
    recoverDockerRuntime(say);
    if (dockerStopped()) powershell(`Start-Process -FilePath ${quotePS(desktop)} -WindowStyle Hidden`);
    else say('Docker Desktop 已在运行，等待现有实例；不会重复启动或强制关闭。');
    say('正在等待 Docker Desktop 就绪，最多约 90 秒…');
    const deadline = Date.now() + 90000;
    while (!ready && Date.now() < deadline) { await sleep(3000); ready = await run(docker, ['info', '--format', '{{.ServerVersion}}'], 5000); }
  }
  if (!ready) { say('提示：Docker 未就绪，继续启动网页；本地向量服务未启动。'); return; }
  say('正在启动 Qdrant（首次可能需要下载镜像）…');
  const ok = await run(docker, ['compose', '-f', path.join(ROOT, 'docker-compose.qdrant.yml'), 'up', '-d'], 180000);
  if (ok) for (let i = 0; i < 60; i++) { if ((await fetchLocal(6333, '/healthz'))?.status === 200) { say('Qdrant 已就绪。'); return; } await sleep(1000); }
  say('提示：Qdrant 未通过就绪检查，网页仍可打开；向量检索暂不可用。');
}
async function startService(kind, entry, args, port, env, records) {
  const old = records.find(item => item.kind === kind && item.port === port && sameProcess(item));
  if (old && await isReady(kind, port)) { say(`${kind === 'backend' ? '后端' : '前端'}已运行，直接复用。`); return old; }
  if (!(await portFree(port))) throw new Error(`端口 ${port} 被占用。请关闭之前手动启动的对应服务后重试；启动器不会关闭其他程序。`);
  const stdout = fs.openSync(path.join(RUNTIME, `${kind}.log`), 'a');
  const stderr = fs.openSync(path.join(RUNTIME, `${kind}.error.log`), 'a');
  const child = spawn(process.execPath, [entry, ...args], { cwd: ROOT, env, detached: true, windowsHide: true, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  child.unref();
  const identity = processIdentity(child.pid);
  if (!identity) throw new Error(`${kind} 未成功启动，请查看运行日志。`);
  const record = { kind, entry, port, pid: child.pid, created: identity.created };
  started.push(record);
  saveState([...records.filter(sameProcess), ...started]);
  for (let i = 0; i < 45; i++) {
    if (await isReady(kind, port)) { say(`${kind === 'backend' ? '后端' : '前端'}已就绪。`); return record; }
    await sleep(1000);
  }
  throw new Error(`${kind} 未通过就绪检查。日志目录：${RUNTIME}`);
}
function stopRecord(record) {
  if (!sameProcess(record)) return;
  execFileSync('taskkill.exe', ['/PID', String(record.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore', timeout: 10000 });
}
async function main() {
  if (!fs.existsSync(path.join(ROOT, 'node_modules/vite/bin/vite.js'))) throw new Error('项目或依赖缺失，请先在项目目录安装依赖。');
  const settings = config();
  if (process.argv.includes('--check')) { say(JSON.stringify({ project: ROOT, apiPort: settings.apiPort, vectorDriver: settings.vectorDriver, localQdrant: settings.localQdrant, node: process.version })); return; }
  lock();
  const prior = readState();
  const records = prior.root === ROOT ? prior.processes.filter(sameProcess) : [];
  if (process.argv.includes('stop')) {
    for (const record of records) stopRecord(record);
    saveState([]);
    say('由启动器管理的前后端已停止。Docker 与 Qdrant 保持原状。');
    return;
  }
  say('灵犀简历：一键启动');
  await startService('backend', path.join(ROOT, 'backend/server.js'), [], settings.apiPort, settings.env, records);
  await startService('frontend', path.join(ROOT, 'node_modules/vite/bin/vite.js'), ['--host', '127.0.0.1', '--port', '5173', '--strictPort'], 5173, settings.env, records);
  saveState([...records.filter(item => !started.some(row => row.kind === item.kind)), ...started]);
  await ensureQdrant(settings);
  const url = 'http://127.0.0.1:5173/';
  if (!process.argv.includes('--no-browser')) powershell(`Start-Process ${quotePS(url)}`);
  say(`网页已就绪：${url}`);
  say('AI 与检索效果仍取决于模型配置和知识资料。用完后双击“停止灵犀简历”。');
}
main().catch(error => {
  for (const record of started) { try { stopRecord(record); } catch {} }
  console.error(`启动器：${error.message}`);
  process.exitCode = 1;
}).finally(() => { if (lockHeld) { try { fs.unlinkSync(LOCK); } catch {} } });
