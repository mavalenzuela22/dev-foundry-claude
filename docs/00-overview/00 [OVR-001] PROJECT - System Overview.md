---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: System Overview
  status: ACTIVE
artifactVersion: "2.1.0-local.8"
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
TSK-004 establishes direct Claude project MCP launch compatibility. TSK-005 is
the active bounded readiness task for the later Claude-native cutover.

TSK-005 does not authorize:

- activating Claude-native POP role bindings or switching the active Platform
  Bootstrap away from ChatGPT;
- Hooks, Skills, subagents, agent teams, or Claude settings/permissions;
- another MCP tool or generic repository-control MCP surface;
- remote MCP transport, authentication, cloud deployment, or telemetry;
- automatic provider routing or secret handling;
- copying runtime implementation or task history from another project.

Those require separate follow-on governed tasks.

## 5. Current State

The initial Claude-native adapter architecture baseline, TSK-002 minimal
governance MCP resolver, TSK-003 minimal root Claude project bootstrap, and
TSK-004 project-scoped MCP launch compatibility are complete. TSK-005 is active
and prepares the exact future cutover contract, an unbound Claude-native
Implementation Executor Capability Profile, and focused readiness proof.

Canonical DEV FOUNDRY 2.1.0 remains the selected reusable methodology.
The local Project Operating Profile and Authority Index bind that release to
`dev-foundry-claude`.

ADR-001 owns the Claude-native repository versus governance-MCP boundary.
ADR-002 owns the initial local stdio runtime stack. ARC-001 defines the adapter
architecture. SPC-001 and DAT-001 close the resolver behavior and tool contract.
SPC-002 owns the prepared Claude-native cutover binding contract.

While governance is hosted from ChatGPT, the Implementation Executor is
separately bound to the runner through
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`, which selects `codex-cli` for
task-directed implementation. Claude Code is not used as an executor before the
separately governed Claude-native cutover. The governance-agent implementation
remains the Governance Author and does not self-select the executor role.
