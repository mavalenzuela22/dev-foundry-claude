---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: System Overview
  status: ACTIVE
artifactVersion: "2.1.0-local.17"
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

The completed TSK-002 boundary delivers the minimal Claude governance MCP
resolver, TSK-003 delivers the minimal Claude-native project bootstrap, and
TSK-004 establishes direct Claude project MCP launch compatibility, TSK-005
completes repository-side cutover readiness, TSK-006 completes the
role-isolation/token-economics architecture, TSK-007 completes the bounded
implementation of exactly the Executor and Auditor project subagents, and
TSK-008 completes the local operational-telemetry instrumentation boundary.

TSK-008 did not authorize:

- activating Claude-native POP role bindings or switching the active Platform
  Bootstrap away from ChatGPT;
- any Claude subagent beyond `dev-foundry-executor` and
  `dev-foundry-auditor`;
- Hooks, Skills, agent teams, Claude settings/permissions, or model selection;
- another MCP tool or generic repository-control MCP surface;
- synthetic Claude benchmarks, public/LAN telemetry listeners, remote telemetry
  backends, or cloud telemetry deployment;
- automatic provider routing or secret handling;
- copying runtime implementation or task history from another project.

Those require separate follow-on governed tasks.

## 5. Current State

The initial Claude-native adapter architecture baseline, TSK-002 minimal
governance MCP resolver, TSK-003 minimal root Claude project bootstrap, and
TSK-004 project-scoped MCP launch compatibility, TSK-005 Claude-native cutover
readiness, TSK-006 role-isolation/token-economics architecture, and TSK-007
minimal Executor/Auditor subagent implementation and TSK-008 local operational
telemetry instrumentation are complete. Exactly two project subagents now exist
and are statically qualified under SPC-003, and the SPC-004 telemetry path is
mechanically ready without synthetic Claude spend.
TSK-009 completes the atomic configured-state cutover to Claude Code.
Claude Code is now the active configured project platform after promotion.

Canonical DEV FOUNDRY 2.1.0 remains the selected reusable methodology.
The local Project Operating Profile and Authority Index bind that release to
`dev-foundry-claude`.

ADR-001 owns the Claude-native repository versus governance-MCP boundary.
ADR-002 owns the initial local stdio runtime stack. ARC-001 defines the adapter
architecture. SPC-001 and DAT-001 close the resolver behavior and tool contract.
SPC-002 owns the active Claude-native binding contract. SPC-003 owns the
role-isolation and token-economics contract. SPC-004 owns the operational
telemetry and empirical tokenomics evidence contract.

The active POP now binds Governance Author and Evidence Custodian to the
`claude-main-agent` through operation-scoped role selection, Implementation
Executor to `dev-foundry-executor`, Governance Auditor to
`dev-foundry-auditor`, and Mechanical Validator to
`claude-code-native-validation`. The runner is no longer an active Executor or
Validator binding.

Exactly two project subagents remain authorized. Hooks, Skills, agent teams,
model selection, additional subagents, and remote telemetry remain outside the
completed cutover boundary. Actual telemetry arrival and any provider trust/MCP
approval are first-session runtime facts.
