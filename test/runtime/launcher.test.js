import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { stableLaunch, verifyManager } from '../../src/runtime/launcher.js';
import { stageRuntime, promoteRuntime } from '../../src/runtime/store.js';
import { attestation, consumer, fakeRuntime, replaceSealed, scratch } from './identity.test.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export function copiedHost(t, runtimeRoot = repo) {
  const host = scratch(t);
  for (const file of ['bin/dev-foundry-claude-launcher.js', 'src/runtime/launcher.js']) {
    mkdirSync(path.dirname(path.join(host, file)), { recursive: true }); cpSync(path.join(runtimeRoot, file), path.join(host, file));
  }
  return path.join(host, 'bin/dev-foundry-claude-launcher.js');
}

// Minimal real B1/B2 manager built entirely in disposable data. Entrypoint
// fixtures prove dispatch transport, not real-model or public-release acceptance.
export function managerFixture(t) {
  const root = scratch(t);
  for (const file of ['src/runtime', 'src/adopt', 'node_modules/yaml']) cpSync(path.join(repo, file), path.join(root, file), { recursive: true });
  const { buildManifestBytes, formatExpect, rootOf, sha256 } = awaitlessPin;
  writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2', type: 'module' }));
  mkdirSync(path.join(root, 'bin'));
  writeFileSync(path.join(root, 'bin/dev-foundry-claude.js'), 'console.log("manager-transport-only");');
  const files = [];
  const walk = dir => { for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full); else { const bytes = readFileSync(full); files.push({ path: path.relative(root, full).split(path.sep).join('/'), size: bytes.length, sha256: sha256(bytes) }); }
  } };
  walk(root);
  const manifest = buildManifestBytes({ version: '1.4.2', entries: files });
  writeFileSync(path.join(root, 'payload-manifest.json'), manifest);
  const expect = formatExpect('1.4.2', rootOf(manifest)), storeRoot = path.join(scratch(t), 'store');
  const installed = promoteRuntime(stageRuntime({ storeRoot, candidateRoot: root, permittedCandidateRoots: [root], expect, attestation: attestation(expect) }));
  return { ...installed, storeRoot };
}
import * as awaitlessPin from '../../src/adopt/pin.js';
import { readdirSync } from 'node:fs';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('stand-alone launcher works without package configuration or active adapter tree; A/B select independently and preserve consumers', t => {
    const manager = managerFixture(t), host = copiedHost(t);
    const runtime = label => fakeRuntime(t, { body: label, files: { 'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2', type: 'module' }),
      'bin/dev-foundry-claude.js': `console.log(${JSON.stringify(label)});` } });
    const a = runtime('selected-A'), b = runtime('selected-B');
    for (const r of [a, b]) promoteRuntime(stageRuntime({ storeRoot: manager.storeRoot, candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect) }));
    for (const [r, label] of [[a, 'selected-A'], [b, 'selected-B']]) {
      const c = consumer(t, r.expect), before = readFileSync(path.join(c.root, '.mcp.json'));
      const result = spawnSync(process.execPath, [host, '--manager-expect', manager.expect, '--store-root', manager.storeRoot, '--', '--version'], { cwd: c.root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout.trim(), label);
      assert.deepEqual(readFileSync(path.join(c.root, '.mcp.json')), before);
      assert.equal(execFileSync('git', ['-C', c.root, 'status', '--porcelain']).toString(), '?? .mcp.json\n');
    }
  });
  test('manager byte mismatch, wrong self-pin, host symlink and unmanaged initial source refuse without target execution', async t => {
    const manager = managerFixture(t), host = copiedHost(t), c = consumer(t, manager.expect);
    assert.equal(verifyManager(manager.storeRoot, manager.expect), manager.packageRoot);
    replaceSealed(path.join(manager.packageRoot, 'src/runtime/dispatch.js'), 'throw new Error("must not execute");');
    assert.throws(() => verifyManager(manager.storeRoot, manager.expect), /manager-byte-mismatch/);
    const output = spawnSync(process.execPath, [host, '--', '--version'], { cwd: c.root, encoding: 'utf8' });
    assert.equal(output.status, 2); assert.match(output.stderr, /one-time|One-time/); assert.match(output.stderr, /B4/);
    const link = path.join(scratch(t), 'host-link'); symlinkSync(path.dirname(host), link);
    await assert.rejects(stableLaunch(['--manager-expect', manager.expect, '--store-root', manager.storeRoot, '--root', link, '--', '--version']), /byte-mismatch|symlink/);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('stable transport refuses damaged selected bytes, cross-project root and unknown journal before CLI execution', t => {
    const manager = managerFixture(t), host = copiedHost(t);
    const target = fakeRuntime(t, { files: { 'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2', type: 'module' }), 'bin/dev-foundry-claude.js': 'console.log("target-must-not-run");' } });
    const selected = promoteRuntime(stageRuntime({ storeRoot: manager.storeRoot, candidateRoot: target.root, permittedCandidateRoots: [target.root], expect: target.expect, attestation: attestation(target.expect) }));
    const c = consumer(t, target.expect), other = consumer(t, target.expect);
    const invoke = args => spawnSync(process.execPath, [host, '--manager-expect', manager.expect, '--store-root', manager.storeRoot, '--', ...args], { cwd: c.root, encoding: 'utf8' });
    assert.equal(invoke(['status', '--root', other.root]).status, 2);
    mkdirSync(path.join(c.root, '.dfc-runtime-upgrade'));
    assert.equal(invoke(['--version']).status, 2);
    assert.equal(invoke(['--version']).stdout, '');
    // Another consumer's otherwise valid selection must independently refuse
    // target corruption, while the stable manager itself remains available.
    replaceSealed(path.join(selected.packageRoot, 'bin/dev-foundry-claude.js'), 'throw new Error("target code ran");');
    const result = spawnSync(process.execPath, [host, '--manager-expect', manager.expect, '--store-root', manager.storeRoot, '--', '--version'], { cwd: other.root, encoding: 'utf8' });
    assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.doesNotMatch(result.stderr, /target code ran/);
    assert.equal(verifyManager(manager.storeRoot, manager.expect), manager.packageRoot);
  });
}
