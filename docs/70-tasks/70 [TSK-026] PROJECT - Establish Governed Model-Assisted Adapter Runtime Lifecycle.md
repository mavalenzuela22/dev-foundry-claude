---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-026
  type: TSK
  title: Establish Governed Model-Assisted Adapter Runtime Lifecycle
  status: PLANNED
artifactVersion: "1"
authorityScope: tsk-026-governed-model-assisted-adapter-runtime-lifecycle
ownerRole: governance-author
canonical: true
scope:
  owns:
    - version-resolved-adapter-runtime-lifecycle
    - project-pinned-multi-version-installation
    - source-governed-model-assisted-self-update
    - recoverable-runtime-and-authority-cutover
    - adapter-142-to-managed-runtime-transition
    - cli-mcp-dashboard-telemetry-version-consistency
    - packaged-cross-platform-consumer-acceptance
  appliesTo:
    components:
      - claude-adapter-package
      - adapter-cli
      - governance-mcp
      - local-operations-dashboard
      - telemetry-launcher
      - consumer-migration-runtime
  excludes:
    - real-consumer-mutation-during-producer-development
    - consumer-product-code
    - reusable-methodology-change
    - silent-consumer-framework-adoption
    - silent-background-updates
    - producer-release-publication-without-separate-gates
    - implementation-before-explicit-executor-authorization
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-007
    - ADR-008
    - ARC-001
    - SPC-005
    - SPC-007
    - SPC-008
    - OPS-001
    - OPS-002
    - OPS-004
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  derivedFrom:
    - TSK-021
    - TSK-025
lifecycle:
  phase: planned
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-026] PROJECT - Establish Governed Model-Assisted Adapter Runtime Lifecycle

## 1. Operator intent and authority boundary

The Operator explicitly authorized a complete governed design and preparation of a model-assisted adapter self-update capability, **up to but excluding product implementation**. This task is PLANNED; no Implementation Executor for TSK-026 is currently bound or authorized. This document, ADR-008, ARC-001 and SPC-008 define the candidate architecture and executable acceptance contract. They do not claim working updater software or release availability.

Baseline observed on 2026-10-09: producer `dev-foundry-claude` at clean main `588fd87fc0eb7ec1bfa0b512b929e17dbf02d391`; adopted immutable DEV FOUNDRY 2.1.0; shipped adapter 1.4.2. Prior TSK-025 and its implementation bindings are history and grant no new implementation authority. This task does not authorize any consumer operation.

## 2. Single capability and user-visible outcome

For an already-governed Claude consumer pinned to an exact self-update-capable adapter release, a normal request equivalent to “update DEV FOUNDRY Claude” SHALL result in a source-governed model workflow that discovers an explicit target, acquires and verifies the whole adapter side-by-side, reconciles any configured-authority delta with reserved Operator decisions, applies a recoverable cutover, and requests a fresh session that verifies the new CLI, MCP, dashboard, telemetry and authority. No user-run npm choreography or manual pin/hash/JSON editing is part of the normal upgrade path.

First-time greenfield/brownfield bootstrap remains CLI-first and requires explicit confirmation; a pre-1.4.0 consumer continues to use only a supported legacy bridge. Releases are not silently installed or adopted.

## 3. Architectural boundary and necessary code review

The target design in ADR-008 and ARC-001 separates (a) a small durable project-pin-aware launcher, (b) immutable version-addressed runtime installations, (c) deterministic package and migration tools, and (d) a Claude-orchestrated source-governed workflow. CLI, MCP, dashboard frontend/backend, telemetry launcher, shipped Skills/agents/templates, migration material, and bundled framework bytes share one verified adapter release identity; configured consumer authority is a distinct versioned state.

Before implementation, the Implementation Executor SHALL inventory and explicitly disposition current `src/adopt/{pin,upgrade,apply,migration,cutover,common}.js`, `src/governance-mcp/session.js`, `src/dashboard/command.js`, `src/telemetry/launch.js`, `bin/dev-foundry-claude.js`, template/Skill surfaces, packaging/release workflows and tests. Reuse deterministic integrity and recoverable-cutover primitives where correct. Refactor, consolidate or remove redundant paths when causally necessary. Do not grow a second conflicting verification, upgrade, evidence or authority engine.

No package version, exact next release number or publication authorization is inferred from this design.

## 4. Mandatory behavior and safety

The implementation SHALL satisfy SPC-008 sections 4–10 and 11 onward, ADR-008 and existing ADR-003/004/005/007 constraints. In particular:
- resolve an exact trusted target release and declared supported transition; never use mutable producer main or `latest` as migration authority;
- stage and verify without executing untrusted target install scripts, replacing source packages, writing project authority or changing the consumer pin;
- select runtime per consumer exact `<version>:sha256:<root>` pin; one project may upgrade while another retains an older version;
- keep source governance active through candidate review, exact plan/hash, reserved authorization, applicable validation/audit and cutover;
- cut over the adapter pin and authorized configured-authority delta as one recoverable logical transition, with durable journal, explicit intermediate states and documented recovery;
- invalidate stale source sessions and verify the new session independently before claiming complete;
- preserve historical records, code, evidence and unrelated project files, and preserve runtime versions still pinned or used by any consumer;
- distinguish rollback eligibility from forward recovery; unknown or ambiguous state blocks activation rather than guessing;
- require separate explicit framework-adoption authorization when a target requires a different DEV FOUNDRY release.

## 5. Acceptance matrix (all required for terminal PASS)

**A. Bootstrap boundaries.** Package installed from release asset without producer checkout on Windows/macOS; greenfield and brownfield initial CLI setup remain explicit, idempotent and preserve product files. Unsupported pre-baseline consumers fail closed.

**B. Initial 1.4.2 transition.** Exercise an **actual installed 1.4.2** consumer to the first new managed-runtime release using the declared one-time transition: package global/launcher reparenting, old self-pin preservation, bounded cutover, fresh start and recoverability. Do not assume the source release already implements the launcher.

**C. Multi-consumer isolation.** Two isolated consumers pinned to different immutable adapter identities launch their respective CLI/MCP/dashboard; upgrade A and prove B's files, pin, running session and active runtime unchanged. Package GC must not evict in-use or pinned versions.

**D. Runtime parity.** From an installed package verify CLI identity/version, MCP self-pin/startup fingerprint, dashboard frontend/server identity, telemetry collector/launcher, owned templates/Skills/agents and matching consumer pin. An already-running old dashboard must be detected; no arbitrary port/process termination.

**E. Semantic migration.** Synthetic release genuinely changes configured POP, index, bootstrap or profiles. The source-governed Claude workflow prepares semantically valid candidate under source authority, requests real reserved Operator choices, records audit disposition when triggered, refuses altered hash/authority, and only then cuts over. A deterministic-only fixture does not satisfy this case.

**F. Fault injection.** Inject crashes/restarts or power-loss-equivalent interruptions at download, verification, staging, preflight, authorization, plan writing, file writes, pin switch, journal commit, CLI/MCP/dashboard restart and final verification. Each case must end in intact source state, verified target state or documented recoverable blocked state; never an unobserved silent mixed authority.

**G. Negative and security tests.** Refuse unknown target/build, unsupported transition, ambiguous/dirty touched paths, symlinks/escape, tampered payload/manifest, wrong trusted source, executed package lifecycle scripts, stale plan, expired authorization, changed framework requirement, unresolved Operator choice, concurrent upgrades, unsafe cleanup and stale-session further governed work.

**H. Persistence and schemas.** Historical evidence retains original framework/schema meaning; dashboard serves compatible records or explicitly reports bounded degradation without data loss; old telemetry remains available. Release and upgrade state survive process exit.

**I. Cross-platform and packaging.** Tests use exact packed release assets and installed/runtime-resolved trees (not only source imports) on Windows and macOS; test Node/npm minimum-version failures and Windows file-lock behavior; full focused and regression suites, diff check and deterministic payload/release identity checks PASS.

**J. User workflow.** Initiate from natural request inside a governed Claude session. No required manual npm, hash-copying, JSON editing or repeated approval when the original exact scoped authorization remains valid. Advanced CLI remains usable for deliberate recovery and first setup.

## 6. Preparation sequence and gates

1. Governance Author completes ADR-008 selection, ARC-001 and SPC-008 reconciliations, this TSK and binding; records exact changed-path list, self-assessment and audit-trigger disposition.
2. Resolve TSK-026 against the resulting indexed authority; validate the documentation candidate and promote documentation only through independently verified gates when authorized.
3. **Stop before product implementation.** A later separate bounded operation SHALL explicitly authorize an eligible TSK-026 Implementation Executor and Capability Profile, implementation scope and evidence contract. Authoring approval alone does not activate that binding.
4. Once authorized, implementation may be divided only along materially independent launcher/runtime, migration/recovery, model integration and packaged E2E gates; do not manufacture additional TSKs or audits for routine failed local tests.
5. Producer release publication and consumer adoption remain separately authorized post-validation actions.

## 7. Hard exclusions and stop conditions

No mutation to PagoElectronico or another consumer, immutable framework release, prior release tags/assets, unrelated provider auth, product code or framework methodology. No arbitrary network-exposed services, silent updater, bypass of Operator decisions, claim of atomic multi-file filesystem rename, automatic downgrade, or false claim that new runtime functions already exist.

Stop on missing binding, unsupported capability or host assumption, stale repository HEAD, package provenance uncertainty, cross-project mutation, unavailable required audit, scope expansion, unverified transition or indeterminate side effect.

## 8. Definition of preparation complete

Documentation has complete architecture decision, migration/launcher contract, recoverable state machine, 1.4.2 bridge, dashboard/telemetry lifecycle, threat/failure matrix, cross-platform E2E proof, minimal implementation projection or declared absence, and explicit handoff stop before Implementation Executor activation. Validation PASS and promotion of documentation, if applicable, are separately evidenced. **PLANNED is not IMPLEMENTED and is not a release.**

## 9. Governance Author design self-assessment and deferred proof

- **Necessity and reuse:** ADR-007/SPC-008 already own source-governed semantic
  migration and side-by-side staging. ADR-008 adds only the previously
  undecided stable launcher/version-store design. ARC-001 and SPC-008 retain
  their authoritative ownership; no parallel methodology or duplicate package
  integrity engine is introduced.
- **State truth:** current 1.4.2 implements a partial migration substrate, not
  the stable version-resolved launcher nor a proven end-to-end model-assisted
  runtime lifecycle. This document claims only a governed PLANNED capability.
- **Security:** a payload hash is byte integrity, not publisher authenticity;
  trusted GitHub Release provenance/transport and target execution policy must
  be implemented and shown in the release trust model. No silent upgrade,
  global overwrite, or unverified package execution is allowed.
- **Actor fit:** one currently eligible Governance Author and its TSK-026
  documentary Capability Profile are active; the prior TSK-025 executor remains
  task-bound and cannot implement TSK-026. No Implementation Executor binding
  for TSK-026 exists; stop before code execution.
- **Audit disposition:** adopted OPS-004 defines triggered independent audit.
  POP audit_triggers are empty; neither this task nor ADR-008 requires an
  independent audit for this document-only preparation, and the Operator did
  not request one. This is an Author trigger assessment, **not** an independent
  audit verdict. If a newly observed mandatory trigger appears, stop and
  satisfy it before promoting the affected boundary.
- **Acceptance/evidence:** repository path-set validation is distinct from
  metadata validation, semantic review, runtime E2E and eventual release
  acceptance. A documentation PASS never means CLI/MCP/dashboard update PASS.
- **Implementation-entry questions remain gated, not silently assumed:** exact
  trusted acquisition mechanism/host permission model, minimal supported
  Node/npm matrix, install-root ownership and launcher bootstrap on Windows,
  safe platform-dependent 1.4.2 handover, durable journal path/schema,
  package GC discovery across consumers, and full source/target host test matrix
  require validated concrete implementation choices **before** their relevant
  execution boundary. An unsupported assumption is a stop, not permission
  to broaden the task.
