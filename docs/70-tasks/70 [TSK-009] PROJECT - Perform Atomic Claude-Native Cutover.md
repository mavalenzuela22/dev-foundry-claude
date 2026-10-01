---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-009
  type: TSK
  title: Perform Atomic Claude-Native Cutover
  status: COMPLETE
artifactVersion: "3"
authorityScope: tsk-009-atomic-claude-native-cutover
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-native-cutover
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - model-selection
    - hooks
    - skills
    - agent-teams
    - new-subagents
    - framework-version-change
    - public-or-remote-telemetry
    - synthetic-benchmarking
    - provider-authentication
authority:
  governedBy:
    - ARC-001
    - SPC-002
    - SPC-003
    - SPC-004
    - OPS-003
    - OPS-008
    - OPS-009
    - DAT-016
  supersedes: []
traceability:
  dependsOn:
    - TSK-007
    - TSK-008
lifecycle:
  phase: complete
  dependsOn:
    - TSK-007
    - TSK-008
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-009] dev-foundry-claude - Perform Atomic Claude-Native Cutover

## 1. Purpose

Atomically promote the configured project from the current ChatGPT-hosted
governance/runtime bindings to the Claude Code target already defined by
SPC-002, while preserving role semantics, telemetry readiness, Operator control,
and fail-closed startup.

This task performs the cutover. It does not select models, add Hooks or Skills,
create agent teams, add subagents, change framework version, or run synthetic
benchmarks.

## 2. Preconditions

The cutover is authorized only from the observed baseline where:

- repository is `dev-foundry-claude`;
- `main` is clean;
- TSK-007 is COMPLETE and exactly the two governed project subagents exist;
- TSK-008 is COMPLETE and SPC-004 telemetry instrumentation is mechanically
  ready;
- the target Executor and Auditor Capability Profiles exist and remain unbound;
- the active POP still binds product implementation to the runner;
- the active Platform Bootstrap is still `chatgpt-project`;
- root `CLAUDE.md` and project `.mcp.json` already provide the Claude-native
  startup/resolver mechanisms;
- POP audit triggers remain empty.

If any of these facts change before the applicable phase, stop and reconcile.

## 3. Provider mechanics revalidated

Current Claude Code documentation revalidated on 2026-10-01 confirms:

- project `CLAUDE.md` instructions load from the repository hierarchy;
- project subagents are loaded from `.claude/agents/`;
- project-scoped MCP servers are loaded from root `.mcp.json`;
- interactive project MCP use may require workspace/project approval;
- project subagents run in separate context windows with their declared tool
  access.

These are provider mechanics, not project or methodology authority.

## 4. Role for the cutover authority operation

The configured-state cutover is a Governance Author operation under OPS-003 and
OPS-009. It mutates configured project authority and reconciles project SoT.

The current Implementation Executor remains eligible only for the final
pre-cutover test-preparation phase described below. That phase MUST finish before
the POP stops binding the runner.

No independent Governance Audit is triggered by the active POP or this task.

## 5. Phase A — final pre-cutover Executor preparation

Before any POP/platform binding mutation, the current runner-bound
Implementation Executor may update exactly:

- `test/bootstrap/claude-cutover-readiness.test.js`;
- `test/bootstrap/claude-subagents.test.js`.

The tests SHALL be reconciled from pre-cutover assertions to the SPC-002 target
state.

They SHALL prove after cutover:

- Governance Author -> `claude-main-agent`, platform `claude-code`;
- Evidence Custodian -> `claude-main-agent`, platform `claude-code`;
- Implementation Executor -> `dev-foundry-executor`, platform
  `claude-code`, bound to
  `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`;
- Governance Auditor -> `dev-foundry-auditor`, platform `claude-code`,
  bound to `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`;
- Mechanical Validator -> `claude-code-native-validation`, platform
  `claude-code`;
- historical runner Executor Capability Profile is no longer the active
  Implementation Executor binding;
- target Claude Executor/Auditor Capability Profiles are bound and active;
- Platform Bootstrap is active and identifies `claude-code`;
- primary bootstrap eligible profiles are only Governance Author and Evidence
  Custodian, both resolving to `claude-main-agent`;
- Executor/Auditor remain exactly the two dedicated project subagents;
- root `CLAUDE.md`, `.mcp.json`, telemetry, and subagent static constraints
  remain intact.

Because Phase A prepares tests for a future configured state, its self-check is
limited to syntax/static integrity and `git diff --check`. The full regression
suite is intentionally deferred until Phase B completes.

Phase A hard exclusions:

- no configured authority mutation;
- no POP/Platform Bootstrap/Authority Index mutation;
- no docs mutation;
- no Capability Profile mutation;
- no product/runtime mutation beyond the two tests;
- no Claude invocation;
- no commit, push, PR, or merge by the Executor.

Phase A ends completely before Phase B begins.

Phase A completed PASS in
`execution_1d5696967d369ec01bc6be225f06d8cead9d50b4948071bb448ba778225e433b`
with exactly the two authorized test paths changed, zero path-policy
violations, both `node --check` commands PASS, and `git diff --check` PASS.
The runner-bound Implementation Executor operation ended before any configured
binding mutation.

## 6. Phase B — atomic configured-state cutover

After Phase A is terminal and its projection is reconciled, Governance Author
shall reconcile exactly these configured/SoT paths:

- `.dev-foundry/profiles/project-operating-profile.yaml`;
- `.dev-foundry/authority-index.yaml`;
- `.dev-foundry/platform-bootstrap.yaml`;
- `.dev-foundry/bootstrap/project-system-prompt.md`;
- `docs/40-specifications/40 [SPC-002] PROJECT - Claude-Native Cutover Binding Contract.md`;
- `docs/00-overview/00 [OVR-001] PROJECT - System Overview.md`;
- `docs/00-overview/00 [OVR-002] PROJECT - Documentation Map and Artifact Taxonomy.md`;
- this TSK for closure evidence.

No other configured or product path is authorized in Phase B.

## 7. POP target

The active POP SHALL bind:

- Governance Author:
  - Actor Profile `governance-author-v3`;
  - implementation kind `agent`;
  - identity `claude-main-agent`;
  - platform `claude-code`;
  - no Capability Profile.
- Evidence Custodian:
  - Actor Profile `evidence-custodian-v1`;
  - implementation kind `agent`;
  - identity `claude-main-agent`;
  - platform `claude-code`;
  - no Capability Profile.
- Implementation Executor:
  - Actor Profile `implementation-executor-v2`;
  - implementation kind `agent`;
  - identity `dev-foundry-executor`;
  - platform `claude-code`;
  - Capability Profile
    `.dev-foundry/profiles/capability-profiles/implementation-executor-claude-code-v2.yaml`.
- Governance Auditor:
  - Actor Profile `governance-auditor-v2`;
  - implementation kind `agent`;
  - identity `dev-foundry-auditor`;
  - platform `claude-code`;
  - Capability Profile
    `.dev-foundry/profiles/capability-profiles/governance-auditor-claude-code-v1.yaml`.
- Mechanical Validator:
  - Actor Profile `mechanical-validator-v2`;
  - implementation kind `tool`;
  - identity `claude-code-native-validation`;
  - platform `claude-code`;
  - no Capability Profile.

The POP remains active, retains Governance Author as default role, keeps the
same Operator and DEV FOUNDRY 2.1.0 framework binding, and changes the primary
platform-bootstrap status from prepared to active.

## 8. Authority Index target

The project Authority Index SHALL:

- retain all existing project/methodology routes;
- route TSK-009;
- retain historical runner Capability Profile bindings as non-required history;
- set `implementation-executor-runner-v2.yaml` to `required: false`;
- set `implementation-executor-claude-code-v2.yaml` to `required: true`;
- set `governance-auditor-claude-code-v1.yaml` to `required: true`;
- keep historical Claude Executor V1 non-required.

No new Capability Profile is created for Mechanical Validator unless separately
governed; SPC-002 and DAT-016 do not require one for the native tool binding.

## 9. Platform Bootstrap target

The primary Platform Bootstrap SHALL become active for `claude-code`.

Its governed-project-bindings eligible profiles SHALL be exactly:

- Governance Author v3;
- Evidence Custodian v1.

Both resolve to `claude-main-agent`, satisfying DAT-016 bootstrap identity
invariants. Governance Author remains the default role.

The bootstrap SHALL direct fail-closed startup from the repository root using
the POP and Authority Index, and SHALL state that:

- the main agent is eligible only for Governance Author or Evidence Custodian
  through operation-scoped selection;
- Implementation Executor and Governance Auditor are dispatched explicitly to
  their dedicated project subagents after resolution;
- Mechanical Validator is separately bound to native Claude Code validation;
- root `CLAUDE.md` and the project governance MCP are startup mechanisms, not
  authority;
- workspace trust/project MCP approval are Operator-side provider mechanics and
  are not bypassed by repository configuration.

## 10. Retired ChatGPT derivative

`.dev-foundry/bootstrap/project-system-prompt.md` SHALL be marked retired as a
non-authoritative `chatgpt-project` derivative.

It SHALL no longer present runner/ChatGPT instructions as the active project
platform. It may preserve only a concise historical note and pointers to current
repository SoT/startup mechanisms.

## 11. SPC and overview reconciliation

SPC-002 SHALL be reconciled so the previously defined cutover target is the
current post-cutover configured state and the pre-cutover arrangement is clearly
historical.

OVR-001/OVR-002 SHALL state that:

- TSK-009 completed the Claude-native cutover;
- Claude Code is the active platform;
- main agent performs Governance Author/Evidence Custodian only by
  operation-scoped role selection;
- dedicated Executor/Auditor subagents are active bindings;
- Mechanical Validator is native Claude Code tooling;
- telemetry is ready and actual arrival is verified during the first real
  Claude-native session;
- Hooks, Skills, agent teams, model selection, and additional subagents remain
  unauthorized.

## 12. Mechanical validation

After Phase B, governed validation SHALL prove:

1. exact POP role/profile/implementation/platform/capability bindings;
2. Platform Bootstrap status/identity/eligible profile invariants;
3. Authority Index required binding state;
4. retired ChatGPT derivative state;
5. exactly two project subagents and unchanged static restrictions;
6. telemetry instrumentation and privacy tests remain green;
7. exactly one governance MCP tool remains exposed;
8. no framework-release, model, Hook, Skill, agent-team, dependency, or extra
   subagent mutation occurred;
9. `npm ci`, `npm test`, and `git diff --check` pass;
10. repository changed surface matches the bounded cutover projection.

Actual workspace trust/MCP approval and actual telemetry arrival are first-session
runtime facts and SHALL NOT be fabricated as pre-cutover evidence.

## 13. Promotion semantics

Promotion of TSK-009 is the cutover boundary.

Before merge, the source branch is only a candidate configured state. The
currently promoted `main` remains authoritative.

After merge/reconciliation:

- Claude Code is the active project platform;
- the runner is no longer the active Implementation Executor or Mechanical
  Validator binding;
- future governed work MUST resolve against the Claude-native POP;
- the process-bound runner transaction service may complete only the already
  authorized TSK-009 promotion transaction boundaries of reconciliation and
  cleanup as an Operator-side repository mechanism under OPS-008; this does not
  select or re-bind it as Implementation Executor or Mechanical Validator;
- any later runner use outside that already-authorized promotion transaction
  requires separate authority compatible with the Claude-native POP.

## 14. Completion

TSK-009 is complete only when:

- Phase A completed under the still-active runner Executor binding;
- Phase B configured-state reconciliation is complete;
- semantic self-assessment is PASS;
- governed mechanical validation is PASS;
- the exact cutover candidate is promoted to `main`;
- reconciliation confirms clean `main`;
- the old implementation branch is cleaned up.

First-session workspace trust/MCP approval and actual telemetry arrival remain
explicit post-cutover Operator/runtime verification facts.


## 15. Completion result

Phase A completed PASS under the pre-cutover runner-bound Implementation
Executor in
`execution_1d5696967d369ec01bc6be225f06d8cead9d50b4948071bb448ba778225e433b`
with exactly two changed test paths, zero path-policy violations, both syntax
checks PASS, and `git diff --check` PASS.

Phase B reconciled exactly the eight configured/SoT paths authorized by this
task. Together with the two Phase A tests, the complete cutover candidate has
exactly ten visible changed paths and zero hidden changes.

The first full candidate validation identified one SPC-002 descriptive mismatch:
the product topology term `subagent` had been simplified to the DAT-016 POP
serialization kind `agent`. SPC-002 was corrected inside its authorized Phase B
surface to preserve both truths explicitly.

Governed mechanical validation
`tsk009-final-mechanical-r2-20261001` then completed PASS with complete
evidence and `executorInvoked:false`:

- `npm ci` PASS;
- `npm test` PASS with 49/49 tests;
- `git diff --check` PASS.

Governance Author semantic self-assessment is PASS:

- POP bindings exactly match the SPC-002 Claude-native target;
- Platform Bootstrap is active for `claude-code` and satisfies DAT-016
  eligible-profile identity invariants;
- main-agent eligibility is limited to Governance Author and Evidence Custodian
  through operation-scoped role selection;
- dedicated Executor and Auditor subagents are active through their target
  Capability Profiles;
- Mechanical Validator is `claude-code-native-validation`;
- runner Capability Profiles remain only non-required historical configuration;
- the ChatGPT project-system-prompt derivative is retired;
- root `CLAUDE.md`, project `.mcp.json`, telemetry implementation, framework
  release, dependencies, subagent definitions, and provider/model settings are
  unchanged by the cutover;
- Hooks, Skills, agent teams, model selection, additional subagents, synthetic
  benchmarking, and remote telemetry remain outside authority;
- no independent Governance Audit is required because the active POP contains no
  audit trigger and no framework-required trigger applies.

Promotion of this exact candidate is the Claude-native cutover boundary.
Workspace trust/project MCP approval and actual telemetry arrival remain
first-session runtime facts to verify after promotion; they are not fabricated as
pre-cutover evidence.
