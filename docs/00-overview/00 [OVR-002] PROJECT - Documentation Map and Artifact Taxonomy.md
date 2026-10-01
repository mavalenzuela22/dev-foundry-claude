---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-002
  type: OVR
  title: Documentation Map and Artifact Taxonomy
  status: ACTIVE
artifactVersion: "2.1.0-local.5"
authorityScope: dev-foundry-claude-project-routing
ownerRole: governance-author
canonical: false
scope:
  owns:
    - project-documentation-map
    - project-authority-routing
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - reusable-artifact-taxonomy
    - reusable-lifecycle-semantics
    - reusable-profile-contracts
authority:
  governedBy:
    - OPS-005
    - DAT-020
  supersedes: []
lifecycle:
  phase: active
portability: adapt
---

# 00 [OVR-002] dev-foundry-claude - Documentation Map and Artifact Taxonomy

## 1. Purpose

Provide the human-readable project navigation map for `dev-foundry-claude`.

The machine-readable routing authority is
`.dev-foundry/authority-index.yaml`. Reusable artifact taxonomy, lifecycle,
roles, contracts, and methodology semantics are owned by the explicitly adopted
DEV FOUNDRY 2.1.0 release, not by this project document.

## 2. Active Methodology

The project adopts canonical DEV FOUNDRY 2.1.0.

- Release manifest:
  `.dev-foundry/releases/2.1.0/release-integrity-manifest.yaml`
- Framework authority index:
  `.dev-foundry/releases/2.1.0/authority-index.yaml`
- Immutable release namespace:
  `.dev-foundry/releases/2.1.0/**`

The release is a consumer copy and SHALL remain byte-identical to its canonical
published artifacts. This repository does not acquire canonical methodology
authority by vendoring it.

## 3. Project Bindings

Configured project authority and bindings are:

- `.dev-foundry/authority-index.yaml` — project Authority Index;
- `.dev-foundry/profiles/project-operating-profile.yaml` — active Project
  Operating Profile;
- `.dev-foundry/platform-bootstrap.yaml` — configured Platform Bootstrap;
- `.dev-foundry/bootstrap/project-system-prompt.md` — non-authoritative
  deployed/pasteable bootstrap derivative;
- `docs/00-overview/00 [OVR-001] PROJECT - System Overview.md` — project purpose
  and boundary;
- this document — human-readable project navigation.

Use the project Authority Index first for repository-dependent authority routing.

## 4. Role Bindings

The active POP binds:

- Governance Author -> canonical `governance-author-v3`;
- Governance Auditor -> canonical `governance-auditor-v2`;
- Mechanical Validator -> canonical `mechanical-validator-v2` implemented by
  the process-bound runner;
- Evidence Custodian -> canonical `evidence-custodian-v1`;
- Implementation Executor -> canonical `implementation-executor-v2`, currently
  bound to the runner's task-directed code executor through
  `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V2`; while governance is hosted from
  ChatGPT, that profile selects `codex-cli` and explicitly excludes Claude Code
  execution before cutover.

Capability does not grant authority, and the runner is product/runtime machinery,
not reusable methodology. The governance-agent bootstrap is not an executor
binding.

## 5. Current Product Authority

The current project authority is:

- OVR-001 and OVR-002 for project purpose, boundary, navigation, and routing;
- ADR-001 for the accepted Claude-native repository versus governance-MCP
  decision;
- ADR-002 for the local stdio MCP runtime stack and dependency boundary;
- ARC-001 for the active Claude Code adapter architecture baseline;
- SPC-001 for governed-operation resolver behavior;
- DAT-001 for the exact resolver tool contract;
- TSK-001 for the completed architecture-baseline task;
- TSK-002 for the completed minimal resolver implementation task;
- TSK-003 for the completed minimal Claude-native project bootstrap task.

No MTP or follow-on product TSK is active.
Hooks, Skills, subagents, agent teams, Claude settings/permissions, and direct
Claude Code execution/cutover remain unauthorized follow-on work.

The project Authority Index routes every current authoritative home. Missing
future implementation authority does not authorize inventing requirements.

## 6. Single Authoritative Home

One decision, invariant, schema, lifecycle rule, role rule, or responsibility has
one authoritative home. Project artifacts route to the adopted framework or own
only project-specific configuration and product authority. Historical or
generated text does not override either.
