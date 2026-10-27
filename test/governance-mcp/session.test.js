import assert from 'node:assert/strict';
import { readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse, stringify } from 'yaml';
import { INDEX_PATH, MCP_FILE, MCP_SERVER_NAME, POP_PATH } from '../../src/adopt/common.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { beginRuntimeUpgrade, finishRuntimeUpgrade, runtimeUpgradeState } from '../../src/adopt/runtime.js';
import { createSessionGuard } from '../../src/governance-mcp/session.js';
import { makeV3Project } from './fixture.js';

const sourcePin = `1.5.5:sha256:${'a'.repeat(64)}`;
const targetPin = `1.5.6:sha256:${'b'.repeat(64)}`;
const mcp = (pin) => canonicalJson({ mcpServers: { [MCP_SERVER_NAME]: { command: 'dev-foundry-claude', args: ['mcp', '--expect', pin] } } });
const read = (project, file) => readFile(path.join(project.root, file), 'utf8');
async function fixture(t) {
  const project = await makeV3Project();
  t.after(project.cleanup);
  await project.write(MCP_FILE, mcp(sourcePin));
  return project;
}
async function edit(project, file, mutate) {
  const data = parse(await read(project, file));
  mutate(data);
  await project.write(file, stringify(data));
}
function denial(result, code, root) {
  assert.equal(result.ok, false);
  assert.equal(result.errorCode, code);
  assert.deepEqual(Object.keys(result).sort(), ['errorCode', 'message', 'nextAction', 'ok']);
  assert.ok(result.nextAction);
  if (root) assert.equal(JSON.stringify(result).includes(root), false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_|Error:|\bat .*\.js:\d/);
  return result;
}
async function beginUpgrade(project) {
  const bytes = Buffer.from(canonicalJson({ mode: 'upgrade', status: 'ready', current: { expect: sourcePin }, target: { expect: targetPin }, create: [],
    merge: [{ path: MCP_FILE, before_sha256: sha256(mcp(sourcePin)), after_sha256: sha256(mcp(targetPin)) }] }));
  const hash = sha256(bytes);
  await beginRuntimeUpgrade({ root: project.root, planBytes: bytes, planSha256: hash, writes: [{ path: MCP_FILE, content: mcp(targetPin) }] });
  return { hash, file: `.dfc-runtime-upgrade/${hash}.json` };
}

test('unavailable explicit host project binding is contextual, never stale or guessed from cwd', async (t) => {
  const project = await fixture(t);
  for (const root of [undefined, '', '.', path.join(project.root, 'absent'), path.join(project.root, MCP_FILE)]) {
    const guard = await createSessionGuard(root, sourcePin);
    const result = denial(await guard(), 'PROJECT_CONTEXT_UNAVAILABLE', project.root);
    assert.match(result.nextAction, /CLAUDE_PROJECT_DIR.*absolute.*Claude Desktop.*Claude Code/);
    assert.doesNotMatch(result.nextAction, /dev-foundry-claude start/);
    assert.deepEqual(await guard(), result);
  }
});

test('failed initial bindings remain distinct, sanitized and fail closed', async (t) => {
  const cases = [
    ['missing POP', (p) => rm(path.join(p.root, POP_PATH))],
    ['corrupt POP', (p) => p.write(POP_PATH, 'PRIVATE_SECRET: [malformed')],
    ['missing MCP', (p) => rm(path.join(p.root, MCP_FILE))],
    ['corrupt MCP', (p) => p.write(MCP_FILE, '{PRIVATE_SECRET')],
    ['invalid pin', (p) => p.write(MCP_FILE, mcp('PRIVATE_SECRET'))],
    ['missing framework', (p) => edit(p, POP_PATH, (pop) => { pop.framework.selected_manifest = 'missing.yaml'; })],
    ['missing actor', (p) => edit(p, POP_PATH, (pop) => { pop.actor_bindings['implementation-executor'].profile = 'missing.yaml'; })],
    ['unsafe actor', (p) => edit(p, POP_PATH, (pop) => { pop.actor_bindings['implementation-executor'].profile = '../PRIVATE_SECRET.yaml'; })],
    ['missing bootstrap', (p) => edit(p, POP_PATH, (pop) => { pop.platform_bootstraps['claude-code'].path = 'missing.yaml'; })],
    ['symlink MCP', async (p) => {
      await p.write('pin-copy.json', mcp(sourcePin));
      await rm(path.join(p.root, MCP_FILE));
      await symlink('pin-copy.json', path.join(p.root, MCP_FILE));
    }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async (st) => {
    const project = await fixture(st);
    await mutate(project);
    const guard = await createSessionGuard(project.root, sourcePin);
    denial(await guard(), 'RUNTIME_BINDING_INVALID', project.root);
    assert.equal((await guard()).errorCode, 'RUNTIME_BINDING_INVALID');
  });
});

test('failed startup cannot silently bind later; a fresh instance checks the exact runtime pin', async (t) => {
  const project = await fixture(t);
  await project.write(MCP_FILE, mcp(targetPin));
  const failed = await createSessionGuard(project.root, sourcePin);
  denial(await failed(), 'RUNTIME_BINDING_INVALID', project.root);
  await project.write(MCP_FILE, mcp(sourcePin));
  denial(await failed(), 'RUNTIME_BINDING_INVALID', project.root);
  assert.equal(await (await createSessionGuard(project.root, sourcePin))(), null);
});

test('valid startup then protected runtime drift stales permanently and requires a fresh bound host session', async (t) => {
  for (const [name, file, mutate] of [
    ['pin', MCP_FILE, (data) => { data.mcpServers[MCP_SERVER_NAME].args[2] = targetPin; }],
    ['framework', POP_PATH, (data) => { data.framework.adopted_version = '2.3.1'; }],
    ['actor selection', POP_PATH, (data) => { data.actor_bindings['implementation-executor'].selection.eligibility_policy = 'successor'; }],
    ['actor profile', '.dev-foundry/releases/2.3.0/actor-profiles/implementation-executor-v2.yaml', (data) => { data.id = 'successor-executor'; }],
    ['bootstrap', '.dev-foundry/platform-bootstrap-claude-code.yaml', (data) => { data.artifact_version = 'successor'; }],
    ['protected route', INDEX_PATH, (data) => { data.bindings[0].id = 'successor-pop-route'; }],
  ]) await t.test(name, async (st) => {
    const project = await fixture(st);
    const original = await read(project, file);
    const guard = await createSessionGuard(project.root, sourcePin);
    assert.equal(await guard(), null);
    if (file === MCP_FILE) {
      const data = JSON.parse(original); mutate(data); await project.write(file, canonicalJson(data));
    } else await edit(project, file, mutate);
    const result = denial(await guard(), 'STALE_SESSION', project.root);
    assert.match(result.nextAction, /fresh Claude Desktop or Claude Code.*bound.*resolve current authority/);
    assert.doesNotMatch(result.nextAction, /dev-foundry-claude start/);
    await project.write(file, original);
    denial(await guard(), 'STALE_SESSION', project.root);
    assert.equal(await (await createSessionGuard(project.root, sourcePin))(), null);
  });
});

test('ordinary task, overview and index authoring leaves protected session identity unchanged', async (t) => {
  const project = await fixture(t);
  const guard = await createSessionGuard(project.root, sourcePin);
  assert.equal(await guard(), null);
  await project.write('docs/tasks/task.md', `${await read(project, 'docs/tasks/task.md')}\nOrdinary task progress.\n`);
  await project.write('docs/overview.md', '# Updated overview\n');
  await edit(project, INDEX_PATH, (index) => {
    index.artifact_version = 'ordinary-authoring';
    index.routes.push({ id: 'overview', path: 'docs/overview.md', authority_class: 'product', governs: ['purpose'], section_id: null });
  });
  assert.equal(await guard(), null);
  assert.equal(await (await createSessionGuard(project.root, sourcePin))(), null);
});

test('actual IN_PROGRESS, PREPARED and invalid upgrade journals require explicit recovery, including after valid startup', async (t) => {
  for (const phase of ['IN_PROGRESS', 'PREPARED', 'invalid']) await t.test(phase, async (st) => {
    const project = await fixture(st);
    const guard = await createSessionGuard(project.root, sourcePin);
    assert.equal(await guard(), null);
    const { file } = await beginUpgrade(project);
    if (phase === 'PREPARED') {
      const { journalSha256: _discard, ...body } = JSON.parse(await read(project, file));
      body.phase = phase;
      await project.write(file, canonicalJson({ ...body, journalSha256: sha256(canonicalJson(body)) }));
    } else if (phase === 'invalid') await project.write(file, '{PRIVATE_SECRET');
    assert.equal((await runtimeUpgradeState(project.root)).blocked, true);
    const before = await read(project, file);
    for (const check of [guard, await createSessionGuard(project.root, sourcePin)]) {
      const result = denial(await check(), 'RUNTIME_RECOVERY_REQUIRED', project.root);
      assert.match(result.nextAction, /upgrade status --root <project>.*Only after verifying.*upgrade recover --root <project> --plan-sha256 <verified-hash> --outcome source\|target/);
    }
    assert.equal(await read(project, file), before);
  });
});

test('verified target startup preserves journal marker and exact pin checking; source session becomes stale', async (t) => {
  const project = await fixture(t);
  const guard = await createSessionGuard(project.root, sourcePin);
  assert.equal(await guard(), null);
  const { hash, file } = await beginUpgrade(project);
  await project.write(MCP_FILE, mcp(targetPin));
  await finishRuntimeUpgrade({ root: project.root, planSha256: hash, outcome: 'target' });
  denial(await guard(), 'STALE_SESSION', project.root);
  denial(await (await createSessionGuard(project.root, sourcePin))(), 'RUNTIME_BINDING_INVALID', project.root);
  assert.notEqual(JSON.parse(await read(project, file)).targetSessionStarted, true);
  assert.equal(await (await createSessionGuard(project.root, targetPin))(), null);
  assert.equal(JSON.parse(await read(project, file)).targetSessionStarted, true);
  assert.equal(await (await createSessionGuard(project.root, targetPin))(), null);
});

test('unsafe state after binding returns its own blocker; correcting unchanged bytes does not invent drift', async (t) => {
  const project = await fixture(t);
  const guard = await createSessionGuard(project.root, sourcePin);
  assert.equal(await guard(), null);
  await project.write(MCP_FILE, '{PRIVATE_SECRET');
  denial(await guard(), 'RUNTIME_BINDING_INVALID', project.root);
  await project.write(MCP_FILE, mcp(sourcePin));
  assert.equal(await guard(), null);
});

test('blocked cutover has a specific diagnostic at startup and during an established session', async (t) => {
  const project = await fixture(t);
  const guard = await createSessionGuard(project.root, sourcePin);
  assert.equal(await guard(), null);
  await project.write('.dfc-cutover/intent.json', '{PRIVATE_SECRET');
  for (const check of [guard, await createSessionGuard(project.root, sourcePin)]) {
    const result = denial(await check(), 'CUTOVER_RECOVERY_REQUIRED', project.root);
    assert.match(result.nextAction, /cutover status --root <project> --json/);
  }
  assert.equal(await read(project, '.dfc-cutover/intent.json'), '{PRIVATE_SECRET');
});
