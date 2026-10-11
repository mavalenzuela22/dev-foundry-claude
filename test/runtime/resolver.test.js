import assert from 'node:assert/strict';
import { chmodSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { resolveRuntime } from '../../src/runtime/resolver.js';
import { promoteRuntime, stageRuntime } from '../../src/runtime/store.js';
import { attestation, consumer, ENTRIES, fakeRuntime, replaceSealed, scratch } from './identity.test.js';

test('two differently pinned consumers resolve independently without any consumer writes', (t) => {
  const a = fakeRuntime(t), b = fakeRuntime(t, { version: '1.5.0' });
  const ca = consumer(t, a.expect), cb = consumer(t, b.expect), storeRoot = path.join(scratch(t), 'store');
  const snapshots = [ca, cb].map(c => readFileSync(path.join(c.root, '.mcp.json')));
  const install = r => promoteRuntime(stageRuntime({ storeRoot, candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect) }));
  const aa = install(a); assert.equal(resolveRuntime({ cwd: ca.root, storeRoot }).runtime.packageRoot, aa.packageRoot);
  assert.throws(() => resolveRuntime({ cwd: cb.root, storeRoot }));
  const bb = install(b);
  assert.equal(resolveRuntime({ cwd: ca.root, storeRoot }).runtime.packageRoot, aa.packageRoot);
  assert.equal(resolveRuntime({ cwd: cb.root, storeRoot }).runtime.packageRoot, bb.packageRoot);
  for (const [i, c] of [ca, cb].entries()) assert.deepEqual(readFileSync(path.join(c.root, '.mcp.json')), snapshots[i]);
});
test('missing/damaged selected source blocks rather than falling back to another installed build', (t) => {
  const a = fakeRuntime(t), b = fakeRuntime(t, { body: 'other-build' });
  const ca = consumer(t, a.expect), storeRoot = path.join(scratch(t), 'store');
  const install = r => promoteRuntime(stageRuntime({ storeRoot, candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect) }));
  install(b); assert.throws(() => resolveRuntime({ cwd: ca.root, storeRoot }));
  const aa = install(a); replaceSealed(path.join(aa.packageRoot, ENTRIES[0]), 'tampered');
  assert.throws(() => resolveRuntime({ cwd: ca.root, storeRoot }));
  chmodSync(path.join(aa.packageRoot, 'bin'), 0o700);
  rmSync(path.join(aa.packageRoot, ENTRIES[0])); chmodSync(path.join(aa.packageRoot, 'bin'), 0o500);
  assert.throws(() => resolveRuntime({ cwd: ca.root, storeRoot }));
});
