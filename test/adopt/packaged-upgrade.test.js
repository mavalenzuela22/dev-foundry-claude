import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { access, chmod, cp, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { RECONCILIATION_FILE, RECONCILIATION_KEY } from '../../src/adopt/common.js';
import { selfPin, sha256 } from '../../src/adopt/pin.js';
import { applyProposal, diffTrees, listTree, makeConsumer, readSetSnapshot, repoRoot } from './fixture.js';

const SOURCE_PIN = '1.4.2:sha256:1780711cd5661b40f7f0e1220146e87ae12f88c3bc9ba37de06f17fe69cbe79f';
// TSK-025-CLOSURE records these published bytes and the exact tag target.
const SOURCE_SHA = '3aa7542c41ce613c9c152e21c8e2d95d835dc00be1cb8f2e46302daa54cadaf3';
const SOURCE_COMMIT = '9b6340b051d32857e8b79589cd049fb81c0a196d';
const SOURCE_URL = 'https://github.com/mavalenzuela22/dev-foundry-claude/releases/download/v1.4.2/dev-foundry-claude-adapter-1.4.2.tgz';
const AGENT = '.claude/agents/dev-foundry-executor.md';
const CONFIGURED = [
  '.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml',
  '.dev-foundry/profiles/capability-profiles/governance-auditor-claude-code-v1.yaml',
  '.dev-foundry/platform-bootstrap-claude-code.yaml',
];
const KAFKA = ['src/kafka/consumer.js', 'src/kafka/new-event.js'];
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  !/^(?:npm_|DEV_FOUNDRY_|OTEL_|CLAUDE|NODE_OPTIONS$|NODE_PATH$|GIT_)/i.test(key)));
const outside = (root) => {
  const relative = path.relative(repoRoot, root);
  assert.ok(relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), root);
};

test('C013 real packaged advanced CLI upgrades exact 1.4.2 with explicit configured decisions and dirty Kafka work', { timeout: 240_000 }, async (t) => {
  const evidenceDir = process.env.DEV_FOUNDRY_TEST_EVIDENCE_DIR;
  if (evidenceDir) { outside(path.resolve(evidenceDir)); await mkdir(evidenceDir, { recursive: true }); }
  const scratch = await realpath(await mkdtemp(path.join(evidenceDir ?? os.tmpdir(), 'packaged-upgrade-')));
  outside(scratch);
  const evidence = { source: {}, target: {}, processes: [], outcomes: [], passed: false };
  t.after(async () => {
    await writeFile(path.join(scratch, 'evidence.json'), JSON.stringify(evidence, null, 2) + '\n');
    t.diagnostic(JSON.stringify({ ...evidence, processes: evidence.processes.map(({ stdout, stderr, ...item }) => item),
      evidence: evidenceDir ? path.join(scratch, 'evidence.json') : 'temporary artifacts removed after test' }));
    if (!evidenceDir) await rm(scratch, { recursive: true, force: true });
  });
  const scenario = (name, fn) => t.test(name, async () => {
    try { await fn(); } catch (error) { (evidence.failures ??= []).push({ name, message: error.message }); throw error; }
  });
  const run = (command, args, cwd = scratch, extra = {}) => {
    const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 90_000, maxBuffer: 16 * 1024 * 1024,
      env: { ...cleanEnv(), npm_config_cache: path.join(scratch, 'npm-cache'), npm_config_update_notifier: 'false', ...extra } });
    evidence.processes.push({ command, args, cwd, status: result.status, signal: result.signal, stdout: result.stdout, stderr: result.stderr });
    assert.ifError(result.error);
    return result;
  };
  const npmPack = async (tree) => {
    const args = ['pack', '--pack-destination', scratch, '--json'];
    if (process.platform !== 'win32') return run('npm', args, tree);
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    try {
      await access(npmCli);
    } catch (error) {
      throw new Error(`Windows npm CLI not found at the expected Node installation path: ${npmCli}`, { cause: error });
    }
    return run(process.execPath, [npmCli, ...args], tree);
  };
  const success = (result) => { assert.equal(result.status, 0, result.stderr || result.stdout); return result; };
  const cli = (pkg, args, env) => run(process.execPath, [path.join(pkg, 'bin/dev-foundry-claude.js'), ...args], scratch, env);
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  // Vite creates .vite-temp beside its dependencies. Copy these once outside the
  // producer too, so even transient config/build artifacts stay in scratch.
  const dashboardDependencies = path.join(scratch, 'dashboard-build/node_modules');
  await cp(path.join(repoRoot, 'tools/dashboard/node_modules'), dashboardDependencies, { recursive: true, verbatimSymlinks: true });
  const runtimeAvailabilityDir = path.join(scratch, 'runtime-availability');
  await mkdir(runtimeAvailabilityDir);
  if (process.platform === 'win32') {
    await writeFile(path.join(runtimeAvailabilityDir, 'claude.cmd'), '@echo off\r\nexit /b 0\r\n');
  } else {
    const executable = path.join(runtimeAvailabilityDir, 'claude');
    await writeFile(executable, `#!${process.execPath}\nprocess.exit(0);\n`);
    await chmod(executable, 0o755);
  }
  const runtimeAvailabilityEnv = { PATH: `${runtimeAvailabilityDir}${path.delimiter}${process.env.PATH ?? ''}` };

  // Same disposable build pattern as package.test.js. No generated manifest or
  // dashboard output is written in the producer, and no test payload is invented.
  async function pack(name, historical = false) {
    const tree = path.join(scratch, `${name}-tree`); await mkdir(tree);
    if (historical) {
      assert.equal(git('rev-parse', 'v1.4.2^{}'), SOURCE_COMMIT);
      const archive = execFileSync('git', ['archive', SOURCE_COMMIT], { cwd: repoRoot, maxBuffer: 100 * 1024 * 1024 });
      execFileSync('tar', ['-x', '-C', tree], { input: archive });
    } else {
      for (const entry of ['package.json', 'package-lock.json', 'README.md', 'bin', 'src', 'templates', 'framework', 'migrations', 'scripts/package']) {
        await cp(path.join(repoRoot, entry), path.join(tree, entry), { recursive: true });
      }
      await cp(path.join(repoRoot, 'tools/dashboard'), path.join(tree, 'tools/dashboard'), { recursive: true,
        filter: (source) => !['node_modules', 'dist'].includes(path.relative(path.join(repoRoot, 'tools/dashboard'), source).split(path.sep)[0]) });
    }
    await symlink(dashboardDependencies, path.join(tree, 'tools/dashboard/node_modules'), 'dir');
    await cp(path.join(repoRoot, 'node_modules'), path.join(tree, 'node_modules'), { recursive: true, verbatimSymlinks: true,
      filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}@modelcontextprotocol${path.sep}client`) });
    const info = JSON.parse(success(await npmPack(tree)).stdout)[0];
    return { tarball: path.join(scratch, info.filename), info };
  }
  async function unpack(tarball, name) {
    const root = path.join(scratch, name); await mkdir(root);
    const archiveName = path.basename(tarball);
    const archiveDirectory = path.dirname(tarball);
    const listing = success(run('tar', ['-tzf', archiveName], archiveDirectory)).stdout.split(/\r?\n/).filter((entry) => entry && !entry.endsWith('/'));
    assert.ok(listing.every((entry) => entry.startsWith('package/') && !entry.split('/').includes('..')));
    success(run('tar', ['-xzf', archiveName, '-C', name], archiveDirectory));
    const pkg = path.join(root, 'package');
    const bytes = await readFile(path.join(pkg, 'payload-manifest.json'));
    const manifest = JSON.parse(bytes);
    assert.deepEqual(listing.map((entry) => entry.slice(8)).filter((entry) => entry !== 'payload-manifest.json').sort(), manifest.files.map((entry) => entry.path).sort());
    assert.ok(manifest.files.some((entry) => entry.path.startsWith('node_modules/yaml/')));
    assert.ok(manifest.files.some((entry) => entry.path.startsWith('node_modules/@modelcontextprotocol/server/')));
    // selfPin verifies every shipped byte, dependency, manifest root and version.
    const pin = selfPin(pkg);
    assert.equal(pin.root, sha256(bytes));
    return { pkg, pin, manifestFiles: manifest.files.length, sha256: sha256(await readFile(tarball)), tarball };
  }

  // Prefer the immutable published archive. Offline reproduction is accepted only
  // with the exact canonical payload root; it is explicitly not a download claim.
  let sourceTarball = process.env.DEV_FOUNDRY_TEST_142_TARBALL;
  let provenance = 'provided published archive, verified against recorded transport SHA';
  if (!sourceTarball) {
    sourceTarball = path.join(scratch, 'published-1.4.2.tgz');
    const downloaded = run('curl', ['--fail', '--location', '--silent', '--show-error', '--connect-timeout', '5', '--max-time', '20', '--output', sourceTarball, SOURCE_URL]);
    if (downloaded.status === 0) provenance = 'downloaded published archive';
    else {
      evidence.source.acquisitionFailure = downloaded.stderr.trim();
      sourceTarball = (await pack('source', true)).tarball;
      provenance = 'local npm-pack reproduction from verified v1.4.2 tag; not downloaded published bytes';
    }
  }
  const source = await unpack(sourceTarball, 'source');
  assert.equal(source.pin.expect, SOURCE_PIN, 'never substitute a merely version-similar or synthetic source');
  assert.equal(source.sha256, SOURCE_SHA, 'canonical source archive must match the recorded published bytes too');
  evidence.source = { ...evidence.source, provenance, expect: source.pin.expect, tarball: source.tarball, sha256: source.sha256,
    publishedTransportMatch: source.sha256 === SOURCE_SHA, canonicalPayloadMatch: true };
  const built = await pack('target');
  const target = await unpack(built.tarball, 'target');
  evidence.target = { expect: target.pin.expect, tarball: target.tarball, sha256: target.sha256, manifestFiles: target.manifestFiles, published: false };
  assert.equal(target.pin.version, JSON.parse(await readFile(path.join(repoRoot, 'package.json'))).version);
  for (const file of ['bin/dev-foundry-claude.js', 'src/adopt/plan.js', 'src/adopt/upgrade.js', 'src/adopt/apply.js', 'src/adopt/common.js', 'src/consumer/command.js']) {
    assert.deepEqual(await readFile(path.join(target.pkg, file)), await readFile(path.join(repoRoot, file)));
  }
  await rm(path.join(scratch, 'target-tree'), { recursive: true, force: true }); // executable/deps must be shipped

  let sequence = 0;
  const artifact = (name) => path.join(scratch, `${++sequence}-${name}.json`);
  const plan = async (c, resolutionFile, expected = 'ready') => {
    const file = artifact('plan');
    const args = ['upgrade', 'plan', '--root', c.root, '--from-package', source.pkg, ...(resolutionFile ? ['--resolution-file', resolutionFile] : []), '--out', file];
    const result = cli(target.pkg, args);
    assert.equal(result.status, expected === 'blocked' ? 2 : 0, result.stderr || result.stdout);
    const returned = JSON.parse(result.stdout); const bytes = await readFile(file); const data = JSON.parse(bytes);
    assert.equal(returned.status, expected); assert.equal(returned.planSha256, sha256(bytes));
    assert.equal(data.current.expect, SOURCE_PIN); assert.equal(data.target.expect, target.pin.expect);
    return { file, hash: returned.planSha256, data, bytes };
  };
  const apply = (c, p, resolutionFile, env) => cli(target.pkg, ['upgrade', 'apply', '--root', c.root, '--plan', p.file, '--plan-sha256', p.hash,
    ...(resolutionFile ? ['--resolution-file', resolutionFile] : [])], { DEV_FOUNDRY_RUNTIME_STORE: path.join(scratch, 'runtime-store'), ...env });
  async function fixture(local = true) {
    const c = await makeConsumer(); t.after(c.cleanup); c.root = await realpath(c.root); outside(c.root);
    const file = artifact('source-adopt');
    const initial = JSON.parse(success(cli(source.pkg, ['adopt', 'plan', '--root', c.root, '--out', file])).stdout);
    success(cli(source.pkg, ['adopt', 'apply', '--root', c.root, '--plan', file, '--plan-sha256', initial.planSha256]));
    assert.equal(JSON.parse(await c.read('.mcp.json')).mcpServers['dev-foundry-governance'].args[2], SOURCE_PIN);
    // Explicit fixture-only authority activation of the old CLI's proposal.
    await applyProposal(c.root, JSON.parse(await readFile(file)).cutover_proposal);
    if (!local) { c.commit(); return { c }; }
    const contents = {};
    for (const configured of CONFIGURED) {
      contents[configured] = await c.read(configured) + '# Explicitly retained consumer formatting.\n';
      await c.put(configured, contents[configured]);
    }
    await c.put(KAFKA[0], 'export const pending = true;\n'); c.commit();
    const localAgent = (await c.read(AGENT)).replace(/^description: .*$/m, 'description: Preserve consumer Kafka delivery policy.');
    await c.put(AGENT, localAgent); // tracked, intentionally dirty
    contents[AGENT] = localAgent.replace('Preserve consumer Kafka delivery policy.', 'Execute the authorized change and preserve consumer Kafka delivery policy.');
    await c.put(KAFKA[0], Buffer.from('export const pending = "Kafka work in progress";\r\n'));
    await c.put(KAFKA[1], Buffer.from('// Untracked Kafka bytes\r\n\x00\xff', 'latin1'));
    const refused = await plan(c, undefined, 'blocked');
    const input = { format: 'dev-foundry.managed-resolution.v1', repository: { root: refused.data.repository.root, head: refused.data.repository.head },
      source: SOURCE_PIN, target: target.pin.expect, files: Object.entries(contents).map(([file, content]) => {
        const record = refused.data.reconciliation.find((item) => item.path === file);
        assert.equal(record?.classification, 'conflict', JSON.stringify(refused.data.blockers));
        return { path: file, before_sha256: record.before_sha256, base_sha256: record.base_sha256, current_sha256: record.current_sha256,
          target_sha256: record.target_sha256, resolved_sha256: sha256(content), resolved_content: content };
      }) };
    const resolutionFile = artifact('resolution'); await writeFile(resolutionFile, JSON.stringify(input));
    return { c, contents, input, resolutionFile };
  }
  let pinnedSourceConsumer;

  await scenario('packed global target dispatches to the exact 1.4.2 package before consumer selection changes', async () => {
    const { c } = await fixture(false);
    pinnedSourceConsumer = c.root;
    const runtimeStore = path.join(scratch, 'runtime-store');
    const sourceSlot = path.join(runtimeStore, `1.4.2--${source.pin.root}`);
    await mkdir(sourceSlot, { recursive: true });
    await cp(source.pkg, sourceSlot, { recursive: true });
    const before = await listTree(c.root);
    const result = success(cli(target.pkg, ['status', '--root', c.root, '--json'], {
      DEV_FOUNDRY_RUNTIME_STORE: runtimeStore,
      ...runtimeAvailabilityEnv,
    }));
    const status = JSON.parse(result.stdout);
    assert.equal(status.adapterVersion, '1.4.2');
    assert.equal(status.selectedAdapterVersion, '1.4.2');
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    evidence.outcomes.push({ case: 'global-target-first-source-runtime-dispatch', source: status.adapterVersion,
      targetGlobal: target.pin.version, consumerPin: status.selectedAdapterVersion, consumerWrites: 0 });
  });

  await scenario('independent maintenance upgrades a stale, not-ready source with a target-prepared bootstrap and modified profiles', async () => {
    const { c, contents, resolutionFile } = await fixture();
    const sessionModule = await import(pathToFileURL(path.join(source.pkg, 'src/governance-mcp/session.js')).href);
    const guard = await sessionModule.createSessionGuard(c.root, SOURCE_PIN);
    const profile = CONFIGURED[0];
    contents[profile] += '# B-case retained source executor decision.\n';
    await c.put(profile, contents[profile]);

    const pop = parse(await c.read('.dev-foundry/profiles/project-operating-profile.yaml'));
    const executor = parse(await c.read(pop.actor_bindings['implementation-executor'].profile));
    const auditor = parse(await c.read(pop.actor_bindings['governance-auditor'].profile));
    const renderer = await import(pathToFileURL(path.join(target.pkg, 'src/adopt/render.js')).href);
    const preparedBootstrap = renderer.renderBootstrap(renderer.templateParams({ project: pop.repository.name, prefix: 'ACME',
      executorProfileId: executor.id, auditorProfileId: auditor.id,
      authorProfile: pop.actor_bindings['governance-author'].profile,
      custodianProfile: pop.actor_bindings['evidence-custodian'].profile,
    }), path.join(target.pkg, 'templates'), { legacyV2: true })['.dev-foundry/platform-bootstrap-claude-code.yaml'] +
      '# B-case retained source bootstrap decision.\n';
    contents[CONFIGURED[2]] = preparedBootstrap;
    await c.put(CONFIGURED[2], preparedBootstrap);
    assert.equal((await guard())?.errorCode, 'STALE_SESSION');

    const runtimeStore = path.join(scratch, 'runtime-store');
    const runtime = await import(pathToFileURL(path.join(target.pkg, 'src/adopt/runtime.js')).href);
    await runtime.installRuntime({ packageRoot: source.pkg, expect: SOURCE_PIN, env: { DEV_FOUNDRY_RUNTIME_STORE: runtimeStore } });
    const sourceStatusResult = cli(target.pkg, ['status', '--root', c.root, '--json'], {
      DEV_FOUNDRY_RUNTIME_STORE: runtimeStore,
    });
    assert.equal(sourceStatusResult.status, 2, sourceStatusResult.stderr || sourceStatusResult.stdout);
    const sourceStatus = JSON.parse(sourceStatusResult.stdout);
    assert.equal(sourceStatus.adapterVersion, '1.4.2');
    assert.equal(sourceStatus.readyToWork, false);
    const blocked = await plan(c, undefined, 'blocked');
    const input = { format: 'dev-foundry.managed-resolution.v1',
      repository: { root: blocked.data.repository.root, head: blocked.data.repository.head },
      source: SOURCE_PIN, target: target.pin.expect,
      files: Object.entries(contents).map(([file, content]) => {
        const record = blocked.data.reconciliation.find((item) => item.path === file);
        assert.equal(record?.classification, 'conflict', file);
        return { path: file, before_sha256: record.before_sha256, base_sha256: record.base_sha256,
          current_sha256: record.current_sha256, target_sha256: record.target_sha256,
          resolved_sha256: sha256(content), resolved_content: content };
      }) };
    await writeFile(resolutionFile, JSON.stringify(input));
    const before = await listTree(c.root);
    const ready = await plan(c, resolutionFile);
    assert.equal(ready.data.status, 'ready');
    success(apply(c, ready, resolutionFile, { DEV_FOUNDRY_RUNTIME_STORE: runtimeStore }));
    assert.equal(JSON.parse(await c.read('.mcp.json')).mcpServers['dev-foundry-governance'].args[2], target.pin.expect);
    assert.equal(await c.read(CONFIGURED[2]), preparedBootstrap);
    const after = await listTree(c.root);
    for (const file of ['src/billing.js', 'src/kafka/consumer.js']) assert.equal(after.get(file), before.get(file));
    evidence.outcomes.push({ case: 'stale-not-ready-target-prepared-recovery', sourceReadyToWork: false,
      sourceSession: 'STALE_SESSION', targetPin: target.pin.expect, runtime: 'independent target maintenance CLI', noSourceRestore: true });
  });

  await scenario('independent packaged recovery restores source after a process dies mid-upgrade', async () => {
    const { c, resolutionFile } = await fixture();
    const ready = await plan(c, resolutionFile);
    const sessionModule = await import(pathToFileURL(path.join(target.pkg, 'src/governance-mcp/session.js')).href);
    const guard = await sessionModule.createSessionGuard(c.root, SOURCE_PIN);
    const upgradeUrl = pathToFileURL(path.join(target.pkg, 'src/adopt/upgrade.js')).href;
    const runtimeUrl = pathToFileURL(path.join(target.pkg, 'src/adopt/runtime.js')).href;
    const rootLiteral = JSON.stringify(c.root);
    const sourceLiteral = JSON.stringify(source.pkg);
    const targetLiteral = JSON.stringify({ version: target.pin.version, payloadRoot: target.pin.root, expect: target.pin.expect });
    const resolutionLiteral = JSON.stringify(resolutionFile);
    const driver = `
      import { writeFile } from 'node:fs/promises';
      import path from 'node:path';
      const { createUpgradePlan } = await import(${JSON.stringify(upgradeUrl)});
      const { beginRuntimeUpgrade } = await import(${JSON.stringify(runtimeUrl)});
      const root = ${rootLiteral};
      const sourcePackageRoot = ${sourceLiteral};
      const adapter = ${targetLiteral};
      const resolutionFile = ${resolutionLiteral};
      const result = await createUpgradePlan({ root, adapter, currentPackageRoot: sourcePackageRoot, resolutionFile });
      await beginRuntimeUpgrade({ root, planBytes: result.bytes, planSha256: result.hash, writes: result.ops.writes });
      const first = result.ops.writes.find((item) => item.path !== '.mcp.json');
      await writeFile(path.join(root, ...first.path.split('/')), first.content);
      process.stdout.write(result.hash);
      process.exit(0);
    `;
    const crashed = success(run(process.execPath, ['--input-type=module', '-e', driver], scratch,
      { DEV_FOUNDRY_RUNTIME_STORE: path.join(scratch, 'runtime-store') }));
    assert.equal(crashed.stdout.trim(), ready.hash);
    assert.equal((await guard())?.errorCode, 'STALE_SESSION');
    const recovered = success(cli(target.pkg, ['upgrade', 'recover', '--root', c.root, '--plan-sha256', ready.hash,
      '--outcome', 'source', '--from-package', source.pkg], { DEV_FOUNDRY_RUNTIME_STORE: path.join(scratch, 'runtime-store') }));
    assert.equal(JSON.parse(recovered.stdout).status, 'ROLLED_BACK');
    assert.equal(await c.read('.mcp.json').then((bytes) => JSON.parse(bytes).mcpServers['dev-foundry-governance'].args[2]), SOURCE_PIN);
    assert.equal((await guard())?.errorCode, 'STALE_SESSION');
    evidence.outcomes.push({ case: 'process-loss-mid-upgrade', planSha256: ready.hash, recovered: 'source', sourcePinPreserved: true,
      interruptedSessionRemainsStale: true, nextAction: 'start a fresh source session' });
  });

  await scenario('READY exact-plan apply preserves configured semantics and all unrelated bytes', async () => {
    const { c, contents, resolutionFile } = await fixture();
    const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
    const kafka = await Promise.all(KAFKA.map((file) => readFile(path.join(c.root, file))));
    const ready = await plan(c, resolutionFile);
    assert.deepEqual((await plan(c, resolutionFile)).bytes, ready.bytes);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    assert.equal(ready.data.reconciliation.filter((item) => item.classification === 'operator-resolved').length, 4);
    for (const configured of CONFIGURED) {
      const record = ready.data.reconciliation.find((item) => item.path === configured);
      assert.equal(record.scope, 'configured-file'); assert.equal(record.current_semantics_preserved, true);
      assert.equal(record.after_sha256, sha256(contents[configured])); assert.ok(ready.data.noop.includes(configured));
    }
    const applied = JSON.parse(success(apply(c, ready, resolutionFile)).stdout);
    const changed = [RECONCILIATION_FILE, '.mcp.json', 'CLAUDE.md', AGENT, '.claude/agents/dev-foundry-auditor.md'].sort();
    assert.deepEqual(applied, { written: changed.length, deleted: 0 });
    const transactionJournal = `.dfc-runtime-upgrade/${ready.hash}.json`;
    assert.deepEqual(diffTrees(before, await listTree(c.root)), [...changed, transactionJournal].sort());
    assert.deepEqual(await readSetSnapshot(c.root), authority);
    for (const [file, content] of Object.entries(contents)) {
      const after = await c.read(file); assert.equal(sha256(after), sha256(content));
      if (CONFIGURED.includes(file)) assert.deepEqual(parse(after), parse(content));
    }
    const runtime = JSON.parse(await c.read('.mcp.json')).mcpServers['dev-foundry-governance'];
    assert.equal(runtime.args[2], target.pin.expect); assert.equal(target.pin.expect.split(':')[0], target.pin.version);
    // The pin is read back via the shipped runtime too; this is not host launcher installation.
    assert.equal(success(cli(target.pkg, ['--version'])).stdout.trim(), target.pin.version);
    const observed = cli(target.pkg, ['upgrade', 'status', '--root', c.root]);
    const status = JSON.parse(observed.stdout);
    assert.equal(status.current.expect, target.pin.expect);
    assert.equal(status.target.expect, target.pin.expect);
    assert.equal(observed.status, 0); assert.equal(status.status, 'current');
    assert.deepEqual(status.blockers, []);
    const runtimeStore = path.join(scratch, 'runtime-store');
    const sourceConsumerStatus = JSON.parse(success(cli(target.pkg, ['status', '--root', pinnedSourceConsumer, '--json'], {
      DEV_FOUNDRY_RUNTIME_STORE: runtimeStore,
      ...runtimeAvailabilityEnv,
    })).stdout);
    assert.equal(sourceConsumerStatus.adapterVersion, '1.4.2');
    assert.equal(sourceConsumerStatus.selectedAdapterVersion, '1.4.2');
    const targetConsumerStatus = JSON.parse(success(cli(target.pkg, ['status', '--root', c.root, '--json'], {
      DEV_FOUNDRY_RUNTIME_STORE: runtimeStore,
      ...runtimeAvailabilityEnv,
    })).stdout);
    assert.equal(targetConsumerStatus.adapterVersion, target.pin.version);
    assert.equal(targetConsumerStatus.selectedAdapterVersion, target.pin.version);
    // Remove the transient decision. Every following observation starts a new
    // shipped process; neither the source package nor the decision is supplied.
    await rm(resolutionFile);
    const stubDir = path.join(scratch, 'runtime-stub'); await mkdir(stubDir);
    const marker = path.join(scratch, 'runtime-started.json');
    const stub = path.join(stubDir, 'claude');
    await writeFile(stub, `#!${process.execPath}
require('node:fs').writeFileSync(process.env.DFC_C014_RUNTIME_MARKER, JSON.stringify({ cwd: process.cwd(), args: process.argv.slice(2) }));
`);
    await chmod(stub, 0o755);
    const runtimeEnv = { ...runtimeAvailabilityEnv, PATH: `${stubDir}${path.delimiter}${runtimeAvailabilityEnv.PATH}`, DFC_C014_RUNTIME_MARKER: marker };
    const readOnlyBefore = await listTree(c.root);
    const readiness = JSON.parse(success(cli(target.pkg, ['status', '--root', c.root, '--json'], runtimeEnv)).stdout);
    assert.equal(readiness.readyToWork, true); assert.equal(readiness.integration, 'ready');
    assert.equal(readiness.framework, '2.1.0'); assert.deepEqual(readiness.diagnostics, []);
    assert.deepEqual(diffTrees(readOnlyBefore, await listTree(c.root)), []);
    // Exercise the packaged start command's real readiness gate in another
    // process. Only its post-gate launcher is replaced: this sandbox cannot
    // open the collector listener, and collector lifecycle is outside C014.
    const startModule = pathToFileURL(path.join(target.pkg, 'src/consumer/command.js')).href;
    const started = run(process.execPath, ['--input-type=module', '-e', `
import { consumerCommand } from ${JSON.stringify(startModule)};
import { spawnSync } from 'node:child_process';
process.exitCode = await consumerCommand({ command: 'start',
  argv: ${JSON.stringify(['--root', c.root, '--', 'C014-harmless-runtime'])}, packageRoot: ${JSON.stringify(target.pkg)},
  launcher: async ({ argv, projectRoot, env }) => spawnSync('claude', argv.slice(3), { cwd: projectRoot, env, stdio: 'inherit' }).status });
`], scratch, runtimeEnv);
    success(started); assert.match(started.stdout, /Starting Claude/);
    assert.deepEqual(JSON.parse(await readFile(marker)), { cwd: c.root, args: ['C014-harmless-runtime'] });
    await rm(marker);
    // Product commits and further dirty Kafka work do not grant or revoke a
    // receipt: only its exact configured/managed surface determines readiness.
    execFileSync('git', ['add', '--', 'src/billing.js'], { cwd: c.root });
    execFileSync('git', ['commit', '--allow-empty', '-m', 'Unrelated product commit'], { cwd: c.root });
    await c.put('src/billing.js', '// Further unrelated product work.\n');
    assert.equal(JSON.parse(success(cli(target.pkg, ['status', '--root', c.root, '--json'], runtimeEnv)).stdout).readyToWork, true);
    const originals = new Map();
    for (const file of [RECONCILIATION_FILE, '.mcp.json', AGENT, 'CLAUDE.md', ...CONFIGURED,
      '.dev-foundry/profiles/project-operating-profile.yaml', '.dev-foundry/authority-index.yaml',
      '.dev-foundry/releases/2.1.0/actor-profiles/implementation-executor-v2.yaml',
      '.dev-foundry/releases/2.1.0/authority-index.yaml', '.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml']) {
      originals.set(file, await readFile(path.join(c.root, file)));
    }
    const receipt = JSON.parse(originals.get(RECONCILIATION_FILE));
    assert.equal(receipt.source, SOURCE_PIN); assert.equal(receipt.target, target.pin.expect);
    assert.equal(receipt.previousPlanSha256, ready.data.reconciliationEvidence.previousPlanSha256);
    assert.equal(JSON.parse(originals.get('.mcp.json')).mcpServers['dev-foundry-governance'].env[RECONCILIATION_KEY], sha256(originals.get(RECONCILIATION_FILE)));
    for (const kind of ['missing receipt', 'edited receipt', 'forged after hash', 'missing commitment', 'stale pin',
      'agent content', 'agent identity', 'managed span', 'profile semantics', 'bootstrap semantics', 'bootstrap identity',
      'POP binding', 'index binding', 'role profile', 'framework index', 'framework manifest', 'receipt symlink',
      'agent symlink', 'configured symlink', 'extra agent', 'extra configured']) {
      let file;
      if (kind.includes('receipt') || kind === 'forged after hash') file = RECONCILIATION_FILE;
      if (kind === 'missing receipt') await rm(path.join(c.root, file));
      else if (kind === 'edited receipt') await c.put(file, originals.get(file).toString() + ' ');
      else if (kind === 'forged after hash') {
        const forged = structuredClone(receipt);
        const record = forged.files.find((item) => item.path === AGENT);
        await c.put(AGENT, contents[AGENT] + '\nUnapproved later instructions.\n');
        record.after_sha256 = sha256(await c.read(AGENT));
        forged.state.files[AGENT] = record.after_sha256;
        // A self-consistent edited receipt cannot replace the reviewed runtime
        // commitment, even when its own hashes match the malicious bytes.
        await c.put(file, JSON.stringify(forged, null, 2) + '\n');
      } else if (kind === 'missing commitment' || kind === 'stale pin') {
        file = '.mcp.json'; const changed = JSON.parse(originals.get(file));
        if (kind === 'missing commitment') delete changed.mcpServers['dev-foundry-governance'].env[RECONCILIATION_KEY];
        else changed.mcpServers['dev-foundry-governance'].args[2] = SOURCE_PIN;
        await c.put(file, JSON.stringify(changed));
      } else if (kind.endsWith('symlink')) {
        file = kind === 'receipt symlink' ? RECONCILIATION_FILE : kind === 'agent symlink' ? AGENT : CONFIGURED[0];
        const linked = artifact('symlink-target'); await writeFile(linked, originals.get(file));
        await rm(path.join(c.root, file)); await symlink(linked, path.join(c.root, file));
      } else if (kind.startsWith('extra')) {
        file = kind === 'extra agent' ? '.claude/agents/dev-foundry-extra.md' : '.dev-foundry/profiles/capability-profiles/extra.yaml';
        await c.put(file, 'Unapproved extra managed file.\n');
      } else {
        file = ({ 'agent content': AGENT, 'agent identity': AGENT, 'managed span': 'CLAUDE.md', 'profile semantics': CONFIGURED[0],
          'bootstrap semantics': CONFIGURED[2], 'bootstrap identity': CONFIGURED[2], 'POP binding': '.dev-foundry/profiles/project-operating-profile.yaml',
          'index binding': '.dev-foundry/authority-index.yaml', 'role profile': '.dev-foundry/releases/2.1.0/actor-profiles/implementation-executor-v2.yaml',
          'framework index': '.dev-foundry/releases/2.1.0/authority-index.yaml', 'framework manifest': '.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml' })[kind];
        const original = originals.get(file).toString();
        const modified = kind === 'agent identity' ? original.replace('name: dev-foundry-executor', 'name: impostor')
          : kind === 'bootstrap identity' ? original.replace('id: ACME-', 'id: OTHER-')
          : kind === 'managed span' ? original.replace('## DEV FOUNDRY Claude adapter', '## Unapproved managed instructions')
          : kind === 'profile semantics' ? original.replace('delegation_depth: 1', 'delegation_depth: 9')
          : kind === 'bootstrap semantics' ? original.replace('mode: governed-project-bindings', 'mode: fixed')
          : kind === 'POP binding' ? original.replace('identity: dev-foundry-executor', 'identity: impostor')
          : kind === 'index binding' ? original.replace('required: true', 'required: false')
          : original + '\n# Unapproved post-apply change.\n';
        assert.notEqual(modified, original); await c.put(file, modified);
      }
      const beforeRefusal = await listTree(c.root);
      const denied = cli(target.pkg, ['status', '--root', c.root, '--json'], runtimeEnv);
      assert.equal(denied.status, 2, kind); assert.equal(JSON.parse(denied.stdout).readyToWork, false, kind);
      assert.equal(cli(target.pkg, ['upgrade', 'status', '--root', c.root]).status, 2, kind);
      assert.equal(cli(target.pkg, ['start', '--root', c.root], runtimeEnv).status, 2, kind);
      assert.deepEqual(diffTrees(beforeRefusal, await listTree(c.root)), [], kind);
      await assert.rejects(readFile(marker), { code: 'ENOENT' });
      await rm(path.join(c.root, file), { force: true });
      if (originals.has(file)) await c.put(file, originals.get(file));
      if (kind === 'forged after hash') await c.put(AGENT, originals.get(AGENT));
      evidence.outcomes.push({ case: `post-apply ${kind}`, readyToWork: false, startStatus: 2, zeroWrites: true });
    }
    assert.equal(JSON.parse(success(cli(target.pkg, ['status', '--root', c.root, '--json'], runtimeEnv)).stdout).readyToWork, true);
    for (let i = 0; i < KAFKA.length; i++) assert.deepEqual(await readFile(path.join(c.root, KAFKA[i])), kafka[i]);
    const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: c.root, encoding: 'utf8' });
    assert.match(dirty, / M src\/kafka\/consumer.js/); assert.match(dirty, /\?\? src\/kafka\/new-event.js/);
    evidence.outcomes.push({ case: 'configured-dirty-upgrade', planSha256: ready.hash, applied, runtime, postApplyStatus: status, readiness, harmlessRuntimeExit: started.status, startProof: 'fresh packaged consumerCommand prelaunch; harmless runtime; collector launcher substituted',
      configured: Object.fromEntries(CONFIGURED.map((file) => [file, sha256(contents[file])])),
      kafka: Object.fromEntries(KAFKA.map((file, i) => [file, { sha256: sha256(kafka[i]), bytes: kafka[i].length, identical: true }])), changed });
  });

  for (const kind of ['omitted decision', 'malformed decision', 'unauthorized configured collision', 'dirty protected pin', 'stale consumer', 'forged plan', 'unselected apply decision']) {
    await scenario(`${kind} refuses with zero consumer writes`, async () => {
      const { c, input, resolutionFile } = await fixture();
      let selected = resolutionFile; let p;
      if (['stale consumer', 'forged plan', 'unselected apply decision'].includes(kind)) p = await plan(c, selected);
      if (['omitted decision', 'unselected apply decision'].includes(kind)) selected = undefined;
      if (kind === 'malformed decision') await writeFile(selected, '{broken');
      if (kind === 'unauthorized configured collision') {
        input.files = input.files.filter((item) => item.path !== CONFIGURED[1]); await writeFile(selected, JSON.stringify(input));
      }
      if (kind === 'dirty protected pin') await c.put('.mcp.json', await c.read('.mcp.json') + ' ');
      if (kind === 'stale consumer') await c.put(AGENT, await c.read(AGENT) + '\nPost-plan consumer change.\n');
      if (kind === 'forged plan') { p.data.guaranteed_untouched.push('forged'); p.bytes = Buffer.from(JSON.stringify(p.data)); p.hash = sha256(p.bytes); await writeFile(p.file, p.bytes); }
      const before = await listTree(c.root);
      if (!p) p = await plan(c, selected, 'blocked');
      const result = apply(c, p, selected); assert.equal(result.status, 1); assert.match(result.stderr, /plan-(?:not-ready|stale)/);
      if (kind === 'malformed decision') assert.ok(p.data.blockers.some((item) => item.code === 'upgrade-resolution-invalid'));
      if (kind === 'dirty protected pin') assert.ok(p.data.blockers.some((item) => item.code === 'dirty-working-tree'));
      assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
      evidence.outcomes.push({ case: kind, status: result.status, refusal: result.stderr.trim(), blockers: p.data.blockers, zeroWrites: true });
    });
  }

  await scenario('packaged apply rolls back an installed write, cleans staging and can recover by exact retry', async () => {
    const { c, resolutionFile } = await fixture(); const p = await plan(c, resolutionFile); const before = await listTree(c.root);
    const preload = path.join(scratch, 'fail-second-rename.cjs');
    // Fault only the OS write boundary, not the bin, planner or payload. The first
    // real rename succeeds, so byte restoration proves rollback after mutation.
    const marker = path.join(scratch, 'rename-fault.json');
    await writeFile(preload, `const fs = require('node:fs');
const promises = require('node:fs/promises');
const original = promises.rename; let count = 0;
promises.rename = async (...args) => {
  if (++count === 4) { fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({ installed: count - 3, failed: args })); throw new Error('C013 injected rename failure'); }
  return original(...args);
};
require('node:module').syncBuiltinESMExports();\n`);
    const failed = apply(c, p, resolutionFile, { NODE_OPTIONS: `--require=${preload}` });
    assert.equal(failed.status, 1); assert.match(failed.stderr, /apply-failed/);
    assert.equal(JSON.parse(await readFile(marker)).installed, 1);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), [`.dfc-runtime-upgrade/${p.hash}.json`],
      'rollback restores consumer bytes and retains only its durable recovery record');
    assert.deepEqual(JSON.parse(success(apply(c, p, resolutionFile)).stdout), { written: 5, deleted: 0 });
    assert.equal(JSON.parse(await c.read(`.dfc-runtime-upgrade/${p.hash}.json`)).phase, 'TARGET_VERIFIED');
    evidence.outcomes.push({ case: 'rollback/retry', failedStatus: failed.status, installedBeforeFailure: 1, restoredAllBytes: true, exactRetryStatus: 0 });
  });
  await scenario('clean exact legacy source still requires an explicit configured bootstrap decision', async () => {
    const { c } = await fixture(false); const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
    const p = await plan(c, undefined, 'blocked');
    assert.ok(p.data.blockers.some((item) => item.code === 'managed-reconciliation-unresolved' && item.message.startsWith(CONFIGURED[2])));
    const result = apply(c, p); assert.equal(result.status, 1); assert.match(result.stderr, /plan-not-ready/);
    assert.deepEqual(await readSetSnapshot(c.root), authority);
    assert.equal(JSON.parse(await c.read('.mcp.json')).mcpServers['dev-foundry-governance'].args[2], SOURCE_PIN);
    assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
    evidence.outcomes.push({ case: 'clean-no-resolution', planSha256: p.hash, applyStatus: result.status, blockers: p.data.blockers, zeroWrites: true });
  });
  assert.equal(selfPin(source.pkg).expect, SOURCE_PIN);
  assert.equal(selfPin(target.pkg).expect, target.pin.expect);
  evidence.passed = !evidence.failures?.length;
});
