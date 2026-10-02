import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { IGNORE_LINE, git, isIgnored, planIgnore } from '../../src/adopt/ignore.js';

async function repo(t, ignoreText) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ignore-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q', root]);
  if (ignoreText !== null) {
    await mkdir(path.join(root, '.dev-foundry'), { recursive: true });
    await writeFile(path.join(root, '.dev-foundry/.gitignore'), ignoreText);
  }
  return root;
}

test('18 the rendered line is exactly /telemetry/local/ and matches only the adapter write path', async (t) => {
  assert.equal(IGNORE_LINE, '/telemetry/local/');
  const root = await repo(t, `${IGNORE_LINE}\n`);
  assert.equal(isIgnored(root, '.dev-foundry/telemetry/local/x.ndjson'), true);
  for (const other of ['.dev-foundry/telemetry/x', '.dev-foundry/releases/x', 'telemetry/local/x', 'src/telemetry/x']) assert.equal(isIgnored(root, other), false, other);
  const control = await repo(t, '.dev-foundry/telemetry/\n');
  assert.equal(isIgnored(control, '.dev-foundry/telemetry/local/x.ndjson'), false);
});

test('18 plan preserves existing content, appends only when needed, creates a missing file, and blocks re-inclusion', async (t) => {
  const existing = '# runtime\nprompts/\r\nexecution-requests/';
  const withContent = await repo(t, existing);
  assert.deepEqual(planIgnore(withContent, existing), { state: 'needed', after: `${existing}\n${IGNORE_LINE}\n` });
  const trailing = await repo(t, 'a/\n');
  assert.deepEqual(planIgnore(trailing, 'a/\n'), { state: 'needed', after: `a/\n${IGNORE_LINE}\n` });
  const missing = await repo(t, null);
  assert.deepEqual(planIgnore(missing, null), { state: 'needed', after: `${IGNORE_LINE}\n` });
  const already = await repo(t, 'telemetry/\n');
  assert.deepEqual(planIgnore(already, 'telemetry/\n'), { state: 'ok', after: 'telemetry/\n' });
  const negated = await repo(t, 'telemetry/*\n!/telemetry/local/\n');
  assert.equal(planIgnore(negated, 'telemetry/*\n!/telemetry/local/\n').state, 'blocked');
});

test('18 operator-global ignores never suppress the need', async (t) => {
  const root = await repo(t, 'prompts/\n');
  const globalFile = path.join(root, '..', `global-excludes-${path.basename(root)}`);
  await writeFile(globalFile, '.dev-foundry/telemetry/\n');
  t.after(() => rm(globalFile, { force: true }));
  const withGlobal = spawnSync('git', ['-c', `core.excludesFile=${globalFile}`, '-C', root, 'check-ignore', '-q', '--no-index', '--', '.dev-foundry/telemetry/local/x.ndjson']);
  assert.equal(withGlobal.status, 0, 'the global file would ignore the path');
  assert.equal(planIgnore(root, 'prompts/\n').state, 'needed');
  assert.equal(git(root, ['config', '--get', 'core.excludesFile']).stdout.trim(), '');
});
