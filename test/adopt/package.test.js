import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { MANIFEST_NAME, formatExpect, rootOf, verifyPayload } from '../../src/adopt/pin.js';
import { diffTrees, listTree, makeConsumer, repoRoot, applyProposal } from './fixture.js';

const scratchDirs = [];
const scratch = async (prefix) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  scratchDirs.push(dir);
  return dir;
};
after(async () => { for (const dir of scratchDirs) await rm(dir, { recursive: true, force: true }); });

const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:npm_|DEV_FOUNDRY_|OTEL_|CLAUDE)/i.test(key)));
const npm = (args, cwd, env = {}) => execFileSync('npm', args, { cwd, encoding: 'utf8', env: { ...cleanEnv(), ...env, npm_config_update_notifier: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });

// Builds a tarball from a copy of the tracked package inputs plus the prod node_modules.
async function build(mutate) {
  const tree = await scratch('build-tree');
  for (const entry of ['package.json', 'package-lock.json', 'README.md', 'bin', 'src', 'templates', 'scripts/package']) {
    await cp(path.join(repoRoot, entry), path.join(tree, entry), { recursive: true });
  }
  await cp(path.join(repoRoot, 'node_modules'), path.join(tree, 'node_modules'), {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}@modelcontextprotocol${path.sep}client`),
  });
  await writeFile(path.join(tree, 'LICENSE'), 'Test license text.\n');
  if (mutate) await mutate(tree);
  const destination = await scratch('tarball');
  const output = npm(['pack', '--pack-destination', destination, '--json'], tree);
  const info = JSON.parse(output)[0];
  const tarball = path.join(destination, info.filename);
  return { tree, tarball, info };
}
const manifestOf = (tarball) => execFileSync('tar', ['-xOzf', tarball, `package/${MANIFEST_NAME}`], { maxBuffer: 64 * 1024 * 1024 });
async function extract(tarball) {
  const dir = await scratch('unpacked');
  execFileSync('tar', ['-xzf', tarball, '-C', dir]);
  return path.join(dir, 'package');
}
const checkTarball = (tarball) => execFileSync(process.execPath, [path.join(repoRoot, 'scripts/package/payload-manifest.mjs'), '--check', tarball], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function regularFiles(packageRoot) {
  const files = [];
  const links = [];
  const walk = async (directory, relative) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const stat = await lstat(path.join(directory, entry.name));
      if (stat.isSymbolicLink()) links.push(rel);
      else if (stat.isDirectory()) await walk(path.join(directory, entry.name), rel);
      else files.push(rel);
    }
  };
  await walk(packageRoot, '');
  return { files: files.sort(), links };
}

let baselinePromise;
function baseline() {
  baselinePromise ??= (async () => {
    const built = await build();
    const manifestBytes = manifestOf(built.tarball);
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    const pin = formatExpect(manifest.version, rootOf(manifestBytes));
    const prefix = await scratch('install-prefix');
    await writeFile(path.join(prefix, 'package.json'), '{"name":"consumer-host","version":"1.0.0","private":true}\n');
    npm(['install', '--prefix', prefix, '--offline', '--no-audit', '--no-fund', '--ignore-scripts', built.tarball], prefix, { npm_config_registry: 'http://127.0.0.1:9/' });
    const installed = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
    return { ...built, manifest, manifestBytes, pin, prefix, installed };
  })();
  return baselinePromise;
}

test('16 the manifest is complete and exact for the tarball and the offline install; package-lock.json is not payload', async (t) => {
  const base = await baseline();
  const checked = checkTarball(base.tarball);
  assert.equal(checked, '');
  const shipped = base.info.files.map((file) => file.path).sort();
  assert.ok(shipped.includes('package.json') && shipped.includes('README.md') && shipped.includes('LICENSE'));
  assert.ok(shipped.some((file) => file.startsWith('node_modules/yaml/')) && shipped.some((file) => file.startsWith('node_modules/zod/')));
  assert.ok(!shipped.includes('package-lock.json'));
  assert.ok(!base.manifest.files.some((entry) => entry.path === 'package-lock.json' || entry.path === MANIFEST_NAME));
  assert.deepEqual(shipped.filter((file) => file !== MANIFEST_NAME), base.manifest.files.map((entry) => entry.path));
  assert.equal(base.manifest.version, JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8')).version);
  const { files, links } = await regularFiles(base.installed);
  assert.deepEqual(files.filter((file) => file !== MANIFEST_NAME), base.manifest.files.map((entry) => entry.path));
  assert.ok(links.every((link) => /(?:^|\/)node_modules\/\.bin\//.test(link)), links.join(','));
  assert.ok(!files.includes('package-lock.json'));
  const started = performance.now();
  verifyPayload(base.installed, base.pin);
  const elapsed = performance.now() - started;
  t.diagnostic(`payload verification: ${elapsed.toFixed(1)} ms for ${files.length} files (${base.manifest.files.reduce((sum, entry) => sum + entry.size, 0)} bytes)`);
  assert.ok(elapsed < 5000);
  // Two builds of the same tree give identical manifest bytes and root.
  const again = await build();
  assert.ok(manifestOf(again.tarball).equals(base.manifestBytes));
  assert.equal(rootOf(manifestOf(again.tarball)), rootOf(base.manifestBytes));
});

test('16 the build fails when a bundled dependency does not match the lock', async () => {
  await assert.rejects(build(async (tree) => {
    const file = path.join(tree, 'node_modules/yaml/package.json');
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    parsed.version = '2.9.0';
    await writeFile(file, JSON.stringify(parsed));
  }), (error) => /does not match the lock/.test(`${error.stderr}${error.message}`));
});

test('15 same-version builds that differ in one byte have different manifests and roots, and pins reject each other', async () => {
  const base = await baseline();
  const bundled = base.manifest.files.find((entry) => /^node_modules\/yaml\/.*\.js$/.test(entry.path)).path;
  const template = 'templates/mcp-entry.json.tmpl';
  const variants = { 'bundled dependency': bundled, template, README: 'README.md', LICENSE: 'LICENSE' };
  for (const [name, relative] of Object.entries(variants)) {
    const other = await build(async (tree) => { await writeFile(path.join(tree, relative), Buffer.concat([await readFile(path.join(tree, relative)), Buffer.from(' ')])); });
    const otherManifest = manifestOf(other.tarball);
    assert.equal(JSON.parse(otherManifest.toString('utf8')).version, base.manifest.version, name);
    assert.ok(!otherManifest.equals(base.manifestBytes), name);
    assert.notEqual(rootOf(otherManifest), rootOf(base.manifestBytes), name);
    const unpacked = await extract(other.tarball);
    assert.throws(() => verifyPayload(unpacked, base.pin), /verification failed/, name);
    assert.doesNotThrow(() => verifyPayload(unpacked, formatExpect(base.manifest.version, rootOf(otherManifest))), name);
  }
});

async function copyInstalled(base) {
  const dir = await scratch('tamper');
  await cp(base.installed, dir, { recursive: true, verbatimSymlinks: true });
  return dir;
}
const bump = async (file) => writeFile(file, Buffer.concat([await readFile(file), Buffer.from(' ')]));
function tampers(base) {
  const bundled = base.manifest.files.find((entry) => /^node_modules\/yaml\/.*\.js$/.test(entry.path)).path;
  return {
    'changed adapter file': (dir) => bump(path.join(dir, 'src/adopt/plan.js')),
    'changed template': (dir) => bump(path.join(dir, 'templates/agents/dev-foundry-executor.md.tmpl')),
    'changed package.json': async (dir) => { const file = path.join(dir, 'package.json'); await writeFile(file, `${await readFile(file, 'utf8')}\n`); },
    'changed README': (dir) => bump(path.join(dir, 'README.md')),
    'changed LICENSE': (dir) => bump(path.join(dir, 'LICENSE')),
    'one byte in a bundled dependency': (dir) => bump(path.join(dir, bundled)),
    'deleted payload file': (dir) => rm(path.join(dir, 'templates/mcp-entry.json.tmpl')),
    'unlisted file in the package': (dir) => writeFile(path.join(dir, 'src/extra.js'), 'x'),
    'unlisted file in a bundled dependency': (dir) => writeFile(path.join(dir, 'node_modules/yaml/extra.txt'), 'x'),
    'symlink outside .bin': (dir) => symlink('../README.md', path.join(dir, 'src/link')),
    'changed manifest': (dir) => bump(path.join(dir, MANIFEST_NAME)),
    'missing manifest': (dir) => rm(path.join(dir, MANIFEST_NAME)),
  };
}

test('14 the only tolerated difference is a link under node_modules/.bin/', async () => {
  const base = await baseline();
  const dir = await copyInstalled(base);
  await mkdir(path.join(dir, 'node_modules/.bin'), { recursive: true });
  await rm(path.join(dir, 'node_modules/.bin/yaml'), { force: true });
  await symlink('../yaml/bin.mjs', path.join(dir, 'node_modules/.bin/yaml'));
  await symlink('../nothing', path.join(dir, 'node_modules/.bin/added'));
  assert.doesNotThrow(() => verifyPayload(dir, base.pin));
  await rm(path.join(dir, 'node_modules/.bin/yaml'), { force: true });
  await symlink('../zod', path.join(dir, 'node_modules/.bin/added2'));
  assert.doesNotThrow(() => verifyPayload(dir, base.pin));
  await writeFile(path.join(dir, 'node_modules/.bin/regular'), 'x');
  assert.throws(() => verifyPayload(dir, base.pin), /verification failed/);
});

test('14 every tamper, a mismatched version, and a bad --expect exit non-zero before serving', async (t) => {
  const base = await baseline();
  const [version, , root] = base.pin.split(':');
  const exitsEarly = (dir, args) => {
    const result = spawnSync(process.execPath, [path.join(dir, 'bin/dev-foundry-claude.js'), ...args], { encoding: 'utf8', timeout: 20000, input: '', env: { ...cleanEnv(), CLAUDE_PROJECT_DIR: os.tmpdir() } });
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Adapter runtime verification failed\./);
  };
  const clean = await copyInstalled(base);
  for (const [name, tamper] of Object.entries(tampers(base))) {
    const dir = await copyInstalled(base);
    await tamper(dir);
    exitsEarly(dir, ['mcp', '--expect', base.pin]);
    t.diagnostic(`rejected: ${name}`);
  }
  exitsEarly(clean, ['mcp', '--expect', `9.9.9:sha256:${root}`]);
  exitsEarly(clean, ['mcp', '--expect', `${version}:sha256:${'0'.repeat(64)}`]);
  exitsEarly(clean, ['mcp']);
  exitsEarly(clean, ['mcp', '--expect']);
  exitsEarly(clean, ['mcp', '--expect', 'garbage']);
  exitsEarly(clean, ['mcp', '--expect', base.pin, 'extra']);
});

const cliEnv = (extra = {}) => ({ ...cleanEnv(), GIT_CONFIG_GLOBAL: '/dev/null', ...extra });
const cli = (dir, args, options = {}) => spawnSync(process.execPath, [path.join(dir, 'bin/dev-foundry-claude.js'), ...args], { encoding: 'utf8', timeout: 60000, env: cliEnv(options.env), cwd: options.cwd ?? os.tmpdir() });
async function adoptThroughInstalledCli(base, consumer) {
  const planFile = path.join(await scratch('plan'), 'plan.json');
  const planned = cli(base.installed, ['adopt', 'plan', '--root', consumer.root, '--out', planFile]);
  assert.equal(planned.status, 0, planned.stderr);
  const summary = JSON.parse(planned.stdout);
  assert.equal(summary.status, 'ready');
  const applied = cli(base.installed, ['adopt', 'apply', '--root', consumer.root, '--plan', planFile, '--plan-sha256', summary.planSha256]);
  assert.equal(applied.status, 0, applied.stderr);
  consumer.commit();
  return JSON.parse(await readFile(planFile, 'utf8'));
}
async function connect(t, command, args, projectRoot) {
  const client = new Client({ name: 'package-test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command, args, env: { CLAUDE_PROJECT_DIR: projectRoot }, cwd: os.tmpdir() }));
  t.after(() => client.close());
  return async (args2) => JSON.parse((await client.callTool({ name: 'resolve_governed_operation', arguments: args2 })).content[0].text);
}

test('7 14 19 the installed package adopts a consumer, serves prepared-then-active, and runs from the temp prefix', async (t) => {
  const base = await baseline();
  assert.ok((await realpath(base.installed)).startsWith(await realpath(base.prefix)));
  assert.equal(cli(base.installed, ['--version']).stdout.trim(), base.manifest.version);
  const consumer = await makeConsumer();
  t.after(() => consumer.cleanup());
  const plan = await adoptThroughInstalledCli(base, consumer);
  assert.equal(plan.adapter.expect, base.pin);
  const entry = JSON.parse(await consumer.read('.mcp.json')).mcpServers['dev-foundry-governance'];
  assert.deepEqual(entry, { type: 'stdio', command: 'dev-foundry-claude', args: ['mcp', '--expect', base.pin] });
  const status = JSON.parse(cli(base.installed, ['adopt', 'status', '--root', consumer.root]).stdout);
  assert.equal(status.overall, 'prepared');
  assert.deepEqual(Object.values(status.roles), Array(5).fill('foreign-active'));
  const binLink = path.join(base.prefix, 'node_modules/.bin/dev-foundry-claude');
  const call = await connect(t, process.execPath, [await realpath(binLink), ...entry.args], consumer.root);
  const roleRequests = [
    { requestedAction: 'author', boundaryId: 'B-1' }, { requestedAction: 'implement', taskId: 'TSK-001' }, { requestedAction: 'audit', boundaryId: 'B-1' },
    { requestedAction: 'validate', boundaryId: 'B-1' }, { requestedAction: 'close', boundaryId: 'B-1' },
  ];
  for (const request of roleRequests) assert.equal((await call({ targetProject: 'acme-billing', ...request })).errorCode, 'BINDING_INACTIVE');
  // Consumer-governed cutover: the guard re-evaluates on every call.
  await applyProposal(consumer.root, plan.cutover_proposal);
  for (const request of roleRequests) {
    const result = await call({ targetProject: 'acme-billing', ...request });
    assert.equal(result.ok, true, JSON.stringify(result));
  }
  assert.equal((await call({ targetProject: 'dev-foundry-claude', ...roleRequests[0] })).errorCode, 'TARGET_MISMATCH');
  assert.equal(JSON.parse(cli(base.installed, ['adopt', 'status', '--root', consumer.root]).stdout).overall, 'active');
  // The installed adapter refuses to plan when it fails self-verification.
  const broken = await copyInstalled(base);
  await bump(path.join(broken, 'src/adopt/render.js'));
  const refused = cli(broken, ['adopt', 'plan', '--root', consumer.root]);
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /verification failed/);
});

test('14 20 run rejects every tamper before any collector or child starts and launches only after verification', async (t) => {
  const base = await baseline();
  const consumer = await makeConsumer();
  t.after(() => consumer.cleanup());
  await adoptThroughInstalledCli(base, consumer);
  const stubDir = await scratch('stub');
  const marker = path.join(stubDir, 'marker.txt');
  const stub = path.join(stubDir, 'claude');
  await writeFile(stub, '#!/bin/sh\n{ env | grep -E "^(OTEL_|CLAUDE_CODE_|ENABLE_|DEV_FOUNDRY_)" | sort; echo "CWD:$(pwd)"; echo "ARGS:$*"; } > "$MARKER_FILE"\n');
  await chmod(stub, 0o755);
  const env = { PATH: `${stubDir}:${path.dirname(process.execPath)}:/usr/bin:/bin`, MARKER_FILE: marker };
  const before = await listTree(consumer.root);

  for (const [name, tamper] of Object.entries(tampers(base))) {
    const dir = await copyInstalled(base);
    await tamper(dir);
    const result = cli(dir, ['run', 'direct', '--', 'x'], { cwd: consumer.root, env });
    assert.notEqual(result.status, 0, name);
    assert.match(result.stderr, /verification failed/, name);
    await assert.rejects(readFile(marker), /ENOENT/, name);
    await assert.rejects(lstat(path.join(consumer.root, '.dev-foundry/telemetry')), /ENOENT/, name);
  }
  // A pin that differs from the installed build is also rejected before launch.
  const consumerPin = await consumer.read('.mcp.json');
  await consumer.put('.mcp.json', consumerPin.replace(base.pin, `${base.pin.slice(0, -1)}${base.pin.endsWith('0') ? '1' : '0'}`));
  assert.notEqual(cli(base.installed, ['run', 'direct', '--', 'x'], { cwd: consumer.root, env }).status, 0);
  await assert.rejects(readFile(marker), /ENOENT/);
  await consumer.put('.mcp.json', consumerPin);

  const run = cli(base.installed, ['run', 'direct', '--', '--probe', 'a b', '--', '--help'], { cwd: consumer.root, env });
  assert.equal(run.status, 0, `${run.stderr}|${run.stdout}`);
  const recorded = Object.fromEntries((await readFile(marker, 'utf8')).trim().split('\n').map((line) => {
    const cut = /^(?:CWD|ARGS):/.test(line) ? line.indexOf(':') : line.indexOf('=');
    return [line.slice(0, cut), line.slice(cut + 1)];
  }));
  assert.match(recorded.OTEL_EXPORTER_OTLP_ENDPOINT, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal(recorded.CLAUDE_CODE_ENABLE_TELEMETRY, '1');
  for (const flag of ['OTEL_LOG_USER_PROMPTS', 'OTEL_LOG_ASSISTANT_RESPONSES', 'OTEL_LOG_TOOL_DETAILS', 'OTEL_LOG_TOOL_CONTENT', 'OTEL_LOG_RAW_API_BODIES']) assert.equal(recorded[flag], '0', flag);
  assert.equal(recorded.OTEL_METRICS_INCLUDE_ACCOUNT_UUID, 'false');
  assert.ok(!Object.keys(recorded).some((key) => /ENDPOINT/.test(key) && key !== 'OTEL_EXPORTER_OTLP_ENDPOINT'));
  assert.equal(await realpath(recorded.CWD), await realpath(consumer.root));
  assert.equal(recorded.ARGS, '--probe a b -- --help');
  assert.equal(recorded.DEV_FOUNDRY_CLAUDE_LAUNCH_MODE, 'direct');
  assert.equal(await realpath(recorded.DEV_FOUNDRY_TELEMETRY_DIR), await realpath(path.join(consumer.root, '.dev-foundry/telemetry/local')));
  const after = await listTree(consumer.root);
  assert.deepEqual(diffTrees(before, after).filter((file) => !file.startsWith('.dev-foundry/telemetry/local/')), []);
  const ignored = spawnSync('git', ['-C', consumer.root, 'check-ignore', '-q', '--no-index', '--', '.dev-foundry/telemetry/local/x.ndjson'], { env: cliEnv() });
  assert.equal(ignored.status, 0);
});

test('20 the adoption and pin code import no network module', async () => {
  const banned = /(?:from|import\()\s*['"](?:node:)?(?:http|https|http2|net|dgram|dns|tls)['"]|\bfetch\(|XMLHttpRequest|WebSocket/;
  const directory = path.join(repoRoot, 'src/adopt');
  for (const name of await readdir(directory)) assert.ok(!banned.test(await readFile(path.join(directory, name), 'utf8')), name);
  assert.ok(!banned.test(await readFile(path.join(repoRoot, 'bin/dev-foundry-claude.js'), 'utf8')));
  assert.ok(!banned.test(await readFile(path.join(repoRoot, 'scripts/package/payload-manifest.mjs'), 'utf8')));
});

test('22 package metadata: private, scoped name, bundled deps, lock stays a build input', async () => {
  const pkg = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@dev-foundry/claude-adapter');
  assert.equal(pkg.private, true);
  assert.deepEqual(pkg.bin, { 'dev-foundry-claude': 'bin/dev-foundry-claude.js' });
  assert.deepEqual([...pkg.bundleDependencies].sort(), Object.keys(pkg.dependencies).sort());
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ['@modelcontextprotocol/server', 'yaml', 'zod']);
  assert.ok(!pkg.files.includes('package-lock.json'));
  assert.match(pkg.scripts.test, /test\/adopt\/\*\.test\.js/);
  const lock = JSON.parse(await readFile(path.join(repoRoot, 'package-lock.json'), 'utf8'));
  assert.equal(lock.name, pkg.name);
  assert.equal(lock.version, pkg.version);
  const ignoreText = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.ok(ignoreText.split('\n').includes('/payload-manifest.json'));
});
