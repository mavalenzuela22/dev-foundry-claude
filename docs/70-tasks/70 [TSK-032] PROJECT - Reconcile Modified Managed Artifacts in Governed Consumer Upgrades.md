---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-032
  type: TSK
  title: Reconcile Modified Managed Artifacts in Governed Consumer Upgrades
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-032-managed-artifact-upgrade-reconciliation
ownerRole: governance-author
canonical: true
scope:
  owns:
    - verified-managed-artifact-reconciliation-on-upgrade
    - minimal-corrective-release-after-adapter-150
  appliesTo:
    components:
      - claude-adapter-package
      - managed-upgrade-plan-apply
      - focused-upgrade-regression-tests
      - existing-adapter-release-artifacts
  excludes:
    - consumer-repository-mutation
    - upstream-dev-foundry-methodology-change
    - foundry-runner-change
    - adapter-150-tag-or-asset-replacement
    - new-infrastructure-or-transport
    - automatic-framework-adoption
    - arbitrary-consumer-configured-authority-rewrite
    - unrelated-managed-runtime-lifecycle-implementation
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-007
    - SPC-005
    - SPC-008
    - OPS-001
    - OPS-003
    - OPS-004
    - OPS-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn: []
  derivedFrom:
    - TSK-020
    - TSK-021
    - TSK-031
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# TSK-032 — Reconcile Modified Managed Artifacts in Governed Consumer Upgrades

## 1. Operator authorization, observed deficiency, and necessity

On 2026-10-19 the Operator authorized a bounded producer corrective through verification, publication and closure, subject to real mandatory gates. The reported PagoElectronico 1.4.2 -> 1.5.0 read-only plan is blocked by ownership and managed-file collisions; that consumer is an acceptance motivation, **not** a producer mutation target. The process-bound producer source at `e70fa87a2725b389222a66b6c3cb30f78fab9e11` on `task/tsk-031-adapter-150-release-preparation` was clean before this task branch was created.

Source diagnosis: `src/adopt/upgrade.js` calls the existing exact prior-package planner and requires its entire managed surface to be noop; `src/adopt/plan.js` rejects modified agents, CLAUDE.md managed spans and proposed configured profiles. Thus correct package provenance and legitimate local edits are conflated. `src/adopt/apply.js` already implements exact plan hash, state re-evaluation, staged writes and rollback.

OPS-007: no-change and 1.5.0 compatible pin-only upgrade cannot satisfy modified-file acceptance. Reuse ADR-007/SPC-008 migration authority and the existing deterministic plan/apply/rollback mechanics. TSK-031 is limited to preparing 1.5.0 and explicitly prohibits this substantive `src/` feature, except a closed historical-regression case; extending it would silently defeat its hard exclusion. This one independently deliverable corrective therefore owns the smallest new TSK, with **no MTP/MT** or new ADR/SPC/DAT, dependency, background service, general-purpose merge framework or infrastructure.

## 2. Material implementation boundary

Extend only the existing managed-upgrade reconciliation behavior. An exact previously installed package matching the consumer runtime pin remains mandatory wherever historical managed-file provenance is required. Target bytes remain verified. Distinguish:
- unmodified managed content: keep compatible/noop and pin-only behavior;
- representational drift demonstrably limited to line endings (LF/CRLF), without altering meaningful payload or adopting another identity: deterministic classification, planned normalization/refresh only where safe and needed;
- local semantic modifications to adapter-managed agent files and CLAUDE.md managed span: expose exact base/current/target differences and preserve legitimate consumer content. Where an automatic nonconflicting merge cannot be proved, **stop** pending an explicit, reviewable, Operator-authorized resolution; do not silently overwrite, discard or invent semantics;
- configured POP, Authority Index, bootstrap, capability/actor profile paths and identity collisions: remain project authority under ADR-007/SPC-008; any authorized governed change must use the explicit source-session migration path, never an implicit managed refresh.

The solution must produce one deterministic, complete, read-only migration plan containing exact source/target release identities, source/package and material hashes, actual before/after SHA-256 per affected path, classification, preserved paths, meaningful diffs, unresolved choices and preconditions. A ready plan may encode only mechanically established or explicitly authorized reconciled contents. Apply requires exact plan bytes/hash and unchanged package, git state, path safety, source pin, managed files, resolution input and authorized target; it writes **only** planned allowed paths, rechecks immediately before writing, and uses existing staged-write rollback/recovery. An unresolved choice produces zero writes. Preserve unknown or conflicting ownership as blocked, not a guess.

Do not reset/clean the consumer, treat a dirty unrelated worktree as permission to change it, modify product code or historical evidence, or rely on another project's current files as producer authority. Preserve existing compatibility with clean 1.4.x consumers and other supported upgrade paths. No automatic DEV FOUNDRY 2.3.0 adoption follows from updating the adapter.

## 3. Implementation handoff and mutation projection

Separate Implementation Executor v2, with exact process-bound `implementation-executor-runner-v3` fit, implements this task; Governance Author only owns project SoT and post-execution reconciliation.

Predicted product paths: `src/adopt/upgrade.js`, `src/adopt/plan.js`, and directly affected focused `test/adopt/upgrade.test.js` / `test/adopt/managed-upgrade.test.js`. `src/adopt/apply.js`, `src/consumer/command.js` and existing version/package/CLI test or migration-metadata files may be touched only when a directly necessary causally documented part of this **same** approved reconciliation capability. Existing package and release files may change only to produce the next verified immutable patch version; determine version uniqueness against actual tag/release state before bump/publication. The executor reports any projection variance for Governance Author reconciliation. Do not edit `.dev-foundry/`, `docs/`, immutable `framework/` release bundles, historical tag/assets, GitHub workflow, infrastructure, dependencies, any other repository or unrelated source.

Reuse current commands/fixtures, existing release asset builder and mechanical validator. The exact runner contract must bind branch/HEAD, this task and scoped paths; it cannot confer independent promotion/publication authority.

## 4. Acceptance and evidence

Focused test matrix must establish: (1) exact source pin and verified prior package required; (2) unchanged upgrade compatibility; (3) LF/CRLF-only changes classified without semantic loss; (4) genuine local semantic edits preserved in an explicitly resolved plan, while conflicted/unresolved modifications block; (5) configured authority/ID collisions stay under consumer authority; (6) plan determinism and source/target/precondition hashes; (7) tampered previous/target package, forged resolution, stale plan, dirty touched paths and symlink/unsafe paths reject with zero writes; (8) rollback/recovery and untouched product/authority/evidence surfaces; (9) old unchanged consumers still pass existing targeted regression coverage. No live PagoElectronico mutation is required or authorized here. Executor performs focused self-verification; separately selected Mechanical Validator supplies resulting state-bound acceptance proof, with full-suite/release-package checks only as materially required for actual patch publication.

Semantic self-assessment under Governance Author v4 is mandatory. POP policy defines no routine audit trigger and DEV FOUNDRY 2.3.0 OPS-004 does not impose a blanket independent audit; evaluate any concrete external, project, material separation or Operator trigger before promotion.

## 5. Release and closure

After exact implementation and validation PASS, perform authorized state-bound commit, push, PR, merge/integration and clean-main verification. Reuse the existing authenticated `.github/workflows/release.yml` and release builder to produce a new immutable patch release (provisional 1.5.1, contingent on availability), with a new tag, canonical/alias assets, manifest and SHA256SUMS identity verification. Never rebuild v1.5.0 or claim publication without remote proof. Maintain old release binaries as immutable. Preserve state-bound evidence and close only after acceptance, actual publication and required checks are independently observable. The consumer TSK-044 resumes under PagoElectronico authority in a **separate** operation.

## 6. C001 execution-dispatch diagnostic and recovery

2026-10-19, producer branch `task/tsk-032-managed-upgrade-reconciliation`: the initial package `.dev-foundry/execution-contracts/TSK-032-C001.json` passed standalone contract validation but the governance resolver rejected it as `EXECUTION_PACKAGE_INELIGIBLE`. The Runner package-classification predicate requires a task-level contract filename stem exactly matching `taskId`, i.e. `TSK-032.json` absent a named MT boundary. A byte-identical contract was created at that canonical path (SHA-256 `69c90367d9ce2f42ebcdd9a818571af25b24b876f47884f9f8ac4e8fd56b1a7f`). That contract passed validation; the resolver returned `READY`, `eligible`, and `authorized` after the source-bound `authorization_intent` assessment.

The ensuing `start_execution_contract` call returned `EXECUTION_REQUEST_INVALID` without accepting an execution. In the current Foundry Runner source, `src/mcp/asynchronous-runtime.ts` (lines 200–226), POP v3 execution dispatch requires a `governedOperation` selection. The Cetus tool schema exposed to this ChatGPT session only accepts `contractPath` and `idempotencyKey`, whereas the currently observed PCJR Runner tool schema exposes `governedOperation`. Therefore dispatch requires refreshed Cetus plugin metadata exposing this field, not an implementation, authorization, or framework corrective. Do not substitute another repository's Runner, inject undeclared arguments, bypass selection, or retry unchanged. Resume against the current state only after the matching process-bound Cetus surface exposes the required field, then resolve fresh state-bound authorization and dispatch. No product implementation, validation or publication occurred from these two rejected attempts.

## 7. Post-publication low-level CLI reconciliation corrective (Operator, 2026-10-19)

The separate PagoElectronico TSK-044 read-only acceptance reported that the published v1.5.1 advanced `dev-foundry-claude upgrade plan` accepts `--root`, `--out`, and `--from-package` but no `--resolution-file`. Producer source at main HEAD `515c1c1489f9c33cc6a1464e1a79aa8cf4005902` confirms: `src/adopt/upgrade.js` already implements source/target/repository/hash-bound `resolutionFile` validation; the guided `dev-foundry-claude upgrade` in `src/consumer/command.js` already forwards it to plan/apply; the advanced `upgrade plan` and `upgrade apply` branch of `bin/dev-foundry-claude.js` does not. Advanced apply must also forward the identical selected file because `applyPlan` replans and verifies the hash before writes. This is a CLI exposure omission in the same managed-artifact reconciliation capability, not authority to redesign migration.

The Operator expressly authorizes one bounded post-v1.5.1 corrective, under this still-IN_PROGRESS TSK-032 and OPS-007 reuse rather than another task/MT. Implement only public `--resolution-file` acceptance and correct forwarding for advanced `upgrade plan` and `upgrade apply`, use existing resolution validation and all existing plan/apply safety checks, and update existing advanced help plus focused tests. Advanced `upgrade status`, existing guided upgrade behavior, and unselected resolution behavior must remain compatible. Test malformed, missing, tampered, stale, symlink/unsafe and unselected resolution with zero writes, as applicable. Directly required `bin/dev-foundry-claude.js`, `src/consumer/help.js`, relevant focused `test/adopt/` files and release version identity files constitute a causally justified projection variance against §3; no broad new source or runtime changes. Prepare only a *new*, separately identified immutable patch release after v1.5.1, provisionally v1.5.2 subject to verified remote uniqueness; do not overwrite v1.5.1. Existing release workflow, manifest, aliases and checksum proof remain mandatory. Distinct Implementation Executor and Mechanical Validator roles; independent audit only if actually triggered under adopted 2.3.0. Publishing cannot be claimed until verified, and PagoElectronico upgrade remains unproven until its own live consumer run.
