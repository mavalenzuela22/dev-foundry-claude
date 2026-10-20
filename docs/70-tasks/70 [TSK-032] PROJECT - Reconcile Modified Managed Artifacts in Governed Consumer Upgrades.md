---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-032
  type: TSK
  title: Reconcile Modified Managed Artifacts in Governed Consumer Upgrades
  status: CLOSED
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
  closureArtifact: TSK-032-CLOSURE
lifecycle:
  phase: closed
  blockedBy: []
  closureArtifact: TSK-032-CLOSURE
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

## 8. Remaining configured-collision and dirty-path corrective (Operator, 2026-10-19)

PagoElectronico TSK-044 reported a read-only BLOCKED upgrade from exact 1.4.2 pin to 1.5.2 despite successful operator resolution of its modified executor agent (result hash `02995b614121585d0a029ae0d1081984b6570c2826d4820b5166b60a2284b9bb`). Its Kafka TSK-043 worktree must remain dirty, preserved byte-for-byte, and outside producer scope. The causal blockers are `artifact-collision`, `upgrade-ownership-unverified`, `upgrade-migration-required` and `dirty-working-tree`. Reuse this in-progress TSK, existing `--resolution-file` and staged rollback; no extra task, framework/Runner/consumer change or indiscriminate overwrite.

**A. Configured collisions:** Extend official exact provenance, identity, SHA-256 and Operator-decision-bound resolution specifically to pre-existing Implementation Executor and Governance Auditor Capability Profiles and Claude Code Platform Bootstrap. Prove prior/target templates, current bytes, identity, references and resulting authorized bytes. The source-governed migration remains explicit under ADR-007/SPC-008; do not silently modify POP, Authority Index, framework adoption, IDs or consumer semantics. If identity or safe semantic reconciliation cannot be established, retain a targeted BLOCKED and describe the required decision. Do not present a hash-matching file as itself authorizing configured governance changes.

**B. Tracked dirty agent:** Reconcile both `createPlan` and `createUpgradePlan` dirty guards. Exempt only an individual tracked managed path already classified `operator-resolved`, whose current hash, prior package, selected resolution, plan hash and immediately rechecked apply state match exactly. Retain all other dirty, symlink, path and state protections, including a clean runtime-pin path. Never clean/reset/stage unrelated files. Resolve derived ownership/migration blockers by satisfying prerequisites, not deleting diagnostics.

**Required product proof:** Build a real distributable tarball and run its *packaged CLI* against a temporary isolated 1.4.2-pinned fixture with the resolved agent, different existing profiles/bootstrap, explicit resolutions and unrelated dirty Kafka files. Require READY plan, authorized apply, correct new runtime/pin, preserved configured meaning and byte-identical unrelated files. Exercise absent/invalid/forged resolution, changed source hash, stale plan, unauthorized collision/path, post-plan edits, and failed apply with recovery. Validate clean legacy and no-resolution paths. Internal API-only test PASS is insufficient.

**Bounded execution:** Existing `src/adopt/plan.js`, `src/adopt/upgrade.js`, causally necessary `src/adopt/apply.js`, targeted `test/adopt/`, CLI packaging and release identity only; reconcile any projection variance. Separate Implementation Executor, Mechanical Validator and Governance Author according to POP v3. Release only following package-fixture PASS, state-bound evidence and actual promotion authorization; do not presume version 1.5.3. The consumer remains untouched.

## 9. Post-apply governed operability closure from C013 (Operator's authorized objective, 2026-10-20)

C012 and C013 passed bounded implementation and real packaged-CLI upgrade acceptance. C013 used exact published 1.4.2 source archive transport SHA-256 and payload pin, ran the actual target npm-packed CLI, produced a READY plan, applied exactly four planned managed writes, preserved both Kafka files byte-for-byte, exercised negative cases and rollback. The target pin was correctly recorded. **Material acceptance gap discovered during Governance Author reconciliation:** C013 deliberately asserted that `upgrade status` remains blocked after a successful authorized apply because re-planning without the transient `--resolution-file` again rejects legitimate preserved agent/profile/bootstrap differences. `src/consumer/command.js` `inspectConsumer()` sets `readyToWork` only when `createPlan()` is `noop`; `start` returns code 2 otherwise. Therefore C013 PASS is **upgrade-mechanics PASS only**, and the user-facing post-cutover governed runtime would remain unusable. Publication and closure stay prohibited pending a focused correction and proof.

**Necessary result (OPS-007):** After an exact authorized resolution and successful adapter upgrade cutover, the normal consumer `status` and `start` readiness evaluation must recognize **only that unchanged, identity-bound, previously authorized reconciled state**, even when it intentionally differs from target templates. Its integrity proof must be durable across a new process/session and must not depend on rereading an ephemeral external decision file or allow silent arbitrary configured-authority mutation. Any subsequent changed managed/configured bytes, identity, bindings, cutover state, version pin, missing/invalid proof or unsafe path must fail closed. Ordinary unrelated product/Kafka work, including new commits, must not invalidate legitimate unchanged managed/configured bytes. Keep the existing security/ownership and Operator decision boundaries.

Reuse existing verified plan data, `createPlan`/readiness logic, `applyPlan` staged-write/rollback and package pin checks; introduce the minimum necessary state-bound reconciliation evidence only if existing durable evidence cannot satisfy this requirement. Such evidence is **observational product state, not methodology authority or a self-authorizing configured change**. Bind it to exact managed paths, hashes, package identity and current project configured authority fingerprints. Write it only under the same explicitly reviewed plan and atomic/recoverable apply boundary, never as a silent side effect. Do not infer approval from present bytes or globally treat divergent templates as safe. No broad new subsystem, dependency, framework adoption or consumer modification from the producer.

**Required acceptance:** Add a minimal packaged-CLI **post-apply** assertion that uses a fresh CLI process and confirms ordinary `status` readiness (or a documented equivalent validated prelaunch gate) after the authorized apply, without supplying a resolution file. Verify that `start` is not blocked at the prelaunch `readyToWork` gate (never launch a real Claude interactive session in the fixture). Exercise unauthorized post-apply managed/configured edits, removed/tampered evidence, stale pin, path attack and source-framework authority drift as appropriate, proving fail-closed. Preserve C013 exact 1.4.2 source proof, zero Kafka writes, safety negatives and rollback. Maintain existing clean 1.4.x/no-resolution behavior. Reuse the same TSK-032, with distinct Implementation Executor and Mechanical Validator, and publish no immutable version before the **post-apply operability** and required package/release validation pass. Reconcile any directly necessary source/test paths as OPS-007 projection variances; no consumer, framework or Runner changes.

## 10. C018 release-gate test contract reconciliation (Governance Author, 2026-10-20)

The Mechanical Validator `TSK032-RELEASE-153-FINAL` produced complete FAIL evidence: `npm test` had exactly 488 PASS / 7 FAIL across 495 tests, while dashboard typecheck, 75 dashboard tests, and `npm pack --dry-run --json` passed. The only failing package fixture still matched printed CLI help against literal `1.5.2`, after C016/C017 had correctly established 1.5.3. Six other tests in `test/bootstrap/claude-cutover-readiness.test.js` and `test/bootstrap/claude-subagents.test.js` asserted the historical POP v2/DEV FOUNDRY 2.1.0 producer role-binding contract despite the current authoritative POP v3/DEV FOUNDRY 2.3.0 and platform bootstrap v3. Specific obsolete requirements include actor profiles at releases/2.1.0, an embedded POP `implementation` mapping and `capability_profiles` array, deriving every required capability from those obsolete fields, and an obsolete runner-v3 pre-cutover environment constraint. These are causally identified *test-harness* divergences, not authorization to change product behavior or authority.

Under OPS-007 and the already authorized patch publication acceptance, adjust only these three test files to assert actual v3 operation-scoped role selection, explicit active configured required capability routes, producer/consumer capability isolation and existing historical safeguards. Keep the integrity/negative tests substantively meaningful, rejecting unsafe or conflicting capability routing. Change the residual printed-help version assertion to 1.5.3. Do not alter actual POP, bootstrap, Authority Index, capability profiles, framework releases, runtime code, templates, historical data or consumer. This is a strictly necessary test-contract projection variance in the same TSK, not a new task or audit trigger. The distinct Mechanical Validator must re-evaluate release readiness after these corrections; no release until PASS.

## 11. Terminal disposition — verified adapter v1.5.3 (2026-10-20)

The approved producer corrective is complete. Governed Mechanical Validation `TSK032-153-RECHECK` passed 496/496 tests; [PR #58](https://github.com/mavalenzuela22/dev-foundry-claude/pull/58) merged to `main` at `6ed110a5fa7ff367e0f86e726690d34404606b0c`. The Operator dispatched the official release; [run 39465155836](https://github.com/mavalenzuela22/dev-foundry-claude/actions/runs/39465155836) succeeded from the same commit. Authentic downloaded [v1.5.3](https://github.com/mavalenzuela22/dev-foundry-claude/releases/tag/v1.5.3) assets, alias identity, published SHA256SUMS, SHA-256 `472218d41c904e8e32cbb985f810178ff2c886ae916e53a6dba609bdc812b81d`, and manifest version 1.5.3 were all verified in `execution_18e634e4921d4a10f47f43d71a14545d90bc7a58980f6cd428f980b39388ade0`. Refer to TSK-032-CLOSURE for this task's terminal producer disposition. PagoElectronico TSK-044 live consumer cutover remains separate and unclaimed.
