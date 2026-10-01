---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-006
  type: TSK
  title: Establish Claude Role Isolation and Token Economics Architecture
  status: COMPLETE
artifactVersion: "2"
authorityScope: tsk-006-role-isolation-token-economics
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-role-isolation-token-economics-architecture
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - subagent-file-implementation
    - claude-runtime-qualification
    - claude-native-cutover
    - hooks
    - skills
    - agent-teams
    - model-selection
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - SPC-002
    - SPC-003
    - OPS-002
    - OPS-003
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-005
lifecycle:
  phase: complete
  dependsOn:
    - TSK-005
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-006] dev-foundry-claude - Establish Claude Role Isolation and Token Economics Architecture

## 1. Purpose

Reconcile the pre-cutover architecture after Operator review so the project does
not repeat an over-delegated orchestration design and does not cut over before
subagent cost/context behavior is bounded and measured.

## 2. Operator decision incorporated

The initial Claude-native design SHALL keep Governance Author on the main agent.

The main agent remains operator-facing and performs Governance Author work
directly while that role is selected. It may later perform Evidence Custodian in
a separate operation. It is not reduced to a write-disabled dispatcher.

Dedicated subagents are justified initially only for:

- Implementation Executor, for implementation-context isolation;
- Governance Auditor, for fresh/read-only audit isolation and independence.

Mechanical Validator remains deterministic rather than model-backed.

## 3. Governed changes

TSK-006:

- reconciles ARC-001 to the final pre-implementation topology;
- reconciles SPC-002 so its future cutover target no longer maps Executor or
  Auditor to the main agent;
- establishes SPC-003 as the project token-economics and isolation contract;
- routes the new authority and records the revised pre-cutover roadmap.

## 4. No implementation executor

This is a documentation/architecture-only Governance Author operation.

No product implementation is required, so OPS-003 permits omission of an
Implementation Executor. No Claude Code runtime or subagent file is created by
this task.

## 5. Acceptance criteria

TSK-006 is complete when:

1. ARC-001 keeps Governance Author on the main agent and identifies exactly
   Executor and Auditor as initial dedicated subagent candidates;
2. SPC-002 future cutover target maps Executor to `dev-foundry-executor` and
   Auditor to `dev-foundry-auditor`;
3. Evidence Custodian remains on the main agent in a separate operation;
4. Mechanical Validator remains deterministic/native;
5. SPC-003 defines explicit dispatch, no nesting/fan-out, static context budgets,
   runtime metrics, qualification scenarios, and the no-agent-without-measured-
   benefit rule;
6. no `.claude/**` implementation, Skills, Hooks, settings, or model selection
   is introduced;
7. POP and Platform Bootstrap remain pre-cutover;
8. repository change-set validation and semantic self-assessment pass;
9. independent Governance Audit runs only if a trigger applies;
10. promotion/integration/cleanup complete under Operator authorization.

## 6. Follow-on boundaries

The expected next boundaries are:

- implement the minimal Executor and Auditor subagents under the static budgets;
- perform controlled Claude runtime/tokenomics qualification and hardening;
- perform the atomic Claude-native cutover only after qualification acceptance.

TSK-006 does not authorize any of those follow-on side effects.

## 7. Completion result

TSK-006 completed as a documentation/architecture-only Governance Author
operation with no Implementation Executor.

The final governed topology keeps Governance Author and operator-facing
orchestration on the main Claude agent, keeps Evidence Custodian on that same
implementation only after separate role selection, dedicates exactly two future
subagents to Implementation Executor and Governance Auditor, and leaves
Mechanical Validator deterministic/native.

SPC-003 establishes explicit resolver-driven dispatch, no nested or parallel
agent fan-out, static context/handoff/disposition budgets, runtime qualification
metrics, controlled benchmark scenarios, and the rule `no agent without measured
benefit`.

Repository change-set validation passed with exactly seven changed paths and zero
hidden changes. Governance Author semantic self-assessment found no premature
Claude activation, no product/runtime implementation, no POP or Platform
Bootstrap mutation, and no unresolved role/topology contradiction.

No independent Governance Audit is required because no framework, project, task,
separation-of-duty, or Operator trigger applies.
