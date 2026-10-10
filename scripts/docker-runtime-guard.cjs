// Recover orphaned Windows AF_UNIX endpoints without touching Docker storage.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const endpoints = {
  'Docker/run': new Set(['dockerEthernetVfkit', 'dockerInference', 'sailor-ingest.sock', 'userAnalyticsOtlpHttp.sock']),
  'docker-secrets-engine': new Set(['engine.sock']),
};
const psQuote = value => "'" + value.replace(/'/g, "''") + "'";
function ps(command) {
  return execFileSync(path.join(process.env.SystemRoot || 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
    ['-NoProfile', '-NonInteractive', '-Command', "$ErrorActionPreference='Stop'; " + command],
    { encoding: 'utf8', windowsHide: true, timeout: 10000 }).trim();
}
function dockerStopped() {
  return ps("@(Get-Process -Name 'Docker Desktop','com.docker.backend','docker-desktop' -ErrorAction SilentlyContinue).Count") === '0';
}
function planRecovery(snapshots, stopped) {
  if (!stopped) return [];
  const plan = [];
  for (const snapshot of snapshots) {
    const allowed = endpoints[snapshot.relative];
    if (!allowed) throw new Error('不允许处理此 Docker 路径。');
    if (!snapshot.exists || snapshot.entries.length === 0) continue;
    if (snapshot.reparse || snapshot.entries.some(entry =>
      !allowed.has(entry.name.replace(/\.stale$/, '')) || entry.directory || !entry.reparse || entry.length !== 0)) {
      throw new Error(`Docker 临时目录 ${snapshot.relative} 包含未知内容，未自动修改。`);
    }
    plan.push(snapshot.relative);
  }
  return plan;
}
function recoverDockerRuntime(say = console.log) {
  if (process.platform !== 'win32') return [];
  const base = path.resolve(process.env.LOCALAPPDATA);
  const lockPath = path.join(base, 'lingxi-docker-runtime.lock');
  let lock;
  try { lock = fs.openSync(lockPath, 'wx'); }
  catch { throw new Error('Docker runtime 修复锁已存在，请确认没有另一个灵犀启动操作。'); }
  try {
    if (!dockerStopped()) return [];
    const snapshots = Object.keys(endpoints).map(relative => {
      const target = path.resolve(base, relative);
      if (!target.startsWith(base + path.sep)) throw new Error('Docker runtime 路径越界。');
      const result = ps(`$p=${psQuote(target)}; if(Test-Path -LiteralPath $p){$d=Get-Item -LiteralPath $p -Force; @{exists=$true;reparse=[bool]($d.Attributes -band 1024);entries=@(Get-ChildItem -LiteralPath $p -Force | ForEach-Object {@{name=$_.Name;directory=$_.PSIsContainer;reparse=[bool]($_.Attributes -band 1024);length=$_.Length}})} | ConvertTo-Json -Depth 4 -Compress}else{'{"exists":false,"entries":[]}'} `);
      return { relative, ...JSON.parse(result) };
    });
    const plan = planRecovery(snapshots, true);
    // Recheck after inspection: never relocate endpoints used by a running Desktop.
    if (!dockerStopped()) return [];
    const recovered = [];
    for (const relative of plan) {
      if (!dockerStopped()) throw new Error('Docker 正在启动，已停止处理剩余临时目录。');
      const target = path.resolve(base, relative);
      const archive = target + '.lingxi-stale-' + Date.now() + '-' + process.pid;
      fs.renameSync(target, archive);
      try { fs.mkdirSync(target); }
      catch (error) { fs.renameSync(archive, target); throw error; }
      recovered.push({ relative, archive });
      say(`已隔离 Docker 残留 socket：${relative}（保留备份，不修改容器或卷）。`);
    }
    return recovered;
  } finally {
    fs.closeSync(lock);
    fs.unlinkSync(lockPath);
  }
}
module.exports = { planRecovery, recoverDockerRuntime, dockerStopped };
