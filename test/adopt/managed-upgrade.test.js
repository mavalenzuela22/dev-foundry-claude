import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { legacyPackage } from './legacy-fixture.js';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
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
  // Consumer bytes must come from the exact producer package, including its
  // planner semantics, rather than current checkout code with old templates.
  const { createPlan: createLegacyPlan } = await import(pathToFileURL(path.join(source, 'src/adopt/plan.js')).href);
  const c = await makeConsumer(); t.after(c.cleanup);
  await c.put('.dev-foundry/executions/TSK-HISTORICAL/evidence-packet.md', '# Completed work\nHistorical result under the original framework; retain its meaning.\n');
  await c.put('.dev-foundry/validations/historical/result.json', '{"verdict":"pass","framework":"2.1.0"}\n');
  c.commit();
  const planned = await createLegacyPlan({ root: c.root, adapter: old, templatesRoot: path.join(source, 'templates') });
  assert.equal(planned.plan.status, 'ready');
  // Materialize the old release's generated surface as fixture data.
  for (const entry of planned.ops.writes) await c.put(entry.path, entry.content);
  c.commit();
  if (active) { await applyProposal(c.root, planned.plan.cutover_proposal); c.commit(); }
  return { c, source, old };
}

async function historical140(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsk031-v140-source-')); t.after(() => rm(root, { recursive: true, force: true }));
  const archive = execFileSync('git', ['archive', 'v1.4.0'], { cwd: repoRoot, maxBuffer: 100 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', root], { input: archive });
  await symlink(path.join(repoRoot, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  const load = async (relative) => import(pathToFileURL(path.join(root, relative)).href);
  const [planModule, upgradeModule, applyModule, consumerModule] = await Promise.all([
    load('src/adopt/plan.js'), load('src/adopt/upgrade.js'), load('src/adopt/apply.js'), load('src/consumer/command.js'),
  ]);
  return { ...planModule, ...upgradeModule, ...applyModule, ...consumerModule };
}
const plan = ({ c, source, adapter = target, resolutionFile }) => createUpgradePlan({ root: c.root, adapter, currentPackageRoot: source, resolutionFile });
const apply = ({ c, adapter = target, resolutionFile }, result) => applyPlan({ root: c.root, adapter, upgrade: true, planBytes: result.bytes, planSha256: result.hash, resolutionFile });

// A verified 1.4.2 payload, with managed text that differs from this target.
async function previous142(t) {
  const source = await mkdtemp(path.join(os.tmpdir(), 'tsk032-142-'));
  t.after(() => rm(source, { recursive: true, force: true }));
  await cp(path.join(repoRoot, 'templates'), path.join(source, 'templates'), { recursive: true });
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2' }));
  for (const file of ['agents/dev-foundry-executor.md.tmpl', 'claude-md-block.md.tmpl']) {
    const absolute = path.join(source, 'templates', file);
    const text = await readFile(absolute, 'utf8');
    await writeFile(absolute, text.replace(file.startsWith('agents/') ? 'description: ' : '## DEV FOUNDRY Claude adapter',
      file.startsWith('agents/') ? 'description: Previous release - ' : '## DEV FOUNDRY Claude adapter (previous release)'));
  }
  const entries = [];
  for (const [file, hash] of await listTree(source)) entries.push({ path: file, sha256: hash, size: (await readFile(path.join(source, file))).length });
  await writeFile(path.join(source, 'payload-manifest.json'), buildManifestBytes({ version: '1.4.2', entries }));
  const pin = selfPin(source);
  const old = { version: pin.version, expect: pin.expect, payloadRoot: pin.root };
  const c = await makeConsumer(); t.after(c.cleanup);
  const initial = await createPlan({ root: c.root, adapter: old, templatesRoot: path.join(source, 'templates') });
  assert.equal(initial.plan.status, 'ready');
  for (const op of initial.ops.writes) await c.put(op.path, op.content);
  c.commit();
  return { c, source, old, adapter: { version: '1.5.0', payloadRoot: 'f'.repeat(64), expect: `1.5.0:sha256:${'f'.repeat(64)}` } };
}

// Build a decision from actual refused consumer bytes and reported fingerprints,
// never by injecting operations into a fabricated ready plan.
async function selectResolution(t, fixture, contents) {
  const refused = await plan({ ...fixture, resolutionFile: undefined });
  assert.equal(refused.plan.status, 'blocked');
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), 'tsk032-decision-')));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = {
    format: 'dev-foundry.managed-resolution.v1', repository: { root: refused.plan.repository.root, head: refused.plan.repository.head },
    source: refused.plan.current.expect, target: refused.plan.target.expect,
    files: Object.entries(contents).map(([file, content]) => {
      const record = refused.plan.reconciliation.find((item) => item.path === file);
      assert.equal(record.classification, 'conflict');
      return { path: file, before_sha256: record.before_sha256, base_sha256: record.base_sha256,
        current_sha256: record.current_sha256, target_sha256: record.target_sha256,
        resolved_sha256: sha256(content), resolved_content: content };
    }),
  };
  fixture.resolutionFile = path.join(directory, 'resolution.json');
  await writeFile(fixture.resolutionFile, canonicalJson(input));
  return input;
}

async function conflicting142(t) {
  const fixture = await previous142(t);
  const file = '.claude/agents/dev-foundry-executor.md';
  const content = (await fixture.c.read(file)).replace('Previous release - ', 'Consumer policy - ').replaceAll('\n', '\r\n');
  await fixture.c.put(file, content); fixture.c.commit();
  const resolved = content.replace('Consumer policy - ', 'Reviewed consumer policy - ');
  const input = await selectResolution(t, fixture, { [file]: resolved });
  return { ...fixture, file, resolved, input };
}

test('tagged v1.4.2 managed agents and span with legitimate conflicting local policies can be explicitly resolved together', async (t) => {
  const source = await mkdtemp(path.join(os.tmpdir(), 'tsk032-tagged-142-'));
  t.after(() => rm(source, { recursive: true, force: true }));
  // Reconstruct a verified fixture payload from real tagged source bytes. This
  // exercises released templates, not an invented Previous-release edit or plan.
  const archive = execFileSync('git', ['archive', 'v1.4.2', 'package.json', 'templates'], { cwd: repoRoot });
  execFileSync('tar', ['-x', '-C', source], { input: archive });
  const entries = [];
  for (const [file, hash] of await listTree(source)) entries.push({ path: file, sha256: hash, size: (await readFile(path.join(source, file))).length });
  await writeFile(path.join(source, 'payload-manifest.json'), buildManifestBytes({ version: '1.4.2', entries }));
  const pin = selfPin(source); const old = { version: pin.version, payloadRoot: pin.root, expect: pin.expect };
  const c = await makeConsumer(); t.after(c.cleanup);
  const initial = await createPlan({ root: c.root, adapter: old, templatesRoot: path.join(source, 'templates') });
  assert.equal(initial.plan.status, 'ready');
  for (const entry of initial.ops.writes) await c.put(entry.path, entry.content);
  const file = '.claude/agents/dev-foundry-executor.md';
  const local = (await c.read(file)).replace('description: Execute one explicitly resolved Implementation Executor operation', 'description: Execute one explicitly resolved invoicing operation');
  const md = (await c.read('CLAUDE.md')).replace('Verify that the current repository is', 'For invoice work, verify that the current repository is');
  await c.put(file, local); await c.put('CLAUDE.md', md); c.commit();
  const fixture = { c, source, old, adapter: { version: '1.5.0', payloadRoot: 'f'.repeat(64), expect: `1.5.0:sha256:${'f'.repeat(64)}` } };
  const resolvedAgent = local.replace('invoicing operation', 'reviewed invoicing operation');
  const resolvedSpan = md.slice(md.indexOf('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN')).replace('For invoice work,', 'For reviewed invoice work,');
  await selectResolution(t, fixture, { [file]: resolvedAgent, 'CLAUDE.md': resolvedSpan });
  const authority = await readSetSnapshot(c.root); const before = await listTree(c.root);
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.equal(result.plan.reconciliation.filter((item) => item.classification === 'operator-resolved').length, 2);
  await apply(fixture, result);
  assert.equal(await c.read(file), resolvedAgent);
  assert.ok((await c.read('CLAUDE.md')).endsWith(resolvedSpan));
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((item) => item.path).sort());
});

test('advanced CLI explicit Operator selection resolves a real 1.4.2 conflict with deterministic provenance and CRLF bytes', async (t) => {
  const fixture = await conflicting142(t); const { c, file, resolved } = fixture;
  // Exercise the real advanced bin with a verified, isolated package snapshot.
  const packaged = await makePresentationPackage(); t.after(packaged.cleanup);
  for (const entry of ['bin', 'src', 'templates', 'migrations', 'package.json', 'node_modules/yaml']) {
    await cp(path.join(repoRoot, entry), path.join(packaged.root, entry), { recursive: true });
  }
  const version = JSON.parse(await readFile(path.join(packaged.root, 'package.json'), 'utf8')).version;
  const entries = [];
  for (const [entry, hash] of await listTree(packaged.root)) entries.push({ path: entry, sha256: hash, size: (await readFile(path.join(packaged.root, entry))).length });
  await writeFile(path.join(packaged.root, 'payload-manifest.json'), buildManifestBytes({ version, entries }));
  const pin = selfPin(packaged.root);
  fixture.adapter = { version: pin.version, payloadRoot: pin.root, expect: pin.expect };
  await selectResolution(t, fixture, { [file]: resolved });
  const invoke = (action, args = [], root = c.root) => spawnSync(process.execPath, [path.join(packaged.root, 'bin/dev-foundry-claude.js'),
    'upgrade', action, '--root', root, ...args], { cwd: path.dirname(fixture.resolutionFile), encoding: 'utf8' });
  // Relative selection must resolve against the invocation directory in both commands.
  const selected = ['--resolution-file', path.basename(fixture.resolutionFile)];
  const from = ['--from-package', fixture.source];
  const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.deepEqual(result.bytes, (await plan(fixture)).bytes);
  const planFile = path.join(path.dirname(fixture.resolutionFile), 'plan.json');
  const planned = invoke('plan', [...from, ...selected, '--out', planFile]);
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).planSha256, result.hash);
  assert.deepEqual(await readFile(planFile), result.bytes);
  assert.equal(result.plan.resolutionInput.path, fixture.resolutionFile);
  assert.equal(result.plan.resolutionInput.sha256, sha256(await readFile(fixture.resolutionFile)));
  const actorProfile = '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml';
  assert.equal(result.plan.preconditions[actorProfile], sha256(await readFile(path.join(c.root, actorProfile))));
  const record = result.plan.reconciliation.find((item) => item.path === file);
  assert.equal(record.classification, 'operator-resolved'); assert.equal(record.after_sha256, sha256(resolved));
  assert.match(record.current_after_diff, /Reviewed consumer policy/); assert.match(record.target_after_diff, /Reviewed consumer policy/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const decision = await readFile(fixture.resolutionFile);
  const localBytes = await c.read(file);
  const applyArgs = ['--plan', planFile, '--plan-sha256', result.hash];
  for (const kind of ['omitted', 'missing', 'changed', 'invalid', 'symlink', 'different path', 'inside project', 'stale repository', 'missing hash', 'wrong hash']) await t.test(kind, async () => {
    let selection = selected;
    let args = applyArgs;
    if (kind === 'omitted') selection = [];
    if (kind === 'missing') selection = ['--resolution-file', 'missing.json'];
    if (kind === 'changed') await writeFile(fixture.resolutionFile, Buffer.concat([decision, Buffer.from(' ')]));
    if (kind === 'invalid') await writeFile(fixture.resolutionFile, '{"authorizedBy":"Operator"}');
    if (kind === 'symlink' || kind === 'different path') {
      const other = fixture.resolutionFile + (kind === 'symlink' ? '.link' : '.copy');
      if (kind === 'symlink') await symlink(fixture.resolutionFile, other); else await cp(fixture.resolutionFile, other);
      selection = ['--resolution-file', other];
    }
    if (kind === 'inside project') { await c.put('decision.json', decision); selection = ['--resolution-file', path.join(c.root, 'decision.json')]; }
    if (kind === 'stale repository') await c.put(file, resolved + '\r\nLater local policy.\r\n');
    if (kind === 'missing hash') args = ['--plan', planFile];
    if (kind === 'wrong hash') args = ['--plan', planFile, '--plan-sha256', '0'.repeat(64)];
    const unchanged = await listTree(c.root);
    try {
      if (!['missing hash', 'wrong hash', 'different path', 'stale repository'].includes(kind)) {
        const refused = invoke('plan', [...from, ...selection]);
        if (kind === 'changed') {
          assert.equal(refused.status, 0, refused.stderr);
          const changed = JSON.parse(refused.stdout);
          assert.equal(changed.resolutionInput.sha256, sha256(await readFile(fixture.resolutionFile)));
          assert.notEqual(sha256(refused.stdout), result.hash);
        } else {
          assert.equal(refused.status, 2, refused.stderr);
          const blocked = JSON.parse(refused.stdout);
          assert.equal(blocked.status, 'blocked'); assert.deepEqual(blocked.merge, []);
          if (kind !== 'omitted') assert.ok(blocked.blockers.some((item) => item.code === 'upgrade-resolution-invalid'));
        }
      }
      const refused = invoke('apply', [...args, ...selection]);
      assert.equal(refused.status, kind === 'missing hash' ? 2 : 1, refused.stderr);
      assert.match(refused.stderr, kind === 'missing hash' ? /apply requires/ : kind === 'wrong hash' ? /plan-hash-mismatch/ : /plan-stale/);
      assert.deepEqual(diffTrees(unchanged, await listTree(c.root)), []);
      assert.deepEqual(await readSetSnapshot(c.root), authority);
    } finally {
      await writeFile(fixture.resolutionFile, decision);
      if (kind === 'inside project') await rm(path.join(c.root, 'decision.json'));
      if (kind === 'stale repository') await c.put(file, localBytes);
    }
  });
  const applied = invoke('apply', [...applyArgs, ...selected]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout), { written: result.ops.writes.length, deleted: 0 });
  assert.equal(await c.read(file), resolved);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((item) => item.path).sort());
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  const unchanged = await previous142(t);
  const compatible = invoke('plan', ['--from-package', unchanged.source], unchanged.c.root);
  assert.equal(compatible.status, 0, compatible.stderr);
  assert.equal(JSON.parse(compatible.stdout).status, 'ready');
  assert.equal(JSON.parse(compatible.stdout).resolutionInput, undefined);
  const noDecision = path.join(path.dirname(planFile), 'compatible.json');
  await writeFile(noDecision, compatible.stdout);
  const compatibleApply = invoke('apply', ['--plan', noDecision, '--plan-sha256', sha256(compatible.stdout)], unchanged.c.root);
  assert.equal(compatibleApply.status, 0, compatibleApply.stderr);
  unchanged.c.commit();
  const healthy = await listTree(unchanged.c.root);
  const noopPlan = invoke('plan', [], unchanged.c.root);
  assert.equal(noopPlan.status, 0, noopPlan.stderr); assert.equal(JSON.parse(noopPlan.stdout).status, 'noop');
  await writeFile(noDecision, noopPlan.stdout);
  const noop = invoke('apply', ['--plan', noDecision, '--plan-sha256', sha256(noopPlan.stdout)], unchanged.c.root);
  assert.equal(noop.status, 0, noop.stderr); assert.deepEqual(JSON.parse(noop.stdout), { written: 0, deleted: 0 });
  assert.deepEqual(diffTrees(healthy, await listTree(unchanged.c.root)), []);
  assert.equal(invoke('status', selected).status, 2);
});

test('resolved CLAUDE span preserves arbitrary outside bytes and binds full-file and span hashes separately', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  const original = await c.read('CLAUDE.md');
  const span = original.slice(original.indexOf('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN')).replace('(previous release)', '(consumer policy)').replaceAll('\n', '\r\n');
  const prefix = Buffer.from([0xff, 0xfe, 13, 10]); const suffix = Buffer.from([10, 0x80, 0, 13, 10]);
  await c.put('CLAUDE.md', Buffer.concat([prefix, Buffer.from(span), suffix])); c.commit();
  const resolved = span.replace('(consumer policy)', '(reviewed consumer policy)');
  await selectResolution(t, fixture, { 'CLAUDE.md': resolved });
  const before = await listTree(c.root); const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  const op = result.ops.writes.find((item) => item.path === 'CLAUDE.md');
  assert.ok(Buffer.isBuffer(op.content));
  assert.deepEqual(op.content, Buffer.concat([prefix, Buffer.from(resolved), suffix]));
  const merge = result.plan.merge.find((item) => item.path === 'CLAUDE.md');
  assert.equal(merge.before_sha256, before.get('CLAUDE.md')); assert.equal(merge.after_sha256, sha256(op.content));
  await apply(fixture, result);
  assert.deepEqual(await readFile(path.join(c.root, 'CLAUDE.md')), op.content);
});

test('resolution apply rejects missing selection, changed/missing file, stale bytes, location and forged plan with zero writes', async (t) => {
  for (const kind of ['unselected', 'changed bytes', 'missing file', 'stale consumer', 'changed location', 'forged plan', 'authority drift']) await t.test(kind, async (t) => {
    const fixture = await conflicting142(t); const result = await plan(fixture);
    assert.equal(result.plan.status, 'ready');
    let selected = fixture; let supplied = result;
    if (kind === 'unselected') selected = { ...fixture, resolutionFile: undefined };
    if (kind === 'changed bytes') await writeFile(fixture.resolutionFile, `${canonicalJson(fixture.input)} `);
    if (kind === 'missing file') await rm(fixture.resolutionFile);
    if (kind === 'stale consumer') await fixture.c.put(fixture.file, fixture.resolved + '\r\nLater edit.\r\n');
    if (kind === 'authority drift') {
      const profile = '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml';
      await fixture.c.put(profile, (await fixture.c.read(profile)) + '\n# Changed authority semantics\n');
    }
    if (kind === 'changed location') {
      const other = fixture.resolutionFile + '.copy'; await cp(fixture.resolutionFile, other);
      selected = { ...fixture, resolutionFile: other };
    }
    if (kind === 'forged plan') {
      const forged = structuredClone(result.plan); forged.merge[0].after_sha256 = 'a'.repeat(64);
      const bytes = Buffer.from(canonicalJson(forged)); supplied = { bytes, hash: sha256(bytes) };
    }
    const before = await listTree(fixture.c.root);
    await assert.rejects(apply(selected, supplied), { code: 'plan-stale' });
    assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  });
});

test('closed resolution schema and exact fingerprints reject mismatches, foreign paths, self-attested approval and identity changes', async (t) => {
  const cases = [
    ['hash', (input) => { input.files[0].resolved_sha256 = '0'.repeat(64); }],
    ...['before_sha256', 'base_sha256', 'current_sha256', 'target_sha256'].map((key) => [key, (input) => { input.files[0][key] = '0'.repeat(64); }]),
    ['foreign path', (input) => { input.files[0].path = 'src/billing.js'; }],
    ['traversal', (input) => { input.files[0].path = '../CLAUDE.md'; }],
    ['authority path', (input) => { input.files[0].path = '.dev-foundry/profiles/project-operating-profile.yaml'; }],
    ['self-attested authorization', (input) => { input.authorizedBy = 'Operator'; }],
    ['extra file key', (input) => { input.files[0].approved = true; }],
    ['duplicate path', (input) => { input.files.push(input.files[0]); }],
    ['foreign repository', (input) => { input.repository.root += '-foreign'; }],
    ['stale HEAD', (input) => { input.repository.head = '0'.repeat(40); }],
    ['source pin', (input) => { input.source = input.target; }],
    ['target pin', (input) => { input.target = input.source; }],
    ['changed agent name', (input) => { input.files[0].resolved_content = input.files[0].resolved_content.replace('name: dev-foundry-executor', 'name: other'); input.files[0].resolved_sha256 = sha256(input.files[0].resolved_content); }],
  ];
  for (const [name, change] of cases) await t.test(name, async (t) => {
    const fixture = await conflicting142(t); change(fixture.input);
    await writeFile(fixture.resolutionFile, canonicalJson(fixture.input));
    const before = await listTree(fixture.c.root); const denied = await plan(fixture);
    assert.equal(denied.plan.status, 'blocked', name); assert.deepEqual(denied.ops.writes, []);
    assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  });
});

test('selected resolution cannot suppress other conflicts, unknown ownership or configured authority collisions', async (t) => {
  for (const kind of ['other conflict', 'unknown agent', 'duplicate span', 'configured profile', 'configured agent alias', 'configured symlink alias']) await t.test(kind, async (t) => {
    const fixture = await conflicting142(t); const { c } = fixture;
    if (kind === 'other conflict') await c.put('CLAUDE.md', (await c.read('CLAUDE.md')).replace('(previous release)', '(other local conflict)'));
    if (kind === 'unknown agent') await c.put(fixture.file, (await c.read(fixture.file)).replace('name: dev-foundry-executor', 'name: foreign'));
    if (kind === 'duplicate span') await c.put('CLAUDE.md', (await c.read('CLAUDE.md')).repeat(2));
    if (kind === 'configured profile') await c.put('.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml', 'consumer authority\n');
    if (kind.startsWith('configured') && kind.endsWith('alias')) {
      const file = '.dev-foundry/authority-index.yaml';
      const configured = kind === 'configured symlink alias' ? '.dev-foundry/managed-agent-alias.md' : fixture.file;
      if (kind === 'configured symlink alias') await symlink(path.join(c.root, fixture.file), path.join(c.root, configured));
      await c.put(file, (await c.read(file)).replace('bindings:\n', `bindings:\n  - id: configured-agent\n    path: ${configured}\n    authority_class: configured\n`));
    }
    c.commit();
    // Rebind only HEAD so each case tests its real blocker, not a stale decision.
    fixture.input.repository.head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: c.root, encoding: 'utf8' }).trim();
    await writeFile(fixture.resolutionFile, canonicalJson(fixture.input));
    const before = await listTree(c.root); const denied = await plan(fixture);
    assert.equal(denied.plan.status, 'blocked', kind); assert.deepEqual(denied.ops.writes, []);
    if (kind === 'other conflict') assert.equal(denied.plan.reconciliation.find((item) => item.path === fixture.file).classification, 'operator-resolved');
    if (kind.startsWith('configured') && kind.endsWith('alias')) assert.equal(denied.plan.reconciliation.find((item) => item.path === fixture.file).classification, 'ownership-unverified');
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  });
});

test('consumer upgrade previews decision diffs and applies only with explicit selection and --yes', async (t) => {
  const fixture = await conflicting142(t); const { c, source, adapter, resolutionFile } = fixture;
  const presentation = await makePresentationPackage(); t.after(presentation.cleanup);
  const invoke = async (argv) => {
    const lines = [];
    const code = await consumerCommand({ command: 'upgrade', argv, cwd: c.root, packageRoot: presentation.root,
      getAdapter: () => adapter, executableAvailable: () => true, output: (text) => lines.push(text) });
    return { code, text: lines.join('\n') };
  };
  const before = await listTree(c.root);
  assert.equal((await invoke(['--from-package', source, '--yes'])).code, 2);
  const preview = await invoke(['--from-package', source, '--resolution-file', resolutionFile]);
  assert.equal(preview.code, 0); assert.match(preview.text, /operator-resolved/); assert.match(preview.text, /Reviewed consumer policy/);
  assert.match(preview.text, /Decision SHA-256:/); assert.match(preview.text, /--resolution-file .* --yes/);
  const reviewed = /preflight \(plan SHA-256 ([a-f0-9]{64})\)/.exec(preview.text)[1];
  const unreviewed = await invoke(['--from-package', source, '--resolution-file', resolutionFile, '--yes']);
  assert.equal(unreviewed.code, 2); assert.match(unreviewed.text, /Application refused/);
  const original = await readFile(resolutionFile);
  await writeFile(resolutionFile, Buffer.concat([original, Buffer.from(' ')]));
  const changed = await invoke(['--from-package', source, '--resolution-file', resolutionFile, '--plan-sha256', reviewed, '--yes']);
  assert.equal(changed.code, 2); assert.match(changed.text, /reviewed plan is missing or changed/);
  await writeFile(resolutionFile, original);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const applied = await invoke(['--from-package', source, '--resolution-file', resolutionFile, '--plan-sha256', reviewed, '--yes', '--json']);
  assert.equal(applied.code, 0); const output = JSON.parse(applied.text);
  assert.ok(output.applied.written > 0); assert.equal(output.plan.status, 'ready');
  assert.equal(await c.read(fixture.file), fixture.resolved);
});

test('resolution cannot introduce a second span, outside text, unneeded decisions or duplicate JSON keys', async (t) => {
  for (const kind of ['second span', 'outside text', 'changed marker', 'unneeded decision', 'duplicate JSON key', 'symlink decision']) await t.test(kind, async (t) => {
    const fixture = await previous142(t); const { c } = fixture;
    const md = (await c.read('CLAUDE.md')).replace('(previous release)', '(local choice)');
    await c.put('CLAUDE.md', md); c.commit();
    const span = md.slice(md.indexOf('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN'));
    const input = await selectResolution(t, fixture, { 'CLAUDE.md': span });
    if (kind === 'second span') input.files[0].resolved_content = span + span;
    if (kind === 'outside text') input.files[0].resolved_content = span + 'outside the span\n';
    if (kind === 'changed marker') input.files[0].resolved_content = span.replace('managed block; do not edit', 'other ownership');
    if (kind === 'unneeded decision') input.files[0].path = '.claude/agents/dev-foundry-auditor.md';
    input.files[0].resolved_sha256 = sha256(input.files[0].resolved_content);
    let bytes = canonicalJson(input);
    if (kind === 'duplicate JSON key') bytes = bytes.replace('"format":', '"format": "forged", "format":');
    await writeFile(fixture.resolutionFile, bytes);
    if (kind === 'symlink decision') {
      const link = fixture.resolutionFile + '.link'; await symlink(fixture.resolutionFile, link); fixture.resolutionFile = link;
    }
    const before = await listTree(c.root); const denied = await plan(fixture);
    assert.equal(denied.plan.status, 'blocked', kind); assert.deepEqual(denied.ops.writes, []);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  });
});

test('explicit resolution retains staged-write failure cleanup and exact local bytes', async (t) => {
  const fixture = await conflicting142(t); const { c } = fixture;
  await mkdir(path.join(c.root, `.mcp.json.dfc-stage-${process.pid}`));
  await c.put(`.mcp.json.dfc-stage-${process.pid}/keep`, 'occupied\n');
  const result = await plan(fixture); assert.equal(result.plan.status, 'ready');
  const before = await listTree(c.root);
  await assert.rejects(apply(fixture, result), { code: 'apply-failed' });
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('resolution drift during staging and later rename failure leave no installed or shadow writes', async (t) => {
  for (const kind of ['decision drift', 'source package drift', 'rename failure']) await t.test(kind, async (t) => {
    const fixture = await conflicting142(t); const result = await plan(fixture);
    assert.equal(result.plan.status, 'ready');
    const before = await listTree(fixture.c.root);
    const write = fsPromises.writeFile; const rename = fsPromises.rename;
    let changed = false; let renames = 0;
    if (kind === 'rename failure') t.mock.method(fsPromises, 'rename', async (...args) => {
      if (++renames === 2) throw new Error('injected rename failure');
      return rename(...args);
    });
    else t.mock.method(fsPromises, 'writeFile', async (file, ...args) => {
      const written = await write(file, ...args);
      if (!changed && String(file).includes('.dfc-stage-')) {
        changed = true;
        if (kind === 'decision drift') await write(fixture.resolutionFile, canonicalJson(fixture.input) + ' ');
        else await write(path.join(fixture.source, 'package.json'), '{}');
      }
      return written;
    });
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
    await assert.rejects(apply(fixture, result), { code: kind === 'rename failure' ? 'apply-failed' : 'plan-stale' });
    assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  });
});

test('verified 1.4.2 agent CRLF drift reconciles without semantic loss', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  const file = '.claude/agents/dev-foundry-executor.md';
  await c.put(file, (await c.read(file)).replaceAll('\n', '\r\n')); c.commit();
  const before = await listTree(c.root);
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.equal(result.plan.reconciliation.find((item) => item.path === file).classification, 'line-endings-only');
  assert.deepEqual(result.bytes, (await plan(fixture)).bytes);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  await apply(fixture, result);
  assert.doesNotMatch(await c.read(file), /Previous release -|\r/);
});

test('verified 1.4.2 non-overlapping local agent edit survives target refresh', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  const file = '.claude/agents/dev-foundry-executor.md';
  const note = '\nConsumer instruction: run invoice rounding checks.\n';
  await c.put(file, (await c.read(file)) + note); c.commit();
  const authority = await readSetSnapshot(c.root); const before = await listTree(c.root);
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.equal(result.plan.reconciliation.find((item) => item.path === file).classification, 'local-edits-preserved');
  assert.deepEqual(result.bytes, (await plan(fixture)).bytes);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  await apply(fixture, result);
  assert.ok((await c.read(file)).endsWith(note));
  assert.doesNotMatch(await c.read(file), /Previous release -/);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((item) => item.path).sort());
});

test('verified 1.4.2 CLAUDE span preserves semantic edits, CRLF and exact outside bytes', async (t) => {
  for (const crlf of [false, true]) await t.test(crlf ? 'CRLF' : 'LF', async (t) => {
    const fixture = await previous142(t); const { c } = fixture;
    const note = 'Consumer instruction: check invoice rounding before delivery.\n';
    const footer = '\nConsumer footer, with mixed endings.\r\n';
    let md = (await c.read('CLAUDE.md')).replace('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->', `${note}<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->`);
    if (crlf) md = md.replaceAll('\n', '\r\n');
    await c.put('CLAUDE.md', md + footer); c.commit();
    const result = await plan(fixture);
    assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
    const record = result.plan.reconciliation.find((item) => item.path === 'CLAUDE.md');
    assert.equal(record.classification, 'local-edits-preserved');
    assert.equal(record.scope, 'managed-block');
    const start = md.indexOf('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:BEGIN');
    await apply(fixture, result);
    const after = await c.read('CLAUDE.md');
    assert.equal(after.slice(0, start), md.slice(0, start));
    assert.ok(after.endsWith(footer));
    assert.ok(after.includes(crlf ? note.replaceAll('\n', '\r\n') : note));
    assert.doesNotMatch(after, /previous release/);
  });
});

test('verified 1.4.2 disjoint replacements and deletions preserve local agent content', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  const file = '.claude/agents/dev-foundry-executor.md';
  const before = await c.read(file);
  const edited = before.replace('Make the authorized code changes with native tools.', 'Make the authorized code changes and check invoice rounding.')
    .replace(/\nPreserve unrelated work[^\n]*\n$/, '\n');
  assert.notEqual(edited, before);
  await c.put(file, edited.replaceAll('\n', '\r\n')); c.commit();
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  await apply(fixture, result);
  assert.equal(await c.read(file), edited.replace('Previous release - ', '').replaceAll('\n', '\r\n'));
});

test('unresolved 1.4.2 overlap exposes fingerprints and all three diffs with zero writes', async (t) => {
  for (const file of ['.claude/agents/dev-foundry-executor.md', 'CLAUDE.md']) await t.test(file, async (t) => {
    const fixture = await previous142(t); const { c } = fixture;
    const current = (await c.read(file)).replace(file === 'CLAUDE.md' ? '(previous release)' : 'Previous release -', 'Consumer override');
    await c.put(file, current); c.commit();
    const before = await listTree(c.root); const result = await plan(fixture);
    assert.equal(result.plan.status, 'blocked');
    assert.deepEqual(result.ops, { writes: [], deletes: [] });
    const record = result.plan.reconciliation.find((item) => item.path === file);
    assert.equal(record.classification, 'conflict');
    for (const key of ['base_sha256', 'current_sha256', 'target_sha256']) assert.match(record[key], /^[a-f0-9]{64}$/);
    assert.equal(record.after_sha256, null);
    for (const key of ['base_current_diff', 'base_target_diff', 'current_target_diff']) assert.match(record[key], /@@ /);
    assert.match(result.plan.blockers.map((item) => item.message).join('\n'), /resolve explicitly/);
    assert.deepEqual(result.bytes, (await plan(fixture)).bytes);
    await assert.rejects(apply(fixture, result), { code: 'plan-not-ready' });
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  });
});

test('1.4.2 reconciliation retains ownership, dirty path, symlink and configured authority gates', async (t) => {
  const agent = '.claude/agents/dev-foundry-executor.md';
  for (const [name, change] of [
    ['foreign identity', async ({ c }) => c.put(agent, (await c.read(agent)).replace('name: dev-foundry-executor', 'name: foreign-executor'))],
    ['unknown bytes', async ({ c }) => c.put(agent, 'consumer custom instructions\n')],
    ['missing agent', async ({ c }) => rm(path.join(c.root, agent))],
    ['missing span', async ({ c }) => c.put('CLAUDE.md', '# Consumer instructions only\n')],
    ['missing POP', async ({ c }) => rm(path.join(c.root, '.dev-foundry/profiles/project-operating-profile.yaml'))],
    ['malformed span', async ({ c }) => c.put('CLAUDE.md', (await c.read('CLAUDE.md')).replace('<!-- DEV-FOUNDRY-CLAUDE-ADAPTER:END -->', ''))],
    ['authority collision', async ({ c }) => c.put('.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml', 'id: consumer-authority\n')],
    ['dirty agent', async ({ c }) => c.put(agent, (await c.read(agent)) + '\nConsumer instruction.\n')],
    ['symlink', async ({ c, source }) => { await rm(path.join(c.root, agent)); await symlink(path.join(source, 'templates/agents/dev-foundry-executor.md.tmpl'), path.join(c.root, agent)); }],
  ]) await t.test(name, async (t) => {
    const fixture = await previous142(t); await change(fixture);
    if (name !== 'dirty agent') fixture.c.commit();
    const before = await listTree(fixture.c.root); const result = await plan(fixture);
    assert.equal(result.plan.status, 'blocked', name); assert.deepEqual(result.ops, { writes: [], deletes: [] });
    if (name === 'dirty agent') assert.ok(result.plan.blockers.some((item) => item.code === 'dirty-working-tree'));
    await assert.rejects(apply(fixture, result), { code: 'plan-not-ready' });
    assert.deepEqual(diffTrees(before, await listTree(fixture.c.root)), []);
  });
});

test('reconciled 1.4.2 plans reject package, source, plan, target and repository tampering', async (t) => {
  for (const kind of ['package', 'pin', 'plan', 'target', 'local drift']) await t.test(kind, async (t) => {
    const fixture = await previous142(t); const { c, source } = fixture;
    const file = '.claude/agents/dev-foundry-executor.md';
    await c.put(file, (await c.read(file)) + '\nConsumer instruction.\n'); c.commit();
    const result = await plan(fixture); assert.equal(result.plan.status, 'ready');
    let supplied = result; let adapter = fixture.adapter;
    if (kind === 'package') await writeFile(path.join(source, 'templates/agents/dev-foundry-executor.md.tmpl'), 'tampered');
    if (kind === 'pin') {
      const mcp = JSON.parse(await c.read('.mcp.json'));
      mcp.mcpServers['dev-foundry-governance'].args[2] = `1.4.2:sha256:${'b'.repeat(64)}`;
      await c.put('.mcp.json', JSON.stringify(mcp)); c.commit();
    }
    if (kind === 'plan') {
      const forged = structuredClone(result.plan);
      forged.reconciliation[0].after_sha256 = 'a'.repeat(64);
      forged.resolution = { content: 'forged approval' };
      const bytes = Buffer.from(canonicalJson(forged)); supplied = { bytes, hash: sha256(bytes) };
    }
    if (kind === 'target') adapter = { ...adapter, payloadRoot: 'e'.repeat(64), expect: `1.5.0:sha256:${'e'.repeat(64)}` };
    if (kind === 'local drift') await c.put(file, (await c.read(file)) + '\nDrift.\n');
    const before = await listTree(c.root);
    await assert.rejects(applyPlan({ root: c.root, adapter, upgrade: true, planBytes: supplied.bytes, planSha256: supplied.hash }), { code: 'plan-stale' });
    if (kind === 'package' || kind === 'pin') {
      const denied = await plan(fixture); assert.equal(denied.plan.status, 'blocked'); assert.deepEqual(denied.ops.writes, []);
    }
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  });
});

test('reconciled 1.4.2 staged write failure preserves local bytes and authority', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  await c.put('.claude/agents/dev-foundry-executor.md', (await c.read('.claude/agents/dev-foundry-executor.md')) + '\nConsumer instruction.\n'); c.commit();
  // Force a later stage to fail after the merged agent was already staged.
  await mkdir(path.join(c.root, `.mcp.json.dfc-stage-${process.pid}`));
  await c.put(`.mcp.json.dfc-stage-${process.pid}/keep`, 'occupied\n');
  const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
  const result = await plan(fixture); assert.equal(result.plan.status, 'ready');
  await assert.rejects(apply(fixture, result), { code: 'apply-failed' });
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
});

test('1.4.2 reconciliation requires the exact prior payload even when current bytes match the target', async (t) => {
  const fixture = await previous142(t); const { c, old, source, adapter } = fixture;
  const noSource = await createUpgradePlan({ root: c.root, adapter });
  assert.equal(noSource.plan.status, 'blocked'); assert.deepEqual(noSource.ops.writes, []);
  for (const file of ['.claude/agents/dev-foundry-executor.md', 'CLAUDE.md']) {
    await c.put(file, (await c.read(file)).replace('Previous release - ', '').replace(' (previous release)', ''));
  }
  c.commit();
  assert.equal((await createPlan({ root: c.root, adapter: old })).plan.status, 'noop');
  await writeFile(path.join(source, 'package.json'), '{}');
  const before = await listTree(c.root); const denied = await plan(fixture);
  assert.equal(denied.plan.status, 'blocked');
  assert.ok(denied.plan.blockers.some((item) => item.code === 'upgrade-ownership-unverified'));
  assert.deepEqual(denied.ops.writes, []);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
});

test('1.4.2 identical upstream edits converge and unchanged target files retain local bytes', async (t) => {
  const fixture = await previous142(t); const { c } = fixture;
  const executor = '.claude/agents/dev-foundry-executor.md';
  const auditor = '.claude/agents/dev-foundry-auditor.md';
  const note = '\nConsumer instruction.\n';
  await c.put(executor, (await c.read(executor)).replace('Previous release - ', '') + note);
  const auditorBytes = (await c.read(auditor)) + '\r\nConsumer instruction with mixed endings.\n';
  await c.put(auditor, auditorBytes); c.commit();
  const result = await plan(fixture);
  assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
  assert.ok(result.plan.noop.includes(auditor));
  assert.ok(!result.ops.writes.some((item) => item.path === auditor));
  await apply(fixture, result);
  assert.equal(await c.read(auditor), auditorBytes);
  assert.ok((await c.read(executor)).endsWith(note));
  assert.doesNotMatch(await c.read(executor), /Previous release/);
});

test('exact released legacy bridge is deterministic, exact-hash enforced, bounded and preserves authority/product/outside block', async (t) => {
  const historical = await historical140(t);
  for (const version of ['1.2.2', '1.2.2-windows', '1.3.0', '1.3.0-public']) for (const active of version === '1.2.2-windows' ? [false] : [false, true]) await t.test(`${version} ${active ? 'active' : 'prepared'}`, async (t) => {
    const fixture = await legacy(t, active, version); const { c, old } = fixture;
    await c.put('CLAUDE.md', (await c.read('CLAUDE.md')) + '\nConsumer footer: keep this byte for byte.\n'); c.commit();
    const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
    const withoutSource = await historical.createUpgradePlan({ root: c.root, adapter: target });
    assert.equal(withoutSource.plan.status, 'blocked'); assert.deepEqual(withoutSource.ops.writes, []);
    const result = await historical.createUpgradePlan({ root: c.root, adapter: target, currentPackageRoot: fixture.source });
    assert.equal(result.plan.status, 'ready', JSON.stringify(result.plan.blockers));
    assert.equal(result.plan.upgradeKind, 'legacy-bridge'); assert.deepEqual(result.plan.current, old);
    assert.deepEqual(result.bytes, (await historical.createUpgradePlan({ root: c.root, adapter: target, currentPackageRoot: fixture.source })).bytes);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    // The tagged 1.4.0 bridge refreshes only the runtime pin for LF packages;
    // CLAUDE.md is preserved byte for byte, including the consumer footer.
    const changed = version === '1.2.2-windows' ? ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.mcp.json', 'CLAUDE.md'] : ['.mcp.json'];
    assert.deepEqual(result.ops.writes.map((item) => item.path).sort(), changed);
    await assert.rejects(historical.applyPlan({ root: c.root, adapter: target, upgrade: true, planBytes: result.bytes, planSha256: '0'.repeat(64) }), { code: 'plan-hash-mismatch' });
    const presentationPackage = await makePresentationPackage(); t.after(presentationPackage.cleanup);
    const output = [];
    await historical.consumerCommand({ command: 'upgrade', argv: ['--from-package', fixture.source], cwd: c.root, packageRoot: presentationPackage.root,
      getAdapter: () => target, executableAvailable: () => true, output: (text) => output.push(text) });
    assert.match(output.join('\n'), /managed files need to be refreshed/); assert.doesNotMatch(output.join('\n'), /upgrade-migration-required|agent-file-collision/);
    assert.match(output.join('\n'), /Application files affected: 0/);
    assert.deepEqual(await historical.applyPlan({ root: c.root, adapter: target, upgrade: true, planBytes: result.bytes, planSha256: result.hash }), { written: changed.length, deleted: 0 });
    assert.deepEqual(diffTrees(before, await listTree(c.root)), result.ops.writes.map((item) => item.path).sort());
    assert.deepEqual(await readSetSnapshot(c.root), authority);
    assert.match(await c.read('CLAUDE.md'), /^# Acme billing/); assert.ok((await c.read('CLAUDE.md')).endsWith('\nConsumer footer: keep this byte for byte.\n'));
    c.commit(); assert.equal((await historical.createPlan({ root: c.root, adapter: target })).plan.status, 'noop');
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
