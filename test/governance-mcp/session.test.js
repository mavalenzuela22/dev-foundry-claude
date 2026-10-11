import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createSessionGuard } from '../../src/governance-mcp/session.js';
import { commit, prepare, verify } from '../../src/runtime/transition.js';
import { fixture } from '../runtime/plan.test.js';

test('unknown/partial runtime transaction never looks absent at startup', async t => {
  const f = fixture(t), old = await createSessionGuard(f.a.root, f.source.expect);
  mkdirSync(path.join(f.a.root, '.dfc-runtime-upgrade'));
  assert.equal((await old()).errorCode, 'STALE_SESSION');
  assert.equal((await (await createSessionGuard(f.a.root, f.source.expect))()).errorCode, 'STALE_SESSION');
  writeFileSync(path.join(f.a.root, '.dfc-runtime-upgrade/intent.json'), '{"format":"unknown"}');
  assert.equal((await (await createSessionGuard(f.a.root))()).errorCode, 'STALE_SESSION');
});
test('commit barrier blocks old and new sessions even before the first live authority write', async t => {
  const f = fixture(t), old = await createSessionGuard(f.a.root, f.source.expect);
  prepare(f.input);
  assert.throws(() => commit({ ...f.input, failpoint: name => { if (name === 'after-checkpoint:committing') throw new Error('interrupted'); } }));
  assert.equal((await old()).errorCode, 'STALE_SESSION');
  assert.equal((await (await createSessionGuard(f.a.root, f.source.expect))()).errorCode, 'STALE_SESSION');
  assert.equal((await (await createSessionGuard(f.a.root, f.target.expect))()).errorCode, 'STALE_SESSION');
});
test('completed record is insufficient when retained backup bytes subsequently change', async t => {
  const f = fixture(t); prepare(f.input); commit(f.input); verify({ ...f.input, session: f.session });
  const guard = await createSessionGuard(f.a.root, f.target.expect); assert.equal(await guard(), null);
  writeFileSync(path.join(f.a.root, '.dfc-runtime-upgrade/stage-0.json'), '{}');
  assert.equal((await guard()).errorCode, 'STALE_SESSION');
  assert.equal((await (await createSessionGuard(f.a.root, f.target.expect))()).errorCode, 'STALE_SESSION');
});
