---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-008
  type: ADR
  title: Version-Resolved Adapter Runtime and Managed Upgrade Architecture
  status: ACCEPTED
artifactVersion: "1"
authorityScope: adapter-version-resolved-runtime-and-governed-lifecycle
ownerRole: governance-author
canonical: true
scope:
  owns:
    - stable-adapter-launcher-selection
    - immutable-versioned-adapter-runtime-store
    - per-consumer-runtime-isolation
    - producer-runtime-manager-responsibility
    - recovery-independent-of-claude-runtime
  appliesTo:
    components:
      - adapter-cli
      - adapter-package
      - governance-mcp
      - dashboard
      - telemetry-launcher
      - runtime-migration
  excludes:
    - first-consumer-governance-bootstrap-redesign
    - silent-updates
    - runtime-provider-authentication
    - consumer-product-code
    - reusable-framework-methodology
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-007
    - ARC-001
    - OPS-005
    - OPS-008
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-008] PROJECT - Version-Resolved Adapter Runtime and Managed Upgrade Architecture

## 1. Context

The initial global npm-installed CLI and package root directly own runtime entry points. Replacing that installation changes a shared executable while a Claude source-governed session may still run; two consumers can require different exact adapter pins. The current deterministic managed-file upgrade is not a complete runtime installation, configured-authority reconciliation or multi-component lifecycle manager. ADR-007 already requires staged verified target bytes and a stale source session after cutover.

## 2. Decision

1. **Stable launcher.** Establish a minimal installation/bootstrap entrypoint, separate from versioned adapter runtime code. Its stable responsibilities are locating the consumer, reading its exact selected self-pin, choosing the matching immutable runtime, checking integrity and dispatching. It SHALL NOT own project semantic governance, interpret a new methodology, implement migration decisions or silently update packages.
2. **Version-addressed runtime store.** Runtime packages coexist by exact adapter identity `<version>:sha256:<root>`, not bare SemVer. Staged bytes are outside active consumer authority and package directories; completed runtimes remain immutable. Resolve the package for each invocation (CLI, MCP, dashboard, telemetry) consistently with the selected project pin.
3. **Project isolation.** Upgrading consumer A does not mutate or invalidate consumer B. The launcher and package store are shared infrastructure, while the selected release and configured authority are project-scoped. Runtime garbage collection is explicit, bounded and refuses removal when a release is pinned, active, reserved for recovery, or of unknown usage.
4. **Separation of responsibilities.** Runtime Manager owns trusted acquisition, immutable storage, compatibility/provenance/integrity checks, dispatch and recovery transport. Deterministic Migration Engine owns exact managed/configured path plans, hashes, journaling, rollback eligibility and mechanical validation. The main source-governed Claude agent analyzes semantic deltas, reconciles bounded project authority, obtains reserved Operator decisions, and coordinates the established lifecycle. Governance MCP continues to resolve authority and staleness, not to become a generic installer.
5. **Whole-package consistency.** CLI, Governance MCP, dashboard frontend/backend, telemetry launcher and shipped adapter-managed integration surfaces use the verified target release. Historical consumer runtime data belongs to the consumer and must not be erased, reinterpreted or silently migrated by a package upgrade.
6. **Session and recoverability.** Source runtime must stay runnable until cutover; new release bytes have no authority before cutover. A durable journal records source/target, plan and phase before mutating project identity. The source session becomes stale after the authorized transition; the new session independently verifies target selection and configured authority before completion. Recovery of a failed CLI/MCP launch must be possible without invoking that failed runtime.
7. **One-time initial migration.** A pre-launcher 1.4.2 consumer cannot be assumed to support the new launcher. The first managed-runtime-capable target SHALL provide an explicit tested transition with source pin preservation; globally replacing 1.4.2 while it is serving sessions is not a valid transition.
8. **No ungoverned automation.** Release discovery may be read-only; download/stage is distinct from project adoption. No background auto-update, silent framework change, implicit consumer pin overwrite or package-script execution occurs. A host or trust-boundary change requires a new governed review.
9. **Preserve CLI first install.** Greenfield and brownfield consumers with no governance continue with the CLI-first setup path. Legacy consumers before 1.4.0 use a declared bridge. Normal future upgrades of governed consumers are initiated inside Claude.

## 3. Alternatives and trade-offs

- **Overwrite global npm on every release:** rejected as shared-project breakage and source-session invalidation.
- **Copy runtime into every consumer repository:** rejected as unrelated tracked project mutation and duplicate maintenance.
- **Let the model fetch/extract/patch arbitrary files directly:** rejected because plan, trust, integrity, journal and recovery require deterministic enforcement.
- **Build a second governance framework inside the launcher:** rejected; current POP/index and source-governed Claude authority remain canonical.
- **Single centralized background updater:** rejected as implicit adoption, unclear Operator consent and cross-project coupling.
- **Multiple uncoordinated version managers:** rejected; one package-identity resolver must serve CLI, MCP, dashboard and telemetry.

An isolated package cache and stable launcher add bootstrapping complexity. This cost is accepted to remove in-place global replacement and allow per-project exact-version isolation. Implementation must prove the simpler deterministic architecture actually meets these guarantees; it must not introduce a general-purpose package registry, permanent daemon or extra always-on agent merely for symmetry.

## 4. Consequences, constraints and proof

SPC-008 owns concrete runtime state, API/migration, recovery and validation predicates. ARC-001 owns component architecture. TSK-026 owns one coherent demonstrable delivery scope, with separate later executor authorization and release/consumer gates. The next release number remains unspecified until governed release preparation.

At minimum, proof must install exact packages on Windows/macOS, preserve a live 1.4.2 consumer in migration, run two simultaneous differently pinned consumers, recover from induced cutover failure with a broken target MCP, and verify dashboard/telemetry package parity before claiming terminal success.
