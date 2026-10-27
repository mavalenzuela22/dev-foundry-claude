import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { access, constants, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { RUNTIMES, buildLaunchPlan, parseLauncherArgs, runLauncher } from '../../src/telemetry/launch.js';
import { LAUNCH_MODES, buildTelemetryEnvironment, startCollector, writeOperationMarker } from '../../src/telemetry/telemetry.js';
import { requireLoopback } from './loopback.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runUuid = '123e4567-e89b-42d3-a456-426614174000';
const tricky = ['--runtime', '-p', 'a b', '--', '', 'ünï 😀', '$(x);`y`|&*"\'\\', '--help'];

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'claude-launcher-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function fakeSpawn({ code = 0, signal = null, error = false } = {}) {
  const calls = [];
  const spawn = (executable, args, options) => {
    const child = new EventEmitter();
    child.kills = [];
    child.kill = (sig) => { child.kills.push(sig); return true; };
    calls.push({ executable, args, options, child });
    setImmediate(() => (error ? child.emit('error', new Error('/secret/path ENOENT')) : child.emit('close', code, signal)));
    return child;
  };
  return { spawn, calls };
}

test('launch plans are exact for the three runtimes', () => {
  assert.deepEqual([...RUNTIMES], ['direct', 'dial', 'codemie']);
  assert.deepEqual(buildLaunchPlan('direct', ['-p', 'x']), { executable: 'claude', args: ['-p', 'x'] });
  assert.deepEqual(buildLaunchPlan('dial', ['-p', 'x']), { executable: 'dial', args: ['run', '--harness', 'claude-code', '--', '-p', 'x'] });
  assert.deepEqual(buildLaunchPlan('codemie', ['-p', 'x']), { executable: 'codemie-claude', args: ['-p', 'x'] });
  assert.deepEqual(buildLaunchPlan('direct', []), { executable: 'claude', args: [] });
  assert.throws(() => buildLaunchPlan('other', []));
});

test('claude arguments are preserved exactly after the first boundary', () => {
  for (const runtime of RUNTIMES) {
    const parsed = parseLauncherArgs(['--runtime', runtime, '--', ...tricky]);
    assert.deepEqual(parsed, { runtime, claudeArgs: tricky });
    const plan = buildLaunchPlan(parsed.runtime, parsed.claudeArgs);
    assert.deepEqual(plan.args.slice(-tricky.length), tricky);
  }
  assert.deepEqual(parseLauncherArgs(['--runtime', 'direct', '--']), { runtime: 'direct', claudeArgs: [] });
});

test('fake child receives runtime-specific argv with literal CLI payload intact', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const payload = ['-p', 'prompt with "quotes" and spaces', '--model', 'claude-test', '--', '--flag=value'];
  const expected = {
    direct: ['claude', payload],
    dial: ['dial', ['run', '--harness', 'claude-code', '--', ...payload]],
    codemie: ['codemie-claude', payload],
  };
  const startFake = async () => ({ port: 40000, host: '127.0.0.1', close: async () => {} });
  for (const runtime of RUNTIMES) {
    const { spawn, calls } = fakeSpawn();
    const code = await runLauncher({ argv: ['--runtime', runtime, '--', ...payload], projectRoot, spawn, startCollector: startFake, env: {} });
    assert.equal(code, 0);
    assert.equal(calls[0].executable, expected[runtime][0]);
    assert.deepEqual(calls[0].args, expected[runtime][1]);
    assert.equal(calls[0].options.shell, false);
    assert.equal(calls[0].options.stdio, 'inherit');
  }
});

test('unknown runtime and malformed launcher syntax reject', () => {
  const bad = [
    [], ['--runtime'], ['--runtime', 'direct'], ['--runtime', '--', 'x'], ['--runtime', 'unknown', '--'], ['--runtime', 'DIRECT', '--'],
    ['--runtime', '', '--'], ['--runtime', 'direct', 'x', '--'], ['--runtime', 'direct', '-p', 'x'], ['direct', '--', 'x'],
    ['--runtime', 'direct', '--runtime', 'dial', '--'], ['--other', 'x', '--runtime', 'direct', '--'], ['-p', '--runtime', 'direct', '--'],
    ['--runtime=direct', '--'],
  ];
  for (const argv of bad) assert.throws(() => parseLauncherArgs(argv), /Invalid launcher arguments/, JSON.stringify(argv));
});

test('rejected arguments start no collector and no child, exit 2 with a generic message', async () => {
  let started = false;
  const { spawn, calls } = fakeSpawn();
  const messages = [];
  const code = await runLauncher({ argv: ['--runtime', 'bogus', '--'], spawn, startCollector: async () => { started = true; }, stderr: (m) => messages.push(m) });
  assert.equal(code, 2);
  assert.equal(started, false);
  assert.equal(calls.length, 0);
  assert.equal(messages.length, 1);
  assert.ok(!/at |Error:/.test(messages[0]));
});

test('default launch uses an OS-selected loopback port and passes it to the child endpoint', async (t) => {
  if (!await requireLoopback(t)) return;
  const projectRoot = await temporaryDirectory(t);
  let collector;
  const { spawn, calls } = fakeSpawn();
  const code = await runLauncher({
    argv: ['--runtime', 'dial', '--', ...tricky], projectRoot, spawn, env: { PATH: process.env.PATH },
    startCollector: async (options) => { collector = await startCollector(options); collector.options = options; return collector; },
  });
  assert.equal(code, 0);
  assert.equal(collector.options.port, 0);
  assert.equal(collector.host, '127.0.0.1');
  assert.notEqual(collector.port, 4318);
  assert.ok(collector.port > 0);
  const [call] = calls;
  assert.equal(call.executable, 'dial');
  assert.deepEqual(call.args, ['run', '--harness', 'claude-code', '--', ...tricky]);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.stdio, 'inherit');
  assert.equal(call.options.cwd, projectRoot);
  assert.equal(call.options.env.OTEL_EXPORTER_OTLP_ENDPOINT, `http://127.0.0.1:${collector.port}`);
  assert.equal(call.options.env.DEV_FOUNDRY_CLAUDE_LAUNCH_MODE, 'dial');
});

test('DEV_FOUNDRY_TELEMETRY_PORT is honored when valid; invalid optional ports still launch', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const seen = [];
  const startFake = async (options) => { seen.push(options.port); return { port: options.port || 40000, host: '127.0.0.1', close: async () => {} }; };
  const { spawn, calls } = fakeSpawn();
  await runLauncher({ argv: ['--runtime', 'direct', '--'], projectRoot, spawn, startCollector: startFake, env: { DEV_FOUNDRY_TELEMETRY_PORT: '43210' } });
  assert.deepEqual(seen, [43210]);
  for (const port of ['abc', '-1', '65536', 'Infinity', '']) {
    const env = { DEV_FOUNDRY_TELEMETRY_PORT: port, KEEP: 'inherited' };
    const messages = [];
    const code = await runLauncher({ argv: ['--runtime', 'direct', '--', ...tricky], projectRoot, spawn, startCollector: startFake, env, stderr: (m) => messages.push(m), onReady: () => assert.fail('collector not ready') });
    assert.equal(code, 0);
    assert.deepEqual(calls.at(-1).args, tricky);
    assert.equal(calls.at(-1).executable, 'claude');
    assert.deepEqual(calls.at(-1).options, { stdio: 'inherit', cwd: projectRoot, env, shell: false });
    assert.equal(calls.at(-1).options.env.OTEL_EXPORTER_OTLP_ENDPOINT, undefined);
    assert.deepEqual(messages, ['Warning: optional local telemetry is degraded; continuing without telemetry injection.']);
  }
  assert.deepEqual(seen, [43210]);
  assert.equal(calls.length, 6);
});

test('collector failure launches only the exact selected runtime with inherited env and exit status', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const env = { PATH: '/runtime/bin', KEEP: 'secret-value', OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'inherited-endpoint' };
  for (const runtime of RUNTIMES) {
    const { spawn, calls } = fakeSpawn({ code: 7 });
    const messages = [];
    let attempts = 0;
    let collectorOptions;
    const code = await runLauncher({
      argv: ['--runtime', runtime, '--', ...tricky], projectRoot, env, spawn,
      startCollector: async (options) => {
        attempts++;
        collectorOptions = options;
        throw new Error('/secret/path secret-value EADDRINUSE');
      },
      stderr: (m) => messages.push(m), onReady: () => assert.fail('collector not ready'),
    });
    assert.equal(code, 7);
    assert.equal(attempts, 1);
    assert.equal(collectorOptions.host, '127.0.0.1');
    assert.equal(collectorOptions.port, 0);
    assert.equal(collectorOptions.telemetryDir, path.join(projectRoot, '.dev-foundry/telemetry/local'));
    assert.equal(calls.length, 1);
    const { child, ...call } = calls[0];
    assert.deepEqual(call, { ...buildLaunchPlan(runtime, tricky), options: { stdio: 'inherit', cwd: projectRoot, env, shell: false } });
    assert.equal(call.options.env.OTEL_EXPORTER_OTLP_ENDPOINT, undefined);
    assert.equal(call.options.env.DEV_FOUNDRY_TELEMETRY_DIR, undefined);
    assert.deepEqual(messages, ['Warning: optional local telemetry is degraded; continuing without telemetry injection.']);
  }
  assert.deepEqual(await readdir(projectRoot), []);
});

test('failed preflight and symlinked telemetry storage skip the collector but still launch', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const outside = await temporaryDirectory(t);
  for (const telemetryPreflight of [false, true]) {
    if (telemetryPreflight) {
      await mkdir(path.join(projectRoot, '.dev-foundry/telemetry'), { recursive: true });
      await symlink(outside, path.join(projectRoot, '.dev-foundry/telemetry/local'), 'dir');
    }
    const { spawn, calls } = fakeSpawn();
    let attempts = 0;
    const code = await runLauncher({
      argv: ['--runtime', 'dial', '--'], projectRoot, env: {}, spawn, telemetryPreflight,
      startCollector: async () => { attempts++; throw new Error(); }, stderr: () => {},
    });
    assert.equal(code, 0);
    assert.equal(attempts, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options.env, {});
    assert.deepEqual(await readdir(outside), []);
  }
});

test('privacy policy env is identical across modes except the launch mode', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  const envs = RUNTIMES.map((launchMode) => buildTelemetryEnvironment({ telemetryDir, telemetryRunId: runUuid, port: 5555, baseEnv: { KEEP: '1', DEV_FOUNDRY_CLAUDE_LAUNCH_MODE: 'inherited' }, launchMode }));
  for (const env of envs) {
    for (const flag of ['OTEL_LOG_USER_PROMPTS', 'OTEL_LOG_ASSISTANT_RESPONSES', 'OTEL_LOG_TOOL_DETAILS', 'OTEL_LOG_TOOL_CONTENT', 'OTEL_LOG_RAW_API_BODIES']) assert.equal(env[flag], '0');
    for (const flag of ['CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_ENHANCED_TELEMETRY_BETA', 'ENABLE_BETA_TRACING_DETAILED']) assert.equal(env[flag], '0');
    assert.equal(env.OTEL_METRICS_INCLUDE_ACCOUNT_UUID, 'false');
  }
  const strip = ({ DEV_FOUNDRY_CLAUDE_LAUNCH_MODE, ...rest }) => rest;
  assert.deepEqual(strip(envs[1]), strip(envs[0]));
  assert.deepEqual(strip(envs[2]), strip(envs[0]));
  assert.deepEqual(envs.map((env) => env.DEV_FOUNDRY_CLAUDE_LAUNCH_MODE), ['direct', 'dial', 'codemie']);
});

test('launch mode is a closed set in the environment builder and marker writer', async (t) => {
  const telemetryDir = await temporaryDirectory(t);
  assert.deepEqual([...LAUNCH_MODES], ['direct', 'dial', 'codemie']);
  const base = { telemetryDir, telemetryRunId: runUuid, port: 5555 };
  for (const launchMode of ['other', '', 'DIRECT', null, 1]) assert.throws(() => buildTelemetryEnvironment({ ...base, launchMode }));
  const inherited = buildTelemetryEnvironment({ ...base, baseEnv: { DEV_FOUNDRY_CLAUDE_LAUNCH_MODE: 'dial' } });
  assert.equal('DEV_FOUNDRY_CLAUDE_LAUNCH_MODE' in inherited, false);

  const read = async () => (await readdir(telemetryDir)).filter((n) => n.startsWith('operations-'));
  const marker = async (mode) => {
    const dir = await mkdtemp(path.join(telemetryDir, 'm-'));
    const env = { DEV_FOUNDRY_TELEMETRY_RUN_ID: runUuid, DEV_FOUNDRY_TELEMETRY_DIR: dir };
    if (mode !== undefined) env.DEV_FOUNDRY_CLAUDE_LAUNCH_MODE = mode;
    await writeOperationMarker({ requestedAction: 'inspect', targetProject: 'p' }, { env });
    const [file] = await readdir(dir);
    return JSON.parse((await readFile(path.join(dir, file), 'utf8')).trim());
  };
  for (const mode of LAUNCH_MODES) assert.equal((await marker(mode)).launchMode, mode);
  for (const mode of [undefined, 'other', '', 'Direct', 'direct ']) {
    const record = await marker(mode);
    assert.equal('launchMode' in record, false);
    assert.ok(!JSON.stringify(record).includes('other'));
  }
  assert.deepEqual(await read(), []);
});

test('collector is closed after child exit and the exit status is preserved', async (t) => {
  if (!await requireLoopback(t)) return;
  const projectRoot = await temporaryDirectory(t);
  for (const [outcome, expected] of [[{ code: 0 }, 0], [{ code: 7 }, 7], [{ code: null, signal: 'SIGTERM' }, 143], [{ code: null, signal: 'SIGINT' }, 130]]) {
    const { spawn } = fakeSpawn(outcome);
    let collector;
    const code = await runLauncher({
      argv: ['--runtime', 'codemie', '--', 'x'], projectRoot, spawn, env: {},
      startCollector: async (options) => {
        collector = await startCollector(options);
        const close = collector.close.bind(collector);
        collector.closeCalls = 0;
        collector.close = () => { collector.closeCalls += 1; return close(); };
        return collector;
      },
    });
    assert.equal(code, expected);
    assert.equal(collector.closeCalls, 1);
    await assert.rejects(fetch(`http://127.0.0.1:${collector.port}/v1/logs`, { method: 'POST' }));
  }
});

test('spawn failure exits 1 with a message naming no paths, and still closes the collector', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const { spawn, calls } = fakeSpawn({ error: true });
  const messages = [];
  let closed = 0;
  const code = await runLauncher({
    argv: ['--runtime', 'direct', '--'], projectRoot, spawn, env: {}, stderr: (m) => messages.push(m),
    startCollector: async () => ({ port: 45000, host: '127.0.0.1', close: async () => { closed += 1; } }),
  });
  assert.equal(code, 1);
  assert.equal(calls.length, 1);
  assert.equal(closed, 1);
  assert.ok(messages.length >= 1 && messages.every((m) => !m.includes('/') && !m.includes('secret')));
});

test('runtime spawn errors never retry or change executable, including with degraded telemetry', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  for (const runtime of RUNTIMES) {
    for (const telemetryFails of [false, true]) {
      for (const synchronous of [false, true]) {
        const fake = fakeSpawn({ error: true });
        let attempts = 0;
        let executable;
        let closed = 0;
        const messages = [];
        const spawn = (...args) => {
          attempts++;
          executable = args[0];
          if (synchronous) throw new Error('/secret/path ENOENT');
          return fake.spawn(...args);
        };
        const code = await runLauncher({
          argv: ['--runtime', runtime, '--'], projectRoot, env: {}, spawn, stderr: (m) => messages.push(m),
          startCollector: async () => {
            if (telemetryFails) throw new Error('/secret/path EACCES');
            return { port: 45000, close: async () => { closed++; } };
          },
        });
        assert.equal(code, 1);
        assert.equal(attempts, 1);
        assert.equal(executable, buildLaunchPlan(runtime).executable);
        assert.equal(closed, telemetryFails ? 0 : 1);
        assert.equal(messages.at(-1), 'Unable to launch the selected Claude Code runtime executable.');
        assert.ok(messages.every((m) => !m.includes('/secret/path') && !m.includes('ENOENT')));
      }
    }
  }
});

test('collector cleanup runs once and cannot replace the child exit code or signal', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  for (const cleanupFails of [false, true]) {
    for (const [outcome, expected] of [[{ code: 0 }, 0], [{ code: 7 }, 7], [{ code: null, signal: 'SIGTERM' }, 143]]) {
      const { spawn } = fakeSpawn(outcome);
      const messages = [];
      let closed = 0;
      const code = await runLauncher({
        argv: ['--runtime', 'codemie', '--'], projectRoot, env: {}, spawn, stderr: (m) => messages.push(m),
        startCollector: async () => ({ port: 45000, close: async () => {
          closed++;
          if (cleanupFails) throw new Error('/secret/path cleanup failed');
        } }),
      });
      assert.equal(code, expected);
      assert.equal(closed, 1);
      assert.deepEqual(messages, cleanupFails ? ['Warning: optional local telemetry cleanup failed.'] : []);
    }
  }
});

test('SIGINT and SIGTERM are forwarded and handlers are removed afterwards', async (t) => {
  const projectRoot = await temporaryDirectory(t);
  const signalTarget = new EventEmitter();
  const children = [];
  const spawn = () => {
    const child = new EventEmitter();
    child.kills = [];
    child.kill = (sig) => { child.kills.push(sig); return true; };
    children.push(child);
    return child;
  };
  const running = runLauncher({
    argv: ['--runtime', 'direct', '--'], projectRoot, spawn, env: {}, signalTarget, killTimeoutMs: 10,
    startCollector: async () => ({ port: 45000, host: '127.0.0.1', close: async () => {} }),
  });
  while (children.length === 0) await new Promise((r) => setImmediate(r));
  signalTarget.emit('SIGINT');
  signalTarget.emit('SIGTERM');
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(children[0].kills, ['SIGINT', 'SIGTERM', 'SIGKILL']);
  children[0].emit('close', null, 'SIGKILL');
  assert.equal(await running, 137);
  assert.equal(signalTarget.listenerCount('SIGINT'), 0);
  assert.equal(signalTarget.listenerCount('SIGTERM'), 0);
});

test('run-claude.sh is executable, delegates to the node launcher and holds no policy', async () => {
  const script = path.join(repoRoot, 'scripts/telemetry/run-claude.sh');
  await access(script, constants.X_OK);
  assert.ok(((await stat(script)).mode & 0o111) !== 0);
  const mode = execFileSync('git', ['ls-files', '-s', 'scripts/telemetry/run-claude.sh'], { cwd: repoRoot, encoding: 'utf8' }).split(' ')[0];
  if (mode) assert.equal(mode, '100755');
  const text = await readFile(script, 'utf8');
  assert.ok(text.startsWith('#!/bin/sh\n'));
  assert.match(text, /exec node scripts\/telemetry\/claude\.mjs --runtime "\$mode" "\$@"/);
  for (const forbidden of [/OTEL_/, /ANTHROPIC/, /DIAL_API/i, /model/i, /collector/i, /4318/]) assert.doesNotMatch(text, forbidden);
  const none = spawnSync(script, [], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  assert.match(none.stderr, /Usage/);
  // Bad invocations are rejected by the Node launcher before any collector or child starts.
  const bad = spawnSync(script, ['bogus', '--', 'x'], { encoding: 'utf8', cwd: os.tmpdir() });
  assert.equal(bad.status, 2);
  assert.ok(!bad.stderr.includes('    at '));
});

test('only the generated CodeMie analytics subtree is Git-ignored', () => {
  const check = (file) => spawnSync('git', ['check-ignore', '-q', file], { cwd: repoRoot }).status;
  assert.equal(check('docs/codemie/analytics/probe.json'), 0);
  assert.equal(check('docs/codemie/README.md'), 1);
});
