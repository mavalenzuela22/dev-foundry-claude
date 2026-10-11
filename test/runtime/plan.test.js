import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { stringify } from 'yaml';
import { AGENT_PATHS, BOOTSTRAP_KEY, BOOTSTRAP_PATH, INDEX_PATH, MCP_FILE, POP_PATH, PROFILE_PATHS, ROLES, TARGETS } from '../../src/adopt/common.js';
import { renderBootstrap, renderProfiles, templateParams } from '../../src/adopt/render.js';
import { canonicalJson, sha256 } from '../../src/adopt/pin.js';
import { authoritySnapshot, buildRuntimePlan, repository } from '../../src/runtime/plan.js';
import { approvedFields } from '../../src/runtime/authorization.js';
import { installedRuntime, stageRuntime, promoteRuntime } from '../../src/runtime/store.js';
import { attestation, consumer, fakeRuntime, replaceSealed, scratch } from './identity.test.js';

const repo = fileURLToPath(new URL('../../', import.meta.url));
export function put(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), content);
}
export function gitCommit(root) {
  execFileSync('git', ['-C', root, 'add', '-A']);
  execFileSync('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'synthetic state', '--allow-empty']);
}
export function fixture(t, { ignore = true, rollbackSafe = true, audit = 'not-required', recipeChange = () => {}, targetAttestation } = {}) {
  const source = fakeRuntime(t), storeRoot = path.join(scratch(t), 'store');
  const recipe = { format: 'dev-foundry.runtime-migration.v1', targetVersion: '1.5.0', sources: [source.expect], frameworkVersion: '2.1.0',
    restartRequired: true, rollbackSafe, audit, paths: [
      { path: POP_PATH, owner: 'configured' }, { path: MCP_FILE, owner: 'pin' },
      { path: PROFILE_PATHS.executor, owner: 'configured' }, { path: AGENT_PATHS.executor, owner: 'managed' }],
    choices: [{ id: 'keep-project-authority', options: ['preserve'] }], gates: ['validation'] };
  recipeChange(recipe);
  const target = fakeRuntime(t, { version: '1.5.0', body: 'target', files: { 'migrations/runtime.json': canonicalJson(recipe) } });
  for (const runtime of [source, target]) {
    const staged = stageRuntime({ storeRoot, candidateRoot: runtime.root, permittedCandidateRoots: [runtime.root], expect: runtime.expect,
      attestation: runtime === target && targetAttestation ? targetAttestation(runtime.expect, source.expect) : attestation(runtime.expect, source.expect) });
    promoteRuntime(staged);
  }
  const a = consumer(t, source.expect), b = consumer(t, source.expect);
  const init = c => {
    cpSync(path.join(repo, '.dev-foundry/releases/2.1.0'), path.join(c.root, '.dev-foundry/releases/2.1.0'), { recursive: true });
    const profiles = { 'governance-author': 'governance-author-v3', 'implementation-executor': 'implementation-executor-v2',
      'governance-auditor': 'governance-auditor-v2', 'mechanical-validator': 'mechanical-validator-v2', 'evidence-custodian': 'evidence-custodian-v1' };
    const actorPath = role => `.dev-foundry/releases/2.1.0/actor-profiles/${profiles[role]}.yaml`;
    const pop = { schema_version: 'dev-foundry.project-operating-profile.v2', kind: 'project-operating-profile', status: 'active', artifact_version: 'source-fixture',
      repository: { name: 'Synthetic', authority_index: INDEX_PATH }, framework: { adopted_version: '2.1.0',
        selected_authority_index: '.dev-foundry/releases/2.1.0/authority-index.yaml', selected_manifest: '.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml', adoption_status: 'active' },
      operator: { identity: 'Synthetic Operator' }, policies: { default_role: 'governance-author', audit_triggers: audit === 'required' ? ['fixture-trigger'] : [] },
      actor_bindings: Object.fromEntries(ROLES.map(role => [role, { status: 'active', profile: actorPath(role),
        implementation: { kind: TARGETS[role].kind, identity: TARGETS[role].identity, platform: TARGETS[role].platform }, capability_profiles: TARGETS[role].capabilities }])),
      platform_bootstraps: { [BOOTSTRAP_KEY]: { path: BOOTSTRAP_PATH, status: 'active' } } };
    const index = { schema_version: 'dev-foundry.authority-index.v2', kind: 'authority-index', status: 'active', subject: { id: 'Synthetic', base_version: '2.1.0' },
      routes: [{ id: 'framework', path: pop.framework.selected_authority_index }],
      bindings: [BOOTSTRAP_PATH, ...Object.values(PROFILE_PATHS)].map((file, i) => ({ id: `binding-${i}`, path: file, required: true })) };
    const params = templateParams({ project: 'Synthetic', prefix: 'SYN', executorProfileId: profiles['implementation-executor'], auditorProfileId: profiles['governance-auditor'],
      authorProfile: actorPath('governance-author'), custodianProfile: actorPath('evidence-custodian') });
    for (const [file, bytes] of Object.entries({ ...renderProfiles(params), ...renderBootstrap(params), [POP_PATH]: canonicalJson(pop), [INDEX_PATH]: canonicalJson(index),
      'src/product.txt': 'consumer product must remain identical', '.dev-foundry/validations/b2.json': '{"synthetic":true,"status":"PASS"}\n',
      '.dev-foundry/validations/audit.json': canonicalJson({ synthetic: true, audit: audit === 'required' ? 'PASS' : 'not-required', reason: 'synthetic declared authority assessment, not independent product audit' }),
      ...(ignore ? { '.gitignore': '/.dfc-runtime-upgrade/\n' } : {}) })) put(c.root, file, bytes);
    gitCommit(c.root);
    return pop;
  };
  const pop = init(a); init(b);
  const authority = authoritySnapshot(a.root), identity = repository(a.root);
  const afterConfig = structuredClone(a.config); afterConfig.mcpServers['dev-foundry-governance'].args[2] = target.expect;
  const afterPop = { ...pop, artifact_version: 'target-fixture' };
  const proposed = { [POP_PATH]: canonicalJson(afterPop), [MCP_FILE]: canonicalJson(afterConfig), [AGENT_PATHS.executor]: 'target managed fixture agent\n' };
  const candidate = { root: a.root, storeRoot, sourcePin: source.expect, targetPin: target.expect, branch: identity.branch, head: identity.head,
    framework: pop.framework, proposal: { kind: 'source-governed-claude', sourcePin: source.expect, sourceAuthority: authority.fingerprint,
      sourceSessionId: 'source-session-fixture', evidence: 'synthetic caller declaration; not actual Claude model evidence' },
    files: Object.entries(proposed).map(([file, after]) => ({ path: file, owner: recipe.paths.find(p => p.path === file).owner,
      beforeSha256: existsSync(path.join(a.root, file)) ? sha256(readFileSync(path.join(a.root, file))) : 'absent', afterSha256: sha256(after), after })),
    choices: [{ id: 'keep-project-authority', value: 'preserve' }], gates: [
      { id: 'validation', path: '.dev-foundry/validations/b2.json', sha256: sha256(readFileSync(path.join(a.root, '.dev-foundry/validations/b2.json'))) },
      { id: audit === 'required' ? 'audit' : 'audit-disposition', path: '.dev-foundry/validations/audit.json', sha256: sha256(readFileSync(path.join(a.root, '.dev-foundry/validations/audit.json'))) }] };
  const result = buildRuntimePlan(candidate);
  const approval = { format: 'dev-foundry.runtime-approval.v1', operator: result.plan.operator, sourceAuthorized: true, operatorApproved: true,
    phases: ['prepare', 'commit'], expiresAt: Date.now() + 3600000, bound: approvedFields(result.plan, result.hash) };
  const input = { root: a.root, planBytes: result.bytes, planSha256: result.hash, owner: 'fixture-runner', approval,
    evidence: result.plan.gates.map(g => ({ id: g.id, sha256: g.sha256, status: 'PASS' })) };
  const session = { id: 'fresh-target-session-fixture', pin: target.expect, planSha256: result.hash,
    authority: result.plan.targetAuthority, independent: true, evidence: 'synthetic fresh observer declaration; host/model proof deferred' };
  const recovery = outcome => ({ outcome, planSha256: result.hash, operatorApproved: true, reason: 'explicit synthetic recovery' });
  return { a, b, source, target, candidate, result, input, session, recovery, storeRoot };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  test('canonical read-only plan binds exact packages, actual framework bytes and synthetic caller provenance', t => {
    const f = fixture(t);
    assert.equal(buildRuntimePlan(f.candidate).hash, f.result.hash);
    assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
    assert.equal(execFileSync('git', ['-C', f.a.root, 'status', '--porcelain']).toString(), '');
    assert.equal(f.result.plan.provenance.target.provenance.trust.kind, 'independent-digest');
  });
  test('candidate refuses unknown paths, fake choices, absent proposal, wrong framework/HEAD and ownership hashes', t => {
    const f = fixture(t);
    for (const mutate of [c => { c.files[0].path = 'src/product.txt'; }, c => { c.files[0].path = '../escape'; }, c => { c.files[0].owner = 'pin'; },
      c => { c.choices[0].value = 'infer'; }, c => { c.choices.push(c.choices[0]); }, c => { delete c.proposal; },
      c => { c.framework.adopted_version = '2.2.0'; }, c => { c.head = '0'.repeat(40); }, c => { c.files[0].beforeSha256 = '0'.repeat(64); },
      c => { c.files[0].afterSha256 = '0'.repeat(64); }, c => { c.gates = []; }]) {
      const candidate = structuredClone(f.candidate); mutate(candidate); assert.throws(() => buildRuntimePlan(candidate));
    }
    const changed = structuredClone(f.candidate); const config = JSON.parse(changed.files.find(x => x.path === MCP_FILE).after);
    config.mcpServers.evil = { command: 'evil' }; const file = changed.files.find(x => x.path === MCP_FILE);
    file.after = canonicalJson(config); file.afterSha256 = sha256(file.after); assert.throws(() => buildRuntimePlan(changed), /config-collision/);
    const yaml = structuredClone(f.candidate), mcp = yaml.files.find(x => x.path === MCP_FILE);
    mcp.after = stringify(JSON.parse(mcp.after)); mcp.afterSha256 = sha256(mcp.after);
    assert.throws(() => buildRuntimePlan(yaml), /config-invalid-json/);
  });
  test('dirty touched path, source authority drift, missing provenance, foreign cutover and symlink fail closed', t => {
    const f = fixture(t), mcp = path.join(f.a.root, MCP_FILE), before = readFileSync(mcp);
    writeFileSync(mcp, Buffer.concat([before, Buffer.from('\n')])); assert.throws(() => buildRuntimePlan(f.candidate)); writeFileSync(mcp, before);
    put(f.a.root, '.dfc-cutover/intent.json', '{}'); assert.throws(() => buildRuntimePlan(f.candidate), /existing-transaction/); rmSync(path.join(f.a.root, '.dfc-cutover'), { recursive: true });
    rmSync(mcp); symlinkSync(path.join(f.b.root, MCP_FILE), mcp); assert.throws(() => buildRuntimePlan(f.candidate)); rmSync(mcp); writeFileSync(mcp, before);
    const bad = { ...f.candidate, targetPin: f.source.expect }; assert.throws(() => buildRuntimePlan(bad));
    put(f.a.root, PROFILE_PATHS.executor, 'not authority'); assert.throws(() => buildRuntimePlan(f.candidate));
  });
  test('installed target with absent provenance, mutated recipe, unsupported source or different framework cannot be a migration candidate', t => {
    assert.throws(() => fixture(t, { recipeChange: r => { r.sources = ['unsupported']; } }), /unsupported-recipe/);
    assert.throws(() => fixture(t, { recipeChange: r => { r.frameworkVersion = '2.2.0'; } }), /unsupported-recipe/);
    assert.throws(() => fixture(t, { targetAttestation: (target, source) => attestation(target, target) }), /unsupported-transition/);
    assert.throws(() => fixture(t, { recipeChange: r => { r.paths.push({ path: '.dev-foundry/releases/2.1.0/authority-index.yaml', owner: 'configured' }); } }), /unknown-owned-path/);
    const f = fixture(t), installed = installedRuntime(f.storeRoot, f.target.expect);
    const holder = path.dirname(installed.packageRoot), stage = path.join(holder, 'stage.json');
    const original = readFileSync(stage), record = JSON.parse(original); delete record.attestation.provenance;
    const changed = canonicalJson(record); replaceSealed(stage, changed);
    replaceSealed(path.join(holder, 'ready.json'), canonicalJson({ expect: f.target.expect, recordSha256: sha256(changed) }));
    assert.throws(() => buildRuntimePlan(f.candidate), /acquisition-blocked/);
    replaceSealed(stage, original); replaceSealed(path.join(holder, 'ready.json'), canonicalJson({ expect: f.target.expect, recordSha256: sha256(original) }));
    replaceSealed(path.join(installed.packageRoot, 'migrations/runtime.json'), '{}');
    assert.throws(() => buildRuntimePlan(f.candidate));
  });
}
