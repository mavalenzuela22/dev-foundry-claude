import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import test from 'node:test';
import { parse } from 'yaml';
import { buildManifestBytes, sha256, verifyPayload } from '../../src/adopt/pin.js';
import { candidateManifest, inspectArchive, inspectShims, installArguments, main,
  npmCli, pendingReceipt, probeExit, tempChild, verifyCandidate } from '../../scripts/acceptance/tsk026-ci.mjs';

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
