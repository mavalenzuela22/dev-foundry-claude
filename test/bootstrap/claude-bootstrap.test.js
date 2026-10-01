import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const bootstrap = await readFile(new URL('../../CLAUDE.md', import.meta.url), 'utf8');
const paragraphs = bootstrap.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.replace(/\s+/g, ' '));

test('bootstrap identifies the project and directs startup to the POP, Authority Index, and resolver', () => {
  assert.match(bootstrap, /^# dev-foundry-claude\s*$/m);
  assert.match(bootstrap, /Verify that the current repository is `dev-foundry-claude` before governed work\./);
  assert.match(bootstrap, /project operating profile at `\.dev-foundry\/profiles\/project-operating-profile\.yaml`/);
  assert.match(bootstrap, /project Authority Index at `\.dev-foundry\/authority-index\.yaml`/);
  assert.match(bootstrap, /Use `resolve_governed_operation` as the deterministic governance entry point for the current bounded operation\./);
});

test('bootstrap requires one bound role and limits authority reads to the resolved operation', () => {
  assert.match(bootstrap, /Resolve and bind exactly one operation-scoped role and its applicable profile before role-dependent work\./);
  assert.match(bootstrap, /Read only the authority references directed by the resolver for that operation\./);
});

test('bootstrap preserves repository and framework authority and explicitly excludes contextual sources', () => {
  assert.match(bootstrap, /Repository SoT and the adopted DEV FOUNDRY framework govern\./);
  const nonAuthority = paragraphs.find((paragraph) => /are not authority\./.test(paragraph));
  assert.ok(nonAuthority, 'An explicit non-authority statement is required');
  for (const source of ['`CLAUDE.md`', 'memory/history', 'generated summaries', 'runtime records', 'other repositories']) {
    assert.ok(nonAuthority.includes(source), `${source} must be explicitly non-authoritative`);
  }
});

test('bootstrap fails closed for every required mismatch and stops on unresolved bindings', () => {
  const failClosed = paragraphs.find((paragraph) => /Fail closed on .* mismatch\./.test(paragraph));
  assert.ok(failClosed, 'An explicit fail-closed statement is required');
  for (const binding of ['repository identity', 'authority', 'profile', 'role', 'required capability', 'bound-state']) {
    assert.ok(failClosed.includes(binding), `${binding} mismatch must fail closed`);
  }
  assert.match(failClosed, /Stop without proceeding when any required binding is missing, unresolved, stale, or conflicting\./);
});

test('bootstrap stays within 40 non-empty lines and excludes forbidden startup expansion', () => {
  const nonEmptyLines = bootstrap.split(/\r?\n/).filter((line) => line.trim().length > 0);
  assert.ok(nonEmptyLines.length <= 40, `Bootstrap has ${nonEmptyLines.length} non-empty lines`);
  const forbidden = [
    /\b(?:lifecycle|role definitions?|task history|TSK-\d+|MT-\d+)\b/i,
    /\b(?:skills?|hooks?|subagents?|agent teams?|settings|permissions?|sandbox)\b/i,
    /\b(?:credentials?|authentication|api[_ -]?keys?|access[_ -]?tokens?|passwords?|secrets?)\b/i,
    /\b(?:npm|npx|claude|git)\s+(?:run|install|ci|test|login|config|commit|push|merge)\b/i,
    /(?:^|\s)@\S+/m,
    /```|~~~/,
    /\.claude\//i,
    /^#{2,}\s/m,
    /\b(?:governance-author|implementation-executor|mechanical-validator|governance-auditor|evidence-custodian)\b/i,
  ];
  for (const pattern of forbidden) assert.doesNotMatch(bootstrap, pattern);
});
