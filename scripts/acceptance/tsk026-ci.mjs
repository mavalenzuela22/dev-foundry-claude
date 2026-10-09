// TSK-026 B4C1 diagnostic only. No release acquisition, publisher authentication,
// global install, consumer selection, target lifecycle execution or acceptance promotion.
import { execFileSync, spawnSync } from 'node:child_process';
import { appendFileSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { buildManifestBytes, canonicalJson, sha256, verifyPayload } from '../../src/adopt/pin.js';

const REPOSITORY = 'mavalenzuela22/dev-foundry-claude';
const PACKAGE = '@dev-foundry/claude-adapter';
const BINS = Object.freeze({ 'dev-foundry-claude': 'bin/dev-foundry-claude.js',
  'dev-foundry-claude-launcher': 'bin/dev-foundry-claude-launcher.js' });
const BUNDLES = Object.freeze({ '@modelcontextprotocol/server': '2.2.0', yaml: '2.9.1', zod: '4.6.5' });
const check = (condition, message) => { if (!condition) throw Error(message); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const digest = value => /^[a-f0-9]{64}$/.test(value ?? '');
const portable = value => typeof value === 'string' && !/[\\:\x00-\x1f]/.test(value) &&
  value.split('/').every(p => p && p !== '.' && p !== '..' && !/[. ]$/.test(p) &&
    !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p));

// Read and verify tar bytes in memory BEFORE npm sees them. No extraction here.
// Only regular files/directories and bounded POSIX PAX path/metadata are allowed.
export function inspectArchive(bytes) {
  check(Buffer.isBuffer(bytes) && bytes.length <= 64 * 1024 * 1024, 'archive exceeds bound');
  const tar = gunzipSync(bytes, { maxOutputLength: 128 * 1024 * 1024 });
  const files = new Map(), names = new Map(), entries = new Set();
  let offset = 0, pax = {}, ended = false;
  const field = (b, a, n) => b.subarray(a, a + n).toString('utf8').replace(/\0.*$/s, '');
  const octal = value => { check(/^[0-7]+$/.test(value.trim()), 'invalid tar number'); return parseInt(value.trim(), 8); };
  while (offset + 512 <= tar.length) {
    const h = tar.subarray(offset, offset + 512); offset += 512;
    if (h.every(b => b === 0)) { ended = true; break; }
    const sum = [...h].reduce((n, b, i) => n + (i >= 148 && i < 156 ? 32 : b), 0);
    check(octal(field(h, 148, 8)) === sum, 'invalid tar checksum');
    const size = octal(field(h, 124, 12));
    check(Number.isSafeInteger(size) && offset + size <= tar.length, 'truncated tar entry');
    const body = tar.subarray(offset, offset + size); offset += Math.ceil(size / 512) * 512;
    const type = field(h, 156, 1);
    if (type === 'x') {
      check(size <= 65536 && !Object.keys(pax).length, 'unbounded PAX metadata');
      for (let pos = 0; pos < body.length;) {
        const space = body.indexOf(32, pos), length = Number(body.subarray(pos, space).toString());
        check(space > pos && Number.isSafeInteger(length) && length > space - pos + 1 && pos + length <= body.length && body[pos + length - 1] === 10, 'invalid PAX record');
        const record = body.subarray(space + 1, pos + length - 1).toString(), at = record.indexOf('=');
        const key = record.slice(0, at);
        check(at > 0 && ['path', 'mtime', 'atime', 'ctime', 'uid', 'gid', 'uname', 'gname'].includes(key) && !Object.hasOwn(pax, key), 'unsupported PAX metadata');
        pax[key] = record.slice(at + 1); pos += length;
      }
      continue;
    }
    check(['', '0', '5'].includes(type) && !field(h, 157, 100), 'archive links/devices/extensions refused');
    const prefix = field(h, 345, 155);
    const name = (pax.path ?? `${prefix ? `${prefix}/` : ''}${field(h, 0, 100)}`).replace(/\/$/, ''); pax = {};
    check(name.startsWith('package/') && portable(name) && names.size < 20000, 'unsafe archive path');
    for (let i = 1, parts = name.split('/'); i <= parts.length; i++) {
      const item = parts.slice(0, i).join('/'), folded = item.toLowerCase();
      check(!names.has(folded) || names.get(folded) === item, 'ambiguous archive path'); names.set(folded, item);
    }
    const relative = name.slice(8);
    check(!entries.has(relative), 'duplicate archive entry'); entries.add(relative);
    for (let parent = path.posix.dirname(relative); parent !== '.'; parent = path.posix.dirname(parent)) {
      check(!files.has(parent), 'file is archive ancestor');
    }
    check(type === '5' || ![...entries].some(p => p.startsWith(`${relative}/`)), 'archive file/directory collision');
    if (type === '5') { check(size === 0, 'directory has bytes'); continue; }
    files.set(relative, body);
  }
  check(ended && !Object.keys(pax).length && tar.subarray(offset).every(b => b === 0), 'incomplete/trailing tar data');
  const manifestBytes = files.get('payload-manifest.json');
  check(manifestBytes && manifestBytes.length <= 4 * 1024 * 1024, 'payload manifest missing');
  const manifest = JSON.parse(manifestBytes), pkg = JSON.parse(files.get('package.json'));
  check(manifest.format === 'dev-foundry.payload-manifest.v1' && Array.isArray(manifest.files) &&
    manifestBytes.equals(buildManifestBytes({ version: manifest.version, entries: manifest.files })), 'noncanonical payload manifest');
  check(pkg.name === PACKAGE && pkg.version === '1.4.2' && manifest.version === pkg.version &&
    equal(pkg.bin, BINS) && equal(pkg.dependencies, BUNDLES) &&
    equal([...pkg.bundleDependencies].sort(), Object.keys(BUNDLES).sort()), 'wrong source package identity/bins/bundles');
  check(files.size === manifest.files.length + 1, 'archive file set mismatch');
  const listed = new Set();
  for (const entry of manifest.files) {
    check(portable(entry.path) && entry.path !== 'payload-manifest.json' && !listed.has(entry.path), 'unsafe/duplicate manifest path');
    listed.add(entry.path);
    const body = files.get(entry.path);
    check(body && body.length === entry.size && sha256(body) === entry.sha256, 'archive payload digest mismatch');
  }
  for (const required of [...Object.values(BINS), 'framework/dev-foundry-2.1.0.bundle.json',
    'migrations/release.json', 'src/runtime/identity.js', 'src/runtime/store.js',
    'tools/dashboard/dist/index.html', ...Object.keys(BUNDLES).map(n => `node_modules/${n}/package.json`)]) {
    check(listed.has(required), `required bundled file missing: ${required}`);
  }
  for (const [name, version] of Object.entries(BUNDLES)) {
    const bundled = JSON.parse(files.get(`node_modules/${name}/package.json`));
    check(bundled.name === name && bundled.version === version, 'wrong bundled dependency identity');
  }
  return { name: pkg.name, version: pkg.version, selfPin: `${pkg.version}:sha256:${sha256(manifestBytes)}`,
    bins: pkg.bin, payloadManifestSha256: sha256(manifestBytes), payloadFiles: manifest.files.length };
}

function binding(value) {
  check(/^[a-f0-9]{40}$/.test(value.producerSha ?? '') && /^[1-9]\d*$/.test(value.runId ?? '') &&
    /^[1-9]\d*$/.test(value.runAttempt ?? ''), 'invalid producer/run binding');
  return { producerSha: value.producerSha, runId: value.runId, runAttempt: value.runAttempt };
}
export function candidateManifest(bytes, expected) {
  return { schema: 'dev-foundry.tsk026-ci-candidate.v1', repository: REPOSITORY,
    kind: 'unreleased-candidate', officialSource: false, archive: 'candidate.tgz',
    ...binding(expected), sha256: sha256(bytes), package: inspectArchive(bytes) };
}
export function verifyCandidate(bytes, manifest, expected) {
  check(digest(expected.sha256) && sha256(bytes) === expected.sha256, 'candidate SHA-256 mismatch');
  const observed = candidateManifest(bytes, expected);
  check(equal(manifest, observed), 'candidate producer/commit/source manifest mismatch');
  check(observed.package.selfPin === expected.selfPin, 'candidate self-pin mismatch');
  return observed.package;
}

// The system temporary root may itself use an OS alias (/var on macOS).
// Descendants must be exact, local, non-link paths; no caller-selected prefix.
export function tempChild(tempRoot, name) {
  check(path.isAbsolute(tempRoot) && !tempRoot.split(/[\\/]/).includes('..') && !/[\x00-\x1f]/.test(tempRoot) && portable(name), 'unsafe temporary path');
  const root = realpathSync(tempRoot), target = path.join(root, ...name.split('/'));
  check(lstatSync(root).isDirectory(), 'temporary root missing');
  for (let cursor = root, parts = name.split('/'), i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    try {
      const stat = lstatSync(cursor);
      check(!stat.isSymbolicLink() && (i === parts.length - 1 || stat.isDirectory()), 'temporary link/non-directory refused');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}
export function installArguments(archive, prefix) {
  check(path.isAbsolute(archive) && path.isAbsolute(prefix), 'exact install paths required');
  return ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--offline', '--prefix', prefix, archive];
}
export function inspectShims(prefix, installed, platform = process.platform) {
  check(['darwin', 'win32', 'linux'].includes(platform), 'unsupported shim platform');
  return Object.entries(BINS).flatMap(([bin, entry]) => {
    const names = platform === 'win32' ? [bin, `${bin}.cmd`, `${bin}.ps1`] : [bin];
    return names.map(name => {
      const file = path.join(prefix, 'node_modules', '.bin', name), stat = lstatSync(file);
      if (platform === 'win32') {
        check(stat.isFile() && !stat.isSymbolicLink() && readFileSync(file, 'utf8').replaceAll('\\', '/').includes(entry), 'Windows npm shim missing/wrong target');
      } else {
        check(stat.isSymbolicLink() && realpathSync(file) === realpathSync(path.join(installed, entry)) &&
          (lstatSync(path.join(installed, entry)).mode & 0o111), 'POSIX npm shim missing/wrong target');
      }
      return { name, file, kind: stat.isSymbolicLink() ? 'symlink' : 'file',
        target: stat.isSymbolicLink() ? readlinkSync(file) : entry, native: platform === process.platform };
    });
  });
}
export function pendingReceipt(expected, host = { os: process.platform, release: os.release(), arch: process.arch, node: process.version }) {
  return { schema: 'dev-foundry.tsk026-ci-report.v1', task: 'TSK-026', boundary: 'B4C1',
    repository: REPOSITORY, ...binding(expected), host, candidateKind: 'unreleased-candidate',
    packageSha256: expected.sha256 ?? null, packageVersion: null, selfPin: expected.selfPin ?? null,
    installedPackageLocation: null, binShims: [], testExitCode: null, testSignal: null,
    probe: 'PENDING', acceptance: 'BLOCKED', errors: [], coverage: {
      candidateInstall: 'PENDING', nativeBinShims: 'PENDING', nativePermissions: 'PENDING',
      official142Source: 'PENDING', liveClaudeOperator: 'PENDING', durableCutover: 'PENDING',
      windowsAclReparseHardlinks: host.os === 'win32' ? 'BLOCKED' : 'PENDING',
      windowsLockedFileRecovery: 'PENDING', otherNativeHost: 'PENDING', independentAudit: 'PENDING',
      fullSuite: 'PENDING', suiteScope: 'candidate checkout tests, including synthetic packaging fixtures; not official release or live model proof',
    }, blockers: ['Windows native ACL/owner, reparse/hardlink and durable storage capability unresolved',
      'Authentic GitHub v1.4.2 source acquisition and unchanged live source session unverified',
      'Real source-governed Claude + Operator semantic decisions and fresh target session unverified',
      'Actual durable cutover/recovery and independent acceptance not established'] };
}
export function probeExit(report) {
  return report.probe === 'PASS' && report.testExitCode === 0 &&
    report.coverage.candidateInstall === 'PASS' && report.coverage.nativeBinShims === 'PASS' &&
    report.coverage.nativePermissions === 'PASS' && ['darwin', 'win32'].includes(report.host.os) ? 0 : 1;
}

function context() {
  check(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'pull_request', 'only disposable read-only PR CI permitted');
  check(process.env.GITHUB_REPOSITORY === REPOSITORY && process.env.GITHUB_HEAD_REF === 'task/tsk-026-implementation-preparation', 'wrong PR repository/HEAD branch');
  check(Number(process.versions.node.split('.')[0]) >= 20, 'Node >=20 required');
  const root = realpathSync(process.env.GITHUB_WORKSPACE), temp = realpathSync(process.env.RUNNER_TEMP);
  const inside = (a, b) => { const rel = path.relative(a, b); return !rel.startsWith(`..${path.sep}`) && rel !== '..' && !path.isAbsolute(rel); };
  check(!inside(root, temp) && !inside(temp, root) && temp !== realpathSync(os.homedir()), 'temporary root overlaps producer/home');
  const expected = { producerSha: process.env.PRODUCER_SHA, runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT, sha256: process.env.CANDIDATE_SHA256, selfPin: process.env.CANDIDATE_PIN };
  binding(expected);
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  check(head === expected.producerSha, 'checkout differs from exact PR head');
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json')));
  check(pkg.name === PACKAGE && pkg.version === '1.4.2', 'wrong producer package');
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH));
  check(event.pull_request?.head?.sha === head && event.pull_request?.base?.ref === 'main', 'wrong PR event binding');
  return { root, temp, expected };
}
export function npmCli() {
  const executableRoot = path.dirname(process.execPath);
  const candidates = [path.join(executableRoot, 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(executableRoot, '../lib/node_modules/npm/bin/npm-cli.js')];
  const cli = candidates.find(existsSync);
  check(cli, 'npm CLI unavailable beside pinned Node'); return realpathSync(cli);
}
function npmRun(args, cwd, temp, timeout, logName) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(npm_|NODE_OPTIONS$|GIT_|DEV_FOUNDRY_|OTEL_|CLAUDE)/i.test(k)));
  const config = tempChild(temp, 'tsk026-npmrc');
  const globalConfig = tempChild(temp, 'tsk026-global-npmrc');
  if (!existsSync(config)) writeFileSync(config, '', { flag: 'wx' });
  if (!existsSync(globalConfig)) writeFileSync(globalConfig, '', { flag: 'wx' });
  Object.assign(env, { npm_config_cache: tempChild(temp, 'tsk026-npm-cache'),
    npm_config_userconfig: config, npm_config_globalconfig: globalConfig, npm_config_update_notifier: 'false' });
  const result = spawnSync(process.execPath, [npmCli(), ...args], { cwd, env, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024, shell: false });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (logName) writeFileSync(tempChild(temp, `tsk026-reports/${logName}`), output);
  console.log(output);
  return { ...result, output };
}
function save(temp, report) {
  const dir = tempChild(temp, 'tsk026-reports'); mkdirSync(dir, { recursive: true });
  writeFileSync(tempChild(temp, 'tsk026-reports/result.json'), canonicalJson(report));
}
async function native(c) {
  const { root, temp, expected } = c, report = pendingReceipt(expected);
  save(temp, report);
  const work = mkdtempSync(tempChild(temp, 'tsk026-install-'));
  try {
    const bytes = readFileSync(tempChild(temp, 'tsk026-candidate/candidate.tgz'));
    const manifestBytes = readFileSync(tempChild(temp, 'tsk026-candidate/manifest.json'));
    check(digest(process.env.MANIFEST_SHA256) && sha256(manifestBytes) === process.env.MANIFEST_SHA256, 'artifact manifest SHA mismatch');
    const pkg = verifyCandidate(bytes, JSON.parse(manifestBytes), expected);
    report.packageVersion = pkg.version; report.selfPin = pkg.selfPin;
    const archive = path.join(work, 'candidate.tgz'), prefix = path.join(work, 'prefix');
    copyFileSync(tempChild(temp, 'tsk026-candidate/candidate.tgz'), archive);
    check(sha256(readFileSync(archive)) === expected.sha256, 'copied archive changed');
    mkdirSync(prefix);
    const install = npmRun(installArguments(archive, prefix), work, temp, 180000, 'install.log');
    check(!install.error && install.status === 0, 'isolated install failed');
    const installed = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
    report.installedPackageLocation = installed;
    verifyPayload(installed, pkg.selfPin);
    const metadata = JSON.parse(readFileSync(path.join(installed, 'package.json')));
    check(metadata.name === pkg.name && metadata.version === pkg.version && equal(metadata.bin, pkg.bins), 'installed manifest identity mismatch');
    report.coverage.candidateInstall = 'PASS';
    report.binShims = inspectShims(prefix, installed);
    report.coverage.nativeBinShims = ['darwin', 'win32'].includes(process.platform) ? 'PASS' : 'BLOCKED';
    // Load only the verified installed manager. Probe its read-only permission
    // check against an empty isolated store; never stage/approve a fake release.
    const storeRoot = path.join(work, 'empty-store'); mkdirSync(storeRoot, { mode: 0o700 });
    const { installedRuntime } = await import(pathToFileURL(path.join(installed, 'src/runtime/store.js')));
    try { installedRuntime(storeRoot, pkg.selfPin); throw Error('empty store unexpectedly accepted'); }
    catch (error) {
      report.permissionObservation = { code: error.code ?? null, message: error.message, scope: 'empty-store read-only permission diagnostic' };
      if (process.platform === 'win32' && error.code === 'store-permissions-unsupported') report.coverage.nativePermissions = 'BLOCKED';
      else if (process.platform === 'darwin' && error.code === 'ENOENT') report.coverage.nativePermissions = 'PASS';
      else throw error;
    }
    // No host-ready => full PASS inference. The preflight is informational.
    const preflight = spawnSync(process.execPath, ['scripts/acceptance/tsk026-host.mjs', '--preflight'],
      { cwd: root, encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
    report.hostPreflight = { exitCode: preflight.status, output: preflight.stdout, error: preflight.error?.message ?? null, acceptanceAuthority: false };
    report.probe = report.coverage.nativePermissions === 'BLOCKED' ? 'BLOCKED' : 'PASS';
  } catch (error) {
    report.probe = 'FAIL'; report.errors.push(error.message);
  } finally {
    save(temp, report); // Preserve observations even if suite is interrupted.
    try {
      const tests = npmRun(['test'], root, temp, 19 * 60 * 1000, 'npm-test.log');
      report.testExitCode = tests.status; report.testSignal = tests.signal;
      report.coverage.fullSuite = !tests.error && tests.status === 0 ? 'PASS' : 'FAIL';
      if (tests.error) report.errors.push(tests.error.message);
      if (report.coverage.fullSuite === 'FAIL') report.probe = 'FAIL';
    } catch (error) { report.errors.push(error.message); report.probe = 'FAIL'; }
    // Delete only the exact mkdtemp tree created by this invocation. No PID,
    // listener, home, checkout or consumer cleanup.
    try { rmSync(work, { recursive: true, force: true }); report.fixturesCleaned = true; }
    catch (error) { report.errors.push(`fixture cleanup: ${error.message}`); report.probe = 'FAIL'; }
    save(temp, report);
  }
  return probeExit(report);
}
export async function main(args = process.argv.slice(2)) {
  check(args.length === 1 && ['candidate', 'init', 'native', 'verdict'].includes(args[0]), 'usage: tsk026-ci.mjs candidate|init|native|verdict (PR CI only)');
  const c = context();
  if (args[0] === 'init') { save(c.temp, pendingReceipt(c.expected)); return 0; }
  if (args[0] === 'native') return native(c);
  if (args[0] === 'candidate') {
    const out = tempChild(c.temp, 'tsk026-candidate'); mkdirSync(out);
    const packed = npmRun(['pack', '--json', '--pack-destination', out], c.root, c.temp, 240000);
    check(!packed.error && packed.status === 0, 'normal prepack failed');
    const info = JSON.parse(packed.stdout);
    check(info.length === 1 && portable(info[0].filename) && !info[0].filename.includes('/'), 'unexpected pack filename');
    const original = tempChild(c.temp, `tsk026-candidate/${info[0].filename}`);
    const archive = tempChild(c.temp, 'tsk026-candidate/candidate.tgz'); copyFileSync(original, archive); rmSync(original);
    const manifest = candidateManifest(readFileSync(archive), c.expected);
    const bytes = Buffer.from(canonicalJson(manifest));
    writeFileSync(tempChild(c.temp, 'tsk026-candidate/manifest.json'), bytes, { flag: 'wx' });
    writeFileSync(tempChild(c.temp, 'tsk026-candidate/SHA256SUMS'), `${manifest.sha256}  candidate.tgz\n${sha256(bytes)}  manifest.json\n`, { flag: 'wx' });
    appendFileSync(process.env.GITHUB_OUTPUT, `sha256=${manifest.sha256}\npin=${manifest.package.selfPin}\nmanifest_sha256=${sha256(bytes)}\n`);
    console.log(`Unreleased candidate only: ${manifest.producerSha} ${manifest.sha256} ${manifest.package.selfPin}`); return 0;
  }
  const report = JSON.parse(readFileSync(tempChild(c.temp, 'tsk026-reports/result.json')));
  check(equal(binding(report), binding(c.expected)) && report.host.os === process.platform && report.host.node === process.version &&
    report.packageSha256 === c.expected.sha256 && report.selfPin === c.expected.selfPin && report.acceptance === 'BLOCKED', 'receipt binding/acceptance mismatch');
  const summary = `TSK-026 B4C1 ${report.host.os}: diagnostic=${report.probe}; npm test=${report.testExitCode ?? 'NOT RUN'}; B4 acceptance=BLOCKED.\nProducer ${report.producerSha}; candidate ${report.packageSha256}.\n${report.blockers.join('\n')}\n`;
  console.log(summary); appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
  return probeExit(report);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then(code => { process.exitCode = code; }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
