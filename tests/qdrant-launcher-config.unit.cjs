const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const launcher = path.resolve(__dirname, '../scripts/lingxi-launcher.cjs');
const check = overrides => spawnSync(process.execPath, [launcher, '--check'], { encoding: 'utf8', env: { ...process.env, API_PORT: '8876', PORT: '8876', VECTOR_STORE_DRIVER: 'qdrant', ...overrides } });
for (const port of [6333, 16333]) {
  const result = check({ QDRANT_HTTP_PORT: String(port), QDRANT_URL: `http://127.0.0.1:${port}` });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).localQdrant, true);
  assert.equal(JSON.parse(result.stdout).qdrantPort, port);
}
assert.equal(check({ QDRANT_HTTP_PORT: '16333', QDRANT_URL: 'http://127.0.0.1:6333' }).status, 1);
for (const port of ['abc', '0', '65536', '5173', '8876']) assert.equal(check({ QDRANT_HTTP_PORT: port, QDRANT_URL: 'http://127.0.0.1:16333' }).status, 1);
const remote = check({ QDRANT_HTTP_PORT: '16333', QDRANT_URL: 'https://qdrant.example.com:6333' });
assert.equal(remote.status, 0);
assert.equal(JSON.parse(remote.stdout).localQdrant, false);
console.log('Qdrant launcher configuration passed: matching local ports, mismatch/conflict rejection, remote bypass.');
