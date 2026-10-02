import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { renderAgents, renderBootstrap, renderClaudeBlock, renderProfiles, templateParams } from '../../src/adopt/render.js';
import { repoRoot } from './fixture.js';

const selfHosted = templateParams({
  project: 'dev-foundry-claude', prefix: 'DFC', executorProfileId: 'implementation-executor-v2', auditorProfileId: 'governance-auditor-v2',
  authorProfile: '.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml',
  custodianProfile: '.dev-foundry/releases/2.1.0/actor-profiles/evidence-custodian-v1.yaml',
});
const acme = templateParams({
  project: 'acme-billing', prefix: 'ACME', executorProfileId: 'implementation-executor-v2', auditorProfileId: 'governance-auditor-v2',
  authorProfile: 'a.yaml', custodianProfile: 'c.yaml', expect: '1.0.0:sha256:' + '0'.repeat(64),
});

test('golden: templates under self-hosted parameters reproduce committed agents and Claude Capability Profiles byte-for-byte', async () => {
  for (const [file, content] of Object.entries({ ...renderAgents(selfHosted), ...renderProfiles(selfHosted) })) {
    assert.equal(content, await readFile(path.join(repoRoot, file), 'utf8'), file);
  }
});

test('rendered agents and block satisfy SPC-003 static limits and carry the binding stop rule', () => {
  const expectedTools = {
    '.claude/agents/dev-foundry-executor.md': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'mcp__dev-foundry-governance__*'],
    '.claude/agents/dev-foundry-auditor.md': ['Read', 'Grep', 'Glob', 'mcp__dev-foundry-governance__*'],
  };
  for (const [file, content] of Object.entries(renderAgents(acme))) {
    const frontmatter = parse(content.split('---\n')[1]);
    assert.ok(Buffer.byteLength(frontmatter.description) <= 240);
    assert.ok(Buffer.byteLength(content) <= 8192);
    assert.ok(content.split('\n').filter((line) => line.trim()).length <= 100);
    assert.deepEqual(frontmatter.tools, expectedTools[file]);
    assert.deepEqual(frontmatter.mcpServers, ['dev-foundry-governance']);
    for (const key of ['hooks', 'skills', 'agents', 'model']) assert.equal(Object.hasOwn(frontmatter, key), false);
    assert.match(content, /Prepared configuration alone is insufficient/);
    assert.match(content, /active POP binding/);
    assert.ok(content.includes('acme-billing'));
    assert.ok(!content.includes('dev-foundry-claude'));
  }
  const block = renderClaudeBlock(acme);
  assert.match(block, /active POP binding[\s\S]*not the presence of this block/);
  assert.ok(!block.includes('dev-foundry-claude'));
});

test('rendered profiles and bootstrap name only the consumer identity', () => {
  for (const content of [...Object.values(renderProfiles(acme)), ...Object.values(renderBootstrap(acme))]) {
    assert.ok(!content.includes('dev-foundry-claude'));
    assert.ok(content.includes('acme-billing') || content.includes('acme_billing'));
    assert.ok(parse(content).id.startsWith('ACME-'));
  }
});
