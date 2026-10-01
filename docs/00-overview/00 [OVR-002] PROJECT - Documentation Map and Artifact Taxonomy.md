---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-002
  type: OVR
  title: Documentation Map and Artifact Taxonomy
  status: ACTIVE
artifactVersion: "2.1.0-local.17"
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
- Mechanical Validator -> canonical `mechanical-validator-v2`, implemented by
  `claude-code-native-validation` on `claude-code`;
- Evidence Custodian -> canonical `evidence-custodian-v1`, implemented by
  `claude-main-agent` on `claude-code`;
- Implementation Executor -> canonical `implementation-executor-v2`,
  implemented by dedicated subagent `dev-foundry-executor` through
  `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`;
- Governance Auditor -> canonical `governance-auditor-v2`, implemented by
  read-only dedicated subagent `dev-foundry-auditor` through
  `DFC-GOVERNANCE-AUDITOR-CLAUDE-CODE-V1`;
- Governance Author -> canonical `governance-author-v3`, implemented by
  `claude-main-agent` on `claude-code`.

The historical `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` and runner
Capability Profiles remain configured history where indexed but are not active
required Executor bindings.

Capability does not grant authority. Role selection remains operation-scoped,
and the main agent is not the Executor or Auditor implementation.

## 5. Current Product Authority

The current project authority is:

- OVR-001 and OVR-002 for project purpose, boundary, navigation, and routing;
- ADR-001 for the accepted Claude-native repository versus governance-MCP
  decision;
- ADR-002 for the local stdio MCP runtime stack and dependency boundary;
- ARC-001 for the active Claude Code adapter architecture baseline;
- SPC-001 for governed-operation resolver behavior;
- SPC-002 for the prepared Claude-native cutover binding contract;
- SPC-003 for Claude role isolation and token-economics constraints;
- SPC-004 for local operational telemetry and empirical tokenomics evidence;
- DAT-001 for the exact resolver tool contract;
- TSK-001 for the completed architecture-baseline task;
- TSK-002 for the completed minimal resolver implementation task;
- TSK-003 for the completed minimal Claude-native project bootstrap task;
- TSK-004 for the completed Claude project MCP launch-compatibility task;
- TSK-005 for the completed Claude-native cutover-readiness task;
- TSK-006 for the completed role-isolation and token-economics architecture
  task;
- TSK-007 for the completed minimal Executor/Auditor subagent implementation
  task;
- TSK-008 for the completed operational-telemetry instrumentation task;
- TSK-009 for the completed atomic Claude-native cutover task.

No MTP or follow-on product TSK is active.
Exactly `dev-foundry-executor` and `dev-foundry-auditor` are the active
dedicated project subagents under SPC-003, with their target Capability Profiles
bound in the active POP.
TSK-008 established the local telemetry path for empirical review using real
Claude-native work; actual telemetry arrival is verified in the first real
Claude-native session.
Claude Code is the active platform. Hooks, Skills, agent teams, model selection,
and additional subagents remain unauthorized unless separately governed.

The project Authority Index routes every current authoritative home. Missing
future implementation authority does not authorize inventing requirements.

## 6. Single Authoritative Home

One decision, invariant, schema, lifecycle rule, role rule, or responsibility has
one authoritative home. Project artifacts route to the adopted framework or own
only project-specific configuration and product authority. Historical or
generated text does not override either.
