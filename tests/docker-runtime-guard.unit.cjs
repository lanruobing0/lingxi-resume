const assert = require('node:assert/strict');
const { planRecovery } = require('../scripts/docker-runtime-guard.cjs');
const socket = name => ({ name, directory: false, reparse: true, length: 0 });
const run = entries => ({ relative: 'Docker/run', exists: true, reparse: false, entries });
assert.deepEqual(planRecovery([run([socket('sailor-ingest.sock')])], false), []);
assert.deepEqual(planRecovery([run([])], true), []);
assert.deepEqual(planRecovery([run([socket('sailor-ingest.sock'), socket('dockerInference.stale')]),
  { relative: 'docker-secrets-engine', exists: true, entries: [socket('engine.sock')] }], true), ['Docker/run', 'docker-secrets-engine']);
for (const entry of [socket('docker_data.vhdx'), { ...socket('sailor-ingest.sock'), length: 10 },
  { ...socket('sailor-ingest.sock'), directory: true }, { ...socket('sailor-ingest.sock'), reparse: false }]) {
  assert.throws(() => planRecovery([run([entry])], true), /未知内容/);
}
assert.throws(() => planRecovery([{ ...run([socket('sailor-ingest.sock')]), reparse: true }], true));
assert.throws(() => planRecovery([{ relative: 'Docker/wsl', exists: true, entries: [] }], true));
console.log('Docker runtime guard safety tests passed');
