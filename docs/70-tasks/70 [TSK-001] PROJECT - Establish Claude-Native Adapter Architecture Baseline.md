---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-001
  type: TSK
  title: Establish Claude-Native Adapter Architecture Baseline
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-001-claude-native-adapter-architecture-baseline
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-native-adapter-architecture-baseline
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - governance-mcp-implementation
    - claude-hook-implementation
    - claude-skill-implementation
    - claude-subagent-implementation
    - implementation-executor-activation
    - provider-authentication
    - provider-routing
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - OPS-001
  supersedes: []
traceability:
  dependsOn: []
  implements:
    - ADR-001
    - ARC-001
lifecycle:
  phase: in-progress
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-001] dev-foundry-claude - Establish Claude-Native Adapter Architecture Baseline

## 1. Purpose and necessity

Establish the first bounded product architecture baseline for
`dev-foundry-claude` before any runtime adapter implementation begins.

The task is necessary because porting the process-bound runner wholesale into
Claude Code would duplicate capabilities that Claude already has, while loading
DEV FOUNDRY broadly into permanent prompts would create recurring token cost and
authority-staleness risk.

## 2. Applicable authority

This task is governed by:

- ADR-001 for the native-repository versus governance-MCP boundary;
- ARC-001 for Claude Code primitive placement;
- OVR-001 for project purpose and cost/context goals;
- canonical DEV FOUNDRY 2.1.0 lifecycle, sufficiency, role, validation, and
  side-effect rules.

## 3. In scope

TSK-001 delivers one architecture-baseline capability:

- inventory the Claude Code primitives materially relevant to the adapter;
- establish which responsibilities stay native to Claude Code;
- establish the dedicated governance-MCP responsibility boundary;
- establish the initial role placement hypothesis for main agent and future
  subagents;
- establish token/context-loading rules for bootstrap, Skills, subagents, and
  MCP descriptions;
- identify resolver behavior required for legitimate pre-TSK governance
  authoring;
- reconcile project routing and overview documents to the new authority.

## 4. Out of scope

TSK-001 does not:

- implement the Claude governance MCP;
- define its concrete wire/tool schema beyond the architectural responsibility;
- create or activate hooks;
- create Skills;
- create or activate custom subagents or agent teams;
- activate an Implementation Executor or Capability Profile;
- change authentication, model-provider routing, or secret handling;
- copy the existing process-bound runner implementation into this project;
- authorize product runtime implementation.

## 5. Acceptance criteria

TSK-001 is complete when all of the following are true:

1. current official Claude Code documentation has been consulted for the
   primitives that materially affect the architecture;
2. one accepted project decision defines the native repository plane versus the
   governance MCP plane;
3. one active project architecture document maps the relevant Claude Code
   primitives to responsibilities without prematurely implementing them;
4. the governance MCP has one mandatory initial responsibility:
   operation-scoped governance resolution;
5. the architecture explicitly addresses legitimate governance authoring before
   a TSK exists;
6. token/context economy is an explicit architectural invariant;
7. project Authority Index and navigation documents route to the new authority;
8. no Implementation Executor or product-runtime implementation is activated;
9. final mechanical validation passes for the exact changed boundary;
10. Governance Author semantic self-assessment finds no known material defect.

## 6. Dependencies

No product TSK dependency precedes this task.

The task depends on the adopted DEV FOUNDRY 2.1.0 release, active project POP,
project Authority Index, OVR-001, and the Operator's explicit authorization of
this bounded architecture task and its promotion lifecycle.

## 7. Evidence expectations

Evidence for completion consists of:

- independently observed repository state and exact changed-path manifest;
- the accepted ADR-001 and active ARC-001 artifacts;
- current Anthropic Claude Code documentation consulted during authoring;
- mechanical validation result for the final boundary;
- Governance Author semantic self-assessment;
- observable promotion/integration state.

Provider documentation is supporting technical evidence, not project authority.

## 8. Completion policy

The Governance Author may mark this task COMPLETE only after the acceptance
criteria are satisfied.

An independent Governance Audit is required only if an applicable framework,
project, task, risk, separation-of-duty, or Operator trigger exists. The active
project POP adds no audit trigger, and TSK-001 introduces none.

Completion of TSK-001 does not authorize its follow-on implementation tasks.
Any MCP, hook, Skill, subagent, or runtime implementation requires a separately
resolved governed operation and an appropriate concrete implementation binding.
