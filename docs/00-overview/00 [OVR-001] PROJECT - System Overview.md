---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: System Overview
  status: ACTIVE
artifactVersion: "2.1.0-local.1"
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

The active TSK-001 architecture boundary does not authorize:

- product runtime implementation;
- an active Implementation Executor or Capability Profile;
- a concrete Claude governance MCP implementation;
- concrete Skills, hooks, subagents, agent teams, or product `CLAUDE.md`
  behavior;
- automatic authentication handling or provider routing;
- copying runtime implementation or task history from another project.

Those require separate follow-on governed implementation tasks.

## 5. Current State

The repository has moved from governance bootstrap into its first bounded
product architecture task.

Canonical DEV FOUNDRY 2.1.0 remains the selected reusable methodology.
The local Project Operating Profile and Authority Index bind that release to
`dev-foundry-claude`.

ADR-001 records the accepted Claude-native repository versus governance-MCP
boundary. ARC-001 defines the active adapter architecture baseline. TSK-001 has
completed the bounded architecture-baseline task.

The Implementation Executor binding remains deferred.
No product runtime implementation or execution is authorized by TSK-001.
