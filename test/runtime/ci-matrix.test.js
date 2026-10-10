import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import test from 'node:test';
import { parse } from 'yaml';
import { buildManifestBytes, sha256, verifyPayload } from '../../src/adopt/pin.js';
import { archiveErrorDiagnostic, candidateManifest, inspectArchive, inspectShims, installArguments, main,
  npmCli, packCandidate, packOutputDiagnostic, pendingReceipt, probeExit, tempChild, verifyCandidate } from '../../scripts/acceptance/tsk026-ci.mjs';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const bound = { producerSha: '8'.repeat(40), runId: '123', runAttempt: '1' };
const bins = { 'dev-foundry-claude': 'bin/dev-foundry-claude.js', 'dev-foundry-claude-launcher': 'bin/dev-foundry-claude-launcher.js' };
const dependencies = { '@modelcontextprotocol/server': '2.2.0', yaml: '2.9.1', zod: '4.6.5' };
function scratch(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'tsk026-ci-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true })); return root;
}
// Explicitly SYNTHETIC, not a release, native-host receipt or real runtime.
// Generate bounded regular-file tar headers, independent of network/npm pack.
function tar(entries, type = '0') {
  const blocks = [];
  for (const [relative, bytes] of entries) {
    const body = Buffer.from(bytes), header = Buffer.alloc(512);
    const text = (at, size, value) => header.write(value, at, size, 'ascii');
    const oct = (at, size, n) => text(at, size, `${n.toString(8).padStart(size - 1, '0')}\0`);
    text(0, 100, `package/${relative}`); oct(100, 8, 0o755); oct(108, 8, 0); oct(116, 8, 0);
    oct(124, 12, body.length); oct(136, 12, 0); header.fill(32, 148, 156);
    text(156, 1, type); text(257, 6, 'ustar\0'); text(263, 2, '00');
    const sum = [...header].reduce((a, b) => a + b, 0);
    text(148, 8, `${sum.toString(8).padStart(6, '0')}\0 `);
    blocks.push(header, body, Buffer.alloc((512 - body.length % 512) % 512));
  }
  return gzipSync(Buffer.concat([...blocks, Buffer.alloc(1024)]));
}
function fixture({ name = '@dev-foundry/claude-adapter', version = '1.4.2', scripts = {} } = {}) {
  const pkg = { name, version, private: true, type: 'module', bin: bins,
    dependencies, bundleDependencies: Object.keys(dependencies), scripts,
    description: 'SYNTHETIC TSK-026 fixture; never official 1.4.2 or native acceptance evidence' };
  const files = new Map([['package.json', Buffer.from(JSON.stringify(pkg))],
    ...Object.values(bins).map(p => [p, Buffer.from('#!/usr/bin/env node\nconsole.log("synthetic");\n')]),
    ...['framework/dev-foundry-2.1.0.bundle.json', 'migrations/release.json', 'src/runtime/identity.js',
      'src/runtime/store.js', 'tools/dashboard/dist/index.html'].map(p => [p, Buffer.from('synthetic fixture\n')]),
    ...Object.entries(dependencies).map(([n, v]) => [`node_modules/${n}/package.json`, Buffer.from(JSON.stringify({ name: n, version: v }))])]);
  const manifest = buildManifestBytes({ version, entries: [...files].map(([p, bytes]) => ({ path: p, size: bytes.length, sha256: sha256(bytes) })) });
  files.set('payload-manifest.json', manifest); return { files, bytes: tar(files) };
}
const expectations = (bytes, manifest) => ({ ...bound, sha256: sha256(bytes), selfPin: manifest.package.selfPin });

test('producer stable launcher exists, matches the package bin and is selected for Git tracking', () => {
  const launcher = 'bin/dev-foundry-claude-launcher.js';
  const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
  assert.equal(pkg.bin['dev-foundry-claude-launcher'], launcher);
  assert.ok(pkg.files.includes('bin'));
  assert.equal(lstatSync(path.join(repo, launcher)).isFile(), true);
  // --no-index checks effective ignore rules even after the file is selected.
  const ignored = spawnSync('git', ['check-ignore', '--no-index', '--', launcher], { cwd: repo, encoding: 'utf8' });
  assert.equal(ignored.status, 1, ignored.stderr || ignored.stdout);
  assert.equal(ignored.stdout, '');
  // The index may contain intent-to-add; this does not prove a completed commit
  // or CI normal-prepack/archive acceptance after promotion.
  assert.equal(execFileSync('git', ['ls-files', '--error-unmatch', '--', launcher],
    { cwd: repo, encoding: 'utf8' }).trim(), launcher);
});

test('synthetic fixture exact archive, producer SHA, run and self-pin binding', () => {
  const { bytes } = fixture(), manifest = candidateManifest(bytes, bound);
  assert.equal(manifest.kind, 'unreleased-candidate'); assert.equal(manifest.officialSource, false);
  assert.equal(verifyCandidate(bytes, manifest, expectations(bytes, manifest)).version, '1.4.2');
  assert.equal(manifest.package.payloadFiles, 11);
});
test('reject wrong candidate SHA even when manifest claims that digest', () => {
  const { bytes } = fixture(), manifest = candidateManifest(bytes, bound);
  assert.throws(() => verifyCandidate(bytes, { ...manifest, sha256: '0'.repeat(64) },
    { ...expectations(bytes, manifest), sha256: '0'.repeat(64) }), /SHA-256/);
});
test('reject wrong commit, run, attempt, pin, origin and official-source claims', () => {
  const { bytes } = fixture(), manifest = candidateManifest(bytes, bound), expected = expectations(bytes, manifest);
  for (const change of [{ producerSha: '9'.repeat(40) }, { runId: '124' }, { runAttempt: '2' },
    { repository: 'foreign/consumer' }, { kind: 'official-release' }, { officialSource: true }, { archive: '../candidate.tgz' }]) {
    assert.throws(() => verifyCandidate(bytes, { ...manifest, ...change }, expected), /manifest mismatch/);
  }
  assert.throws(() => verifyCandidate(bytes, manifest, { ...expected, producerSha: '9'.repeat(40) }), /manifest mismatch/);
  assert.throws(() => verifyCandidate(bytes, manifest, { ...expected, selfPin: `1.4.2:sha256:${'0'.repeat(64)}` }), /self-pin/);
});
test('reject wrong source package/version and embedded manifest/payload corruption', () => {
  for (const input of [{ name: '@foreign/consumer' }, { version: '9.0.0' }]) assert.throws(() => inspectArchive(fixture(input).bytes), /source package/);
  const { files } = fixture(); files.set('bin/dev-foundry-claude.js', Buffer.from('tampered'));
  assert.throws(() => inspectArchive(tar(files)), /digest mismatch/);
  files.delete('node_modules/yaml/package.json'); assert.throws(() => inspectArchive(tar(files)), /file set mismatch/);
});
test('archive parser refuses traversal, links, duplicate paths and platform ambiguity', () => {
  const { files } = fixture();
  for (const name of ['../escape', 'bin/CON.cmd', 'bin/extra:stream', 'bin/extra\\escape', 'bin/extra.']) {
    assert.throws(() => inspectArchive(tar([...files, [name, 'unsafe']])), /unsafe archive path/);
  }
  assert.throws(() => inspectArchive(tar(files, '2')), /links/);
  assert.throws(() => inspectArchive(tar([...files, ['package.json', '{}']])), /duplicate archive/);
  assert.throws(() => inspectArchive(tar([...files, ['BIN/foreign.js', 'unsafe']])), /ambiguous/);
  assert.throws(() => inspectArchive(tar([...files, ['bin', 'unsafe']])), /collision/);
});
test('copied candidate archive retains exact bytes and SHA binding', t => {
  const root = scratch(t), { bytes } = fixture(), manifest = candidateManifest(bytes, bound);
  const source = path.join(root, 'source.tgz'), copied = path.join(root, 'copy.tgz');
  writeFileSync(source, bytes); copyFileSync(source, copied);
  assert.deepEqual(readFileSync(copied), bytes);
  verifyCandidate(readFileSync(copied), manifest, expectations(bytes, manifest));
  writeFileSync(copied, Buffer.concat([bytes, Buffer.from('changed')]));
  assert.throws(() => verifyCandidate(readFileSync(copied), manifest, expectations(bytes, manifest)), /SHA-256/);
});
test('temporary projection refuses traversal, symlink/junction and dangling link', t => {
  const root = scratch(t), outside = scratch(t);
  assert.throws(() => tempChild(root, '../consumer'), /unsafe temporary path/);
  assert.throws(() => tempChild(root, '/absolute'), /unsafe temporary path/);
  symlinkSync(outside, path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => tempChild(root, 'linked/write'), /link/);
  if (process.platform !== 'win32') {
    symlinkSync(path.join(root, 'missing'), path.join(root, 'dangling'));
    assert.throws(() => tempChild(root, 'dangling'), /link/);
  }
});
test('Windows .cmd/.ps1 expectations are synthetic and never native proof on another OS', t => {
  const root = scratch(t), installed = path.join(root, 'node_modules/@dev-foundry/claude-adapter');
  const binRoot = path.join(root, 'node_modules/.bin'); mkdirSync(binRoot, { recursive: true });
  for (const [bin, entry] of Object.entries(bins)) {
    for (const suffix of ['', '.cmd', '.ps1']) writeFileSync(path.join(binRoot, `${bin}${suffix}`), `synthetic npm shim ../@dev-foundry/claude-adapter/${entry}`);
  }
  const observed = inspectShims(root, installed, 'win32');
  assert.equal(observed.length, 6); assert.ok(observed.every(s => s.native === (process.platform === 'win32')));
  rmSync(path.join(binRoot, 'dev-foundry-claude.ps1'));
  assert.throws(() => inspectShims(root, installed, 'win32'), /ENOENT/);
  writeFileSync(path.join(binRoot, 'dev-foundry-claude.ps1'), 'wrong target');
  assert.throws(() => inspectShims(root, installed, 'win32'), /wrong target/);
});
test('offline synthetic prefix install ignores malicious lifecycle and preserves unrelated consumer/global sentinels', { timeout: 60000 }, t => {
  const root = scratch(t), prefix = path.join(root, 'prefix'), other = scratch(t);
  const consumer = path.join(other, 'consumer.txt'), global = path.join(other, 'global.txt');
  writeFileSync(consumer, 'consumer unchanged'); writeFileSync(global, 'global unchanged');
  const marker = path.join(root, 'lifecycle-ran');
  const lifecycle = `node -e "require('fs').writeFileSync(${JSON.stringify(marker)}, 'executed')"`;
  const { bytes } = fixture({ scripts: { preinstall: lifecycle, install: lifecycle, postinstall: lifecycle } });
  const manifest = candidateManifest(bytes, bound); verifyCandidate(bytes, manifest, expectations(bytes, manifest));
  const archive = path.join(root, 'candidate.tgz'); writeFileSync(archive, bytes); mkdirSync(prefix);
  const config = path.join(root, 'npmrc'); writeFileSync(config, '');
  const globalConfig = path.join(root, 'global-npmrc'); writeFileSync(globalConfig, '');
  const args = installArguments(archive, prefix);
  assert.ok(args.includes('--ignore-scripts') && args.includes('--prefix') && args.includes('--offline'));
  assert.ok(!args.includes('--global') && !args.includes('-g'));
  execFileSync(process.execPath, [npmCli(), ...args], { cwd: root, timeout: 45000,
    env: { ...process.env, npm_config_cache: path.join(root, 'cache'), npm_config_userconfig: config,
      npm_config_globalconfig: globalConfig, npm_config_registry: 'http://127.0.0.1:9/', npm_config_update_notifier: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(existsSync(marker), false);
  assert.equal(readFileSync(consumer, 'utf8'), 'consumer unchanged'); assert.equal(readFileSync(global, 'utf8'), 'global unchanged');
  const installed = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
  verifyPayload(installed, manifest.package.selfPin);
  const observed = inspectShims(prefix, installed);
  assert.equal(observed.length, process.platform === 'win32' ? 6 : 2);
  assert.equal(lstatSync(installed).isDirectory(), true);
  t.diagnostic('SYNTHETIC install only: no official 1.4.2, product ACL, durable cutover or live Claude proof');
});
test('receipts retain missing proof and unsupported Windows gate; never green via host-ready', () => {
  const r = pendingReceipt(bound, { os: 'win32', node: 'v22.0.0', arch: 'x64', release: 'synthetic' });
  assert.equal(r.acceptance, 'BLOCKED'); assert.equal(r.testExitCode, null);
  assert.equal(r.coverage.windowsAclReparseHardlinks, 'BLOCKED'); assert.equal(probeExit(r), 1);
  r.probe = 'PASS'; r.testExitCode = 0; r.coverage.candidateInstall = 'PASS'; r.coverage.nativeBinShims = 'PASS';
  r.coverage.nativePermissions = 'BLOCKED'; assert.equal(probeExit(r), 1);
  r.host.os = 'darwin'; r.coverage.nativePermissions = 'PASS'; assert.equal(probeExit(r), 0);
  assert.equal(r.acceptance, 'BLOCKED'); assert.equal(r.coverage.liveClaudeOperator, 'PENDING');
  r.testExitCode = 1; assert.equal(probeExit(r), 1);
});
test('CLI cannot select an arbitrary prefix, path, consumer or complete-acceptance switch', async () => {
  for (const args of [['native', '--prefix', '/consumer'], ['--pass'], ['candidate', '../output'], ['release']]) {
    await assert.rejects(main(args), /usage:/);
  }
});
test('workflow only accepts PR base main with exact task HEAD, exact head SHA and read-only credentials', () => {
  const workflow = parse(readFileSync(path.join(repo, '.github/workflows/tsk-026-acceptance.yml'), 'utf8'));
  assert.deepEqual(workflow.on, { pull_request: { branches: ['main'] } });
  assert.deepEqual(workflow.permissions, { contents: 'read' });
  assert.deepEqual(workflow.jobs.native.strategy.matrix.os, ['macos-latest', 'windows-latest']);
  assert.equal(workflow.jobs.native.strategy['fail-fast'], false);
  for (const job of Object.values(workflow.jobs)) {
    assert.match(job.if, /github.head_ref == 'task\/tsk-026-implementation-preparation'/);
    assert.ok(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 35);
    assert.equal(job['continue-on-error'], undefined); assert.equal(job.permissions, undefined);
    for (const step of job.steps) {
      assert.ok(step['timeout-minutes'] > 0);
      assert.equal(step['continue-on-error'], undefined);
      if (step.uses?.startsWith('actions/checkout@')) {
        assert.equal(step.with.ref, '${{ github.event.pull_request.head.sha }}');
        assert.equal(step.with['persist-credentials'], false);
        assert.equal(step.with.repository, '${{ github.event.pull_request.head.repo.full_name }}');
      }
      if (step.uses?.startsWith('actions/setup-node@')) assert.equal(step.with['node-version'], 22);
      if (step.run) assert.doesNotMatch(step.run, /secrets\.|gh release|npm publish|--global|git checkout|curl|wget/);
    }
  }
});
test('workflow transports one run-specific candidate, runs full tests and always uploads failing host reports', () => {
  const text = readFileSync(path.join(repo, '.github/workflows/tsk-026-acceptance.yml'), 'utf8'), workflow = parse(text);
  const candidate = workflow.jobs.candidate, native = workflow.jobs.native;
  assert.equal(candidate['runs-on'], 'ubuntu-latest'); assert.equal(native.needs, 'candidate');
  const upload = candidate.steps.find(s => s.uses === 'actions/upload-artifact@v4');
  const download = native.steps.find(s => s.uses === 'actions/download-artifact@v4');
  assert.equal(upload.with.name, download.with.name); assert.match(upload.with.name, /github.run_id.*github.run_attempt/);
  assert.equal(upload.with['retention-days'], 7);
  const report = native.steps.find(s => s.uses === 'actions/upload-artifact@v4');
  assert.equal(report.if, 'always()'); assert.equal(report.with['retention-days'], 7); assert.equal(report.with['if-no-files-found'], 'error');
  const verdict = native.steps.find(s => s.run?.endsWith(' verdict'));
  assert.equal(verdict.if, 'always()'); assert.match(verdict.name, /BLOCKED fails/);
  assert.ok(native.steps.findIndex(s => s.run?.endsWith(' init')) < native.steps.indexOf(download));
  assert.ok(native.steps.every(s => !s.run?.includes(' pack')));
  const script = readFileSync(path.join(repo, 'scripts/acceptance/tsk026-ci.mjs'), 'utf8');
  assert.match(script, /npmRun\(\['test'\]/); assert.match(script, /acceptanceAuthority: false/);
  assert.match(script, /store-permissions-unsupported/); assert.match(script, /Authentic GitHub v1.4.2/);
  assert.match(script, /shell: false/); assert.doesNotMatch(script, /process\.kill|npm publish/);
});

// These exercise the real candidate orchestration and filesystem with an
// injected subprocess result. They never npm-pack, contact GitHub or use tokens.
function packFixture(t, { result = {}, missing = false, bytes = fixture().bytes,
  beforeReturn = () => {}, getContext, output } = {}) {
  const temp = scratch(t), githubOutput = output ?? path.join(temp, 'github-output');
  const c = { root: repo, temp, expected: bound };
  const run = (args, root, runnerTemp, timeout, logName, quiet) => {
    assert.equal(root, repo); assert.equal(runnerTemp, temp);
    assert.deepEqual(args, ['pack', '--json', '--pack-destination', tempChild(temp, 'tsk026-candidate')]);
    assert.equal(timeout, 240000); assert.equal(logName, undefined); assert.equal(quiet, true);
    const prepared = JSON.parse(readFileSync(path.join(temp, 'tsk026-pack-diagnostics/result.json')));
    assert.equal(prepared.outcome, 'PENDING');
    if (!missing) writeFileSync(path.join(args[3], 'synthetic.tgz'), bytes);
    beforeReturn(c);
    return { status: 0, signal: null, stdout: '[{"filename":"synthetic.tgz"}]', stderr: '', ...result };
  };
  const execute = () => packCandidate(getContext ?? (() => c), run, temp, githubOutput);
  const diagnostic = () => {
    const file = path.join(temp, 'tsk026-pack-diagnostics/result.json');
    assert.ok(lstatSync(file).size <= 4096);
    assert.equal(existsSync(path.join(temp, 'tsk026-pack-diagnostics/result.pending.json')), false);
    return JSON.parse(readFileSync(file));
  };
  return { c, execute, diagnostic, githubOutput };
}
test('candidate success with Vite warning binds exact bytes and keeps bounded PASS diagnostics', t => {
  const f = packFixture(t, { result: { stderr: 'built in 2.70s\npayload-manifest: 1233 files\nSome chunks are larger than 500 kB after minification. 633 kB' } });
  assert.equal(f.execute(), 0);
  const report = f.diagnostic();
  assert.equal(report.outcome, 'PASS'); assert.equal(report.phase, 'complete');
  assert.equal(report.command.exitCode, 0); assert.equal(report.command.signal, null);
  assert.match(report.command.stderr.summary, /chunk-size-warning/);
  assert.ok(report.command.durationMs >= 0 && report.durationMs >= report.command.durationMs);
  const bytes = readFileSync(path.join(f.c.temp, 'tsk026-candidate/candidate.tgz'));
  const manifestBytes = readFileSync(path.join(f.c.temp, 'tsk026-candidate/manifest.json'));
  const manifest = JSON.parse(manifestBytes);
  verifyCandidate(bytes, manifest, expectations(bytes, manifest));
  assert.equal(readFileSync(f.githubOutput, 'utf8'),
    `sha256=${sha256(bytes)}\npin=${manifest.package.selfPin}\nmanifest_sha256=${sha256(manifestBytes)}\n`);
  assert.equal(readFileSync(path.join(f.c.temp, 'tsk026-candidate/SHA256SUMS'), 'utf8'),
    `${sha256(bytes)}  candidate.tgz\n${sha256(manifestBytes)}  manifest.json\n`);
});
test('Vite build-completed/warning text never overrides an actual npm pack exit failure', t => {
  const f = packFixture(t, { result: { status: 1, stdout: 'built in 2.70s\npayload-manifest: 1233 files',
    stderr: 'Some chunks are larger than 500 kB after minification.' } });
  assert.throws(f.execute, /npm-pack; exit=1; signal=none/);
  const r = f.diagnostic();
  assert.equal(r.outcome, 'FAIL'); assert.equal(r.phase, 'npm-pack'); assert.equal(r.command.exitCode, 1);
  assert.equal(existsSync(f.githubOutput), false);
});
test('candidate retains subprocess timeout, signal, buffer and thrown-error diagnostics', t => {
  for (const code of ['ETIMEDOUT', 'ENOBUFS', 'ENOENT']) {
    const f = packFixture(t, { result: { status: null, signal: 'SIGTERM', error: Object.assign(Error('private subprocess text'), { code }) } });
    assert.throws(f.execute, new RegExp(`npm-pack; exit=unavailable; signal=SIGTERM; code=${code}`));
    assert.equal(f.diagnostic().command.errorCode, code);
    assert.equal(f.diagnostic().outcome, 'FAIL'); assert.equal(existsSync(f.githubOutput), false);
  }
  const temp = scratch(t);
  const thrown = Object.assign(Error('secret credential text'), { code: 'ETIMEDOUT', signal: 'SIGKILL', stdout: 'secret stdout' });
  assert.throws(() => packCandidate(() => ({ root: repo, temp, expected: bound }), () => { throw thrown; }, temp), /signal=SIGKILL; code=ETIMEDOUT/);
  const r = JSON.parse(readFileSync(path.join(temp, 'tsk026-pack-diagnostics/result.json')));
  assert.equal(r.phase, 'npm-pack'); assert.equal(r.command.errorCode, 'ETIMEDOUT');
  assert.doesNotMatch(JSON.stringify(r), /secret|credential/);
});
test('candidate pack metadata is strict and malformed JSON retains the parse failure', t => {
  for (const stdout of ['built in 2.70s\n[]', '{bad json private data', 'null', '{}', '[]',
    '[null]', '[{"filename":"../escape.tgz"}]', '[{"filename":"sub/archive.tgz"}]']) {
    const f = packFixture(t, { result: { stdout } });
    assert.throws(f.execute, /parse-pack-metadata/);
    const r = f.diagnostic(); assert.equal(r.phase, 'parse-pack-metadata'); assert.equal(r.outcome, 'FAIL');
    assert.equal(r.command.exitCode, 0); assert.equal(existsSync(f.githubOutput), false);
    assert.doesNotMatch(JSON.stringify(r), /private data|escape.tgz/);
  }
});
test('successful npm exit with missing archive fails discovery and retains diagnostics', t => {
  const f = packFixture(t, { missing: true });
  assert.throws(f.execute, /discover-tarball; code=ENOENT/);
  assert.equal(f.diagnostic().outcome, 'FAIL'); assert.equal(f.diagnostic().phase, 'discover-tarball');
  assert.equal(existsSync(f.githubOutput), false);
});
test('postpack archive digest verification failure remains failed and emits no outputs', t => {
  const { files } = fixture(); files.set('bin/dev-foundry-claude.js', Buffer.from('corrupted'));
  const f = packFixture(t, { bytes: tar(files) });
  assert.throws(f.execute, /inspectArchive/);
  assert.equal(f.diagnostic().phase, 'inspectArchive');
  assert.equal(f.diagnostic().error.reason, 'archive-payload-digest-mismatch');
  assert.equal(existsSync(f.githubOutput), false);
});
test('manifest and hash write failures are distinguished and retained', t => {
  for (const [file, phase] of [['manifest.json', 'write-candidate-manifest'], ['SHA256SUMS', 'write-candidate-hash']]) {
    const f = packFixture(t, { beforeReturn: c => mkdirSync(path.join(c.temp, 'tsk026-candidate', file)) });
    assert.throws(f.execute, new RegExp(phase));
    assert.equal(f.diagnostic().phase, phase); assert.equal(f.diagnostic().outcome, 'FAIL');
    assert.equal(existsSync(f.githubOutput), false);
  }
});
test('GitHub output error fails after verification with retained diagnostic and no PASS', t => {
  const f = packFixture(t, { output: path.join(scratch(t), 'missing/output') });
  assert.throws(f.execute, /emit-github-outputs; code=ENOENT/);
  assert.equal(f.diagnostic().phase, 'emit-github-outputs'); assert.equal(f.diagnostic().outcome, 'FAIL');
});
test('context and candidate preparation failures retain atomic diagnostics', t => {
  const f = packFixture(t, { getContext: () => { throw Error('credential private context'); } });
  assert.throws(f.execute, /at context/);
  assert.equal(f.diagnostic().phase, 'context'); assert.doesNotMatch(JSON.stringify(f.diagnostic()), /credential|private/);
  const g = packFixture(t); mkdirSync(path.join(g.c.temp, 'tsk026-candidate'));
  assert.throws(g.execute, /prepare-candidate; code=EEXIST/);
  assert.equal(g.diagnostic().phase, 'prepare-candidate'); assert.equal(g.diagnostic().command, null);
});
test('diagnostics contain only a tight closed projection, never credentials or arbitrary contents', t => {
  const secrets = ['ghp_SYNTHETIC_NOT_A_REAL_TOKEN', 'Bearer SYNTHETIC_SECRET', 'password=SYNTHETIC_PASSWORD',
    'https://user:SYNTHETIC_PASSWORD@example.test/', 'UNLABELLED_PRIVATE_CONTENT', 'ENV_VAR=SYNTHETIC_VALUE'];
  const text = `npm error code EACCES\n${secrets.join('\n')}\n${'x'.repeat(100000)}`;
  const f = packFixture(t, { result: { status: 1, stdout: text, stderr: text } });
  assert.throws(f.execute, /exit=1/);
  const r = f.diagnostic(), stored = JSON.stringify(r);
  assert.equal(r.command.stdout.bytes, Buffer.byteLength(text)); assert.equal(r.command.stdout.truncated, true);
  assert.equal(r.command.stderr.summary, 'npm-code:EACCES');
  assert.ok(r.command.stdout.summary.length <= 512); assert.ok(Buffer.byteLength(stored) <= 4096);
  for (const secret of secrets) assert.ok(!stored.includes(secret));
  assert.deepEqual(packOutputDiagnostic('private arbitrary content'), { bytes: 25, truncated: false, summary: '' });
});
test('diagnostic projection refuses symlinks and never writes outside the fixed directory', t => {
  const temp = scratch(t), outside = scratch(t), sentinel = path.join(outside, 'result.json');
  writeFileSync(sentinel, 'unchanged');
  symlinkSync(outside, path.join(temp, 'tsk026-pack-diagnostics'), process.platform === 'win32' ? 'junction' : 'dir');
  let invoked = false;
  assert.throws(() => packCandidate(() => { invoked = true; }, () => {}, temp), /prepare-diagnostics.*diagnostic persistence failed/);
  assert.equal(invoked, false); assert.equal(readFileSync(sentinel, 'utf8'), 'unchanged');
});
test('candidate diagnostic upload always runs; candidate publication and native consumption still require success', () => {
  const workflow = parse(readFileSync(path.join(repo, '.github/workflows/tsk-026-acceptance.yml'), 'utf8'));
  const candidate = workflow.jobs.candidate, native = workflow.jobs.native;
  const diagnostics = candidate.steps.find(s => s.name === 'Upload bounded candidate pack diagnostics');
  assert.equal(diagnostics.uses, 'actions/upload-artifact@v4'); assert.equal(diagnostics.if, 'always()');
  assert.equal(diagnostics.with.path, '${{ runner.temp }}/tsk026-pack-diagnostics/');
  assert.equal(diagnostics.with['if-no-files-found'], 'warn'); assert.equal(diagnostics.with['retention-days'], 7);
  const upload = candidate.steps.find(s => s.with?.name?.startsWith('tsk026-candidate-'));
  assert.equal(upload.if, undefined); assert.equal(upload['continue-on-error'], undefined);
  assert.equal(candidate.steps.find(s => s.id === 'pack')['continue-on-error'], undefined);
  assert.equal(native.needs, 'candidate'); assert.doesNotMatch(native.if, /always|failure/);
  assert.deepEqual(candidate.outputs, { sha256: '${{ steps.pack.outputs.sha256 }}',
    pin: '${{ steps.pack.outputs.pin }}', 'manifest-sha256': '${{ steps.pack.outputs.manifest_sha256 }}' });
});

test('CLI candidate context failure exits nonzero and retains a safe diagnostic', t => {
  const temp = scratch(t);
  const result = spawnSync(process.execPath, [path.join(repo, 'scripts/acceptance/tsk026-ci.mjs'), 'candidate'],
    { env: { RUNNER_TEMP: temp }, encoding: 'utf8', timeout: 10000, maxBuffer: 8192 });
  assert.equal(result.status, 1); assert.equal(result.signal, null);
  assert.match(result.stderr, /candidate pack failed at context/);
  const diagnostic = JSON.parse(readFileSync(path.join(temp, 'tsk026-pack-diagnostics/result.json')));
  assert.equal(diagnostic.outcome, 'FAIL'); assert.equal(diagnostic.phase, 'context');
});
test('bounded output projection retains terminal npm reason after a large prepack log', () => {
  const diagnostic = packOutputDiagnostic(`built in 2.70s\n${'x'.repeat(100000)}\nnpm error code ELIFECYCLE\n`);
  assert.equal(diagnostic.truncated, true); assert.equal(diagnostic.summary, 'build-completed; npm-code:ELIFECYCLE');
});

// Exercise the unchanged parser with real synthetic gzip/TAR bytes, rather
// than supplying its rejection strings as fake subprocess errors.
function changeHeader(edit) {
  const raw = gunzipSync(tar([['entry', 'bytes']]));
  edit(raw);
  raw.fill(32, 148, 156);
  const sum = [...raw.subarray(0, 512)].reduce((a, b) => a + b, 0);
  raw.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return gzipSync(raw);
}
function paxRecord(key, value) {
  const text = `${key}=${value}\n`;
  let length = Buffer.byteLength(text) + 2;
  while (length !== Buffer.byteLength(`${length} ${text}`)) length = Buffer.byteLength(`${length} ${text}`);
  return `${length} ${text}`;
}
function paxArchive(body, following = fixture().bytes) {
  const prefix = gunzipSync(tar([['PaxHeader', body]], 'x')).subarray(0, -1024);
  return gzipSync(Buffer.concat([prefix, gunzipSync(following)]));
}
function manifestArchive(edit, rebuild = false) {
  const { files } = fixture();
  const manifest = JSON.parse(files.get('payload-manifest.json'));
  edit(files, manifest);
  files.set('payload-manifest.json', buildManifestBytes({ version: manifest.version,
    entries: rebuild ? [...files].filter(([p]) => p !== 'payload-manifest.json')
      .map(([p, bytes]) => ({ path: p, size: bytes.length, sha256: sha256(bytes) })) : manifest.files }));
  return tar(files);
}
const requiredArchivePaths = [
  ...Object.values(bins), 'framework/dev-foundry-2.1.0.bundle.json', 'migrations/release.json',
  'src/runtime/identity.js', 'src/runtime/store.js', 'tools/dashboard/dist/index.html',
  ...Object.keys(dependencies).map(n => `node_modules/${n}/package.json`),
];
const archiveFailures = [
  ['archive-exceeds-bound', () => Buffer.alloc(64 * 1024 * 1024 + 1)],
  ['archive-invalid-tar-number', () => changeHeader(raw => raw.write('invalid\0', 124, 8, 'ascii'))],
  ['archive-invalid-tar-checksum', () => {
    const raw = gunzipSync(fixture().bytes); raw[0] ^= 1; return gzipSync(raw);
  }],
  ['archive-truncated-tar-entry', () => changeHeader(raw => raw.write('00000100000\0', 124, 12, 'ascii'))],
  ['archive-unbounded-pax-metadata', () => paxArchive('x'.repeat(65537))],
  ['archive-unbounded-pax-metadata', () => paxArchive(paxRecord('mtime', '1'), paxArchive(paxRecord('mtime', '2')))],
  ['archive-invalid-pax-record', () => paxArchive('9 path=x!')],
  ['archive-unsupported-pax-metadata', () => paxArchive(paxRecord('unsupported', 'value'))],
  ['archive-unsupported-pax-metadata', () => paxArchive(paxRecord('path', 'package/a') + paxRecord('path', 'package/b'))],
  ...['1', '2', '3', '4', '6', 'g', 'L'].map(type =>
    ['archive-links-devices-extensions-refused', () => tar([['entry', '']], type)]),
  ['archive-links-devices-extensions-refused', () => changeHeader(raw => raw.write('link-target', 157, 11, 'ascii'))],
  ['archive-unsafe-path', () => tar([['../escape', 'bytes']])],
  ['archive-ambiguous-path', () => tar([['bin/a', 'a'], ['BIN/b', 'b']])],
  ['archive-duplicate-entry', () => tar([['entry', 'a'], ['entry', 'b']])],
  ['archive-file-is-ancestor', () => tar([['bin', 'file'], ['bin/child', 'bytes']])],
  ['archive-file-directory-collision', () => tar([['bin/child', 'bytes'], ['bin', 'file']])],
  ['archive-directory-has-bytes', () => tar([['bin', 'bytes']], '5')],
  ['archive-incomplete-trailing-data', () => gzipSync(gunzipSync(fixture().bytes).subarray(0, -1024))],
  ['archive-incomplete-trailing-data', () => gzipSync(Buffer.concat([gunzipSync(fixture().bytes), Buffer.from('trailing')]))],
  ['archive-incomplete-trailing-data', () => paxArchive(paxRecord('mtime', '1'), gzipSync(Buffer.alloc(1024)))],
  ['archive-payload-manifest-missing', () => tar([['entry', 'bytes']])],
  ['archive-noncanonical-payload-manifest', () => {
    const { files } = fixture(); files.set('payload-manifest.json', Buffer.from(JSON.stringify(JSON.parse(files.get('payload-manifest.json')))));
    return tar(files);
  }],
  ...[{ name: '@foreign/package' }, { version: '9.0.0' }, { bin: {} }, { dependencies: {} }, { bundleDependencies: [] }]
    .map(delta => ['archive-wrong-source-package-identity-bins-bundles', () => manifestArchive(files => {
      files.set('package.json', Buffer.from(JSON.stringify({ ...JSON.parse(files.get('package.json')), ...delta })));
    }, true)]),
  ['archive-file-set-mismatch', () => {
    const { files } = fixture(); files.delete('src/runtime/store.js'); return tar(files);
  }],
  ['archive-unsafe-duplicate-manifest-path', () => manifestArchive((files, manifest) => { manifest.files[0].path = '../escape'; })],
  ['archive-unsafe-duplicate-manifest-path', () => manifestArchive((files, manifest) => { manifest.files[1] = manifest.files[0]; })],
  ['archive-payload-digest-mismatch', () => manifestArchive(files => { files.set('src/runtime/store.js', Buffer.from('changed')); })],
  ...requiredArchivePaths.map(required => [`archive-required-bundled-file-missing:${required}`,
    () => manifestArchive(files => { files.delete(required); }, true)]),
  ['archive-wrong-bundled-dependency-identity', () => manifestArchive(files => {
    files.set('node_modules/yaml/package.json', Buffer.from(JSON.stringify({ name: 'yaml', version: '0.0.0' })));
  }, true)],
];
for (const [index, [reason, makeBytes]] of archiveFailures.entries()) {
  test(`archive rejection ${index + 1}: ${reason} stays FAIL without candidate consumption`, t => {
    const bytes = makeBytes();
    assert.throws(() => inspectArchive(bytes), error => {
      assert.equal(archiveErrorDiagnostic(error).reason, reason); return true;
    });
    const f = packFixture(t, { bytes, result: { stderr: 'built in 2.70s\nSome chunks are larger than 500 kB after minification.' } });
    assert.throws(f.execute, error => {
      assert.equal(error.message, `candidate pack failed at inspectArchive; archive-reason=${reason}`); return true;
    });
    const report = f.diagnostic();
    assert.equal(report.outcome, 'FAIL'); assert.equal(report.phase, 'inspectArchive');
    assert.deepEqual(report.error, { type: 'Error', reason });
    assert.match(report.command.stderr.summary, /chunk-size-warning/);
    assert.equal(existsSync(f.githubOutput), false);
    for (const name of ['manifest.json', 'SHA256SUMS']) assert.equal(existsSync(path.join(f.c.temp, 'tsk026-candidate', name)), false);
    assert.equal(existsSync(path.join(f.c.temp, 'tsk026-reports')), false);
    assert.equal(existsSync(path.join(f.c.temp, 'prefix')), false);
  });
}
test('unknown archive exception messages and required-path lookalikes are closed and redacted', () => {
  const secret = 'Bearer SYNTHETIC_CREDENTIAL https://user:password@example.test/ ENV=PRIVATE_FILE_CONTENT';
  for (const message of [secret, `invalid tar number ${secret}`, `required bundled file missing: ${secret}`,
    'required bundled file missing: src/runtime/store.js/../private', 'invalid tar number\n',
    ...requiredArchivePaths.map(p => `required bundled file missing: ${p}\n${secret}`)]) {
    for (const name of ['Error', 'SyntaxError', 'TypeError', 'RangeError', secret]) {
      const error = Object.assign(Error(message), { name, code: secret });
      assert.deepEqual(archiveErrorDiagnostic(error), { type: name === secret ? 'Error' : name, reason: 'archive-unclassified' });
    }
  }
});
test('unknown real JSON/gzip archive failures redact payload text and expose only generic CLI reason', t => {
  const secret = 'ghp_SYNTHETIC_NOT_REAL_TOKEN password=SYNTHETIC_PRIVATE_ENV_FILE';
  const { files } = fixture(); files.set('payload-manifest.json', Buffer.from(secret));
  for (const bytes of [tar(files), Buffer.from(secret)]) {
    const f = packFixture(t, { bytes });
    assert.throws(f.execute, error => {
      assert.equal(error.message, 'candidate pack failed at inspectArchive; archive-reason=archive-unclassified'); return true;
    });
    const report = f.diagnostic();
    assert.equal(report.outcome, 'FAIL'); assert.equal(report.phase, 'inspectArchive');
    assert.equal(report.error.reason, 'archive-unclassified'); assert.equal(report.errorCode, null);
    assert.ok(['SyntaxError', 'Error'].includes(report.error.type));
    assert.doesNotMatch(JSON.stringify(report), /ghp_|SYNTHETIC_PRIVATE|password=|PRIVATE_ENV_FILE/);
    assert.equal(existsSync(f.githubOutput), false);
    for (const name of ['manifest.json', 'SHA256SUMS']) assert.equal(existsSync(path.join(f.c.temp, 'tsk026-candidate', name)), false);
    assert.equal(existsSync(path.join(f.c.temp, 'tsk026-reports')), false);
    assert.equal(existsSync(path.join(f.c.temp, 'prefix')), false);
  }
});
