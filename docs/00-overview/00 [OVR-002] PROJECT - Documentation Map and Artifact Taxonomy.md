---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-002
  type: OVR
  title: Documentation Map and Artifact Taxonomy
  status: ACTIVE
artifactVersion: "2.1.0-local.31"
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

The active POP binds, on platform `chatgpt-project` (ADR-004, TSK-013):

- Governance Author -> canonical `governance-author-v3`, implemented by
  `operator-assisted-dev-foundry-copilot`;
- Governance Auditor -> canonical `governance-auditor-v2`, implemented by
  `operator-assisted-dev-foundry-copilot`, subject to operation-scoped
  independence;
- Evidence Custodian -> canonical `evidence-custodian-v1`, implemented by
  `operator-assisted-dev-foundry-copilot`;
- Implementation Executor -> canonical `implementation-executor-v2`,
  implemented by `process-bound-runner-code-executor` through
  `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V3` (Codex via the process-bound runner);
- Mechanical Validator -> canonical `mechanical-validator-v2`, implemented by
  `process-bound-runner`.

The Claude Capability Profiles, `DFC-IMPLEMENTATION-EXECUTOR-RUNNER-V1` and
`-V2`, and `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V1` remain configured
history or consumer-target product surface where indexed and are not active
producer bindings.

Capability does not grant authority. Role selection remains operation-scoped,
and the main agent is not the Executor or Auditor implementation.

## 5. Current Product Authority

The current project authority is:

- OVR-001 and OVR-002 for project purpose, boundary, navigation, and routing;
- ADR-001 for the accepted Claude-native repository versus governance-MCP
  decision;
- ADR-002 for the local stdio MCP runtime stack and dependency boundary;
- ADR-003 for the reusable adapter package and consumer boundary;
- ARC-001 for the active Claude Code adapter architecture baseline;
- SPC-001 for governed-operation resolver behavior;
- SPC-002 for the Claude-native binding model (historical producer state and consumer target);
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
- TSK-009 for the completed atomic Claude-native cutover task;
- TSK-010 for the completed multi-harness Claude runtime activation task;
- TSK-011 for the post-cutover reconciliation and runner-compatibility
  investigation task;
- TSK-012 for the completed reusable package and brownfield adoption task;
- ADR-004 for producer/consumer operational separation and the adapter release
  lifecycle;
- SPC-005 for the active adapter release and consumer upgrade contract;
- TSK-013 for the producer-maintenance cutover task;
- SPC-006 for the local producer operations dashboard parity contract;
- TSK-014 for the completed and formally closed Foundry Runner dashboard parity
  baseline task;
- TSK-014-CLOSURE for TSK-014 terminal disposition, delivered evidence, accepted
  visual limit, and explicit OTEL deferral;
- TSK-015 for the completed and formally closed Claude OTEL read-model and local
  dashboard integration task;
- TSK-015-AUDIT for the completed independent Governance Audit and corrective-review
  lineage supporting TSK-015 promotion;
- TSK-015-CLOSURE for TSK-015 terminal disposition, delivered evidence, known limit,
  explicit deferrals, and formal closure.
- TSK-016 for the completed and formally closed reusable-package dashboard distribution,
  package CLI, consumer installation documentation, methodology-first user guide, and
  isolated package-consumer smoke task;
- TSK-016-CLOSURE for TSK-016 terminal disposition, promotion evidence, known
  distribution limit, and formal closure.
- TSK-017 for the Windows installed-payload verification corrective and 1.2.1 lineage.
- TSK-018 for the completed and formally closed launcher LF/package-stability corrective and 1.2.2 Windows consumer proof;
- TSK-018-CLOSURE for its terminal disposition.
- TSK-019 and TSK-019-CLOSURE for the completed CRLF managed-block idempotence corrective and adapter 1.2.3 Windows consumer proof;
- ADR-006 for the beginner-first self-explaining consumer experience;
- SPC-007 for the guided consumer CLI/help contract;
- TSK-020 and TSK-020-CLOSURE for the completed public GitHub Release and compatible-upgrade baseline;
- TSK-021 for the active self-explaining consumer UX, guided telemetry start, canonical help and managed-surface upgrade implementation.

No MTP is active.
`dev-foundry-executor` and `dev-foundry-auditor` remain Claude adapter product
surface under SPC-003 and are not bound in the producer POP.
TSK-008 established the local telemetry path for empirical review using real
Claude-native work and TSK-010 added the `direct`, `dial` and `codemie` launch
modes; actual telemetry arrival is verified in real launcher-started sessions.
The active producer platform is `chatgpt-project`; Claude Code is the adapter's target runtime. Hooks, Skills, agent teams, model selection,
and additional subagents remain unauthorized unless separately governed.

The project Authority Index routes every current authoritative home. Missing
future implementation authority does not authorize inventing requirements.

## 6. Single Authoritative Home

One decision, invariant, schema, lifecycle rule, role rule, or responsibility has
one authoritative home. Project artifacts route to the adopted framework or own
only project-specific configuration and product authority. Historical or
generated text does not override either.
