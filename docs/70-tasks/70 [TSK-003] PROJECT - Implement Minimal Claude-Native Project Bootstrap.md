---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-003
  type: TSK
  title: Implement Minimal Claude-Native Project Bootstrap
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-003-minimal-claude-native-project-bootstrap
ownerRole: governance-author
canonical: true
scope:
  owns:
    - minimal-claude-native-project-bootstrap
  appliesTo:
    components:
      - claude-project-bootstrap
  excludes:
    - skills
    - hooks
    - subagents
    - agent-teams
    - claude-code-executor-cutover
    - claude-code-settings
    - permission-policy
    - remote-mcp-transport
    - authentication
    - framework-methodology
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - OPS-001
    - OPS-002
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-002
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-002
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-003] dev-foundry-claude - Implement Minimal Claude-Native Project Bootstrap

## 1. Purpose and necessity

Deliver the smallest project-level startup briefing required for a future direct
Claude Code session to enter `dev-foundry-claude`, locate repository authority,
and use the governance resolver without preloading or duplicating DEV FOUNDRY.

TSK-003 prepares the repository for that future cutover. It does not perform the
cutover and does not invoke Claude Code as an executor.

## 2. Applicable authority

Implementation is directed by:

- ADR-001 for the native Claude repository plane versus governance MCP boundary;
- ARC-001 for the minimal startup layer, context-economy rule, and responsibility
  map;
- TSK-002 for the already-delivered local stdio governance resolver;
- canonical DEV FOUNDRY 2.1.0 task, fit, role-binding, validation, and promotion
  semantics.

No new ADR, ARC, SPC, or DAT is required because the architecture already closes
the bootstrap placement and responsibility.

## 3. In scope

TSK-003 delivers one atomic bootstrap capability:

- one root `CLAUDE.md` suitable for direct Claude Code project startup;
- explicit project identity `dev-foundry-claude`;
- directed entry points to the POP and project Authority Index;
- direction to use `resolve_governed_operation` as the deterministic
  operation-scoped governance entry point;
- direction to read only the authority references returned for the current
  bounded operation;
- explicit non-authority treatment of `CLAUDE.md`, conversation/session memory,
  generated summaries, runtime records, and other repositories;
- fail-closed startup behavior for repository, authority, profile, role, or
  required-capability mismatch;
- focused automated proof that the bootstrap remains minimal and aligned.

No MTP is required because the bootstrap and its focused proof form one coherent
implementation boundary.

## 4. Material implementation boundary

The material implementation boundary is the minimal Claude project bootstrap and
its directly necessary focused test wiring.

Initial mutation-surface projection:

- `CLAUDE.md`;
- `package.json`;
- `test/bootstrap/claude-bootstrap.test.js`.

No dependency change is authorized or expected.

The Implementation Executor must not mutate governance documents, the POP,
Authority Index, platform bootstrap, framework release, MCP implementation, or
`.mcp.json`.

## 5. Executor fit

While governance is hosted from ChatGPT, product implementation is performed
through the runner using `codex-cli` under
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`.

Claude Code is deliberately not the executor for TSK-003. Direct Claude execution
begins only after a separately governed Claude-native cutover boundary.

Fit is PASS because the task has one closed objective, no unresolved architecture,
no new dependency, three projected paths, and deterministic local proof.

## 6. Bootstrap content contract

The root `CLAUDE.md` must stay a startup pointer, not a methodology copy.

It must:

1. identify the project as `dev-foundry-claude`;
2. point to `.dev-foundry/profiles/project-operating-profile.yaml`;
3. point to `.dev-foundry/authority-index.yaml`;
4. name `resolve_governed_operation` as the deterministic governance resolver;
5. require one operation-scoped role before role-dependent work;
6. direct reading only of authority referenced for that bounded operation;
7. state that repository SoT and the adopted framework govern;
8. state that `CLAUDE.md`, memory/history, generated summaries, runtime records,
   and other repositories are not authority;
9. fail closed on identity, authority, profile, role, capability, or bound-state
   mismatch;
10. remain at or below 40 non-empty lines.

It must not reproduce complete lifecycle rules, role definitions, task history,
provider credentials, authentication instructions, broad tool policy, or future
Skills/Hooks/subagent behavior.

## 7. Acceptance criteria

TSK-003 is implementation-complete when:

1. root `CLAUDE.md` satisfies the bootstrap content contract;
2. `CLAUDE.md` is at or below 40 non-empty lines;
3. no Skills, Hooks, subagents, agent teams, Claude settings, or permission files
   are introduced;
4. `.mcp.json` and the TSK-002 resolver implementation remain unchanged;
5. `npm test` discovers and passes both the existing governance-MCP tests and
   the new bootstrap-focused test;
6. the bootstrap test verifies required pointers, resolver name, non-authority
   language, fail-closed language, and the size ceiling;
7. executor changed-surface reporting is an exact projection match or reports any
   directly necessary variance;
8. post-execution governed mechanical validation passes;
9. no Claude Code execution is required for acceptance.

## 8. Hard exclusions

TSK-003 does not authorize:

- direct Claude Code execution or cutover;
- a Claude-specific Implementation Executor binding;
- Skills, Hooks, subagents, or agent teams;
- `.claude/settings.json` or permission/sandbox policy;
- another MCP tool or changes to the existing resolver;
- provider/model selection;
- credentials, authentication, remote transport, or network services;
- methodology changes or copies;
- unrelated cleanup or refactoring.

## 9. Evidence expectations

Completion evidence includes:

- exact changed-surface report;
- `npm test` output;
- focused bootstrap test result;
- proof that existing governance-MCP tests remain green;
- post-execution repository state and diff;
- Governance Author projection reconciliation;
- governed mechanical validation;
- semantic self-assessment;
- independent Governance Audit only if an applicable trigger exists;
- promotion/integration state under the Operator's standing bounded
  authorization.

## 10. Completion policy

TSK-003 may become COMPLETE only after implementation, projection
reconciliation, governed validation, and Governance Author self-assessment satisfy
the acceptance boundary.

Completion means the repository is prepared with the minimal Claude startup
briefing. It does not mean the project has cut over to Claude Code.
