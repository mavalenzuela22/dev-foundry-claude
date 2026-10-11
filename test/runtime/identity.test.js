import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { buildManifestBytes, formatExpect, rootOf, sha256 } from '../../src/adopt/pin.js';
import { resolveConsumer, runtimeIdentity, verifyRuntime } from '../../src/runtime/identity.js';
import { OFFICIAL_REPOSITORY } from '../../src/runtime/acquisition.js';

// Shared disposable fixture lives in a bounded test path; importing it does not
// register this file's tests. No extra helper path or weaker verifier is needed.
export function scratch(t) {
  const root = mkdtempSync(path.join(realpathSync(os.tmpdir()), 'tsk026-'));
  t.after(() => {
    if (!existsSync(root)) return;
    // Store bytes are sealed. Restore permissions only in disposable test data.
    execFileSync('chmod', ['-R', 'u+rwX', root]);
    rmSync(root, { recursive: true, force: true });
  });
  return root;
}
export const ENTRIES = [
  'bin/dev-foundry-claude.js', 'src/governance-mcp/server.js', 'src/dashboard/command.js',
  'tools/dashboard/server/http.mjs', 'tools/dashboard/server/launch.mjs',
  'tools/dashboard/server/evidence.mjs', 'tools/dashboard/server/claude-otel.mjs',
  'tools/dashboard/dist/index.html', 'src/telemetry/launch.js', 'src/telemetry/telemetry.js',
];
export function fakeRuntime(t, { version = '1.4.2', body = 'fixture', files = {} } = {}) {
  const root = scratch(t);
  const content = { 'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version,
    scripts: { preinstall: 'this-script-must-never-run', install: 'this-script-must-never-run' } }),
  ...Object.fromEntries(ENTRIES.map((file) => [file, `${body}:${file}`])), ...files };
  for (const [file, value] of Object.entries(content)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), value);
  }
  const manifest = buildManifestBytes({ version, entries: Object.entries(content).map(([file, value]) =>
    ({ path: file, size: Buffer.byteLength(value), sha256: sha256(value) })) });
  writeFileSync(path.join(root, 'payload-manifest.json'), manifest);
  return { root, expect: formatExpect(version, rootOf(manifest)), manifest };
}
export function consumer(t, expect) {
  const root = scratch(t);
  execFileSync('git', ['init', '--quiet', root], { env: Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))) });
  const config = { mcpServers: { 'dev-foundry-governance': { type: 'stdio', command: 'dev-foundry-claude', args: ['mcp', '--expect', expect] } } };
  writeFileSync(path.join(root, '.mcp.json'), JSON.stringify(config));
  return { root, config };
}
export function attestation(expect, source = expect) {
  const version = runtimeIdentity(expect).version;
  const asset = `dev-foundry-claude-adapter-${version}.tgz`;
  const declaration = 'independently reviewed exact fixture transition';
  return { provenance: { format: 'dev-foundry.runtime-attestation.v1', repository: OFFICIAL_REPOSITORY,
    tag: `v${version}`, asset, url: `https://github.com/${OFFICIAL_REPOSITORY}/releases/download/v${version}/${asset}`,
    observedAssetSha256: sha256('independently observed fixture asset'), payloadSelfPin: expect,
    trust: { kind: 'independent-digest', assetSha256: sha256('independently observed fixture asset'), payloadSelfPin: expect,
      evidence: 'test-only independent fixture digest selection, not a published release', transitionDeclaration: declaration } },
  transition: { source, target: expect, supported: true, declaration } };
}
export function replaceSealed(file, bytes) {
  chmodSync(file, 0o600); writeFileSync(file, bytes); chmodSync(file, 0o400);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('exact pins include SemVer and root; invalid portable SemVer never aliases', () => {
    const a = runtimeIdentity(`1.4.2:sha256:${'a'.repeat(64)}`);
    const b = runtimeIdentity(`1.4.2:sha256:${'b'.repeat(64)}`);
    assert.notEqual(a.key, b.key);
    for (const label of ['1.4', 'latest', '01.4.2', '1.4.2-01', '1.4.2-..']) assert.throws(() => runtimeIdentity(`${label}:sha256:${'a'.repeat(64)}`));
    assert.equal(runtimeIdentity(`1.4.2-rc.1+build.2:sha256:${'a'.repeat(64)}`).version, '1.4.2-rc.1+build.2');
  });
  test('consumer discovery selects one Git root from a child and preserves bytes', (t) => {
    const runtime = fakeRuntime(t), c = consumer(t, runtime.expect);
    const before = readFileSync(path.join(c.root, '.mcp.json'));
    const child = path.join(c.root, 'child'); mkdirSync(child);
    assert.equal(resolveConsumer(child).repositoryRoot, c.root);
    assert.equal(resolveConsumer(c.root).expect, runtime.expect);
    assert.deepEqual(readFileSync(path.join(c.root, '.mcp.json')), before);
  });
  test('invalid, missing, duplicate and substituted MCP pins fail closed', (t) => {
    const c = consumer(t, `1.4.2:sha256:${'a'.repeat(64)}`), file = path.join(c.root, '.mcp.json');
    const entry = c.config.mcpServers['dev-foundry-governance'];
    for (const mutate of [e => { e.args[2] = 'latest'; }, e => { e.args.push('extra'); },
      e => { e.command = 'node'; }, e => { e.env = { CLAUDE_PROJECT_DIR: '/elsewhere' }; }, e => { delete e.type; }]) {
      const config = structuredClone(c.config); mutate(config.mcpServers['dev-foundry-governance']);
      writeFileSync(file, JSON.stringify(config)); assert.throws(() => resolveConsumer(c.root));
    }
    writeFileSync(file, `{"mcpServers":{"dev-foundry-governance":${JSON.stringify(entry)},"dev-foundry-governance":${JSON.stringify(entry)}}}`);
    assert.throws(() => resolveConsumer(c.root), /ambiguous-mcp/);
    rmSync(file); assert.throws(() => resolveConsumer(c.root));
  });
  test('symlinked MCP/root, nested repositories and Git indirection are refused', (t) => {
    const r = fakeRuntime(t), c = consumer(t, r.expect), other = consumer(t, r.expect);
    rmSync(path.join(c.root, '.mcp.json')); symlinkSync(path.join(other.root, '.mcp.json'), path.join(c.root, '.mcp.json'));
    assert.throws(() => resolveConsumer(c.root));
    const link = path.join(scratch(t), 'link'); symlinkSync(other.root, link); assert.throws(() => resolveConsumer(link));
    const nested = path.join(other.root, 'nested'); mkdirSync(nested); execFileSync('git', ['init', '--quiet', nested]);
    assert.throws(() => resolveConsumer(nested), /repository-ambiguous/);
    const indirect = scratch(t); writeFileSync(path.join(indirect, '.git'), 'gitdir: /elsewhere');
    assert.throws(() => resolveConsumer(indirect), /git-indirection/);
  });
  test('shared payload verification rejects manifest/file tamper and wrong pins', (t) => {
    const r = fakeRuntime(t);
    assert.equal(verifyRuntime(r.root, r.expect).expect, r.expect);
    assert.throws(() => verifyRuntime(r.root, `1.4.2:sha256:${'0'.repeat(64)}`));
    writeFileSync(path.join(r.root, ENTRIES[0]), 'modified'); assert.throws(() => verifyRuntime(r.root, r.expect));
    const r2 = fakeRuntime(t); writeFileSync(path.join(r2.root, 'payload-manifest.json'), Buffer.concat([r2.manifest, Buffer.from('\n')]));
    assert.throws(() => verifyRuntime(r2.root, r2.expect));
  });
}
