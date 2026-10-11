import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { canonicalJson } from '../../src/adopt/pin.js';
import { acquireLock, newOwner, runtimeUpgradeStatus } from '../../src/runtime/journal.js';
import { prepare } from '../../src/runtime/transition.js';
import { fixture, gitCommit, put } from './plan.test.js';

test('missing or negated repository ignore and unsafe journal root block before untracked state', t => {
  const f = fixture(t, { ignore: false });
  assert.throws(() => prepare(f.input), /journal-ignore-required/); assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
  put(f.a.root, '.gitignore', '/.dfc-runtime-upgrade/\n!/.dfc-runtime-upgrade/\n'); gitCommit(f.a.root);
  assert.throws(() => prepare(f.input), /journal-ignore-required/); assert.equal(existsSync(path.join(f.a.root, '.dfc-runtime-upgrade')), false);
});
test('existing empty, truncated, unknown, torn or symlinked journal is blocked rather than absent/overwritten', t => {
  const f = fixture(t), dir = path.join(f.a.root, '.dfc-runtime-upgrade');
  mkdirSync(dir); assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown'); assert.throws(() => prepare(f.input));
  put(f.a.root, '.dfc-runtime-upgrade/intent.json', '{'); assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown');
  rmSync(dir, { recursive: true }); symlinkSync(f.b.root, dir); assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown'); assert.throws(() => prepare(f.input));
});
test('checkpoint seals, missing backups, fragments, unknown files and concurrent locks fail closed and retain original bytes', t => {
  const f = fixture(t); prepare(f.input); const dir = path.join(f.a.root, '.dfc-runtime-upgrade');
  const owner = newOwner('first'), release = acquireLock(f.a.root, owner);
  assert.throws(() => acquireLock(f.a.root, newOwner('second')), /lock-conflict/);
  assert.throws(() => acquireLock(f.a.root, newOwner('second'), { reconcile: owner }), /lock-conflict/); release();
  const checkpoint = path.join(dir, 'checkpoint-000001.json'), original = readFileSync(checkpoint);
  const record = JSON.parse(original); record.state = 'completed'; writeFileSync(checkpoint, canonicalJson(record));
  assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown'); writeFileSync(checkpoint, original);
  const backup = path.join(dir, 'stage-0.json'), bytes = readFileSync(backup); rmSync(backup);
  assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown'); writeFileSync(backup, bytes);
  put(f.a.root, '.dfc-runtime-upgrade/unexpected.json', '{}'); assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown');
  assert.deepEqual(readFileSync(checkpoint), original); assert.deepEqual(readFileSync(backup), bytes);
});
test('retained original approval is sealed and cannot be silently changed in the intent', t => {
  const f = fixture(t); prepare(f.input);
  const file = path.join(f.a.root, '.dfc-runtime-upgrade/intent.json'), original = readFileSync(file), intent = JSON.parse(original);
  assert.deepEqual(intent.authorization.approval, f.input.approval);
  intent.authorization.approval.operator = 'other operator'; writeFileSync(file, canonicalJson(intent));
  assert.equal(runtimeUpgradeStatus(f.a.root).state, 'unknown');
  writeFileSync(file, original); assert.equal(runtimeUpgradeStatus(f.a.root).state, 'prepared');
});
