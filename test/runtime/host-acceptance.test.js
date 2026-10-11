import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildManifestBytes, rootOf, sha256 } from '../../src/adopt/pin.js';
import { exactLocalPath, inspectBinShims, inspectInstalled, preflight } from '../../scripts/acceptance/tsk026-host.mjs';
import { expectedShims, PACKAGE, REPOSITORY, pendingReport } from '../../scripts/acceptance/tsk026-report.mjs';
import { HOST, fixtureReport, scratch, verifierFixture } from './host-report.test.js';

const cli = fileURLToPath(new URL('../../scripts/acceptance/tsk026-host.mjs', import.meta.url));
function repo(t) {
  const root = scratch(t);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  const git = args => execFileSync('git', ['-C', root, ...args], { env, encoding: 'utf8' }).trim();
  git(['init', '--quiet']); git(['remote', 'add', 'origin', `https://github.com/${REPOSITORY}.git`]);
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: PACKAGE, version: '1.4.2' }));
  git(['add', 'package.json']); git(['-c', 'user.name=fixture-only', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture-only']);
  return { root, git, head: git(['rev-parse', 'HEAD']) };
}
function installed(t, version = '1.4.2') {
  const root = scratch(t);
  const bytes = JSON.stringify({ name: PACKAGE, version, scripts: { install: 'MUST NEVER EXECUTE' } });
  writeFileSync(path.join(root, 'package.json'), bytes);
  const manifest = buildManifestBytes({ version, entries: [{ path: 'package.json', size: Buffer.byteLength(bytes), sha256: sha256(bytes) }] });
  writeFileSync(path.join(root, 'payload-manifest.json'), manifest);
  return { root, pkg: { version, pin: `${version}:sha256:${rootOf(manifest)}` } };
}
test('CLI help and invalid arguments never invoke acceptance or target code', () => {
  const help = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(help.status, 0); assert.match(help.stdout, /offline/); assert.match(help.stdout, /B4B/);
  for (const args of [[], ['--install'], ['--preflight', '--report'], ['--preflight', '--download', 'url']]) {
    assert.equal(spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' }).status, 1);
  }
});
test('read-only offline preflight records host readiness separately from pending acceptance', t => {
  const f = repo(t); const before = readFileSync(path.join(f.root, 'package.json'));
  const status = f.git(['status', '--porcelain', '--untracked-files=all']);
  const result = preflight({ repoRoot: f.root, host: HOST });
  assert.equal(result.status, 'host-ready'); assert.equal(result.acceptance, 'BLOCKED');
  assert.equal(result.report.producerCommit, f.head);
  assert.equal(result.report.gates.firstBridge.status, 'PENDING');
  assert.equal(result.readOnly, true);
  assert.deepEqual(readFileSync(path.join(f.root, 'package.json')), before);
  assert.equal(f.git(['status', '--porcelain', '--untracked-files=all']), status);
  assert.equal(preflight({ repoRoot: f.root, host: { ...HOST, os: 'linux' } }).status, 'pending');
});
test('wrong repository, producer version, missing Git root and nested selection are refused', t => {
  const f = repo(t);
  f.git(['remote', 'set-url', 'origin', 'https://github.com/attacker/repo.git']);
  assert.equal(preflight({ repoRoot: f.root }).status, 'fail');
  f.git(['remote', 'set-url', 'origin', `https://github.com/${REPOSITORY}.git`]);
  writeFileSync(path.join(f.root, 'package.json'), JSON.stringify({ name: PACKAGE, version: '1.4.1' }));
  assert.equal(preflight({ repoRoot: f.root }).status, 'fail');
  const child = path.join(f.root, 'child'); mkdirSync(child);
  assert.equal(preflight({ repoRoot: child }).status, 'fail');
  assert.equal(preflight({ repoRoot: scratch(t) }).status, 'fail');
});
test('exact JSON reports remain fixture-only; forged authentic PASS and wrong native host fail', t => {
  const f = repo(t); const file = path.join(scratch(t), 'report.json');
  const r = fixtureReport(); r.producerCommit = f.head; r.installed = { source: null, target: null };
  writeFileSync(file, JSON.stringify(r));
  const result = preflight({ repoRoot: f.root, reportFile: file, host: HOST });
  assert.equal(result.status, 'pending'); assert.equal(result.acceptance, 'PENDING');
  const forged = verifierFixture().r; forged.producerCommit = f.head; forged.installed = r.installed;
  forged.aggregate = 'PASS'; writeFileSync(file, JSON.stringify(forged));
  assert.equal(preflight({ repoRoot: f.root, reportFile: file, host: HOST }).status, 'fail');
  r.host.os = 'win32'; writeFileSync(file, JSON.stringify(r));
  assert.equal(preflight({ repoRoot: f.root, reportFile: file, host: HOST }).report.gates.host.status, 'FAIL');
});
test('remote URLs, archives, traversal, symlinked/missing files and hostile JSON are rejected', t => {
  const f = repo(t); const dir = scratch(t); const file = path.join(dir, 'report.json');
  writeFileSync(file, JSON.stringify(pendingReport()));
  const link = path.join(dir, 'link.json'); symlinkSync(file, link);
  for (const reportFile of ['https://github.com/release.tgz', 'archive.tgz', path.join(dir, 'missing.json'),
    `${dir}/../report.json`, link]) {
    assert.equal(preflight({ repoRoot: f.root, reportFile }).status, 'fail', reportFile);
  }
  const archive = path.join(dir, 'archive.tgz'); writeFileSync(archive, JSON.stringify(pendingReport()));
  assert.equal(preflight({ repoRoot: f.root, reportFile: archive }).status, 'fail');
  for (const bytes of ['{"schema":"a","schema":"b"}', 'null', '[]', '{"gates":', 'x'.repeat(1024 * 1024 + 1)]) {
    writeFileSync(file, bytes);
    assert.equal(preflight({ repoRoot: f.root, reportFile: file }).status, 'fail');
  }
  assert.throws(() => exactLocalPath(`${dir}/./report.json`));
});
test('installed payload byte consistency is observable but never authentic release evidence', t => {
  const p = installed(t); const before = readFileSync(path.join(p.root, 'package.json'));
  assert.equal(inspectInstalled(p.root, p.pkg).authenticity, 'unverified');
  assert.deepEqual(readFileSync(path.join(p.root, 'package.json')), before);
  assert.throws(() => inspectInstalled(p.root, { ...p.pkg, pin: `1.4.2:sha256:${'0'.repeat(64)}` }));
  const other = installed(t, '1.4.3'); assert.throws(() => inspectInstalled(other.root, p.pkg));
  writeFileSync(path.join(p.root, 'package.json'), 'tampered'); assert.throws(() => inspectInstalled(p.root, p.pkg));
});
test('missing source, symlinked installed bytes and hostile manifest paths fail closed', t => {
  const f = repo(t); const file = path.join(scratch(t), 'report.json');
  const r = fixtureReport(); r.producerCommit = f.head; r.installed.source = path.join(scratch(t), 'absent'); r.installed.target = null;
  writeFileSync(file, JSON.stringify(r)); assert.equal(preflight({ repoRoot: f.root, reportFile: file }).status, 'fail');
  const p = installed(t); rmSync(path.join(p.root, 'package.json'));
  symlinkSync(path.join(f.root, 'package.json'), path.join(p.root, 'package.json'));
  assert.throws(() => inspectInstalled(p.root, p.pkg));
  for (const hostile of ['../escape', '/etc/passwd', 'a/../../escape', 'a\\..\\escape', 'C:/escape']) {
    const q = installed(t);
    writeFileSync(path.join(q.root, 'payload-manifest.json'), JSON.stringify({ files: [{ path: hostile }] }));
    assert.throws(() => inspectInstalled(q.root, q.pkg));
  }
  const config = path.join(f.root, '.git/config'); const external = path.join(scratch(t), 'config');
  writeFileSync(external, readFileSync(config)); rmSync(config); symlinkSync(external, config);
  assert.equal(preflight({ repoRoot: f.root }).status, 'fail');
});
test('Windows shim inspection requires cmd and PowerShell files; simulation is never native proof', t => {
  const bin = scratch(t);
  for (const shim of expectedShims('win32')) writeFileSync(path.join(bin, shim), 'fixture-only shim, never executed');
  assert.equal(inspectBinShims(bin, 'win32').native, process.platform === 'win32');
  assert.equal(inspectBinShims(bin, 'win32').authenticity, 'unverified');
  rmSync(path.join(bin, 'dev-foundry-claude.cmd'));
  assert.throws(() => inspectBinShims(bin, 'win32'));
});
