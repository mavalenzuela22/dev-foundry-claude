---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: System Overview
  status: ACTIVE
artifactVersion: "2.1.0-local.18"
authorityScope: dev-foundry-claude-project
ownerRole: governance-author
canonical: false
scope:
  owns:
    - project-purpose
    - project-boundary
    - current-greenfield-state
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - reusable-dev-foundry-methodology
    - detailed-runtime-design
    - implementation-task-details
authority:
  governedBy:
    - OPS-005
    - OPS-007
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 00 [OVR-001] dev-foundry-claude - System Overview

## 1. Purpose

`dev-foundry-claude` is the greenfield runtime adapter that makes DEV FOUNDRY
usable natively from Claude Code while preserving repository-owned product
authority, bounded execution, independent review where required, minimal
sufficient change, and Operator control.

DEV FOUNDRY reusable methodology is not owned by this repository. This project
explicitly adopts immutable canonical DEV FOUNDRY 2.1.0 from
`.dev-foundry/releases/2.1.0/`.

## 2. Project Boundary

The project MAY provide Claude Code bootstrap instructions, context-resolution
tooling, Skills, subagents or agent-team integration, hooks or deterministic
guards, test fixtures, test harnesses, and other adapter-specific runtime support
when separately governed.

The project SHALL NOT embed or recreate the runner merely to read or mutate the
same repository from Claude Code. The runner and this adapter are distinct
runtime integrations.

The project SHALL NOT duplicate the adopted DEV FOUNDRY release into project
prompts, Skills, summaries, or local OPS/DAT copies as a parallel methodology
source.

## 3. Current Goals

The approved direction is to:

- minimize model cost caused by repeated authority reconstruction;
- preserve repository SoT while enabling deterministic minimal-context retrieval;
- use Claude Code native mechanisms when they materially improve the adapter;
- preserve role separation and explicit Operator authorization;
- keep provider authentication, credentials, enterprise routing, and private
  launcher configuration outside reusable methodology and project SoT unless a
  concrete non-secret contract requires them.

## 4. Current Non-Goals

The following remain outside the delivered boundary and require separate
follow-on governed tasks:

- any Claude subagent beyond `dev-foundry-executor` and `dev-foundry-auditor`;
- Hooks, Skills, agent teams, committed Claude settings/permissions, or model
  selection (Operator-local, Git-ignored `.claude/settings.local.json` is
  provider mechanics, not project configuration);
- another MCP tool or a generic repository-control MCP surface;
- synthetic Claude benchmarks, public/LAN telemetry listeners, remote telemetry
  backends, or cloud telemetry deployment;
- automatic provider routing, provider authentication, or secret handling;
- copying runtime implementation or task history from another project;
- modifying, wrapping, or replacing the mature ChatGPT-side runner, or creating
  an intermediate synchronization layer or cross-surface protocol.

## 5. Current State

TSK-001 through TSK-010 are complete: the adapter architecture baseline, the
minimal governance MCP resolver, the minimal root Claude bootstrap, project MCP
launch compatibility, cutover readiness, role-isolation/token-economics
architecture, the Executor and Auditor subagents, local operational telemetry,
the atomic cutover (TSK-009), and multi-harness launcher support (TSK-010:
`direct`, `dial`, `codemie` through the one canonical launcher
`scripts/telemetry/claude.mjs`, with a dynamically selected collector port).
TSK-011 reconciles post-cutover defects and bounds a Claude-versus-runner
compatibility investigation.

Claude Code is the active configured project platform. Canonical DEV FOUNDRY
2.1.0 remains the selected reusable methodology; the local Project Operating
Profile and Authority Index bind that release to `dev-foundry-claude`.

ADR-001 owns the Claude-native repository versus governance-MCP boundary.
ADR-002 owns the initial local stdio runtime stack. ARC-001 defines the adapter
architecture. SPC-001 and DAT-001 close the resolver behavior and tool contract.
SPC-002 owns the active Claude-native binding contract. SPC-003 owns the
role-isolation and token-economics contract. SPC-004 owns the operational
telemetry and empirical tokenomics evidence contract.

The active POP binds Governance Author and Evidence Custodian to the
`claude-main-agent` through operation-scoped role selection, Implementation
Executor to `dev-foundry-executor`, Governance Auditor to
`dev-foundry-auditor`, and Mechanical Validator to
`claude-code-native-validation`. The runner is not an active Executor or
Validator binding. A read-only runner inspection is not an active-role action
and is not evidence of a stale binding.

Exactly two project subagents are authorized. Actual telemetry arrival and any
provider trust/MCP approval are first-session runtime facts; whether `dial` and
`codemie` forward the launcher's telemetry environment remains to be observed in
a real session.
