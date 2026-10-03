---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-002
  type: SPC
  title: Claude-Native Cutover Binding Contract
  status: ACTIVE
artifactVersion: "6"
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

Define the Claude-native role binding model that `dev-foundry-claude` operated
under after the TSK-009 cutover, and that remains the target binding model for a
consumer repository that cuts over to Claude Code under its own authority
(ADR-003), without changing reusable DEV FOUNDRY role semantics.

TSK-013 (ADR-004) moved this repository's own producer operation to
ChatGPT-project producer maintenance. This contract therefore no longer
describes the active producer binding of `dev-foundry-claude`; the active
producer bindings are in its POP.

## 2. Historical Claude-native producer state

From TSK-009 promotion until TSK-013 promotion, the producer repository itself
was bound to the Claude-native model in section 3. That is history and MUST NOT
be used for new producer governed operations after TSK-013 promotion.

Before TSK-009, the producer was bound to the ChatGPT project governance
implementation and the process-bound runner. TSK-013 reuses those concrete
identities, not the historical pre-cutover runner Capability Profile V2.

`DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` remains historical prepared
configuration and is not a target binding.

Sections 3 through 8 describe the Claude-native target/consumer model and the
historical TSK-009 acceptance of this repository. `dev-foundry-executor`,
`dev-foundry-auditor`, `claude-code-native-validation`, workspace trust and
Claude MCP activation are properties of that model. They are not the active
`dev-foundry-claude` producer bindings after TSK-013 promotion; those are owned
by the current POP.

## 3. Claude-native binding target state

The Claude-native binding model is:

- Governance Author -> canonical `governance-author-v3`, concrete implementation
  `claude-main-agent`, platform `claude-code`, active;
- Implementation Executor -> canonical `implementation-executor-v2`, concrete
  implementation `dev-foundry-executor`, kind `subagent`, represented in the
  DAT-016 POP binding with implementation kind `agent`, platform
  `claude-code`, capability profile
  `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`, active;
- Evidence Custodian -> canonical `evidence-custodian-v1`, concrete
  implementation `claude-main-agent`, platform `claude-code`, active;
- Mechanical Validator -> canonical `mechanical-validator-v2`, concrete
  implementation `claude-code-native-validation`, platform `claude-code`,
  active;
- Governance Auditor -> canonical `governance-auditor-v2`, concrete
  implementation `dev-foundry-auditor`, kind `subagent`, represented in the
  DAT-016 POP binding with implementation kind `agent`, platform
  `claude-code`, capability profile
  `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`, active.

The same `claude-main-agent` is eligible for Governance Author and Evidence
Custodian only through operation-scoped role selection under OPS-003/OPS-009.
It is not the Implementation Executor or Governance Auditor implementation.
Role continuity across operations does not transfer authority.

In the Claude-native model the runner Capability Profiles are not bound.

## 4. Claude-native Platform Bootstrap model

A Claude-native Platform Bootstrap is active for:

- platform id `claude-code`;
- repository identity `dev-foundry-claude`;
- startup from the repository root;
- POP and Authority Index as configured entry points;
- Governance Author as the default role;
- main-agent eligibility only for Governance Author and Evidence Custodian;
- explicit dispatch of Implementation Executor and Governance Auditor to their
  dedicated project subagents after operation-scoped resolution;
- Mechanical Validator bound separately as native Claude Code tooling;
- root `CLAUDE.md` and project governance MCP as startup mechanisms, not
  authority.

A ChatGPT project-system-prompt derivative is not part of the Claude-native
model.

## 5. Operator-side activation facts

This section describes the Claude-native model.

The first direct interactive Claude Code session may require human workspace
trust and approval of the project-scoped MCP server. These are provider security
mechanics and Operator-side activation facts, not repository authority.

Governed Claude-native work MUST fail closed until:

- the repository is opened as `dev-foundry-claude`;
- root project instructions are loaded;
- the project governance MCP is connected;
- `resolve_governed_operation` is available;
- the active POP and Authority Index resolve without contradiction.

No repository setting may bypass workspace trust or silently pre-approve the
project MCP.

## 6. Native operation boundary

This section describes the Claude-native model.

Claude Code uses native repository capabilities for file/search, shell,
build/test, Git, and provider work subject to the selected role, task authority,
Capability Profile where applicable, and Operator side-effect authorization.

The governance MCP remains read-oriented and resolves authority. It is not a
repository remote-control surface.

## 7. Isolation and audit boundary

This section describes the Claude-native model, not the active producer after
TSK-013.

The cutover SHALL NOT occur until the dedicated Executor and Auditor subagents
are implemented and statically qualified under SPC-003 and the local
operational-telemetry path is mechanically ready under SPC-004.
TSK-009 satisfies that repository-side prerequisite.

Paid synthetic Claude benchmarking is not a cutover prerequisite. Empirical
tokenomics review uses real governed work after cutover.

When a bounded operation triggers independent Governance Audit, it is dispatched
explicitly to `dev-foundry-auditor`. The main agent cannot issue that required
independent verdict.

Implementation work selected for the Implementation Executor role is dispatched
to `dev-foundry-executor`. The main agent does not silently implement product
work instead of the selected Executor role.

## 8. Post-cutover acceptance state

This section records the historical TSK-009 acceptance of the Claude-native
model.

TSK-009 acceptance requires repository-configured bindings, active Platform
Bootstrap, active Capability Profile routing, SPC-003 subagent topology, SPC-004
telemetry instrumentation readiness, overview state, and the retired ChatGPT
derivative to be mutually consistent and mechanically validated before
promotion.

Runtime workspace trust/MCP approval is verified by the Operator in the first
direct Claude Code session and is not fabricated as repository evidence.

The first real Claude-native session also verifies actual telemetry arrival.
That verification is runtime evidence after cutover, not a paid pre-cutover
benchmark.
