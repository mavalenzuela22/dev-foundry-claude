---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: System Overview
  status: ACTIVE
artifactVersion: "2.1.0-local.22"
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

When separately governed (TSK-012, ADR-003), the project MAY distribute its reusable runtime
as a versioned package that an existing governed repository installs, receiving only
project-specific generated configuration. A consumer SHALL NOT receive this project's
authority, history, or runtime code copies, and adopting the package SHALL NOT change that
repository's authority or its runner bindings.

The project SHALL NOT duplicate the adopted DEV FOUNDRY release into project
prompts, Skills, summaries, or local OPS/DAT copies as a parallel methodology
source.

Under ADR-004 the project is the **producer** of the Claude adapter and is
operated independently of the **consumers** that run it. The runtime that
develops this repository need not be Claude Code, even though the adapter it
produces targets Claude Code. A consumer adopts an explicit immutable adapter
release and never follows this repository's `main`; adopting or replacing a
package changes no consumer authority.

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
  an intermediate synchronization layer or cross-surface protocol;
- dual binding of any role, package-registry publication, and modification of any
  consumer repository without separate Operator authorization.

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

TSK-012 is complete: the reusable `@dev-foundry/claude-adapter` package and brownfield adoption
under ADR-003 exist as a private, tarball-distributed build with a plan/apply CLI, a runtime pin,
and a default-off consumer-mode activation guard. No real consumer repository has adopted it and
no package has been published. The active self-hosted state below is unchanged.

TSK-013 is the producer-maintenance cutover under ADR-004. After its promotion
the active configured producer platform is `chatgpt-project`, not Claude Code.
Claude Code remains the target runtime of the adapter and of any consumer that
explicitly adopts a release. Root `CLAUDE.md`, `.mcp.json`, `.claude/**`, the
Claude Capability Profiles and package templates remain as product,
distribution and test surface and bind no producer role. Adapter version 1.1.0
(TSK-012) is the initial consumer baseline; SPC-005 (PLANNED) records the future
release and upgrade contract, whose implementation is not yet authorized.
Canonical DEV FOUNDRY 2.1.0 remains the selected reusable methodology; the local
Project Operating Profile and Authority Index bind that release to
`dev-foundry-claude`.

ADR-001 owns the Claude-native repository versus governance-MCP boundary.
ADR-002 owns the initial local stdio runtime stack. ARC-001 defines the adapter
architecture. SPC-001 and DAT-001 close the resolver behavior and tool contract.
SPC-002 owns the Claude-native binding target and consumer-cutover model, not
the active producer bindings, which the POP owns. SPC-003 owns the
role-isolation and token-economics contract. SPC-004 owns the operational
telemetry and empirical tokenomics evidence contract.

The active POP binds Governance Author, Governance Auditor and Evidence
Custodian to `operator-assisted-dev-foundry-copilot` on `chatgpt-project` through
operation-scoped role selection, Implementation Executor to
`process-bound-runner-code-executor` through
`DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3`, and Mechanical Validator to
`process-bound-runner`. The Claude subagents and native validation are not
active producer bindings; the runner V2 profile is historical.

Exactly two Claude project subagents exist as adapter product surface. Actual telemetry arrival and any
provider trust/MCP approval are first-session runtime facts; whether `dial` and
`codemie` forward the launcher's telemetry environment remains to be observed in
a real session.
