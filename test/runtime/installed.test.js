import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import { attestation, consumer, replaceSealed, scratch } from './identity.test.js';

test('B1 modules and canonical verifier work from an offline installed package after build tree removal', { timeout: 180000 }, async (t) => {
  const repo = fileURLToPath(new URL('../../', import.meta.url));
  const tree = scratch(t), destination = scratch(t), prefix = scratch(t), cache = scratch(t);
  for (const relative of ['package.json', 'package-lock.json', 'README.md', 'bin', 'src', 'templates', 'framework', 'migrations', 'scripts/package']) {
    cpSync(path.join(repo, relative), path.join(tree, relative), { recursive: true });
  }
  cpSync(path.join(repo, 'tools/dashboard'), path.join(tree, 'tools/dashboard'), { recursive: true,
    filter: source => !['node_modules', 'dist'].includes(path.relative(path.join(repo, 'tools/dashboard'), source).split(path.sep)[0]) });
  symlinkSync(path.join(repo, 'tools/dashboard/node_modules'), path.join(tree, 'tools/dashboard/node_modules'), 'dir');
  cpSync(path.join(repo, 'node_modules'), path.join(tree, 'node_modules'), { recursive: true,
    filter: source => !source.includes(`${path.sep}node_modules${path.sep}@modelcontextprotocol${path.sep}client`) });
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(npm_|DEV_FOUNDRY_|OTEL_|CLAUDE)/i.test(key))),
    npm_config_cache: cache, npm_config_offline: 'true', npm_config_registry: 'http://127.0.0.1:9/', npm_config_update_notifier: 'false' };
  const npm = (args, cwd) => execFileSync('npm', args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const info = JSON.parse(npm(['pack', '--pack-destination', destination, '--json'], tree))[0];
  const archive = path.join(destination, info.filename);
  npm(['install', '--prefix', prefix, '--offline', '--ignore-scripts', '--no-audit', '--no-fund', archive], prefix);
  const installed = path.join(prefix, 'node_modules/@dev-foundry/claude-adapter');
  rmSync(tree, { recursive: true, force: true });
  const pinModule = await import(pathToFileURL(path.join(installed, 'src/adopt/pin.js')));
  const identity = await import(pathToFileURL(path.join(installed, 'src/runtime/identity.js')));
  const store = await import(pathToFileURL(path.join(installed, 'src/runtime/store.js')));
  const dispatch = await import(pathToFileURL(path.join(installed, 'src/runtime/dispatch.js')));
  const acquisition = await import(pathToFileURL(path.join(installed, 'src/runtime/acquisition.js')));
  const expect = pinModule.selfPin(installed).expect;
  assert.equal(identity.verifyRuntime(installed, expect).expect, expect);
  assert.equal(pinModule.parseExpect(expect).version, '1.4.2');
  assert.equal(acquisition.acquisitionPlan({ kind: 'archive', expect, ...attestation(expect) }).status, 'blocked');
  const c = consumer(t, expect), storeRoot = path.join(scratch(t), 'store');
  const result = store.promoteRuntime(store.stageRuntime({ storeRoot, candidateRoot: installed, permittedCandidateRoots: [installed], expect,
    attestation: attestation(expect) }));
  assert.equal(dispatch.dispatchPlan({ cwd: c.root, storeRoot }).packageRoot, result.packageRoot);
  for (const name of ['identity', 'store', 'acquisition', 'resolver', 'dispatch']) {
    assert.ok(JSON.parse(readFileSync(path.join(installed, 'payload-manifest.json'))).files.some(e => e.path === `src/runtime/${name}.js`));
  }
  replaceSealed(path.join(installed, 'src/runtime/resolver.js'), 'modified installed source');
  assert.throws(() => identity.verifyRuntime(installed, expect), /verification failed/);
  assert.equal(dispatch.dispatchPlan({ cwd: c.root, storeRoot }).expect, expect, 'verified store copy is independent of later source damage');
  // Dry-run prepack also runs only in this disposable copy. Nothing writes the
  // producer's dashboard/dist or payload-manifest.json.
  t.diagnostic(`offline installed candidate ${expect}; no real release provenance or Windows/Claude proof claimed`);
});
