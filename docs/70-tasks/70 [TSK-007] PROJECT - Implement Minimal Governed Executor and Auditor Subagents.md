---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-007
  type: TSK
  title: Implement Minimal Governed Executor and Auditor Subagents
  status: IN_PROGRESS
artifactVersion: "3"
authorityScope: tsk-007-minimal-governed-subagents
ownerRole: governance-author
canonical: true
scope:
  owns:
    - minimal-governed-claude-subagents
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - claude-runtime-qualification
    - claude-native-cutover
    - governance-author-subagent
    - evidence-custodian-subagent
    - validator-subagent
    - hooks
    - skills
    - agent-teams
    - model-selection
    - claude-settings
authority:
  governedBy:
    - ARC-001
    - SPC-002
    - SPC-003
    - OPS-002
    - OPS-003
    - OPS-009
    - DAT-016
  supersedes: []
traceability:
  dependsOn:
    - TSK-006
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-006
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-007] dev-foundry-claude - Implement Minimal Governed Executor and Auditor Subagents

## 1. Purpose

Implement the smallest Claude Code project-subagent surface required by the
pre-cutover architecture: one Implementation Executor and one Governance Auditor.

This task does not execute Claude Code and does not activate the future
Claude-native POP bindings.

## 2. Current provider mechanics

Current Claude Code documentation revalidated for this task states that:

- project custom subagents are Markdown files under `.claude/agents/`;
- only `name` and `description` frontmatter are required;
- `tools` is an allowlist;
- omitting `Agent` from a subagent's tool allowlist prevents that subagent from
  spawning nested subagents;
- project subagents may reference an already-configured MCP server by name;
- subagents run in separate context windows and receive their own system prompt;
- no concrete model field is required.

These are host mechanics, not DEV FOUNDRY authority.

## 3. Prepared capability authority

TSK-007 prepares two unbound Claude-native Capability Profiles:

- `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2` for
  `dev-foundry-executor`;
- `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1` for
  `dev-foundry-auditor`.

Both remain configured but unbound until the later atomic cutover.

The prior `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` remains historical
prepared configuration and is not the future cutover binding after TSK-007.

## 4. Material implementation boundary

Codex may change exactly:

- create `.claude/agents/dev-foundry-executor.md`;
- create `.claude/agents/dev-foundry-auditor.md`;
- create `test/bootstrap/claude-subagents.test.js`;
- update `test/bootstrap/claude-cutover-readiness.test.js` only to reconcile
  stale pre-TSK-006/TSK-007 readiness expectations with the current pre-cutover
  state: SPC-002 v3 target mappings, target prepared Capability Profiles, and the
  existence of exactly the two authorized project subagents while settings,
  Hooks, Skills, and agent teams remain absent.

No other existing implementation/runtime file is authorized for mutation.

## 5. Executor subagent contract

`dev-foundry-executor` SHALL:

- implement only an explicitly selected Implementation Executor operation;
- use exactly the tool allowlist defined by
  `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`;
- reference the existing `dev-foundry-governance` MCP server;
- omit `Agent`, Skills, hooks, memory, model selection, agent teams, and nested
  delegation;
- require a bounded handoff containing role/task/authority references,
  implementation boundary, exclusions, proof, stop conditions, and relevant
  Operator authorization state;
- independently read directed authority instead of receiving copied authority
  bodies;
- stop on missing/conflicting authority, inactive binding, scope expansion, or
  forbidden governance/audit work;
- return a compact disposition matching SPC-003 rather than a transcript of its
  internal exploration.

## 6. Auditor subagent contract

`dev-foundry-auditor` SHALL:

- act only as Governance Auditor for a declared audit operation;
- use exactly the read-only tool allowlist defined by
  `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`;
- reference the existing `dev-foundry-governance` MCP server;
- have no Bash, PowerShell, Edit, Write, Agent, Skills, hooks, memory, or model
  selection;
- reobserve directed authority/evidence and issue only the bounded audit
  verdict/findings required by the Actor Profile;
- stop when independence, evidence, authority, or boundary stability is not
  satisfied;
- never mutate or implement corrective work.

## 7. Static proof contract

The focused test SHALL prove at least:

1. exactly two project agent definition files exist under `.claude/agents/`;
2. their exact names are `dev-foundry-executor` and
   `dev-foundry-auditor`;
3. each description is at most 240 UTF-8 bytes;
4. each complete definition is at most 8192 UTF-8 bytes and at most 100
   non-empty lines;
5. neither definition has `skills`, `model`, `hooks`, `memory`,
   `background`, or `isolation` frontmatter;
6. neither tool allowlist contains `Agent` or any agent-spawn specifier;
7. both reference `dev-foundry-governance` and grant only its governed MCP
   tool namespace in addition to the role-specific built-in allowlist;
8. Executor built-ins are exactly `Read`, `Grep`, `Glob`, `Edit`,
   `Write`, and `Bash`;
9. Auditor built-ins are exactly `Read`, `Grep`, and `Glob`;
10. Auditor has no mutation or shell tool;
11. the two prepared Capability Profiles match the tested identities, platforms,
    tool lists, budgets, and nesting/Skills constraints;
12. the current POP remains pre-cutover and does not bind either new profile;
13. `test/bootstrap/claude-cutover-readiness.test.js` is reconciled so its
    SPC-002 assertions expect the current future mappings:
    `dev-foundry-executor` with
    `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`, and
    `dev-foundry-auditor` with
    `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`; it must no longer require the
    superseded main-agent/deferred-Auditor target;
14. that same readiness test verifies the current pre-cutover prepared-profile
    state: the target Executor V2 and Auditor V1 profiles exist but remain
    unbound, while historical Executor V1 is not treated as the future cutover
    target;
15. that same readiness test allows exactly the two authorized custom subagents
    under `.claude/agents/` while continuing to require Claude settings, Hooks,
    Skills, and agent-team definitions to remain absent;
16. root `CLAUDE.md`, `.mcp.json`, runtime source, dependencies, and all other
    existing tests remain unchanged;
17. `npm ci`, `npm test`, and `git diff --check` pass.

## 8. Token-economics constraints

TSK-007 implements only static token/context controls from SPC-003.

It SHALL NOT claim measured token savings, measured cost savings, context
utilization, model-routing benefit, or runtime independence proof. Those require
the later controlled Claude qualification task.

## 9. Implementation executor fit

While governance remains hosted from ChatGPT, TSK-007 implementation is executed
by Codex through the runner under
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`.

Claude Code is not invoked.

## 10. Acceptance

TSK-007 is complete only when:

- authority preparation and routing are coherent;
- Codex changes exactly the four projected implementation/test paths;
- focused static proof and the full regression suite pass;
- governed post-execution mechanical validation passes;
- Governance Author projection reconciliation and semantic self-assessment pass;
- no independent Governance Audit runs unless triggered;
- promotion/integration/cleanup complete under Operator authorization.

Completion means the two subagents exist and are statically qualified for a
later runtime/tokenomics qualification task. It does not activate them as current
POP bindings and does not perform Claude-native cutover.

## 11. Corrective baseline reconciliation

The first TSK-007 execution stopped before implementation because the full
regression suite exposed one stale assertion in
`test/bootstrap/claude-cutover-readiness.test.js`.

That test still encoded the superseded pre-TSK-006 cutover target where
Implementation Executor and Governance Auditor mapped to `claude-main-agent`
and the Auditor remained deferred. Current SPC-002 v3 instead requires dedicated
`dev-foundry-executor` and `dev-foundry-auditor` implementations.

The first failed execution changed zero repository files, passed path policy,
passed `npm ci` and `git diff --check`, and failed only the stale baseline
assertion.

The second execution also changed zero repository files and failed on the same
pre-existing assertion before implementation began. Review before a third
execution identified one additional directly affected stale expectation in the
same readiness test: it still required all custom subagents to be absent, which
would contradict TSK-007's authorized creation of exactly two project subagents.

The smallest sufficient correction remains confined to that single existing
readiness test. It may be reconciled to the complete current pre-cutover state
listed in the Static proof contract, but no other existing test may change.
