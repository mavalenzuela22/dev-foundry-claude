import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPayload } from '../../src/adopt/pin.js';
import { expectedShims, normalizeReport, pendingReport, PACKAGE, REPOSITORY } from './tsk026-report.mjs';

export const HELP = `TSK-026 B4A offline acceptance harness (Node >=20)
Usage: node scripts/acceptance/tsk026-host.mjs --help
       node scripts/acceptance/tsk026-host.mjs --preflight [--report <exact-local-json-file>]
Read-only: no network, archive extraction, installation, model invocation or consumer changes.
Report paths must be absolute regular JSON files, without symlinks or traversal.
External PASS requires independent native verification; report claims alone cannot establish it.
Exit codes: 0 host-ready (no acceptance claim), 2 pending/blocked, 1 invalid/failing.
B4B: official installed v1.4.2 one-time bridge and native macOS/Windows proof.
B4C: live source-governed Claude/Operator semantic decision and independent audit.
`;
export function exactLocalPath(value, directory = false) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || /[\x00-\x1f]/.test(value) ||
    /[\\/](?:\.\.?)(?:[\\/]|$)/.test(value) || value.includes('://')) throw Error('unsafe exact local path');
  let cursor = path.parse(value).root;
  const parts = value.slice(cursor.length).split(path.sep).filter(Boolean);
  for (const [i, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    const stat = lstatSync(cursor);
    if (stat.isSymbolicLink() || (i < parts.length - 1 && !stat.isDirectory())) throw Error('symlink or non-directory path');
  }
  const stat = lstatSync(cursor);
  if (directory ? !stat.isDirectory() : !stat.isFile()) throw Error('required regular file/directory missing');
  return cursor;
}
function readJson(file) {
  if (typeof file !== 'string' || path.extname(file) !== '.json') throw Error('only exact local .json reports accepted; archives refused');
  const bytes = readFileSync(exactLocalPath(file));
  if (bytes.length > 1024 * 1024) throw Error('JSON report exceeds bounded size');
  const value = JSON.parse(bytes);
  // Canonical form prevents duplicate keys, ambiguous reports and parser disagreement.
  if (bytes.toString().trim() !== JSON.stringify(value)) throw Error('report must be exact JSON.stringify form (no duplicate keys)');
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw Error('report must be an object');
  return value;
}
export function inspectInstalled(root, pkg) {
  exactLocalPath(root, true);
  const manifest = JSON.parse(readFileSync(exactLocalPath(path.join(root, 'payload-manifest.json'))));
  if (!Array.isArray(manifest.files)) throw Error('missing payload files');
  const names = new Map();
  for (const entry of manifest.files) {
    if (typeof entry.path !== 'string' || /[\\:\x00-\x1f]/.test(entry.path) || path.posix.isAbsolute(entry.path) ||
      entry.path.split('/').some(p => !p || p === '.' || p === '..')) throw Error('hostile payload path');
    const parts = entry.path.split('/');
    for (let i = 1; i <= parts.length; i++) {
      const name = parts.slice(0, i).join('/'), folded = name.toLowerCase();
      if (names.has(folded) && names.get(folded) !== name) throw Error('platform-ambiguous payload path');
      names.set(folded, name);
    }
    exactLocalPath(path.join(root, entry.path));
  }
  const metadata = JSON.parse(readFileSync(exactLocalPath(path.join(root, 'package.json'))));
  if (metadata.name !== PACKAGE || metadata.version !== pkg?.version) throw Error('installed package identity mismatch');
  verifyPayload(root, pkg.pin);
  return { root, pin: pkg.pin, bytesVerified: true, authenticity: 'unverified' };
}
export function inspectBinShims(binRoot, os = process.platform) {
  const root = exactLocalPath(binRoot, true);
  const shims = expectedShims(os);
  for (const shim of shims) exactLocalPath(path.join(root, shim));
  return { binRoot: root, os, shims, native: os === process.platform, authenticity: 'unverified' };
}
export function preflight({ repoRoot = fileURLToPath(new URL('../../', import.meta.url)), reportFile,
  host = { os: process.platform, arch: process.arch, node: process.version } } = {}) {
  try {
    const root = exactLocalPath(repoRoot, true);
    const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
    const git = args => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    exactLocalPath(path.join(root, '.git'), true);
    for (const file of ['HEAD', 'config']) exactLocalPath(path.join(root, '.git', file));
    exactLocalPath(path.join(root, '.git/objects'), true);
    if (realpathSync(git(['rev-parse', '--show-toplevel'])) !== root) throw Error('wrong repository root');
    const remote = git(['remote', 'get-url', 'origin']);
    if (![`git@github-personal:${REPOSITORY}`, `git@github.com:${REPOSITORY}.git`, `https://github.com/${REPOSITORY}.git`].includes(remote)) throw Error('wrong repository origin');
    const pkg = JSON.parse(readFileSync(exactLocalPath(path.join(root, 'package.json'))));
    if (pkg.name !== PACKAGE || pkg.version !== '1.4.2') throw Error('wrong producer package/version');
    const producerCommit = git(['rev-parse', 'HEAD']);
    const report = reportFile ? readJson(reportFile) : pendingReport({ producerCommit, ...host });
    const observations = {};
    for (const role of ['source', 'target']) {
      if (report.installed?.[role] !== null && report.installed?.[role] !== undefined) {
        observations[role] = inspectInstalled(report.installed[role], report[role]);
      }
    }
    if (report.installed?.binRoot != null) observations.binShims = inspectBinShims(report.installed.binRoot, host.os);
    const normalized = normalizeReport(report, { expectedCommit: producerCommit, host });
    const ready = ['darwin', 'win32'].includes(host.os) && Number(host.node.replace(/^v/, '').split('.')[0]) >= 20;
    const status = normalized.aggregate === 'FAIL' ? 'fail' : !reportFile && ready ? 'host-ready' : 'pending';
    return { status, acceptance: normalized.aggregate, readOnly: true, observations, report: normalized };
  } catch (error) {
    return { status: 'fail', acceptance: 'FAIL', readOnly: true, error: error.message,
      nextGates: ['Supply exact local regular JSON and matching producer/installed package identities; no remote URLs or archives.'] };
  }
}
export function main(args = process.argv.slice(2)) {
  if (args.length === 1 && args[0] === '--help') { console.log(HELP); return 0; }
  if (args[0] !== '--preflight' || !(args.length === 1 || (args.length === 3 && args[1] === '--report'))) {
    console.error(HELP); return 1;
  }
  const result = preflight({ reportFile: args[2] });
  console.log(JSON.stringify(result, null, 2));
  return result.status === 'host-ready' ? 0 : result.status === 'fail' ? 1 : 2;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();
