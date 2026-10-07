import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { selfPin, sha256 } from '../../src/adopt/pin.js';

// Archived producer artifacts, not regenerated packages with invented roots.
export async function legacyPackage(t, version = '1.2.2') {
  const bundle = JSON.parse(await readFile(new URL('./legacy-packages.bundle.json', import.meta.url), 'utf8'));
  const entry = bundle.packages.find((entry) => entry.id === version) ?? bundle.packages.find((entry) => entry.version === version);
  const bytes = Buffer.from(entry.base64, 'base64'); assert.equal(sha256(bytes), entry.sha256);
  const root = await mkdtemp(path.join(os.tmpdir(), 'tsk021-released-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tarball = path.join(root, 'release.tgz'); await writeFile(tarball, bytes);
  execFileSync('tar', ['-xzf', tarball, '-C', root]);
  const source = path.join(root, 'package'); const pin = selfPin(source);
  assert.equal(pin.expect, entry.expect);
  return { source, old: { version: pin.version, payloadRoot: pin.root, expect: pin.expect } };
}
