#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { selfPin } from '../../src/adopt/pin.js';

export const RELEASES = Object.freeze({
  target: Object.freeze({ version: '1.5.5', sha256: '1b220edd2fc608ee9fdb3cbac739c45f418f8fcb6b061dc33bbf6764349961e4',
    pin: '1.5.5:sha256:c1686443eafc42504c5b8423c4bc88eb57a5f2f5fc142537ff4780f57a6858bf',
    url: 'https://github.com/mavalenzuela22/dev-foundry-claude/releases/download/v1.5.5/dev-foundry-claude-adapter-1.5.5.tgz' }),
  source: Object.freeze({ version: '1.4.2', sha256: '3aa7542c41ce613c9c152e21c8e2d95d835dc00be1cb8f2e46302daa54cadaf3',
    pin: '1.4.2:sha256:1780711cd5661b40f7f0e1220146e87ae12f88c3bc9ba37de06f17fe69cbe79f',
    url: 'https://github.com/mavalenzuela22/dev-foundry-claude/releases/download/v1.4.2/dev-foundry-claude-adapter-1.4.2.tgz' }),
});

export const shimNamesForPlatform = (platform) => platform === 'win32'
  ? ['dev-foundry-claude.cmd', 'dev-foundry-claude.ps1'] : ['dev-foundry-claude'];
export const within = (root, candidate) => {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel === '' || (!rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel));
};
export const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function verifyPin(kind, pin) {
  const release = RELEASES[kind];
  if (!release || pin?.version !== release.version || pin?.expect !== release.pin) throw new Error(`${kind} installed payload pin mismatch`);
  return true;
}
export const nodeMajor = (version) => Number(String(version).split('.')[0].replace(/^v/, ''));
export const supportsNodeVersion = (version) => nodeMajor(version) >= 20;
export function verifyArchiveIdentity(kind, bytes, url = RELEASES[kind].url) {
  const release = RELEASES[kind];
  if (!release || url !== release.url || hash(bytes) !== release.sha256) throw new Error(`${kind} official archive identity mismatch`);
  return { version: release.version, sha256: release.sha256, url: release.url };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--target-archive', '--source-archive', '--report-root'].includes(key) || !argv[i + 1] || argv[i + 1].startsWith('--')) {
      throw new Error(`Invalid argument: ${key}`);
    }
    args[key] = argv[++i];
  }
  return args;
}

async function acquire(kind, supplied, scratch) {
  const spec = RELEASES[kind];
  const file = path.join(scratch, `${kind}-${spec.version}.tgz`);
  let bytes;
  if (supplied) bytes = await readFile(supplied);
  else {
    const response = await fetch(spec.url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`${kind} download failed with HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > 128 * 1024 * 1024) throw new Error(`${kind} archive exceeds the 128 MiB download limit`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error(`${kind} download returned no body`);
    const chunks = []; let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 128 * 1024 * 1024) { await reader.cancel(); throw new Error(`${kind} archive exceeds the 128 MiB download limit`); }
      chunks.push(Buffer.from(value));
    }
    bytes = Buffer.concat(chunks, size);
  }
  verifyArchiveIdentity(kind, bytes);
  await writeFile(file, bytes, { flag: 'wx' });
  return { file, identity: verifyArchiveIdentity(kind, bytes) };
}

export function npmInvocation({ platform = process.platform, env = process.env, execPath = process.execPath,
  exists = existsSync, pathApi = path } = {}) {
  if (env.npm_execpath && exists(env.npm_execpath)) return [execPath, env.npm_execpath];
  if (platform === 'win32') {
    const neighboringCli = pathApi.join(pathApi.dirname(execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    if (exists(neighboringCli)) return [execPath, neighboringCli];
    for (const entry of (env.PATH ?? '').split(pathApi.delimiter)) {
      const cli = pathApi.join(entry, 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (exists(cli)) return [execPath, cli];
    }
    throw new Error('Could not locate npm-cli.js without invoking a Windows shell');
  }
  return ['npm'];
}

function run(command, args, cwd, timeout = 120_000) {
  const sandboxHome = cwd;
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
    env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot, WINDIR: process.env.WINDIR,
      HOME: sandboxHome, USERPROFILE: sandboxHome, APPDATA: path.join(sandboxHome, 'appdata'),
      TEMP: sandboxHome, TMP: sandboxHome, TMPDIR: sandboxHome,
      npm_config_cache: path.join(sandboxHome, '.npm-cache'), npm_config_userconfig: path.join(sandboxHome, '.npmrc'),
      npm_config_globalconfig: path.join(sandboxHome, '.npmrc.global'), npm_config_update_notifier: 'false',
      npm_config_fund: 'false', npm_config_audit: 'false', npm_config_ignore_scripts: 'true' } });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', signal: result.signal };
}

export async function installAndInspect(kind, archive, scratch, report, { invokeNpm = npmInvocation, execute = run, inspectPin = selfPin } = {}) {
  const outcomes = report.checks[kind];
  const prefix = path.join(scratch, `install-${kind}`);
  try {
    await mkdir(prefix);
    const [npm, ...npmPrefix] = invokeNpm();
    outcomes.npmVersion = { status: 'FAIL', version: null, exitCode: null, stderr: '' };
    const npmVersion = execute(npm, [...npmPrefix, '--version'], scratch, 30_000);
    outcomes.npmVersion = { status: npmVersion.status === 0 ? 'PASS' : 'FAIL', version: npmVersion.stdout.trim(),
      exitCode: npmVersion.status, stderr: npmVersion.stderr.slice(-2000) };
    if (npmVersion.status !== 0) throw new Error(`npm --version failed: ${npmVersion.stderr}`);
    outcomes.isolatedInstall = 'FAIL';
    const installed = execute(npm, [...npmPrefix, 'install', '--prefix', prefix, '--ignore-scripts', '--no-audit', '--no-fund', '--no-save', archive.file], scratch);
    outcomes.installResult = { exitCode: installed.status, stderr: installed.stderr.slice(-4000) };
    outcomes.isolatedInstall = installed.status === 0 ? 'PASS' : 'FAIL';
    if (installed.status !== 0) throw new Error(`${kind} isolated npm install failed (${installed.status})`);

    let packageRoot;
    let pin;
    try {
      packageRoot = await realpath(path.join(prefix, 'node_modules', '@dev-foundry', 'claude-adapter'));
      pin = inspectPin(packageRoot); verifyPin(kind, pin); outcomes.payloadPin = 'PASS';
    }
    catch (error) { outcomes.payloadPin = 'FAIL'; throw error; }
    outcomes.payload = { version: pin.version, expect: pin.expect, root: pin.root, verified: true };
    const binDir = path.join(prefix, 'node_modules', '.bin');
    const shims = shimNamesForPlatform(process.platform);
    try {
      for (const name of shims) {
        const file = path.join(binDir, name);
        if (!existsSync(file)) throw new Error(`Missing ${process.platform} npm bin shim: ${name}`);
        const resolved = await realpath(file);
        if (!within(prefix, resolved)) throw new Error(`npm bin shim escapes isolated prefix: ${name} (${resolved})`);
      }
      outcomes.nativeShims = 'PASS';
    } catch (error) { outcomes.nativeShims = 'FAIL'; throw error; }
    outcomes.shims = shims.map((name) => ({ name, exists: true, insidePrefix: true }));

    outcomes.cli = {};
    for (const [label, args] of [['version', ['--version']], ['migration', ['migration']]]) {
      const statusKey = label === 'version' ? 'packagedCliVersion' : 'migrationInspection';
      try {
        const result = execute(process.execPath, [path.join(packageRoot, 'bin', 'dev-foundry-claude.js'), ...args], scratch, 30_000);
        outcomes.cli[label] = { exitCode: result.status, stdout: result.stdout.trim().slice(0, 4000), stderr: result.stderr.trim().slice(0, 2000) };
        const valid = result.status === 0 && (label !== 'version' || result.stdout.trim() === RELEASES[kind].version);
        outcomes[statusKey] = valid ? 'PASS' : 'FAIL';
        if (!valid) throw new Error(`${kind} packaged CLI ${label} check failed (exit ${result.status})`);
      } catch (error) { outcomes[statusKey] = 'FAIL'; throw error; }
    }
    outcomes.scratchBoundary = within(scratch, packageRoot) ? 'PASS' : 'FAIL';
    if (outcomes.scratchBoundary !== 'PASS') throw new Error(`${kind} installed package escaped scratch`);
    return packageRoot;
  } catch (error) {
    if (outcomes.npmVersion.status === 'NOT_RUN') outcomes.npmVersion = { status: 'FAIL', version: null, exitCode: null, stderr: '' };
    outcomes.failure = { message: error.message, code: error.code ?? null };
    throw error;
  }
}

function newCheckRecord() {
  return { officialArchive: 'NOT_RUN', npmVersion: { status: 'NOT_RUN' }, isolatedInstall: 'NOT_RUN', installResult: null,
    payloadPin: 'NOT_RUN', payload: null, nativeShims: 'NOT_RUN', shims: [], packagedCliVersion: 'NOT_RUN',
    migrationInspection: 'NOT_RUN', cli: {}, scratchBoundary: 'NOT_RUN', failure: null };
}

async function probe(args) {
  const reportRoot = await realpath(path.resolve(args['--report-root'] ?? process.env.TSK026_REPORT_ROOT ?? os.tmpdir()));
  if (!(await stat(reportRoot)).isDirectory()) throw new Error('Report root must be an existing directory');
  const scratch = await (await import('node:fs/promises')).mkdtemp(path.join(reportRoot, `tsk026-native-155-${process.platform}-`));
  const reportPath = path.join(scratch, 'report.json');
  const report = { schema: 'tsk026.native-acceptance.v1', status: 'FAIL', host: { platform: process.platform, release: os.release(), arch: process.arch,
    node: process.version, npm: null }, scratch: await realpath(scratch), archives: {}, checks: { source: newCheckRecord(), target: newCheckRecord() }, gaps: [
      'No disposable consumer upgrade/recovery scenario was run; this harness verifies released package installation and read-only CLI behavior only.',
      'Live Claude/Operator flow, exhaustive process-kill recovery, MCP/dashboard/telemetry parity, and TSK-026 matrix A-J remain outside this probe.'
    ] };
  let failure;
  try {
    if (!supportsNodeVersion(process.version)) throw new Error('Node 20 or later is required');
    for (const kind of ['target', 'source']) {
      const supplied = args[kind === 'target' ? '--target-archive' : '--source-archive'];
      report.checks[kind].officialArchive = 'FAIL';
      const archive = await acquire(kind, supplied, scratch);
      report.archives[kind] = { ...archive.identity, supplied: Boolean(supplied), verified: true };
      report.checks[kind].officialArchive = 'PASS';
    }
    if (!['win32', 'darwin'].includes(process.platform)) throw new Error(`Unsupported native acceptance host: ${process.platform}`);
    for (const kind of ['source', 'target']) {
      const root = await installAndInspect(kind, { file: path.join(scratch, `${kind}-${RELEASES[kind].version}.tgz`) }, scratch, report);
      if (!within(scratch, root)) throw new Error(`${kind} installed package escaped scratch`);
    }
    report.status = 'PASS';
  } catch (error) {
    failure = error;
    report.failure = { message: error.message, code: error.code ?? null };
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ status: report.status, report: reportPath, platform: process.platform })}\n`);
  }
  if (failure) throw Object.assign(new Error(failure.message), { reportPath });
  return report;
}

const ownPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ownPath) {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
  if (args) probe(args).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
