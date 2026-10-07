import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { request } from 'node:http';
import { chmod, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { performance } from 'node:perf_hooks';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { MANIFEST_NAME, buildManifestBytes, formatExpect, rootOf, selfPin, sha256, verifyPayload } from '../../src/adopt/pin.js';
import { diffTrees, listTree, makeConsumer, repoRoot, applyProposal, readSetSnapshot } from './fixture.js';

const scratchDirs = [];
const scratch = async (prefix) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
  scratchDirs.push(dir);
  return dir;
};
after(async () => { for (const dir of scratchDirs) await rm(dir, { recursive: true, force: true }); });

const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(?:npm_|DEV_FOUNDRY_|OTEL_|CLAUDE)/i.test(key)));
const npmCache = await scratch('package-npm-cache');
const npm = (args, cwd, env = {}) => execFileSync('npm', args, { cwd, encoding: 'utf8', env: { ...cleanEnv(), ...env, npm_config_cache: npmCache, npm_config_update_notifier: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] });

// Builds a tarball from a copy of the tracked package inputs plus the prod node_modules.
async function build(mutate) {
  const tree = await scratch('build-tree');
  for (const entry of ['package.json', 'package-lock.json', 'README.md', 'bin', 'src', 'templates', 'scripts/package']) {
    await cp(path.join(repoRoot, entry), path.join(tree, entry), { recursive: true });
  }
  await cp(path.join(repoRoot, 'tools/dashboard'), path.join(tree, 'tools/dashboard'), {
    recursive: true,
    filter: (source) => !['node_modules', 'dist'].includes(path.relative(path.join(repoRoot, 'tools/dashboard'), source).split(path.sep)[0]),
  });
  // Producer build dependencies only. npm's explicit payload allowlist excludes
  // this symlink; consumers receive the fresh Vite output, never build tooling.
  await symlink(path.join(repoRoot, 'tools/dashboard/node_modules'), path.join(tree, 'tools/dashboard/node_modules'), 'dir');
  await cp(path.join(repoRoot, 'node_modules'), path.join(tree, 'node_modules'), {
    recursive: true,
    filter: (source) => !source.includes(`${path.sep}node_modules${path.sep}@modelcontextprotocol${path.sep}client`),
  });
  await writeFile(path.join(tree, 'LICENSE'), 'Test license text.\n');
  // Forbidden producer inputs exist in the build tree but must never ship.
  for (const relative of ['.env', 'docs/task-history.md', '.dev-foundry/telemetry/local/otel-2026-10-05.ndjson', '.claude/settings.json', 'tools/dashboard/producer-state.json']) {
    await mkdir(path.dirname(path.join(tree, relative)), { recursive: true });
    await writeFile(path.join(tree, relative), 'producer-only-sentinel');
  }
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

test('TSK-020 tar listing accepts LF and CRLF while preserving exact path comparison', async () => {
  const dir = await scratch('tar-listing');
  const fixture = path.join(dir, 'listing.json');
  const preload = path.join(dir, 'tar.cjs');
  // Replace only the external tar boundary; execute the real --check command.
  await writeFile(preload, `const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
require('node:child_process').execFileSync = (command, args) => {
  assert.equal(command, 'tar');
  const { listing, manifest } = JSON.parse(readFileSync(args[1], 'utf8'));
  if (args[0] === '-tzf') {
    assert.equal(args.length, 2);
    return listing;
  }
  assert.deepEqual(args, ['-xOzf', args[1], 'package/payload-manifest.json']);
  return JSON.stringify(manifest);
};
require('node:module').syncBuiltinESMExports();
`);
  const files = ['README.md', 'bin/dev-foundry-claude.js'];
  const manifest = { files: files.map((file) => ({ path: file })) };
  for (const eol of ['\n', '\r\n']) {
    for (const [name, paths, status] of [
      ['exact', files, 0],
      ['extra', [...files, 'extra.txt'], 1],
      ['missing', files.slice(1), 1],
    ]) {
      const listing = ['package/', 'package/bin/', ...paths.map((file) => `package/${file}`), `package/${MANIFEST_NAME}`, ''].join(eol);
      await writeFile(fixture, JSON.stringify({ listing, manifest }));
      const result = spawnSync(process.execPath, ['--require', preload, path.join(repoRoot, 'scripts/package/payload-manifest.mjs'), '--check', fixture], { encoding: 'utf8' });
      assert.equal(result.status, status, `${JSON.stringify(eol)} ${name}: ${result.stderr}`);
      assert.equal(result.stdout, '');
      assert.equal(result.stderr, status === 0
        ? 'payload-manifest: tarball matches manifest (2 files).\n'
        : 'payload-manifest: tarball and manifest differ.\n');
    }
  }
});

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
    npm(['install', '--prefix', prefix, '--offline', '--no-audit', '--no-fund', '--ignore-scripts', built.tarball], prefix, { npm_config_registry: 'http://127.0.0.1:9/' });
    const installed = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
    await rm(built.tree, { recursive: true, force: true });
    return { ...built, manifest, manifestBytes, pin, prefix, installed };
  })();
  return baselinePromise;
}

test('TSK-018 the source launcher has a canonical LF shebang and Git pins its line endings', async () => {
  const launcher = await readFile(path.join(repoRoot, 'bin/dev-foundry-claude.js'));
  const shebang = launcher.subarray(0, launcher.indexOf(0x0a) + 1);
  assert.deepEqual(shebang, Buffer.from('#!/usr/bin/env node\n'));
  assert.equal(shebang.includes(0x0d), false, 'no CR byte terminates the shebang');
  assert.equal(launcher.includes(0x0d), false, 'all launcher line endings are LF');
  const attributes = await readFile(path.join(repoRoot, '.gitattributes'), 'utf8');
  assert.ok(attributes.split(/\r?\n/).includes('bin/dev-foundry-claude.js text eol=lf'));
  const effective = execFileSync('git', ['-c', 'core.autocrlf=true', 'check-attr', 'text', 'eol', '--', 'bin/dev-foundry-claude.js'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(effective, 'bin/dev-foundry-claude.js: text: set\nbin/dev-foundry-claude.js: eol: lf\n');
});

test('TSK-018 packing and offline npm installation preserve every launcher byte', async () => {
  const base = await baseline();
  const source = await readFile(path.join(repoRoot, 'bin/dev-foundry-claude.js'));
  const packed = execFileSync('tar', ['-xOzf', base.tarball, 'package/bin/dev-foundry-claude.js']);
  const installed = await readFile(path.join(base.installed, 'bin/dev-foundry-claude.js'));
  assert.deepEqual(packed, source);
  assert.deepEqual(installed, packed);
  const entry = base.manifest.files.find((file) => file.path === 'bin/dev-foundry-claude.js');
  assert.equal(entry.size, installed.length);
  assert.equal(entry.sha256, sha256(installed));
  assert.equal(selfPin(base.installed).expect, base.pin);
  const dir = await copyInstalled(base);
  await writeFile(path.join(dir, 'bin/dev-foundry-claude.js'), Buffer.concat([source.subarray(0, source.indexOf(0x0a)), Buffer.from('\r\n'), source.subarray(source.indexOf(0x0a) + 1)]));
  assert.throws(() => verifyPayload(dir, base.pin), /verification failed/, 'a CRLF shebang is still an exact-byte mismatch');
  assert.throws(() => selfPin(dir), /verification failed/);
});

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
  assert.deepEqual(files.filter((file) => file !== MANIFEST_NAME && path.posix.dirname(file) !== 'node_modules/.bin'), base.manifest.files.map((entry) => entry.path));
  assert.ok(links.every((link) => path.posix.dirname(link) === 'node_modules/.bin'), links.join(','));
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
  assert.equal(again.info.integrity, base.info.integrity, 'tarball bytes are reproducible');
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
    'changed dashboard server': (dir) => bump(path.join(dir, 'tools/dashboard/server/http.mjs')),
    'changed dashboard UI': (dir) => bump(path.join(dir, 'tools/dashboard/dist/index.html')),
    'changed dashboard compiled asset': (dir) => bump(path.join(dir, base.manifest.files.find((entry) => /^tools\/dashboard\/dist\/assets\/.*\.js$/.test(entry.path)).path)),
    'changed LICENSE': (dir) => bump(path.join(dir, 'LICENSE')),
    'one byte in a bundled dependency': (dir) => bump(path.join(dir, bundled)),
    'deleted payload file': (dir) => rm(path.join(dir, 'templates/mcp-entry.json.tmpl')),
    'unlisted file in the package': (dir) => writeFile(path.join(dir, 'src/extra.js'), 'x'),
    'unlisted file in a bundled dependency': (dir) => writeFile(path.join(dir, 'node_modules/yaml/extra.txt'), 'x'),
    'nested regular file inside .bin': async (dir) => {
      await mkdir(path.join(dir, 'node_modules/.bin/nested'), { recursive: true });
      await writeFile(path.join(dir, 'node_modules/.bin/nested/extra.cmd'), 'x');
    },
    'nested symlink inside .bin': async (dir) => {
      await mkdir(path.join(dir, 'node_modules/.bin/nested'), { recursive: true });
      await symlink('../../yaml/bin.mjs', path.join(dir, 'node_modules/.bin/nested/yaml'));
    },
    'unlisted shim in a dependency .bin': async (dir) => {
      await mkdir(path.join(dir, 'node_modules/yaml/node_modules/.bin'), { recursive: true });
      await writeFile(path.join(dir, 'node_modules/yaml/node_modules/.bin/extra.cmd'), 'x');
    },
    'unlisted file in .bin lookalike': async (dir) => {
      await mkdir(path.join(dir, 'node_modules/.bin-extra'), { recursive: true });
      await writeFile(path.join(dir, 'node_modules/.bin-extra/extra.ps1'), 'x');
    },
    '.bin directory replaced by a symlink': async (dir) => {
      await rm(path.join(dir, 'node_modules/.bin'), { recursive: true, force: true });
      await symlink('yaml', path.join(dir, 'node_modules/.bin'), 'dir');
    },
    'symlink outside .bin': (dir) => symlink('../README.md', path.join(dir, 'src/link')),
    'changed manifest': (dir) => bump(path.join(dir, MANIFEST_NAME)),
    'missing manifest': (dir) => rm(path.join(dir, MANIFEST_NAME)),
  };
}

test('14 installer symlinks directly inside node_modules/.bin are tolerated', async () => {
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
});

test('TSK-017 Windows npm regular direct-child launch shims verify and allow installed adoption', async (t) => {
  const base = await baseline();
  const dir = await copyInstalled(base);
  await mkdir(path.join(dir, 'node_modules/.bin'), { recursive: true });
  const shims = { yaml: '#!/bin/sh\nnode "$basedir/../yaml/bin.mjs" "$@"\n', 'yaml.cmd': '@ECHO off\r\nnode "%~dp0\\..\\yaml\\bin.mjs" %*\r\n', 'yaml.ps1': '& node "$PSScriptRoot/../yaml/bin.mjs" $args\r\n' };
  for (const [name, content] of Object.entries(shims)) {
    const file = path.join(dir, 'node_modules/.bin', name);
    await rm(file, { force: true });
    await writeFile(file, content);
    assert.equal((await lstat(file)).isFile(), true, name);
  }
  assert.doesNotThrow(() => verifyPayload(dir, base.pin));
  assert.equal(selfPin(dir).expect, base.pin);
  const consumer = await makeConsumer();
  t.after(() => consumer.cleanup());
  const plan = await adoptThroughInstalledCli({ ...base, installed: dir }, consumer);
  assert.equal(plan.adapter.expect, base.pin);
  const call = await connect(t, process.execPath, [path.join(dir, 'bin/dev-foundry-claude.js'), 'mcp', '--expect', base.pin], consumer.root);
  assert.equal((await call({ targetProject: 'acme-billing', requestedAction: 'author', boundaryId: 'B-1' })).errorCode, 'BINDING_INACTIVE');
});

test('TSK-017 even manifest-listed .bin files require exact size and SHA-256', async () => {
  const base = await baseline();
  const dir = await copyInstalled(base);
  const relative = 'node_modules/.bin/listed.cmd';
  const file = path.join(dir, relative);
  const bytes = Buffer.from('@ECHO off\r\n');
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  const manifest = buildManifestBytes({ version: base.manifest.version, entries: [...base.manifest.files, { path: relative, size: bytes.length, sha256: sha256(bytes) }] });
  await writeFile(path.join(dir, MANIFEST_NAME), manifest);
  const pin = formatExpect(base.manifest.version, rootOf(manifest));
  assert.doesNotThrow(() => verifyPayload(dir, pin));
  await writeFile(file, Buffer.alloc(bytes.length, 'x'));
  assert.throws(() => verifyPayload(dir, pin), /verification failed/, 'same-size SHA mismatch');
  await writeFile(file, Buffer.concat([bytes, Buffer.from('x')]));
  assert.throws(() => verifyPayload(dir, pin), /verification failed/, 'size mismatch');
  await rm(file);
  assert.throws(() => verifyPayload(dir, pin), /verification failed/, 'missing listed file');
  await symlink('../yaml/bin.mjs', file);
  assert.throws(() => verifyPayload(dir, pin), /verification failed/, 'listed file replaced by tolerated link');
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

  // Observe the host restriction independently; never turn a product error into
  // a skip based on the launcher's intentionally generic failure message.
  if (await freeDashboardPort() === null) {
    t.skip('Host prohibits collector loopback sockets; tamper/pin rejection passed, live run remains unverified');
    return;
  }
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
  assert.equal(lock.packages[''].version, pkg.version);
  assert.equal(pkg.version, '1.4.0');
  const readme = await readFile(path.join(repoRoot, 'README.md'), 'utf8');
  assert.match(readme, /\*\*Claude Code adapter 1\.4\.0\*\*/);
  assert.match(readme.split('## 1. What is DEV FOUNDRY?')[0], /npm install -g[\s\S]*cd <project>[\s\S]*dev-foundry-claude setup[\s\S]*dev-foundry-claude start/);
  assert.ok(!readme.includes('1.2.0') && !readme.includes('1.2.1'));
  const ignoreText = await readFile(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.ok(ignoreText.split('\n').includes('/payload-manifest.json'));
});

// TSK-016 uses the same independently packed, offline-installed baseline as the
// adoption/MCP/run regression tests. Its temporary producer tree is deleted.
test('TSK-016 package ships only dashboard runtime/assets and pins every dashboard byte', async () => {
  const base = await baseline();
  assert.equal(base.manifest.version, '1.4.0', 'TSK-021 preserves the TSK-016 dashboard payload contract');
  await assert.rejects(lstat(base.tree), /ENOENT/);
  const files = base.info.files.map((file) => file.path);
  for (const name of ['http', 'evidence', 'claude-otel', 'launch']) assert.ok(files.includes(`tools/dashboard/server/${name}.mjs`));
  assert.ok(files.includes('src/dashboard/command.js'));
  assert.ok(files.includes('tools/dashboard/dist/index.html'));
  assert.ok(files.includes('tools/dashboard/dist/logo.svg'));
  assert.ok(files.some((file) => /^tools\/dashboard\/dist\/assets\/.*\.js$/.test(file)));
  assert.ok(files.some((file) => /^tools\/dashboard\/dist\/assets\/.*\.css$/.test(file)));
  for (const file of files) {
    assert.ok(!/^(?:docs\/|\.dev-foundry\/|\.claude\/|\.env|secrets\/|scripts\/|test\/)/.test(file), file);
    if (file.startsWith('tools/')) assert.match(file, /^tools\/dashboard\/(?:server\/(?:http|evidence|claude-otel|launch)\.mjs|dist\/(?:index\.html|logo\.svg|assets\/[^/]+\.(?:js|css|svg|woff2?)))$/);
    assert.ok(!file.startsWith('tools/dashboard/node_modules/'), file);
  }
  assert.ok(!files.some((file) => file.startsWith('node_modules/vite/') || file.startsWith('node_modules/react/') || file.startsWith('node_modules/@modelcontextprotocol/client/')));
  const dashboardFiles = files.filter((file) => /^(?:src\/dashboard\/|tools\/dashboard\/)/.test(file));
  assert.ok(dashboardFiles.every((file) => base.manifest.files.some((entry) => entry.path === file)));
  verifyPayload(base.installed, base.pin);
});

async function freeDashboardPort() {
  const socket = createServer();
  try {
    await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
  } catch (error) {
    if (['EPERM', 'EACCES'].includes(error.code)) return null;
    throw error;
  }
  const { port, address } = socket.address();
  assert.equal(address, '127.0.0.1');
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

const boundedDashboardPorts = new Map();
async function startInstalledDashboard(t, base, cwd, args = []) {
  const livePort = await freeDashboardPort();
  const port = livePort ?? 43127;
  const extra = {};
  if (livePort === null) {
    t.diagnostic('Host blocks loopback sockets: installed CLI/HTTP handler smoke uses IPC; live TCP remains unverified.');
    const loader = path.join(await scratch('dashboard-server-smoke'), 'listen.mjs');
    // Instrument only the socket boundary, outside the installed payload. The
    // actual CLI, root/pin checks, server and asynchronous request handler run.
    await writeFile(loader, `import assert from 'node:assert/strict';
import { Server } from 'node:http';
Server.prototype.listen = function(options, ready) {
  assert.deepEqual(options, { host: '127.0.0.1', port: 43127, exclusive: true });
  this.address = () => ({ address: '127.0.0.1', port: options.port, family: 'IPv4' });
  this.close = (done) => done();
  process.on('message', ({ id, url, method, host }) => {
    const response = { status: 0, headers: {}, body: '' };
    this.emit('request', { url, method, headers: { host } }, {
      setHeader(key, value) { response.headers[key.toLowerCase()] = value; },
      writeHead(status, headers) { response.status = status; for (const [key, value] of Object.entries(headers)) this.setHeader(key, value); },
      end(body) { response.body = body?.toString() ?? ''; process.send({ id, response }); }
    });
  });
  queueMicrotask(ready);
  return this;
};
`);
    extra.NODE_OPTIONS = `--import=${loader}`;
  }
  const child = spawn(process.execPath, [path.join(base.prefix, 'node_modules/.bin/dev-foundry-claude'), 'dashboard', '--port', String(port), ...args], {
    cwd, env: cliEnv({ CLAUDE_PROJECT_DIR: base.tree, GIT_DIR: base.tree, GIT_WORK_TREE: base.tree, ...extra }), stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  if (livePort === null) boundedDashboardPorts.set(port, child);
  let output = ''; let errors = '';
  child.stderr.on('data', (bytes) => { errors += bytes; });
  const closed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await closed;
    boundedDashboardPorts.delete(port);
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Installed dashboard startup timed out: ${errors}`)), 10000);
    child.stdout.on('data', (bytes) => {
      output += bytes;
      if (output.includes(`http://127.0.0.1:${port}`)) { clearTimeout(timer); resolve(); }
    });
    closed.then((result) => { clearTimeout(timer); reject(new Error(`Dashboard exited: ${JSON.stringify(result)} ${errors}`)); }, reject);
  });
  return { port, url: `http://127.0.0.1:${port}`, stop: async () => {
    child.kill('SIGTERM');
    const result = await closed;
    boundedDashboardPorts.delete(port);
    assert.deepEqual(result, { code: 0, signal: null });
    assert.equal(errors, '');
  } };
}

function dashboardRequest(port, url, { method = 'GET', host = `127.0.0.1:${port}` } = {}) {
  const child = boundedDashboardPorts.get(port);
  if (child) return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.removeListener('message', received); reject(new Error('Handler timed out')); }, 5000);
    const received = ({ response }) => { clearTimeout(timer); resolve(response); };
    child.once('message', received); child.send({ id: 1, url, method, host });
  });
  return new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: url, method, headers: { Host: host }, timeout: 5000 }, (res) => {
      let body = '';
      res.setEncoding('utf8'); res.on('data', (bytes) => { body += bytes; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.once('error', reject); req.once('timeout', () => req.destroy(new Error('Request timed out'))); req.end();
  });
}

test('TSK-016 installed CLI serves consumer evidence and packaged UI without producer checkout or build tooling', { timeout: 60000 }, async (t) => {
  const base = await baseline();
  const consumer = await makeConsumer(); t.after(() => consumer.cleanup());
  await adoptThroughInstalledCli(base, consumer);
  await consumer.put('.dev-foundry/executions/TSK-CONSUMER/consumer-run/status.json', JSON.stringify({ schemaVersion: 'foundry-runner.status.v2', taskId: 'TSK-CONSUMER', status: 'passed', finishedAt: '2026-10-05T12:00:00Z' }));
  await consumer.put('.dev-foundry/repository-transactions/consumer-tx.json', JSON.stringify({ transactionId: 'consumer-tx', status: 'completed', completedAt: '2026-10-05T12:00:00Z', facts: [{ name: 'taskId', value: 'TSK-CONSUMER' }] }));
  const attrs = (values) => Object.entries(values).map(([key, value]) => ({ key, value: typeof value === 'number' ? { doubleValue: value } : { stringValue: value } }));
  const metric = { schema: 'dev-foundry.claude-otel-envelope.v1', telemetryRunId: 'consumer-private-run', receivedAt: '2026-10-05T12:00:00Z', signal: 'metrics', payload: {
    resourceMetrics: [{ resource: { attributes: attrs({ 'session.id': 'consumer-private-session', 'user.email': 'secret@example.invalid', prompt: 'private-prompt-sentinel' }) }, scopeMetrics: [{ metrics: [{ name: 'claude_code.token.usage', sum: { aggregationTemporality: 1, dataPoints: [{ asDouble: 37, startTimeUnixNano: '1', timeUnixNano: '1791201600000000000', attributes: attrs({ type: 'input' }) }] } }] }] }],
  } };
  await consumer.put('.dev-foundry/telemetry/local/otel-2026-10-05.ndjson', `${JSON.stringify(metric)}\n`);
  // Consumer static files must not substitute for the pinned package assets.
  await consumer.put('tools/dashboard/dist/index.html', 'consumer-ui-sentinel');
  const nested = path.join(consumer.root, 'nested/work'); await mkdir(nested, { recursive: true });
  const before = await listTree(consumer.root);
  const dashboard = await startInstalledDashboard(t, base, nested);
  const health = JSON.parse((await dashboardRequest(dashboard.port, '/api/dashboard/v1/health')).body);
  assert.deepEqual(health.dashboard, { api: 'available', ui: 'available' });
  assert.equal(health.data.executions.records, 1);
  assert.equal(health.data.transactions.records, 1);
  assert.equal(health.throughput, 'unavailable');
  const executions = JSON.parse((await dashboardRequest(dashboard.port, '/api/dashboard/v1/executions')).body);
  assert.equal(executions.records[0].taskId, 'TSK-CONSUMER');
  const transactions = JSON.parse((await dashboardRequest(dashboard.port, '/api/dashboard/v1/transactions')).body);
  assert.equal(transactions.records[0].recordId, 'consumer-tx');
  const otel = JSON.parse((await dashboardRequest(dashboard.port, '/api/dashboard/v1/claude-otel')).body);
  assert.equal(otel.summary.inputTokens, 37);
  assert.equal(otel.recentSessions[0].measures.inputTokens, 37);
  assert.ok(!/consumer-private|secret@example|private-prompt-sentinel/.test(JSON.stringify(otel)));
  const ui = await dashboardRequest(dashboard.port, '/telemetry?tab=claude-otel');
  assert.equal(ui.status, 200);
  assert.equal(ui.body, await readFile(path.join(base.installed, 'tools/dashboard/dist/index.html'), 'utf8'));
  const script = ui.body.match(/src="([^"]+\.js)"/)[1];
  const asset = await dashboardRequest(dashboard.port, script);
  assert.equal(asset.status, 200); assert.match(asset.headers['content-type'], /javascript/);
  assert.equal(asset.body, await readFile(path.join(base.installed, 'tools/dashboard/dist', script), 'utf8'));
  assert.equal((await dashboardRequest(dashboard.port, '/api/dashboard/v1/health', { method: 'HEAD' })).body, '');
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await dashboardRequest(dashboard.port, '/api/dashboard/v1/health', { method })).status, 405);
  for (const host of ['localhost:43127', '0.0.0.0:43127', '192.168.0.1:43127', 'evil.example', '127.0.0.1.evil.example:43127', '127.0.0.1']) assert.equal((await dashboardRequest(dashboard.port, '/api/dashboard/v1/health', { host })).status, 403);
  assert.equal((await dashboardRequest(dashboard.port, '/assets/%2e%2e/.env')).status, 400);
  assert.equal((await dashboardRequest(dashboard.port, '/.env')).status, 404);
  await dashboard.stop();
  const explicit = await startInstalledDashboard(t, base, os.tmpdir(), ['--root', consumer.root]);
  assert.equal(JSON.parse((await dashboardRequest(explicit.port, '/api/dashboard/v1/executions')).body).records[0].taskId, 'TSK-CONSUMER');
  await explicit.stop();
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), [], 'dashboard is observational');
});

test('TSK-016 dashboard rejects invalid args, roots, unsafe structure, stale pins and modified assets before listening', async (t) => {
  const base = await baseline();
  const consumer = await makeConsumer(); t.after(() => consumer.cleanup());
  await adoptThroughInstalledCli(base, consumer);
  for (const args of [[], ['--port'], ['--port', 'abc'], ['--port', '0'], ['--port', '1023'], ['--port', '65536'], ['--port', '4.5'], ['--port', '1e4'], ['--port', '3000', '--port', '4000'], ['--port', '3000', '--root'], ['--port', '3000', '--root', '--port'], ['--port', '3000', '--host', '0.0.0.0'], ['--port', '3000', 'extra']]) {
    const result = cli(base.installed, ['dashboard', ...args], { cwd: consumer.root });
    assert.equal(result.status, 2, JSON.stringify(args)); assert.equal(result.stdout, ''); assert.match(result.stderr, /Usage:/);
  }
  const noRoot = cli(base.installed, ['dashboard', '--port', '3000']);
  assert.equal(noRoot.status, 1); assert.match(noRoot.stderr, /consumer git repository/);
  const profile = await consumer.read('.dev-foundry/profiles/project-operating-profile.yaml');
  await consumer.put('.dev-foundry/profiles/project-operating-profile.yaml', 'invalid: true');
  assert.match(cli(base.installed, ['dashboard', '--port', '3000'], { cwd: consumer.root }).stderr, /project operating profile/);
  await consumer.put('.dev-foundry/profiles/project-operating-profile.yaml', profile);
  const mcp = await consumer.read('.mcp.json');
  await consumer.put('.mcp.json', mcp.replace(base.pin, '1.1.0:sha256:' + '0'.repeat(64)));
  const stale = cli(base.installed, ['dashboard', '--port', '3000'], { cwd: consumer.root });
  assert.equal(stale.status, 1); assert.equal(stale.stdout, ''); assert.match(stale.stderr, /verification failed/);
  await consumer.put('.mcp.json', mcp);
  const unsafe = path.join(consumer.root, '.dev-foundry'); const moved = path.join(consumer.root, 'unsafe-evidence');
  // A symlinked evidence authority root is rejected rather than followed.
  await cp(unsafe, moved, { recursive: true }); await rm(unsafe, { recursive: true }); await symlink(moved, unsafe, 'dir');
  const linked = cli(base.installed, ['dashboard', '--port', '3000'], { cwd: consumer.root });
  assert.equal(linked.status, 1); assert.match(linked.stderr, /project operating profile/);
  await rm(unsafe); await cp(moved, unsafe, { recursive: true });
  for (const [name, tamper] of Object.entries(tampers(base)).filter(([name]) => name.includes('dashboard'))) {
    const dir = await copyInstalled(base); await tamper(dir);
    const result = cli(dir, ['dashboard', '--port', '3000'], { cwd: consumer.root });
    assert.equal(result.status, 1, name); assert.equal(result.stdout, ''); assert.match(result.stderr, /verification failed/);
  }
});

test('TSK-020 installed CLI explicitly plans/applies compatible upgrade with exact verified target identity', async (t) => {
  const base = await baseline();
  const consumer = await makeConsumer(); t.after(consumer.cleanup);
  const { createPlan } = await import('../../src/adopt/plan.js');
  const { applyPlan } = await import('../../src/adopt/apply.js');
  const old = { version: '1.2.2', payloadRoot: 'a'.repeat(64), expect: `1.2.2:sha256:${'a'.repeat(64)}` };
  const adoption = await createPlan({ root: consumer.root, adapter: old });
  await applyPlan({ root: consumer.root, adapter: old, planBytes: adoption.bytes, planSha256: adoption.hash });
  consumer.commit();
  const before = await listTree(consumer.root);
  const authority = await readSetSnapshot(consumer.root);
  const invoke = (args, installed = base.installed) => cli(installed, ['upgrade', ...args, '--root', consumer.root]);
  assert.equal(JSON.parse(invoke(['status']).stdout).status, 'upgrade-needed');
  const out = path.join(await scratch('upgrade-plan'), 'plan.json');
  const planned = invoke(['plan', '--out', out]);
  assert.equal(planned.status, 0, planned.stderr);
  const summary = JSON.parse(planned.stdout);
  assert.equal(summary.current.expect, old.expect);
  assert.equal(summary.target.expect, base.pin);
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
  const denied = invoke(['plan', '--out', path.join(consumer.root, 'docs/overwrite.json')]);
  assert.equal(denied.status, 2);
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
  const broken = await copyInstalled(base);
  await bump(path.join(broken, 'README.md'));
  const refused = invoke(['apply', '--plan', out, '--plan-sha256', summary.planSha256], broken);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Adapter runtime verification failed/);
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
  // A different, internally valid build of the same version is also stale.
  const changedReadme = await readFile(path.join(broken, 'README.md'));
  await writeFile(path.join(broken, MANIFEST_NAME), buildManifestBytes({ version: base.manifest.version,
    entries: base.manifest.files.map((entry) => entry.path === 'README.md'
      ? { ...entry, size: changedReadme.length, sha256: sha256(changedReadme) } : entry) }));
  assert.notEqual(selfPin(broken).expect, base.pin);
  const differentBuild = invoke(['apply', '--plan', out, '--plan-sha256', summary.planSha256], broken);
  assert.equal(differentBuild.status, 1);
  assert.match(differentBuild.stderr, /plan-stale/);
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), []);
  const applied = invoke(['apply', '--plan', out, '--plan-sha256', summary.planSha256]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.deepEqual(JSON.parse(applied.stdout), { written: 1, deleted: 0 });
  assert.deepEqual(diffTrees(before, await listTree(consumer.root)), ['.mcp.json']);
  assert.deepEqual(await readSetSnapshot(consumer.root), authority);
  consumer.commit();
  assert.equal(JSON.parse(invoke(['status']).stdout).status, 'current');
  const replan = cli(base.installed, ['adopt', 'plan', '--root', consumer.root]);
  assert.equal(replan.status, 0, replan.stderr);
  assert.equal(JSON.parse(replan.stdout).status, 'noop');
  assert.equal(JSON.parse(replan.stdout).activation.overall, 'prepared');
});

test('TSK-021 isolated installed package guides fresh and brownfield setup, status, doctor, help and start recovery', async (t) => {
  const base = await baseline();
  assert.equal(base.manifest.version, '1.4.0');
  for (const file of ['src/consumer/help.js', 'src/consumer/command.js', 'src/telemetry/launch.js']) assert.ok(base.manifest.files.some((entry) => entry.path === file));
  const fresh = await makeConsumer({ governed: false }); t.after(fresh.cleanup);
  const freshBefore = await listTree(fresh.root);
  const freshResult = cli(base.installed, ['setup', '--yes'], { cwd: fresh.root });
  assert.equal(freshResult.status, 2); assert.match(freshResult.stdout, /owner/);
  assert.deepEqual(diffTrees(freshBefore, await listTree(fresh.root)), []);
  const c = await makeConsumer(); t.after(c.cleanup);
  const invoke = (command, args = [], env = {}) => cli(base.installed, [command, ...args], { cwd: c.root, env });
  for (const topic of ['getting-started', 'setup', 'start', 'status', 'upgrade', 'doctor', 'concepts']) {
    const help = invoke('help', [topic]); assert.equal(help.status, 0); assert.match(help.stdout, /1\.4\.0/);
  }
  const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
  const setup = invoke('setup'); assert.equal(setup.status, 0); assert.match(setup.stdout, /setup --yes/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const prepared = invoke('setup', ['--yes', '--json']); assert.equal(prepared.status, 0, prepared.stderr);
  const data = JSON.parse(prepared.stdout); assert.equal(data.integration, 'prepared'); assert.ok(data.plan.cutover_proposal);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  c.commit();
  const blocked = invoke('start'); assert.equal(blocked.status, 2); assert.match(blocked.stdout, /owner.*approve/);
  assert.equal(JSON.parse(invoke('status', ['--json']).stdout).readyToWork, false);
  assert.match(invoke('doctor').stdout, /Read-only diagnosis: attention needed/);
  await applyProposal(c.root, data.plan.cutover_proposal); c.commit();
  const stubDir = await scratch('guided-claude');
  const stub = path.join(stubDir, 'claude');
  const marker = path.join(stubDir, 'guided-marker.json');
  await writeFile(stub, `#!${process.execPath}\nrequire('node:fs').writeFileSync(process.env.MARKER_FILE, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), telemetry: process.env.CLAUDE_CODE_ENABLE_TELEMETRY, endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT }));\n`);
  await chmod(stub, 0o755);
  const env = { PATH: `${stubDir}${path.delimiter}${path.dirname(process.execPath)}${path.delimiter}/usr/bin${path.delimiter}/bin`, MARKER_FILE: marker };
  const ready = invoke('status', ['--json'], env); assert.equal(ready.status, 0, ready.stderr); assert.equal(JSON.parse(ready.stdout).readyToWork, true);
  const doctor = invoke('doctor', ['--json'], env); assert.equal(doctor.status, 0); assert.ok(Object.values(JSON.parse(doctor.stdout).checks).every(Boolean));
  assert.match(invoke('upgrade', [], env).stdout, /already selects/);
  const healthyTree = await listTree(c.root);
  const tampered = await copyInstalled(base); await bump(path.join(tampered, 'src/consumer/help.js'));
  const refused = cli(tampered, ['start'], { cwd: c.root, env }); assert.equal(refused.status, 1); assert.match(refused.stdout, /could not be verified/);
  await assert.rejects(readFile(marker), /ENOENT/);
  assert.deepEqual(diffTrees(healthyTree, await listTree(c.root)), []);
  const client = new Client({ name: 'packaged-help-parity', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(base.installed, 'bin/dev-foundry-claude.js'), 'mcp', '--expect', base.pin], env: { CLAUDE_PROJECT_DIR: c.root }, cwd: os.tmpdir() }));
  t.after(() => client.close());
  const listed = await client.listResources(); assert.equal(listed.resources.length, 7);
  for (const resource of listed.resources) {
    const text = (await client.readResource({ uri: resource.uri })).contents[0].text;
    assert.equal(text, invoke('help', [resource.uri.split('/').at(-1)]).stdout);
  }
  // This subtest reports any host socket restriction separately from the
  // completed installed CLI checks above. No provider is invoked by the stub.
  await t.test('packaged canonical launcher live loopback smoke', async (t) => {
    if (process.platform === 'win32') { t.skip('POSIX executable stub unavailable; native Windows smoke remains unverified'); return; }
    if (await freeDashboardPort() === null) { t.skip('Host prohibits loopback sockets; live packaged start remains unverified'); return; }
    const start = invoke('start', ['--', '--resume', 'a b', '--'], env);
    assert.equal(start.status, 0, start.stderr); assert.match(start.stdout, /Local telemetry is ready/); assert.match(start.stdout, /dashboard --port 4319/);
    const recorded = JSON.parse(await readFile(marker, 'utf8'));
    assert.deepEqual(recorded.args, ['--resume', 'a b', '--']); assert.equal(await realpath(recorded.cwd), await realpath(c.root));
    assert.equal(recorded.telemetry, '1'); assert.match(recorded.endpoint, /^http:\/\/127\.0\.0\.1:\d+$/);
    assert.deepEqual(diffTrees(healthyTree, await listTree(c.root)).filter((file) => !file.startsWith('.dev-foundry/telemetry/local/')), []);
  });
});

test('TSK-021 installed 1.4.0 upgrades a verified isolated 1.2.2-shaped package with differing managed bytes', async (t) => {
  const base = await baseline();
  const oldBuild = await build(async (tree) => {
    for (const file of ['package.json', 'package-lock.json']) {
      const absolute = path.join(tree, file); const data = JSON.parse(await readFile(absolute, 'utf8'));
      data.version = '1.2.2'; if (data.packages) data.packages[''].version = '1.2.2';
      await writeFile(absolute, JSON.stringify(data, null, 2) + '\n');
    }
    for (const file of ['agents/dev-foundry-executor.md.tmpl', 'agents/dev-foundry-auditor.md.tmpl', 'claude-md-block.md.tmpl']) {
      const absolute = path.join(tree, 'templates', file); const text = await readFile(absolute, 'utf8');
      await writeFile(absolute, file.startsWith('agents/') ? `${text}\n<!-- Adapter 1.2.2 managed agent -->\n` : text.replace(/DEV FOUNDRY/g, 'DEV FOUNDRY 1.2.2 integration'));
    }
  });
  const oldPackage = await extract(oldBuild.tarball);
  const c = await makeConsumer(); t.after(c.cleanup);
  const setup = cli(oldPackage, ['setup', '--yes', '--json'], { cwd: c.root });
  assert.equal(setup.status, 0, setup.stderr); c.commit();
  const before = await listTree(c.root); const authority = await readSetSnapshot(c.root);
  const invoke = (args) => cli(base.installed, ['upgrade', ...args], { cwd: c.root });
  const without = invoke([]); assert.equal(without.status, 2); assert.match(without.stdout, /managed files need to be refreshed/);
  const planned = invoke(['--from-package', oldPackage, '--json']); assert.equal(planned.status, 0, planned.stderr);
  const data = JSON.parse(planned.stdout); assert.equal(data.plan.upgradeKind, 'managed-refresh');
  assert.equal(data.plan.current.expect, selfPin(oldPackage).expect); assert.equal(data.plan.target.expect, base.pin);
  assert.equal(data.plan.merge.length, 4); assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const planFile = path.join(await scratch('managed-plan'), 'plan.json');
  const exact = cli(base.installed, ['upgrade', 'plan', '--root', c.root, '--from-package', oldPackage, '--out', planFile]);
  assert.equal(exact.status, 0, exact.stderr);
  const hash = JSON.parse(exact.stdout).planSha256;
  const denied = cli(base.installed, ['upgrade', 'apply', '--root', c.root, '--plan', planFile, '--plan-sha256', '0'.repeat(64)]);
  assert.equal(denied.status, 1); assert.match(denied.stderr, /plan-hash-mismatch/);
  assert.deepEqual(diffTrees(before, await listTree(c.root)), []);
  const applied = cli(base.installed, ['upgrade', 'apply', '--root', c.root, '--plan', planFile, '--plan-sha256', hash]);
  assert.equal(applied.status, 0, applied.stderr); assert.deepEqual(JSON.parse(applied.stdout), { written: 4, deleted: 0 });
  assert.deepEqual(diffTrees(before, await listTree(c.root)), ['.claude/agents/dev-foundry-auditor.md', '.claude/agents/dev-foundry-executor.md', '.mcp.json', 'CLAUDE.md']);
  assert.deepEqual(await readSetSnapshot(c.root), authority);
  c.commit(); assert.equal(JSON.parse(cli(base.installed, ['adopt', 'plan', '--root', c.root]).stdout).status, 'noop');
});
