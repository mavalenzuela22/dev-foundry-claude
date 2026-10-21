import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { installAndInspect, npmInvocation, RELEASES, shimNamesForPlatform, supportsNodeVersion, verifyArchiveIdentity, verifyPin, within } from '../../scripts/acceptance/tsk026-native-155.mjs';

test('Node major precondition accepts supported 20 and 22 and rejects 18', () => {
  assert.equal(supportsNodeVersion('v18.20.8'), false);
  assert.equal(supportsNodeVersion('v20.19.0'), true);
  assert.equal(supportsNodeVersion('v22.14.0'), true);
});

test('Windows npm CLI resolution prefers verified npm_execpath then neighboring Node npm then the narrow PATH fallback', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsk026-npm-resolution-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pathApi = path.win32;
  const execPath = 'C:\\node\\node.exe';
  const neighbor = pathApi.join(pathApi.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const explicit = 'C:\\explicit\\npm-cli.js';
  const fallback = 'C:\\path-entry\\node_modules\\npm\\bin\\npm-cli.js';
  const existing = new Set([neighbor, explicit, fallback]);
  const resolve = (env) => npmInvocation({ platform: 'win32', env, execPath, pathApi, exists: (file) => existing.has(file) });
  assert.deepEqual(resolve({ npm_execpath: explicit, PATH: 'C:\\path-entry' }), [execPath, explicit]);
  assert.deepEqual(resolve({ PATH: 'C:\\path-entry' }), [execPath, neighbor]);
  existing.delete(neighbor);
  assert.deepEqual(resolve({ PATH: 'C:\\path-entry' }), [execPath, fallback]);
  assert.throws(() => resolve({ PATH: 'C:\\missing' }), /Could not locate npm-cli\.js/);
});

test('published archive origins, transport hashes, and immutable payload pins are fixed', () => {
  assert.equal(RELEASES.target.url, 'https://github.com/mavalenzuela22/dev-foundry-claude/releases/download/v1.5.5/dev-foundry-claude-adapter-1.5.5.tgz');
  assert.equal(RELEASES.target.sha256, '1b220edd2fc608ee9fdb3cbac739c45f418f8fcb6b061dc33bbf6764349961e4');
  assert.equal(RELEASES.target.pin, '1.5.5:sha256:c1686443eafc42504c5b8423c4bc88eb57a5f2f5fc142537ff4780f57a6858bf');
  assert.equal(RELEASES.source.url, 'https://github.com/mavalenzuela22/dev-foundry-claude/releases/download/v1.4.2/dev-foundry-claude-adapter-1.4.2.tgz');
  assert.equal(RELEASES.source.sha256, '3aa7542c41ce613c9c152e21c8e2d95d835dc00be1cb8f2e46302daa54cadaf3');
  assert.equal(RELEASES.source.pin, '1.4.2:sha256:1780711cd5661b40f7f0e1220146e87ae12f88c3bc9ba37de06f17fe69cbe79f');
  for (const kind of ['target', 'source']) {
    assert.throws(() => verifyArchiveIdentity(kind, Buffer.from('bad archive')),/identity mismatch/);
    assert.throws(() => verifyArchiveIdentity(kind, Buffer.from('bad archive'), 'https://example.invalid/archive.tgz'),/identity mismatch/);
    assert.throws(() => verifyPin(kind, { version: RELEASES[kind].version, expect: 'wrong:sha256:' + '0'.repeat(64) }),/pin mismatch/);
  }
});

test('native npm shim expectations and scratch confinement are platform-specific', () => {
  assert.deepEqual(shimNamesForPlatform('win32'), ['dev-foundry-claude.cmd', 'dev-foundry-claude.ps1']);
  assert.deepEqual(shimNamesForPlatform('darwin'), ['dev-foundry-claude']);
  assert.deepEqual(shimNamesForPlatform('linux'), ['dev-foundry-claude']);
  const root = path.join(os.tmpdir(), 'probe-scratch');
  assert.equal(within(root, path.join(root, 'node_modules', '.bin', 'dev-foundry-claude')), true);
  assert.equal(within(root, path.join(root, '..', 'outside')), false);
});

test('positive source and target inspection records each install, pin, shim, CLI, migration, and scratch result', async (t) => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tsk026-positive-report-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const report = { checks: {} };
  const expectedStatuses = ['PASS', 'PASS', 'PASS', 'PASS', 'PASS'];
  for (const kind of ['source', 'target']) {
    report.checks[kind] = { officialArchive: 'PASS', npmVersion: { status: 'NOT_RUN' }, isolatedInstall: 'NOT_RUN',
      installResult: null, payloadPin: 'NOT_RUN', payload: null, nativeShims: 'NOT_RUN', shims: [],
      packagedCliVersion: 'NOT_RUN', migrationInspection: 'NOT_RUN', cli: {}, scratchBoundary: 'NOT_RUN', failure: null };
    const prefix = path.join(root, `install-${kind}`);
    const packageRoot = path.join(prefix, 'node_modules', '@dev-foundry', 'claude-adapter');
    const binDir = path.join(prefix, 'node_modules', '.bin');
    let installCreatedFixture = false;
    const execute = (command, args) => {
      if (args[0] === '--version') return { status: 0, stdout: '10.8.2\n', stderr: '' };
      if (args[0] === 'install') {
        mkdirSync(packageRoot, { recursive: true });
        mkdirSync(binDir, { recursive: true });
        for (const shim of shimNamesForPlatform(process.platform)) writeFileSync(path.join(binDir, shim), 'fixture');
        installCreatedFixture = true;
        return { status: 0, stdout: '', stderr: '' };
      }
      assert.equal(installCreatedFixture, true);
      if (args.at(-1) === '--version') return { status: 0, stdout: `${RELEASES[kind].version}\n`, stderr: '' };
      assert.deepEqual(args.slice(-1), ['migration']);
      return { status: 0, stdout: 'migration inspection complete\n', stderr: '' };
    };
    await installAndInspect(kind, { file: path.join(root, `${kind}.tgz`) }, root, report, {
      invokeNpm: () => ['npm'],
      execute,
      inspectPin: () => ({ version: RELEASES[kind].version, root: 'a'.repeat(64), expect: RELEASES[kind].pin }),
    });
    const checks = report.checks[kind];
    assert.equal(checks.npmVersion.status, 'PASS');
    assert.equal(checks.installResult.exitCode, 0);
    assert.equal(checks.isolatedInstall, 'PASS');
    assert.equal(checks.payloadPin, 'PASS');
    assert.equal(checks.nativeShims, 'PASS');
    assert.equal(checks.packagedCliVersion, 'PASS');
    assert.equal(checks.migrationInspection, 'PASS');
    assert.equal(checks.scratchBoundary, 'PASS');
    assert.deepEqual([checks.packagedCliVersion, checks.migrationInspection, checks.payloadPin, checks.nativeShims, checks.scratchBoundary], expectedStatuses);
    assert.equal(checks.payload.version, RELEASES[kind].version);
    assert.deepEqual(Object.keys(checks.cli).sort(), ['migration', 'version']);
    assert.equal(checks.failure, null);
  }
});

test('unsupported or bad archives fail nonzero and still emit an honest report', async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsk026-native-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fake = path.join(root, 'fake.tgz');
  await writeFile(fake, 'not-the-release');
  const script = fileURLToPath(new URL('../../scripts/acceptance/tsk026-native-155.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--target-archive', fake, '--report-root', root], { encoding: 'utf8', timeout: 10_000 });
  assert.notEqual(result.status, 0);
  const scratch = JSON.parse(result.stdout.trim()).report;
  assert.ok(scratch, result.stdout);
  const report = JSON.parse(await readFile(scratch, 'utf8'));
  assert.equal(report.status, 'FAIL');
  assert.match(report.failure.message, /identity mismatch|Node 20 or later/);
  assert.equal(report.checks.target.officialArchive, 'FAIL', 'failed archive validation cannot claim native acceptance');
  assert.equal(report.checks.target.isolatedInstall, 'NOT_RUN');
  assert.match(report.gaps[0], /No disposable consumer upgrade\/recovery scenario/);
});
