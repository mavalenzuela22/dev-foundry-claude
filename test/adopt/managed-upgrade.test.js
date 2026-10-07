import assert from 'node:assert/strict';
import { legacyPackage } from './legacy-fixture.js';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createPlan } from '../../src/adopt/plan.js';
import { createUpgradePlan } from '../../src/adopt/upgrade.js';
import { applyPlan } from '../../src/adopt/apply.js';
import { buildManifestBytes, canonicalJson, selfPin, sha256 } from '../../src/adopt/pin.js';
import { consumerCommand } from '../../src/consumer/command.js';
import { diffTrees, listTree, makeConsumer, makePresentationPackage, readSetSnapshot, repoRoot, applyProposal } from './fixture.js';

const target = { version: '1.4.0', payloadRoot: 'f'.repeat(64), expect: `1.4.0:sha256:${'f'.repeat(64)}` };
// Real released 1.2.2 templates and exact verified historical payload.
async function legacy(t, active = false, version = '1.2.2') {
  const { source, old } = await legacyPackage(t, version);
  const c = await makeConsumer(); t.after(c.cleanup);
  await c.put('.dev-foundry/executions/TSK-HISTORICAL/evidence-packet.md', '# Completed work\nHistorical result under the original framework; retain its meaning.\n');
  await c.put('.dev-foundry/validations/historical/result.json', '{"verdict":"pass","framework":"2.1.0"}\n');
  c.commit();
  const planned = await createPlan({ root: c.root, adapter: old, templatesRoot: path.join(source, 'templates') });
  assert.equal(planned.plan.status, 'ready');
  // Materialize the old release's generated surface as fixture data.
  for (const entry of planned.ops.writes) await c.put(entry.path, entry.content);
  c.commit();
  if (active) { await applyProposal(c.root, planned.plan.cutover_proposal); c.commit(); }
  return { c, source, old };
}
const plan = ({ c, source }) => createUpgradePlan({ root: c.root, adapter: target, currentPackageRoot: source });
const apply = ({ c }, result) => applyPlan({ root: c.root, adapter: target, upgrade: true, planBytes: result.bytes, planSha256: result.hash });

test('exact released legacy bridge is deterministic, exact-hash enforced, bounded and preserves authority/product/outside block', async (t) => {
  for (const version of ['1.2.2', '1.2.2-windows', '1.3.0', '1.3.0-public']) for (const active of version === '1.2.2-windows' ? [false] : [false, true]) await t.test(`${version} ${active ? 'active' : 'prepared'}`, async (t) => {
    const fixture = await legacy(t, active, version); const { c, old } = fixture;
    await c.put('CLAUDE.md', (await c.read('CLAUDE.md')) + '\nConsumer footer: keep this byte for byte.\n'); c.commit();
    const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
    const withoutSource = await createUpgradePlan({ root: c.root, adapter: target });
    assert.equal(withoutSource.plan.status, 'blocked'); assert.deepEqual(withoutSource.ops.writes, []);
    const result = await plan(fixture);
    assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
    assert.equal(result.plan.upgradeKind, 'legacy-bridge'); assert.deepEqual(result.plan.current, old);
    assert.deepEqual(result.bytes, (await plan(fixture)).bytes);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    const changed = version === '1.2.2-windows' ? ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.mcp.json', 'CLAUDE.md'] : ['.mcp.json'];
    assert.deepEqual(result.ops.writes.map((item) => item.path).sort(), changed);
    await assert.rejects(apply(fixture, { ...result, hash: '0'.repeat(64) }), { code: 'plan-hash-mismatch' });
    const presentationPackage = await makePresentationPackage(); t.after(presentationPackage.cleanup);
    const output = [];
    await consumerCommand({ command: 'upgrade', argv: ['--from-package', fixture.source], cwd: c.root, packageRoot: presentationPackage.root,
      getAdapter: () => target, executableAvailable: () => true, output: (text) => output.push(text) });
    assert.match(output.join('\n'), /managed files need to be refreshed/); assert.doesNotMatch(output.join('\n'), /upgrade-migration-required|agent-file-collision/);
    assert.match(output.join('\n'), /Application files affected: 0/);
    assert.deepEqual(await apply(fixture, result), { written: changed.length, deleted: 0 });
    assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((item) => item.path).sort());
    assert.deepEqual(await readSetSnapshot(c.root), authority);
    assert.match(await c.read('CLAUDE.md'), /^# Acme billing/); assert.ok((await c.read('CLAUDE.md')).endsWith('\nConsumer footer: keep this byte for byte.\n'));
    c.commit(); assert.equal((await createPlan({ root: c.root, adapter: target })).plan.status, 'noop');
  });
});

test('refresh refuses product/authority paths in supplied plan even with a matching recomputed hash', async (t) => {
  const fixture = await legacy(t); const result = await plan(fixture);
  const before = await listTree(fixture.c.root);
  for (const file of ['src/billing.js', '.dev-foundry/profiles/project-operating-profile.yaml', '../outside.js', '.claude/agents/custom.md']) {
    const forged = structuredClone(result.plan);
    forged.merge.push({ path: file, before_sha256: 'a'.repeat(64), after_sha256: 'b'.repeat(64), diff: 'forged' });
    const bytes = Buffer.from(canonicalJson(forged));
    await assert.rejects(apply(fixture, { bytes, hash: sha256(bytes) }), { code: 'plan-stale' });
  }
  assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
});

test('refresh refuses modified agents, duplicate blocks, dirty paths, wrong or tampered previous payload and drift', async (t) => {
  for (const [name, change] of [
    ['custom agent', async ({ c }) => { await c.put('.claude/agents/dev-foundry-executor.md', 'consumer custom instructions'); c.commit(); }],
    ['duplicate block', async ({ c }) => { await c.put('CLAUDE.md', (await c.read('CLAUDE.md')).repeat(2)); c.commit(); }],
    ['dirty agent', async ({ c }) => c.put('.claude/agents/dev-foundry-executor.md', `${await c.read('.claude/agents/dev-foundry-executor.md')} `)],
    ['tampered payload', async ({ source }) => writeFile(path.join(source, 'package.json'), '{}')],
    ['changed pin', async ({ c }) => { const mcp = JSON.parse(await c.read('.mcp.json')); mcp.mcpServers['dev-foundry-governance'].args[2] = `1.2.2:sha256:${'b'.repeat(64)}`; await c.put('.mcp.json', JSON.stringify(mcp)); c.commit(); }],
  ]) await t.test(name, async (t) => {
    const fixture = await legacy(t); const exact = await plan(fixture); await change(fixture);
    const before = await listTree(fixture.c.root);
    await assert.rejects(apply(fixture, exact), { code: 'plan-stale' });
    const denied = await plan(fixture); assert.equal(denied.plan.status, 'blocked'); assert.deepEqual(denied.ops.writes, []);
    assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  });
});

test('self-update baseline managed refresh still proves changed templates against an exact previous package', async (t) => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'baseline-refresh-')); t.after(() => rm(source, { recursive: true, force: true }));
  await cp(path.join(repoRoot, 'templates'), path.join(source, 'templates'), { recursive: true });
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.0' }));
  for (const file of ['agents/dev-foundry-executor.md.tmpl', 'agents/dev-foundry-auditor.md.tmpl', 'claude-md-block.md.tmpl']) {
    const absolute = path.join(source, 'templates', file); const text = await readFile(absolute, 'utf8'); await writeFile(absolute, file.startsWith('agents/') ? `${text}\n<!-- previous baseline managed bytes -->\n` : text.replaceAll('DEV FOUNDRY', 'DEV FOUNDRY previous baseline'));
  }
  const entries = [];
  for (const [file, hash] of await listTree(source)) entries.push({ path: file, sha256: hash, size: (await readFile(path.join(source, file))).length });
  await writeFile(path.join(source, 'payload-manifest.json'), buildManifestBytes({ version: '1.4.0', entries }));
  const pin = selfPin(source); const old = { version: pin.version, expect: pin.expect, payloadRoot: pin.root };
  const c = await makeConsumer(); t.after(c.cleanup);
  const initial = await createPlan({ root: c.root, adapter: old, templatesRoot: path.join(source, 'templates') });
  for (const op of initial.ops.writes) await c.put(op.path, op.content); c.commit();
  const authority = await readSetSnapshot(c.root); const before = await listTree(c.root);
  const result = await createUpgradePlan({ root: c.root, adapter: target, currentPackageRoot: source });
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers)); assert.equal(result.plan.upgradeKind, 'managed-refresh');
  assert.deepEqual(result.ops.writes.map((op) => op.path).sort(), ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.mcp.json', 'CLAUDE.md']);
  await applyPlan({ root: c.root, adapter: target, upgrade: true, planBytes: result.bytes, planSha256: result.hash });
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((op) => op.path).sort());
});

test('same-version different build and unknown legacy sources cannot cross the bridge even when managed bytes match', async (t) => {
  const { c } = await legacy(t);
  for (const version of ['1.2.2', '1.3.0', '1.1.0']) {
    const config = JSON.parse(await c.read('.mcp.json')); config.mcpServers['dev-foundry-governance'].args[2] = `${version}:sha256:${'a'.repeat(64)}`;
    await c.put('.mcp.json', JSON.stringify(config)); c.commit();
    const before = await listTree(c.root); const result = await createUpgradePlan({ root: c.root, adapter: target });
    assert.equal(result.plan.status, 'blocked'); assert.equal(result.plan.blockers[0].code, 'legacy-source-unsupported'); assert.deepEqual(result.ops.writes, []);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  }
});

test('Windows 1.2.2 candidate fixture proves its Git source and distinct exact recipe', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const { source, old } = await legacyPackage(t, '1.2.2-windows');
  assert.equal(old.expect, '1.2.2:sha256:c2beefd78db3417c20d313cf7e189152c134d1f6abc11c14555630e2036462c2');
  const material = JSON.parse(await readFile(path.join(repoRoot, 'migrations/release.json'), 'utf8'));
  const recipes = material.legacy.filter((recipe) => recipe.source === old.expect);
  assert.equal(recipes.length, 1);
  const recipe = recipes[0];
  assert.equal(recipe.proof.gitCommit, 'bf5f590b609e7aed972ad25be12e17ea984a6da8');
  assert.equal(recipe.proof.tarballSha256, '1f32b627b4534cb1f1cb3abf6ddf6b66610e979851cbeee7c34d9d32bbca5fe8');
  const bundle = JSON.parse(await readFile(new URL('./legacy-packages.bundle.json', import.meta.url), 'utf8'));
  assert.equal(sha256(Buffer.from(bundle.packages.find((entry) => entry.id === '1.2.2-windows').base64, 'base64')), recipe.proof.tarballSha256);
  assert.deepEqual(recipe.allowedPaths, ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.mcp.json', 'CLAUDE.md']);
  assert.deepEqual(recipe.configuredAuthorityTransforms, []);
  assert.equal(recipe.preserveForeignRuntime, true); assert.equal(recipe.previousPackageRequired, true);
  const manifest = JSON.parse(await readFile(path.join(source, 'payload-manifest.json'), 'utf8'));
  assert.equal(manifest.files.length, 1213);
  for (const entry of manifest.files) {
    if (entry.path.startsWith('node_modules/') || entry.path.startsWith('tools/dashboard/dist/')) continue;
    const gitBytes = execFileSync('git', ['show', `${recipe.proof.gitCommit}:${entry.path}`], { cwd: repoRoot });
    const checkoutBytes = entry.path === 'bin/dev-foundry-claude.js' ? gitBytes : Buffer.from(gitBytes.toString('utf8').replace(/\r?\n/g, '\r\n'));
    assert.equal(sha256(checkoutBytes), entry.sha256, entry.path);
  }
  const closure = execFileSync('git', ['show', `${recipe.proof.evidenceCommit}:${recipe.proof.evidence}`], { cwd: repoRoot, encoding: 'utf8' });
  assert.ok(closure.includes(recipe.proof.gitCommit)); assert.ok(closure.includes(old.payloadRoot));
  const { old: lf } = await legacyPackage(t, '1.2.2');
  assert.notEqual(lf.expect, old.expect); assert.equal(lf.version, old.version);
});

test('Windows candidate bridge refuses one changed byte and a verified same-version rebuilt payload', async (t) => {
  const fixture = await legacy(t, false, '1.2.2-windows'); const { c, source, old } = fixture;
  assert.equal((await plan(fixture)).plan.status, 'ready');
  const file = path.join(source, 'README.md'); const original = await readFile(file); const changed = Buffer.from(original);
  changed[0] ^= 1;
  await writeFile(file, changed);
  assert.throws(() => selfPin(source));
  const before = await listTree(c.root);
  const tampered = await plan(fixture);
  assert.equal(tampered.plan.status, 'blocked'); assert.equal(tampered.plan.blockers[0].code, 'upgrade-ownership-unverified');
  assert.deepEqual(tampered.ops.writes, []); assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  // Give the one-byte variant its own correct manifest: integrity is valid, provenance is unsupported.
  const manifestFile = path.join(source, 'payload-manifest.json');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  manifest.files.find((entry) => entry.path === 'README.md').sha256 = sha256(changed);
  await writeFile(manifestFile, buildManifestBytes({ version: manifest.version, entries: manifest.files }));
  const rebuilt = selfPin(source); assert.equal(rebuilt.version, old.version); assert.notEqual(rebuilt.expect, old.expect);
  const config = JSON.parse(await c.read('.mcp.json')); config.mcpServers['dev-foundry-governance'].args[2] = rebuilt.expect;
  await c.put('.mcp.json', JSON.stringify(config)); c.commit();
  const rebuiltBefore = await listTree(c.root); const unsupported = await plan(fixture);
  assert.equal(unsupported.plan.status, 'blocked'); assert.equal(unsupported.plan.blockers[0].code, 'legacy-source-unsupported');
  assert.deepEqual(unsupported.ops.writes, []); assert.deepEqual(diffTrees(rebuiltBefore, await listTree(c.root)), []);
});

test('Windows legacy recipe preserves active CRLF authority instead of transforming it', async (t) => {
  const fixture = await legacy(t, true, '1.2.2-windows');
  const before = await listTree(fixture.c.root); const authority = await readSetSnapshot(fixture.c.root);
  const result = await plan(fixture);
  assert.equal(result.plan.legacyRecipe, 'legacy-1.2.2-windows-candidate-managed-surface');
  assert.equal(result.plan.status, 'blocked'); assert.equal(result.plan.blockers[0].code, 'upgrade-ownership-unverified');
  assert.deepEqual(result.ops.writes, []); assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  assert.deepEqual(await readSetSnapshot(fixture.c.root), authority);
});

test('public 1.3.0 source fixture matches the exact git tag payload and declares a distinct build from validation artifacts', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const { source, old } = await legacyPackage(t, '1.3.0-public');
  const manifest = JSON.parse(await readFile(path.join(source, 'payload-manifest.json'), 'utf8'));
  for (const entry of manifest.files) {
    if (entry.path.startsWith('node_modules/') || entry.path.startsWith('tools/dashboard/dist/')) continue;
    const tagBytes = execFileSync('git', ['show', `v1.3.0:${entry.path}`], { cwd: repoRoot });
    assert.equal(sha256(tagBytes), entry.sha256, entry.path);
  }
  const { old: archived } = await legacyPackage(t, '1.3.0'); assert.notEqual(old.expect, archived.expect);
  const material = JSON.parse(await readFile(path.join(repoRoot, 'migrations/release.json'), 'utf8'));
  const recipe = material.legacy.find((recipe) => recipe.source === old.expect);
  assert.equal(recipe.proof.gitTag, 'v1.3.0');
  assert.equal(recipe.proof.gitCommit, execFileSync('git', ['rev-parse', 'v1.3.0'], { cwd: repoRoot, encoding: 'utf8' }).trim());
});
