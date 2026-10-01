---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-005
  type: TSK
  title: Prepare Claude-Native Cutover Bindings
  status: COMPLETE
artifactVersion: "2"
authorityScope: tsk-005-prepare-claude-native-cutover-bindings
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-native-cutover-readiness
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - activate-claude-native-bindings
    - direct-claude-code-execution
    - hooks
    - skills
    - subagents
    - agent-teams
    - claude-code-settings
    - permission-policy
    - provider-authentication
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - SPC-002
    - OPS-001
    - OPS-002
    - OPS-003
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-002
    - TSK-003
    - TSK-004
lifecycle:
  phase: complete
  dependsOn:
    - TSK-002
    - TSK-003
    - TSK-004
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-005] dev-foundry-claude - Prepare Claude-Native Cutover Bindings

## 1. Purpose and necessity

Prepare the complete repository-side authority package needed for a later atomic
switch from ChatGPT-hosted governance to direct Claude Code operation, without
performing that switch yet.

This avoids circular self-activation by Claude and avoids making the current
ChatGPT session ineligible before the transition package is complete.

## 2. Delivered readiness authority

TSK-005 establishes:

- SPC-002 as the exact cutover target-state contract;
- `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` as the project-configured
  Claude-native Implementation Executor Capability Profile;
- Authority Index routing for the cutover contract and prepared capability;
- focused mechanical readiness proof.

The new Claude capability remains unbound until the later cutover task.

## 3. Material implementation boundary

The only product/test implementation authorized for Codex in TSK-005 is:

- `test/bootstrap/claude-cutover-readiness.test.js`.

The focused test SHALL mechanically prove the repository is ready for the future
cutover while still intentionally pre-cutover.

No runtime code, MCP configuration, `CLAUDE.md`, dependencies, POP binding, or
Platform Bootstrap mutation is authorized to the Implementation Executor.

## 4. Executor fit

While governance remains hosted from ChatGPT, the focused readiness-test
implementation is performed through the runner using `codex-cli` under
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`.

Claude Code is not invoked by TSK-005.

## 5. Readiness-test contract

The test must prove at least:

1. TSK-002, TSK-003, and TSK-004 are COMPLETE;
2. root `CLAUDE.md` exists and references `resolve_governed_operation`;
3. `.mcp.json` contains exactly one local stdio governance server and the
   current launch fallback;
4. `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` exists, is active, targets
   `claude-code`, requires the project governance MCP, and stops when unbound;
5. the current POP still binds Implementation Executor to
   `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2` on `chatgpt-project`;
6. the current Platform Bootstrap remains `chatgpt-project` and is not silently
   switched by this task;
7. SPC-002 names the future Claude-native role mapping and explicitly keeps
   Governance Auditor deferred until a separately governed independent
   implementation exists;
8. no `.claude/settings.json`, Hooks, Skills, custom subagents, or agent-team
   definitions are introduced.

## 6. Acceptance criteria

TSK-005 is complete when:

- configured readiness authority is coherent and routed;
- the focused readiness test passes;
- the full existing test suite passes;
- `npm ci`, `npm test`, and `git diff --check` pass;
- Codex changes exactly the projected test path;
- the POP and Platform Bootstrap remain pre-cutover;
- semantic self-assessment finds no premature activation or authority
  contradiction;
- independent Governance Audit runs only if an applicable trigger exists;
- promotion/integration/cleanup complete under Operator authorization.

## 7. Hard exclusions

TSK-005 does not authorize:

- changing active POP concrete role bindings;
- changing the active Platform Bootstrap platform;
- retiring the ChatGPT platform derivative yet;
- direct Claude Code execution;
- `.claude/settings.json`, permissions, Hooks, Skills, subagents, or teams;
- provider/model/authentication configuration;
- runtime MCP or resolver changes;
- unrelated cleanup.

## 8. Completion policy

Completion means the repository is ready for one final atomic cutover TSK.

It does not mean Claude Code is yet the active project governance platform.

## 9. Completion result

TSK-005 completed with an exact projection match. Codex created only:

- `test/bootstrap/claude-cutover-readiness.test.js`.

Governed execution
`execution_72abb2220714780f6fb68454d3f26dfacd20182c75f0de60f814256afb246a50`
completed PASS with path policy PASS, zero violations, executor exit code 0, and
runner exit code 0. `npm ci`, `npm test`, and `git diff --check` passed.
The full suite reported 30/30 tests passing.

Governance Author projection reconciliation is `projection match`. Semantic
self-assessment confirmed that the Claude-native Capability Profile remains
unbound, the active POP still selects the runner/Codex implementation, the
Platform Bootstrap remains `chatgpt-project`, and SPC-002 defines the future
cutover without prematurely activating Claude-native bindings.

No independent Governance Audit is required for this completion boundary because
no framework, project, task, separation-of-duty, or Operator trigger applies.

Completion means the repository is ready for one final atomic cutover TSK. Claude
Code has still not been used as the active project governance platform.
