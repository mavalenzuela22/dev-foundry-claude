import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const MANIFEST_FORMAT = 'dev-foundry.payload-manifest.v1';
export const MANIFEST_NAME = 'payload-manifest.json';

const EXPECT_PATTERN = /^(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?):sha256:([0-9a-f]{64})$/;
// npm owns launch links/shims only as direct children of this package's .bin.
const isInstallerBinArtifact = (relative) => path.posix.dirname(relative) === 'node_modules/.bin';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export class PinError extends Error {
  constructor() {
    super('Adapter runtime verification failed.');
  }
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
  }
  return value;
}

// Canonical JSON: sorted keys, two-space indent, LF, trailing newline, no timestamps.
export const canonicalJson = (value) => `${JSON.stringify(sortValue(value), null, 2)}\n`;

const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function buildManifestBytes({ version, entries }) {
  const sorted = entries.map(({ path: p, sha256: h, size }) => ({ path: p, sha256: h, size })).sort(byPath);
  return Buffer.from(canonicalJson({ format: MANIFEST_FORMAT, version, files: sorted }), 'utf8');
}

export const rootOf = (manifestBytes) => sha256(manifestBytes);
export const formatExpect = (version, root) => `${version}:sha256:${root}`;

export function parseExpect(value) {
  if (typeof value !== 'string') throw new PinError();
  const match = EXPECT_PATTERN.exec(value);
  if (!match) throw new PinError();
  return { version: match[1], root: match[2] };
}

function walk(directory, relative, found) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    const full = path.join(directory, entry.name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) found.push({ rel, kind: 'link' });
    else if (stat.isDirectory()) walk(full, rel, found);
    else if (stat.isFile()) found.push({ rel, kind: 'file' });
    else found.push({ rel, kind: 'other' });
  }
}

// Verifies the installed package tree against the expected pin. Synchronous, no network.
// Any failure throws a generic PinError.
export function verifyPayload(packageRoot, expectValue) {
  let expect;
  try {
    expect = parseExpect(expectValue);
    const manifestBytes = readFileSync(path.join(packageRoot, MANIFEST_NAME));
    if (rootOf(manifestBytes) !== expect.root) throw new PinError();
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (manifest.format !== MANIFEST_FORMAT || !Array.isArray(manifest.files)) throw new PinError();
    if (!manifestBytes.equals(buildManifestBytes({ version: manifest.version, entries: manifest.files }))) throw new PinError();
    const pkg = JSON.parse(readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
    if (manifest.version !== pkg.version || manifest.version !== expect.version) throw new PinError();
    const listed = new Set();
    for (const entry of manifest.files) {
      if (typeof entry.path !== 'string' || typeof entry.sha256 !== 'string' || !Number.isInteger(entry.size)) throw new PinError();
      if (entry.path === MANIFEST_NAME || entry.path.startsWith('/') || entry.path.split('/').includes('..') || listed.has(entry.path)) throw new PinError();
      listed.add(entry.path);
      const full = path.join(packageRoot, ...entry.path.split('/'));
      const stat = lstatSync(full);
      if (!stat.isFile() || stat.size !== entry.size) throw new PinError();
      if (sha256(readFileSync(full)) !== entry.sha256) throw new PinError();
    }
    const found = [];
    walk(packageRoot, '', found);
    for (const item of found) {
      if (item.kind === 'other') throw new PinError();
      if (item.kind === 'link') {
        if (!isInstallerBinArtifact(item.rel)) throw new PinError();
        continue;
      }
      if (item.rel === MANIFEST_NAME) continue;
      if (!listed.has(item.rel) && !isInstallerBinArtifact(item.rel)) throw new PinError();
    }
    return { version: manifest.version, root: expect.root };
  } catch (error) {
    if (error instanceof PinError) throw error;
    throw new PinError();
  }
}

// Used by the adapter itself: derive its own pin from its shipped manifest, then verify it.
export function selfPin(packageRoot) {
  try {
    const manifestBytes = readFileSync(path.join(packageRoot, MANIFEST_NAME));
    const { version } = JSON.parse(manifestBytes.toString('utf8'));
    const expect = formatExpect(version, rootOf(manifestBytes));
    verifyPayload(packageRoot, expect);
    return { version, root: rootOf(manifestBytes), expect };
  } catch {
    throw new PinError();
  }
}
