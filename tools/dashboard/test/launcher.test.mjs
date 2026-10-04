import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(new URL('../../../scripts/dashboard.mjs', import.meta.url));
const runtime = fileURLToPath(new URL('../server/start.mjs', import.meta.url));

function command(entry, args) {
  return new Promise((resolve, reject) => {
    execFile(process.execPath, [entry, ...args], { cwd: tmpdir(), timeout: 5000 }, (error, stdout, stderr) => {
      if (error && (error.killed || typeof error.code !== 'number')) return reject(error);
      resolve({ code: error?.code ?? 0, stdout, stderr });
    });
  });
}

// Reserve an OS-selected loopback port only in the test; production still requires
// an explicit safe port. Report host socket restrictions as unverified, not PASS.
async function reservePort(t) {
  const socket = createServer();
  try {
    await new Promise((resolve, reject) => {
      socket.once('error', reject);
      socket.listen(0, '127.0.0.1', resolve);
    });
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      t.skip(`Host prohibits loopback sockets (${error.code}); live launcher behavior unverified`);
      return null;
    }
    throw error;
  }
  t.after(() => socket.listening ? new Promise((resolve) => socket.close(resolve)) : undefined);
  assert.equal(socket.address().address, '127.0.0.1');
  const port = socket.address().port;
  assert.ok(port >= 1024 && port <= 65535);
  return { port, release: () => new Promise((resolve) => socket.close(resolve)) };
}

async function start(t, entry, port) {
  const child = spawn(process.execPath, [entry, '--port', String(port)], { cwd: tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Dashboard startup timed out: ${stderr}`)), 5000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.includes(`http://127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); }
    });
    closed.then((result) => { clearTimeout(timer); reject(new Error(`Dashboard exited before startup: ${JSON.stringify(result)} ${stderr}`)); }, reject);
  });
  return {
    url: `http://127.0.0.1:${port}`,
    async stop(signal) {
      assert.equal(child.kill(signal), true);
      let timer;
      try {
        const result = await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Dashboard did not close after ${signal}`)), 5000); })]);
        assert.deepEqual(result, { code: 0, signal: null });
        assert.equal(stderr, '');
      } finally { clearTimeout(timer); }
    },
  };
}

test('repository launcher preserves runtime argument validation and exit behavior', async () => {
  for (const args of [[], ['--port'], ['--port', 'no'], ['--port', '1023'], ['--port', '65536'], ['--port', '3000', '--host', '0.0.0.0']]) {
    const expected = await command(runtime, args);
    assert.equal(expected.code, 1);
    assert.deepEqual(await command(launcher, args), expected);
  }
});

test('repository launcher serves the same dashboard from another cwd and closes cleanly on both signals', { timeout: 20000 }, async (t) => {
  const reservation = await reservePort(t);
  if (!reservation) return;
  const { port } = reservation;
  await reservation.release();
  const direct = await start(t, runtime, port);
  const expectedHealth = await (await fetch(`${direct.url}/api/dashboard/v1/health`)).json();
  await direct.stop('SIGTERM');
  const expectedUi = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const wrapped = await start(t, launcher, port);
    const health = await fetch(`${wrapped.url}/api/dashboard/v1/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), expectedHealth);
    assert.equal(expectedHealth.product, 'dev-foundry-claude');
    assert.deepEqual(expectedHealth.dashboard, { api: 'available', ui: 'available' });
    assert.equal(await (await fetch(wrapped.url)).text(), expectedUi);
    assert.equal((await fetch(`${wrapped.url}/api/dashboard/v1/executions`, { method: 'POST' })).status, 405);
    await wrapped.stop(signal);
    // Rebinding the exact port proves shutdown released the listener.
    const socket = createServer();
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(port, '127.0.0.1', resolve); });
    await new Promise((resolve) => socket.close(resolve));
  }
});

test('repository launcher preserves occupied-port failure without a fallback listener', async (t) => {
  const reservation = await reservePort(t);
  if (!reservation) return;
  const args = ['--port', String(reservation.port)];
  const expected = await command(runtime, args);
  assert.equal(expected.code, 1);
  assert.match(expected.stderr, /Requested port is occupied/);
  assert.equal(expected.stdout, '');
  assert.deepEqual(await command(launcher, args), expected);
});
