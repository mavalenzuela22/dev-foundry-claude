import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { chmodSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildManifestBytes, formatExpect, rootOf, sha256 } from '../../src/adopt/pin.js';
import { runtimeIdentity } from '../../src/runtime/identity.js';
import { defaultStoreRoot, installedRuntime, promoteRuntime, stageRuntime, storePath } from '../../src/runtime/store.js';
import { attestation, consumer, ENTRIES, fakeRuntime, replaceSealed, scratch } from './identity.test.js';

const stage = (t, r, storeRoot = path.join(scratch(t), 'store'), extras = {}) => stageRuntime({ storeRoot,
  candidateRoot: r.root, permittedCandidateRoots: [r.root], expect: r.expect, attestation: attestation(r.expect), ...extras });

test('portable default cache paths and unsafe/unknown environment rejection', () => {
  assert.equal(defaultStoreRoot({ platform: 'win32', env: { LOCALAPPDATA: 'C:\\Users\\A\\AppData\\Local' }, home: '' }), 'C:\\Users\\A\\AppData\\Local\\dev-foundry-claude\\runtimes');
  assert.equal(defaultStoreRoot({ platform: 'darwin', env: {}, home: '/Users/A' }), '/Users/A/Library/Caches/dev-foundry-claude/runtimes');
  assert.equal(defaultStoreRoot({ platform: 'linux', env: { XDG_CACHE_HOME: '/cache' }, home: '/home/a' }), '/cache/dev-foundry-claude/runtimes');
  assert.equal(defaultStoreRoot({ platform: 'linux', env: {}, home: '/home/a' }), '/home/a/.cache/dev-foundry-claude/runtimes');
  for (const env of [{}, { LOCALAPPDATA: 'relative' }, { LOCALAPPDATA: 'C:\\safe\\..\\other' }, { LOCALAPPDATA: '\\\\server\\share' }]) assert.throws(() => defaultStoreRoot({ platform: 'win32', env }));
  assert.throws(() => defaultStoreRoot({ platform: 'linux', env: { XDG_CACHE_HOME: 'relative' } }));
  assert.throws(() => defaultStoreRoot({ platform: 'unknown' }));
});
test('stage seals a verified copy; promotion is exact, non-destructive and collision safe', (t) => {
  const r = fakeRuntime(t), before = readFileSync(path.join(r.root, ENTRIES[0]));
  const s = stage(t, r);
  assert.throws(() => installedRuntime(s.storeRoot, r.expect));
  const first = promoteRuntime(s);
  assert.equal(first.status, 'installed'); assert.equal(installedRuntime(s.storeRoot, r.expect).expect, r.expect);
  const again = stage(t, r, s.storeRoot);
  assert.equal(promoteRuntime(again).status, 'already-installed');
  assert.ok(readdirSync(again.stageRoot).includes('package'), 'collision preserves stage evidence');
  assert.deepEqual(readFileSync(path.join(r.root, ENTRIES[0])), before);
  assert.ok(readdirSync(s.stageRoot).includes('stage.json'), 'original attestation survives promotion');
});
test('same SemVer/different payload roots coexist and never alias', (t) => {
  const a = fakeRuntime(t, { body: 'a' }), b = fakeRuntime(t, { body: 'b' }), store = path.join(scratch(t), 'store');
  const aa = promoteRuntime(stage(t, a, store)), bb = promoteRuntime(stage(t, b, store));
  assert.notEqual(aa.packageRoot, bb.packageRoot); assert.notEqual(aa.expect, bb.expect);
  assert.equal(installedRuntime(store, a.expect).expect, a.expect);
  assert.equal(installedRuntime(store, b.expect).expect, b.expect);
  assert.throws(() => installedRuntime(store, '1.4.2'));
});
test('unpermitted candidates, provenance, source damage and missing bytes block before store writes', (t) => {
  const r = fakeRuntime(t), store = path.join(scratch(t), 'store');
  assert.throws(() => stage(t, r, store, { permittedCandidateRoots: [] }));
  assert.throws(() => stage(t, r, store, { attestation: {} }));
  writeFileSync(path.join(r.root, ENTRIES[0]), 'damaged'); assert.throws(() => stage(t, r, store));
  rmSync(path.join(r.root, 'payload-manifest.json')); assert.throws(() => stage(t, r, store));
  assert.throws(() => readdirSync(store));
});
test('aborted writes leave non-runnable partial stage and preserve source', (t) => {
  const r = fakeRuntime(t); let polls = 0;
  const store = path.join(scratch(t), 'store');
  assert.throws(() => stage(t, r, store, { signal: { get aborted() { return ++polls > 4; } } }), /stage-aborted/);
  const failed = path.join(store, 'staging', readdirSync(path.join(store, 'staging'))[0]);
  assert.ok(readdirSync(failed).includes('package')); assert.ok(!readdirSync(failed).includes('stage.json'));
  assert.throws(() => promoteRuntime({ storeRoot: store, stageRoot: failed, expect: r.expect }));
  assert.throws(() => installedRuntime(store, r.expect));
  assert.deepEqual(readFileSync(path.join(r.root, 'payload-manifest.json')), r.manifest);
});
test('partial release reservations are not runnable or overwritten', (t) => {
  const r = fakeRuntime(t), s = stage(t, r);
  const partial = path.join(s.storeRoot, 'releases', runtimeIdentity(r.expect).key);
  mkdirSync(partial, { mode: 0o700 }); writeFileSync(path.join(partial, 'historical-fragment'), 'keep');
  assert.throws(() => installedRuntime(s.storeRoot, r.expect)); assert.throws(() => promoteRuntime(s));
  assert.equal(readFileSync(path.join(partial, 'historical-fragment'), 'utf8'), 'keep');
});
test('tampered stage, install record and owned bytes never promote or dispatch', (t) => {
  const r = fakeRuntime(t), s = stage(t, r);
  replaceSealed(path.join(s.stageRoot, 'package', ENTRIES[0]), 'damaged');
  assert.throws(() => promoteRuntime(s));
  const clean = stage(t, r, s.storeRoot), published = promoteRuntime(clean);
  replaceSealed(path.join(published.packageRoot, ENTRIES[0]), 'damaged');
  assert.throws(() => installedRuntime(s.storeRoot, r.expect));
  assert.throws(() => promoteRuntime(stage(t, r, s.storeRoot)), 'modified existing identity never replaced');
  const r2 = fakeRuntime(t), s2 = stage(t, r2), p2 = promoteRuntime(s2);
  replaceSealed(path.join(path.dirname(p2.packageRoot), 'ready.json'), '{}');
  assert.throws(() => installedRuntime(s2.storeRoot, r2.expect));
});
test('store symlinks, traversal, writable parents and source/store overlap fail closed', (t) => {
  const r = fakeRuntime(t), root = scratch(t), elsewhere = scratch(t);
  symlinkSync(elsewhere, path.join(root, 'store'));
  assert.throws(() => stage(t, r, path.join(root, 'store')));
  assert.throws(() => storePath(root, '../escape')); assert.throws(() => storePath(root, 'C:/escape'));
  assert.throws(() => storePath(`${root}/../escape`));
  assert.throws(() => stage(t, r, path.join(r.root, 'store')));
  chmodSync(elsewhere, 0o777); assert.throws(() => stage(t, r, elsewhere), /unsafe-store-permissions/);
});
test('unsafe payload links, portable name collisions, traversal and duplicate manifest entries are refused', (t) => {
  for (const kind of ['symlink', 'hardlink', 'duplicate', 'traversal', 'case']) {
    const r = fakeRuntime(t); let expect = r.expect;
    if (kind === 'symlink') { rmSync(path.join(r.root, ENTRIES[0])); symlinkSync(path.join(r.root, ENTRIES[1]), path.join(r.root, ENTRIES[0])); }
    if (kind === 'hardlink') { rmSync(path.join(r.root, ENTRIES[0])); linkSync(path.join(r.root, ENTRIES[1]), path.join(r.root, ENTRIES[0])); }
    if (kind === 'case') { writeFileSync(path.join(r.root, 'PACKAGE.json'), 'collision'); }
    if (['duplicate', 'traversal', 'case'].includes(kind)) {
      const entries = JSON.parse(r.manifest).files;
      entries.push(kind === 'duplicate' ? entries[0] : { path: kind === 'case' ? 'PACKAGE.json' : '../escape', size: 9, sha256: sha256('collision') });
      const manifest = buildManifestBytes({ version: '1.4.2', entries }); writeFileSync(path.join(r.root, 'payload-manifest.json'), manifest);
      expect = formatExpect('1.4.2', rootOf(manifest));
    }
    assert.throws(() => stage(t, { ...r, expect }), kind);
  }
});
test('npm installer links must target listed contained bytes and are never imported', (t) => {
  const r = fakeRuntime(t);
  mkdirSync(path.join(r.root, 'node_modules/.bin'), { recursive: true });
  const link = path.join(r.root, 'node_modules/.bin/launch');
  symlinkSync('../../bin/dev-foundry-claude.js', link);
  const s = stage(t, r), installed = promoteRuntime(s);
  assert.equal(readdirSync(path.join(installed.packageRoot, 'node_modules/.bin')).length, 0);
  assert.equal(fs.readlinkSync(link), '../../bin/dev-foundry-claude.js', 'source installer evidence preserved');
  rmSync(link); symlinkSync(path.join(r.root, ENTRIES[0]), link);
  assert.throws(() => stage(t, r), /unsafe-installer-link/);
  rmSync(link); symlinkSync('../../../outside', link);
  assert.throws(() => stage(t, r), /unsafe-installer-link/);
});
test('a selected store inside a consumer cannot create any consumer directories', (t) => {
  const r = fakeRuntime(t), c = consumer(t, r.expect);
  const before = readdirSync(c.root).sort();
  assert.throws(() => stage(t, r, path.join(c.root, 'store')), /consumer-store-location/);
  assert.deepEqual(readdirSync(c.root).sort(), before);
});
test('interruption or payload replacement at publish preserves evidence and blocks activation', (t) => {
  for (const fault of ['interrupt-after-rename', 'tamper-after-rename']) {
    const r = fakeRuntime(t), s = stage(t, r), rename = fs.renameSync;
    try {
      fs.renameSync = (from, to) => {
        rename(from, to);
        if (fault === 'interrupt-after-rename') throw new Error('injected publish interruption');
        replaceSealed(path.join(to, ENTRIES[0]), 'injected damaged publish');
      };
      syncBuiltinESMExports();
      assert.throws(() => promoteRuntime(s));
    } finally { fs.renameSync = rename; syncBuiltinESMExports(); }
    assert.throws(() => installedRuntime(s.storeRoot, r.expect));
    const holder = path.join(s.storeRoot, 'releases', runtimeIdentity(r.expect).key);
    assert.ok(readdirSync(holder).includes('package'));
    assert.ok(!readdirSync(holder).includes('ready.json'));
    assert.throws(() => promoteRuntime(stage(t, r, s.storeRoot)), 'partial publish never overwritten');
    assert.deepEqual(readFileSync(path.join(r.root, 'payload-manifest.json')), r.manifest);
  }
});
test('missing staging bytes, changed stage attestation and writable installed bytes are refused', (t) => {
  const r = fakeRuntime(t), s = stage(t, r);
  replaceSealed(path.join(s.stageRoot, 'stage.json'), '{}'); assert.throws(() => promoteRuntime(s));
  const s2 = stage(t, r, s.storeRoot);
  chmodSync(path.join(s2.stageRoot, 'package'), 0o700); rmSync(path.join(s2.stageRoot, 'package', 'payload-manifest.json'));
  chmodSync(path.join(s2.stageRoot, 'package'), 0o500); assert.throws(() => promoteRuntime(s2));
  const s3 = stage(t, r, s.storeRoot), p = promoteRuntime(s3);
  chmodSync(path.join(p.packageRoot, ENTRIES[0]), 0o600);
  assert.throws(() => installedRuntime(s.storeRoot, r.expect), /runtime-writable/);
});
