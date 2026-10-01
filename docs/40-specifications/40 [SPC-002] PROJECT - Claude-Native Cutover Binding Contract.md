---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-002
  type: SPC
  title: Claude-Native Cutover Binding Contract
  status: ACTIVE
artifactVersion: "1"
authorityScope: claude-native-cutover-binding-contract
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-native-cutover-binding-state
    - claude-native-cutover-transition
    - claude-native-role-implementation-map
  appliesTo:
    components:
      - dev-foundry-claude
    operations:
      - claude-native-cutover
  excludes:
    - reusable-role-semantics
    - provider-authentication
    - model-selection
    - hooks
    - skills
    - subagents
    - agent-teams
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - OPS-002
    - OPS-003
    - OPS-009
    - DAT-016
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-002] dev-foundry-claude - Claude-Native Cutover Binding Contract

## 1. Purpose

Define the exact configured-state transition from the current ChatGPT-hosted
governance arrangement to direct operation from Claude Code without changing
reusable DEV FOUNDRY role semantics.

This contract prepares the transition. It does not itself activate Claude Code.

## 2. Pre-cutover state

Before cutover:

- the active POP continues to bind Governance Author and Evidence Custodian to
  the current ChatGPT project governance implementation;
- Implementation Executor remains bound to the runner through
  `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`;
- Mechanical Validator remains bound to the runner;
- the current platform bootstrap remains `chatgpt-project`;
- `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` may exist as active configured
  capability but MUST remain unbound and MUST NOT be selected.

This pre-cutover state is intentional and remains authoritative until a separate
cutover TSK is promoted.

## 3. Cutover target state

A future cutover TSK SHALL atomically reconcile the configured project state so
that:

- Governance Author -> canonical `governance-author-v3`, concrete implementation
  `claude-main-agent`, platform `claude-code`, active;
- Implementation Executor -> canonical `implementation-executor-v2`, concrete
  implementation `claude-main-agent`, platform `claude-code`, capability
  profile `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1`, active;
- Evidence Custodian -> canonical `evidence-custodian-v1`, concrete
  implementation `claude-main-agent`, platform `claude-code`, active;
- Mechanical Validator -> canonical `mechanical-validator-v2`, concrete
  implementation `claude-code-native-validation`, platform `claude-code`,
  active;
- Governance Auditor -> canonical `governance-auditor-v2`, concrete
  implementation `claude-main-agent`, platform `claude-code`, status
  `deferred` until a separately governed independent-audit implementation is
  activated.

The same `claude-main-agent` may be eligible for multiple active roles only
through operation-scoped role selection under OPS-003/OPS-009. Role continuity
across operations does not transfer authority.

## 4. Platform bootstrap target

At cutover, the primary project Platform Bootstrap SHALL be reconciled to:

- platform id `claude-code`;
- repository identity `dev-foundry-claude`;
- startup from the repository root;
- POP and Authority Index as configured entry points;
- Governance Author as the default role;
- eligible profiles limited to Governance Author, Implementation Executor, and
  Evidence Custodian because those roles share the `claude-main-agent`
  implementation;
- Mechanical Validator remains separately bound as native Claude Code tooling;
- Governance Auditor is not bootstrap-eligible while deferred;
- project `CLAUDE.md` and the project governance MCP are startup mechanisms,
  not authority.

The prior ChatGPT project-system-prompt derivative SHALL be marked retired or
historical during cutover so it cannot appear to represent the active platform.

## 5. Operator-side activation facts

The first direct interactive Claude Code session may require human workspace
trust and approval of the project-scoped MCP server. These are provider security
mechanics and Operator-side activation steps, not repository authority.

The cutover MUST fail closed for governed work until:

- the repository is opened as `dev-foundry-claude`;
- project instructions are loaded;
- the project governance MCP is connected;
- `resolve_governed_operation` is available;
- the active POP and Authority Index resolve without contradiction.

No repository setting SHALL attempt to bypass workspace trust or silently
pre-approve the project MCP.

## 6. Native operation boundary

After cutover, Claude Code uses native repository capabilities for file/search,
shell, build/test, Git, and provider work subject to the selected role, task
authority, capability profile, and Operator side-effect authorization.

The governance MCP remains read-oriented and resolves authority. It does not
become a repository remote-control surface.

## 7. Audit boundary

The initial cutover does not activate a custom Auditor subagent merely for
symmetry.

When a bounded operation requires independent Governance Audit while the Auditor
binding is deferred, the operation MUST stop until a separately eligible
independent implementation is governed and activated.

## 8. Cutover acceptance

The future cutover TSK is complete only when repository-configured bindings,
Platform Bootstrap, active capability routing, overview state, and any
non-authoritative platform derivative are mutually consistent and mechanically
validated.

Runtime trust/MCP approval is verified by the Operator in the first direct Claude
Code session and is not fabricated as repository evidence.
