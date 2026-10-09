import assert from 'node:assert/strict';
import { chmodSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildManifestBytes, formatExpect, rootOf } from '../../src/adopt/pin.js';
import { dispatchPlan } from '../../src/runtime/dispatch.js';
import { promoteRuntime, stageRuntime } from '../../src/runtime/store.js';
import { attestation, consumer, ENTRIES, fakeRuntime, scratch } from './identity.test.js';

test('read-only dispatch inventories exactly one verified package, without executing stub entrypoints', (t) => {
  const r = fakeRuntime(t), c = consumer(t, r.expect), storeRoot = path.join(scratch(t), 'store');
  const p = promoteRuntime(stageRuntime({ storeRoot, candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect) }));
  const before = readFileSync(path.join(c.root, '.mcp.json'));
  const plan = dispatchPlan({ cwd: c.root, storeRoot });
  assert.equal(plan.execution, 'deferred-B3'); assert.equal(plan.expect, r.expect);
  assert.deepEqual(plan.entrypoints.mcp.args, ['mcp', '--expect', r.expect]);
  const flatten = value => typeof value === 'string' ? [value] : Array.isArray(value) ? [] : Object.values(value).flatMap(flatten);
  const paths = flatten(plan.entrypoints).filter(s => path.isAbsolute(s));
  assert.equal(paths.length, 11);
  for (const file of paths) assert.ok(file.startsWith(p.packageRoot + path.sep));
  assert.deepEqual(readFileSync(path.join(c.root, '.mcp.json')), before);
  assert.deepEqual(dispatchPlan({ cwd: c.root, storeRoot }), plan, 'deterministic repeat');
});
test('missing ownership/entrypoints and escaped entrypoints never produce a dispatch plan', (t) => {
  const r = fakeRuntime(t), c = consumer(t, r.expect), storeRoot = path.join(scratch(t), 'store');
  const p = promoteRuntime(stageRuntime({ storeRoot, candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect) }));
  chmodSync(path.join(p.packageRoot, 'bin'), 0o700); rmSync(path.join(p.packageRoot, ENTRIES[0]));
  symlinkSync(path.join(r.root, ENTRIES[0]), path.join(p.packageRoot, ENTRIES[0])); chmodSync(path.join(p.packageRoot, 'bin'), 0o500);
  assert.throws(() => dispatchPlan({ cwd: c.root, storeRoot }));
  const incomplete = fakeRuntime(t, { files: { 'package.json': JSON.stringify({ name: '@dev-foundry/claude-adapter', version: '1.4.2' }) } });
  // A valid manifest can omit a required component; dispatch still blocks.
  const manifest = JSON.parse(incomplete.manifest); manifest.files = manifest.files.filter(e => e.path !== ENTRIES[1]);
  rmSync(path.join(incomplete.root, ENTRIES[1]));
  const bytes = buildManifestBytes({ version: '1.4.2', entries: manifest.files });
  writeFileSync(path.join(incomplete.root, 'payload-manifest.json'), bytes);
  const expect = formatExpect('1.4.2', rootOf(bytes));
  const c2 = consumer(t, expect);
  promoteRuntime(stageRuntime({ storeRoot, candidateRoot: incomplete.root, permittedCandidateRoots: [incomplete.root], expect, attestation: attestation(expect) }));
  assert.throws(() => dispatchPlan({ cwd: c2.root, storeRoot }), /entrypoint-unowned/);
});
