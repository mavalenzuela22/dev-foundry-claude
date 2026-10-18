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

test('rendered role guidance requires substantive executor work and trigger-bound independent review', () => {
  const agents = renderAgents(selfHosted);
  assert.match(agents['.claude/agents/dev-foundry-executor.md'], /Make the authorized code changes/);
  assert.match(agents['.claude/agents/dev-foundry-executor.md'], /changed paths, commands\/results, evidence paths and hashes/);
  assert.match(agents['.claude/agents/dev-foundry-executor.md'], /Do not rediscover project governance or call the resolver again/);
  assert.match(agents['.claude/agents/dev-foundry-auditor.md'], /different session, or different model alone is not an audit trigger/);
  assert.match(agents['.claude/agents/dev-foundry-auditor.md'], /objective closure predicates/);
});

test('rendered agents and startup block satisfy SPC-003 static budgets and preserve isolation constraints', () => {
  const expectedTools = {
    '.claude/agents/dev-foundry-executor.md': ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash', 'mcp__dev-foundry-governance__*'],
    '.claude/agents/dev-foundry-auditor.md': ['Read', 'Grep', 'Glob', 'mcp__dev-foundry-governance__*'],
  };
  for (const [file, content] of Object.entries(renderAgents(acme))) {
    const frontmatter = parse(content.split('---\n')[1]);
    assert.ok(Buffer.byteLength(frontmatter.description) <= 240);
    assert.ok(Buffer.byteLength(content, 'utf8') <= 8192);
    assert.ok(content.split('\n').filter((line) => line.trim()).length <= 100);
    assert.deepEqual(frontmatter.tools, expectedTools[file]);
    assert.deepEqual(frontmatter.mcpServers, ['dev-foundry-governance']);
    for (const key of ['hooks', 'skills', 'agents', 'model']) assert.equal(Object.hasOwn(frontmatter, key), false);
    assert.match(content, /current handoff|compact source-bound handoff/i);
    if (file.endsWith('executor.md')) assert.match(content, /selection, capability fit, authorization/i);
    else assert.match(content, /independence eligibility from trustworthy evidence/i);
    assert.ok(content.includes('acme-billing'));
    assert.ok(!content.includes('dev-foundry-claude'));
  }
  const block = renderClaudeBlock(acme);
  assert.match(block, /resolve the operation once with `resolve_governed_operation`/);
  assert.match(block, /This block is startup guidance, not authority/);
  assert.ok(!block.includes('dev-foundry-claude'));
});

test('rendered profiles and bootstrap name only the consumer identity', () => {
  for (const content of [...Object.values(renderProfiles(acme)), ...Object.values(renderBootstrap(acme))]) {
    assert.ok(!content.includes('dev-foundry-claude'));
    assert.ok(content.includes('acme-billing') || content.includes('acme_billing'));
    assert.ok(parse(content).id.startsWith('ACME-'));
  }
});
