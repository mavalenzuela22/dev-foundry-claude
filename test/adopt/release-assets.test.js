import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { selfPin, sha256 } from '../../src/adopt/pin.js';
import { buildReleaseAssets, selectNpmInvocation } from '../../scripts/release/build-assets.mjs';
import { repoRoot } from './fixture.js';

test('npm invocation runs the Windows npm.cmd fallback through ComSpec or cmd.exe', () => {
  for (const npmExecPath of [undefined, '', 'C:\\Program Files\\nodejs\\npm.cmd']) {
    assert.deepEqual(selectNpmInvocation('win32', npmExecPath), ['cmd.exe', ['/d', '/s', '/c', 'npm.cmd']]);
    assert.deepEqual(selectNpmInvocation('win32', npmExecPath, ''), ['cmd.exe', ['/d', '/s', '/c', 'npm.cmd']]);
    const comSpec = 'C:\\Windows\\System32\\cmd.exe';
    assert.deepEqual(selectNpmInvocation('win32', npmExecPath, comSpec), [comSpec, ['/d', '/s', '/c', 'npm.cmd']]);
  }
});

test('npm invocation preserves bare npm on non-Windows without npm_execpath', () => {
  for (const platform of ['darwin', 'linux']) {
    for (const npmExecPath of [undefined, '', '/usr/local/bin/npm']) {
      assert.deepEqual(selectNpmInvocation(platform, npmExecPath, 'C:\\Windows\\System32\\cmd.exe'), ['npm', []]);
    }
  }
});

test('npm invocation uses Node with an explicit JS or CJS npm CLI on every platform', () => {
  for (const platform of ['win32', 'darwin', 'linux']) {
    for (const cli of ['C:\\Program Files\\nodejs\\npm-cli.js', '/opt/node/npm-cli.cjs']) {
      for (const comSpec of [undefined, 'C:\\Windows\\System32\\cmd.exe']) {
        assert.deepEqual(selectNpmInvocation(platform, cli, comSpec), [process.execPath, [cli]]);
      }
    }
  }
});

test('release builder produces reproducible normal-package assets, exact identity, alias and both checksums', async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'release-assets-test-'));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const out = path.join(scratch, 'first');
  const info = await buildReleaseAssets(out);
  assert.equal(info.version, '1.4.2');
  assert.deepEqual((await readdir(out)).sort(), [...info.files].sort());
  const versioned = await readFile(path.join(out, info.files[0]));
  assert.deepEqual(await readFile(path.join(out, info.files[1])), versioned);
  assert.equal(info.sha256, sha256(versioned));
  assert.equal(await readFile(path.join(out, 'SHA256SUMS'), 'utf8'), `${info.sha256}  ${info.files[0]}\n${info.sha256}  ${info.files[1]}\n`);
  execFileSync('tar', ['-xzf', path.join(out, info.files[0]), '-C', scratch]);
  assert.equal(selfPin(path.join(scratch, 'package')).expect, info.expect);
  await assert.rejects(buildReleaseAssets(out), /must be empty/);
  const again = await buildReleaseAssets(path.join(scratch, 'second'));
  assert.deepEqual(again, info);
  for (const name of info.files) assert.deepEqual(await readFile(path.join(scratch, 'second', name)), await readFile(path.join(out, name)));
});

test('release workflow dispatch guards main, exact commit, three assets, and refuses existing tags/releases', async () => {
  const workflow = parse(await readFile(path.join(repoRoot, '.github/workflows/release.yml'), 'utf8'));
  assert.deepEqual(workflow.on, { workflow_dispatch: null });
  assert.deepEqual(workflow.permissions, { contents: 'write' });
  const steps = workflow.jobs.release.steps;
  assert.match(steps[0].run, /test "\$DISPATCH_REF" = refs\/heads\/main/);
  assert.equal(steps.find((s) => s.uses?.startsWith('actions/checkout')).with.ref, '${{ github.sha }}');
  const publish = steps.at(-1);
  assert.equal(publish.env.GH_TOKEN, '${{ github.token }}');
  assert.match(publish.run, /git rev-parse HEAD/);
  assert.match(publish.run, /git\/refs.*-f "ref=refs\/tags\/\$tag" -f "sha=\$GITHUB_SHA"/);
  assert.match(publish.run, /--verify-tag --target "\$GITHUB_SHA"/);
  assert.match(publish.run, /Release already exists/);
  assert.equal((publish.run.match(/\$RUNNER_TEMP\/adapter-release\//g) ?? []).length, 3);
  assert.ok(!steps.some((s) => /npm publish|--clobber|release edit/.test(s.run ?? '')));
});
