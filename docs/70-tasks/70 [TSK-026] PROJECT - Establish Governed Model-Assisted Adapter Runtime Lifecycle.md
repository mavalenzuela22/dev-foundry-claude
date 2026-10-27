---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-026
  type: TSK
  title: Establish Governed Model-Assisted Adapter Runtime Lifecycle
  status: IN_PROGRESS
artifactVersion: "2"
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
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-026] PROJECT - Establish Governed Model-Assisted Adapter Runtime Lifecycle

## 1. Operator intent and authority boundary

Originally the Operator authorized design and preparation only. On 2026-10-20 the Operator explicitly authorized producer implementation of TSK-026, selecting a bounded **replacement of defective upgrade/recovery orchestration with reuse of verified integrity, reconciliation and durable-journal primitives**. This task is now IN_PROGRESS for governed execution preparation. Authorization alone does not prove Implementation Executor fit, execution package eligibility, validation, publication or consumer adoption. ADR-008, ARC-001 and SPC-008 retain product authority. No consumer repository may be mutated.

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

**A. Bootstrap boundaries.** Exercise a real packaged installation without producer checkout in representative installed-host evidence (native automation or an actual consumer). Record Windows/macOS outcomes separately as verified or NOT VERIFIED rather than requiring every host/job to pass before a bounded delivery. Greenfield and brownfield initial CLI setup remain explicit, idempotent and preserve product files; unsupported pre-baseline consumers fail closed.

**B. Initial 1.4.2 transition.** Exercise an **actual installed 1.4.2** consumer to the first new managed-runtime release using the declared one-time transition: package global/launcher reparenting, old self-pin preservation, bounded cutover, fresh start and recoverability. Do not assume the source release already implements the launcher.

**C. Multi-consumer isolation.** Two isolated consumers pinned to different immutable adapter identities launch their respective CLI/MCP/dashboard; upgrade A and prove B's files, pin, running session and active runtime unchanged. Package GC must not evict in-use or pinned versions.

**D. Runtime parity.** From an installed package verify CLI identity/version, MCP self-pin/startup fingerprint, dashboard frontend/server identity, telemetry collector/launcher, owned templates/Skills/agents and matching consumer pin. An already-running old dashboard must be detected; no arbitrary port/process termination.

**E. Semantic migration.** Synthetic release genuinely changes configured POP, index, bootstrap or profiles. The source-governed Claude workflow prepares semantically valid candidate under source authority, requests real reserved Operator choices, records audit disposition when triggered, refuses altered hash/authority, and only then cuts over. A deterministic-only fixture does not satisfy this case.

**F. Fault injection.** Cover representative, materially distinct interruption/restart boundaries across acquisition, authorization, managed writes, pin/journal commit and fresh-session activation. Show intact source, verified target or an explicitly recoverable blocked state without silent mixed authority. Extend injection to a specific internal subphase only for observed defects or concrete risk; exhaustive injections at every internal write are not a default acceptance gate.

**G. Negative and security tests.** Refuse unknown target/build, unsupported transition, ambiguous/dirty touched paths, symlinks/escape, tampered payload/manifest, wrong trusted source, executed package lifecycle scripts, stale plan, expired authorization, changed framework requirement, unresolved Operator choice, concurrent upgrades, unsafe cleanup and stale-session further governed work.

**H. Persistence and schemas.** Historical evidence retains original framework/schema meaning; dashboard serves compatible records or explicitly reports bounded degradation without data loss; old telemetry remains available. Release and upgrade state survive process exit.

**I. Cross-platform and packaging.** Use exact packed release assets and installed/runtime-resolved trees, not solely source imports. Windows/macOS host evidence may be native CI or a trustworthy recorded real-consumer operation; explicitly distinguish verified platforms from NOT VERIFIED host behavior. Apply focused compatibility, Node/npm-version, Windows file-lock and recovery checks where their risk or observed behavior requires them; retain deterministic payload/release identity, integrity and directly affected regression PASS. A fixture/tool/CI failure is a validation ERROR/INCOMPLETE under OPS-004 rather than product FAIL, but is never counted as test PASS or proof of full host compatibility. An exhaustive full-suite PASS on every CI host is not a universal closure prerequisite.

**J. User workflow.** Initiate from natural request inside a governed Claude session. No required manual npm, hash-copying, JSON editing or repeated approval when the original exact scoped authorization remains valid. Advanced CLI remains usable for deliberate recovery and first setup.

## 6. Preparation sequence and gates

1. Governance Author completes ADR-008 selection, ARC-001 and SPC-008 reconciliations, this TSK and binding; records exact changed-path list, self-assessment and audit-trigger disposition.
2. Resolve TSK-026 against the resulting indexed authority; validate the documentation candidate and promote documentation only through independently verified gates when authorized.
3. **Implementation authorized by Operator on 2026-10-20, subject to eligibility.** Governance Author SHALL prepare one bounded prompt/execution contract on the producer task branch, prove operation-scoped Implementation Executor v2/runner-v3 fit, and obtain an eligible Runner resolution before starting code execution. The executor may modify only task-authorized product/test/package surfaces and may not author governance.
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
  runtime lifecycle. This section describes historical design state; current implementation work remains unverified.
- **Security:** a payload hash is byte integrity, not publisher authenticity;
  trusted GitHub Release provenance/transport and target execution policy must
  be implemented and shown in the release trust model. No silent upgrade,
  global overwrite, or unverified package execution is allowed.
- **Actor fit:** Governance Author authoring was resolved by the process-bound producer Runner. Operator implementation approval now exists, but executor identity/profile and a current execution package still require separate proof. Earlier TSK-025 bindings do not authorize TSK-026.
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

## 10. Authorized implementation disposition (2026-10-20)

**OPS-007 necessity:** 1.5.3 global CLI/MCP execution is coupled to installed package identity while consumer `--expect` can still select source 1.4.2. Source-governed migration then depends on a runtime that cannot start; modified agents and partially prepared target bootstrap can independently cause collisions. Existing staged apply rollback is not a durable process-crash recovery guarantee. No-change, pin-only refresh or another isolated bypass cannot satisfy the full observed recovery/cutover acceptance.

**Selected material boundary:** Replace failing upgrade/maintenance orchestration with one source/target lifecycle per ADR-008. First reuse `pin.js` integrity, existing managed-file reconciliation and `cutover.js` durable journal/lock behavior wherever valid. Retire redundant prior paths only after packaged acceptance; do not introduce a second authority/resolver engine, speculative dependencies or new network services. A stable launcher selects exact immutable per-consumer runtime; an official bounded maintenance path independently plans, authorizes, applies and recovers without requiring the ordinary source MCP to be READY. Global installation/staging must never mutate consumer pin, active bootstrap or source authority prematurely. Model interpretation handles semantic configuration differences; exact Operator-approved candidate data becomes a verifiable plan, and only deterministic tools execute mutations.

**Hard exclusions:** no PagoElectronico or other consumer repository mutation, no Foundry Runner or immutable framework methodology changes, no silent framework adoption/background upgrade, no guard bypass, no arbitrary maintenance shell execution, no historical evidence deletion, no new general governance system and no release before full acceptance. Preserve source 1.4.2 from verified official package bytes and source pin until approved cutover.

**Expected mutation projection:** `bin/dev-foundry-claude.js`, `src/adopt/{pin,migration,upgrade,plan,apply,cutover,common,activation,inspect,render}.js`, `src/consumer/{command,help}.js`, `src/governance-mcp/session.js`, runtime dashboard/telemetry dispatch, directly affected package metadata/build scripts/migration material/templates, existing upgrade/cutover/package tests and necessary focused launcher/manager/test files. The executor must report any causally necessary projection variance under OPS-007/OPS-008; the projection cannot expand material authority. No `docs/`, `.dev-foundry/`, canonical framework release or consumer mutation by the Implementation Executor.

**Required acceptance:** Installed packed CLI case A (genuinely customized 1.4.2 -> target), case B (1.4.2 pin with partially target-prepared bootstrap, modified executor/Capability Profiles, source `readyToWork=false`, MCP `STALE_SESSION` -> official recovery -> complete cutover), and global-target-first installation, without manual pin/bootstrap resets. Both require a READY authorized plan, exact bound decisions/hashes, preservation of all unrelated dirty worktree bytes, source runtime protection until cutover, integrity/stale/invalid-resolution/concurrent-writer rejection, interruption recovery, correct independent pinned runtimes and fresh CLI/MCP/dashboard/telemetry parity. Retain all additional TSK-026/SPC-008 macOS/Windows installed-host proof, not solely import-level fixture tests. No terminal PASS/publication on command discovery or partial unblocking.

**Role and gates:** Implementation Executor v2 must be bound to a valid Runner execution contract and compatible runner-v3 Capability Profile. Executor completes focused self-verification; mechanical validation must establish state-bound packaged E2E; Governance Author reconciles actual change and semantic sufficiency. Independent audit occurs only on a demonstrated applicable trigger. Publication is separately gated and cannot be assumed now. One TSK, no default MTP or corrective release per discovered test failure.

## 11. 1.5.4 release-candidate evidence and remaining gates (2026-10-21)

The Operator requested rapid publication and recovery of PagoElectronico without a time-consuming Windows test cycle. This confirms urgency and publication intent, **not** that missing mandatory acceptance evidence has been obtained or that the source/consumer contract may be silently bypassed.

The completed producer release-candidate preparation is Runner execution `execution_3e2bbe185bdf7259c91617d7654bba57f9264312d4da4a86aa9d00d113f94e3b`, request `req_77b4341674dbfdb1d3310423369a7288`: execution PASS, path policy PASS, post-execution Mechanical Validation PASS and complete evidence. The version-sensitive serial package/release-assets/packaged-upgrade command reported 43 PASS / 0 FAIL / 0 SKIP; `npm pack --dry-run --json` and `git diff --check` passed. The candidate identifies itself as 1.5.4, with payload root `1786a3ef92684df8187d849d56360fdca9aecf0fefcca34a6e31a246083f5eb6`. The installed 1.4.2 source fixture was downloaded from the published GitHub asset and its verified transport SHA-256 matched `3aa7542c41ce613c9c152e21c8e2d95d835dc00be1cb8f2e46302daa54cadaf3`; the 1.5.4 target remains **local, not published**. The earlier independent focused validation `tsk026-managed-runtime-focused-20261020-v001` returned PASS, evidenceComplete true, without invoking Codex.

Current review conclusion: the implementation and package candidate are materially real, not merely planned, and existing focused proof is reused per OPS-007. The 1.5.4 candidate is not yet a release or approved consumer cutover. Still unproven under the active SPC-008/TSK-026 full acceptance contract: real Windows installed-host behavior, exhaustive journal-phase interruption coverage, live model/Operator semantic migration, full current-payload provenance/release trust and the remaining runtime component parity where host-limited. These are recorded as **not verified**, not product FAIL or fabricated PASS. No repeat of the full 503-case suite is justified solely by this candidate's version change.

Disposition (superseded in part by the explicit exception below): retain the exact candidate changes and evidence, protect all consumer worktrees, and do not publish a GitHub release, repin PagoElectronico or claim terminal task acceptance until the remaining applicable publication conditions are genuinely resolved. Publication and consumer adoption are separate side effects under OPS-008.

## 12. Authorized release-scoped exception — Windows proof for 1.5.4 (2026-10-21)

The Operator explicitly authorized proceeding with the established release procedure for the existing 1.5.4 managed-runtime candidate **without Windows tests**. Consistent with OPS-007/OPS-008, the smallest authorized change is a **release-bound Windows evidence exception** recorded in SPC-008 §18.1 and here. The missing Windows installed-host bootstrap, recovery and file-lock proofs are classified **not verified / risk accepted for this delivery**, not PASS and not a general waiver for subsequent releases.

The Operator did **not** waive package provenance, tamper checks, correct source/target identity, explicit resolution of governed configured-authority changes, READY exact plan, preservation of dirty consumer files and audit/validation when genuinely required. The remaining non-Windows material acceptance gaps recorded in §11 must be resolved or an explicit separately bounded Operator decision obtained before any GitHub release. No new Windows testing cycle and no repeat full suite solely for version metadata. Producer release publication and PagoElectronico consumer upgrade remain distinct boundaries; do not modify the consumer from the producer task.

## 13. Bounded 1.5.4 recovery pilot — Operator release direction (2026-10-21)

After the Windows-only exception, the Operator urgently requested that the team **do whatever is necessary to restore PagoElectronico**, responding to the explicit proposal of a limited 1.5.4 recovery pilot. Accept this as authorization to **prepare and attempt** the established controlled promotion/publication path for that **limited pilot**, with the exception scope and unverified risks defined in SPC-008 §18.2. Do not reinterpret this direction as a claim of completed validation, permission to force an unsafe consumer migration, or authority to modify PagoElectronico from the producer.

Producer candidate commit `3243fba8acf80a7b1695f0cd4e18463dd22f3beb` on PR #60 has independent focus validation and verified packaged upgrade-case evidence. The remaining known gaps from §11 are disclosed as not verified for the pilot only: live natural-language model/Operator orchestration, every new runtime-journal interruption point, and comprehensive live-host component parity; Windows-host tests remain omitted under §12. This narrowly replaces the §10 pre-release full-acceptance prohibition **for one explicitly limited 1.5.4 recovery pilot**, but does **not** close TSK-026 or assert its full acceptance. Security, release provenance/integrity, real READY plan plus explicit Operator choices, source-package preservation, independent validation and authenticated publication from exact committed main remain required.

Promotion and release remain separate state-bound operations; the approved test evidence must be reusable for the exact commit. No broader upgrade rollout, auto-update or consumer write is approved. A later consumer operation must re-read its own 1.4.2 pin/worktree, stage the verifiable released target and prove its own preflight before considering apply.

## 14. Bounded follow-up 1.5.5 Windows journal recovery hotfix — Operator direction (2026-10-21)

Official 1.5.4 was published from producer merge commit `8c0890d2967cbecd8a37aa8ef37b8d519becf90e`. On PagoElectronico, the official 1.4.2-to-1.5.4 managed-refresh plan was READY with one explicitly resolved executor-agent conflict. Applying it on Windows failed `EPERM` while writing a journal; verified `PREPARED` journal `6a0d5e64d9a308159cbcfc627ced19bf0226e7e74c471def4482041f8e51e375` remains, while all five managed-file bytes still match their before hashes and the source pin remains 1.4.2. This failure is not a completed upgrade or license for journal deletion.

The Operator explicitly required achieving a working 1.5.x on PagoElectronico, accepted the minimal producer 1.5.5 hotfix proposal and continued to defer broad Windows acceptance until after practical unblocking. The authorized bounded producer correction is: platform-compatible durable journal write without masking other IO errors; preserve file fsync and truthful Windows directory durability limitation; recognize and block unsafe `PREPARED`, and allow explicitly hash-bound source-only recovery when every original file is intact; increment the package/release version consistently. No other feature expansion, Windows suite or consumer write by the producer executor.

Executed `TSK-026` hotfix request `req_bdf1ba2c546e2094a63df3bf73c57f4c`, execution `execution_32be249b475a37ba7654be570b6236802662b05a0587554217a91db4e4f4d17c`: PASS with zero path violations and post-execution mechanical validation PASS on unchanged baseline HEAD `39a110743e2769d2a3f9e9f766004b7fe7c2a7f3`; five focused `runtime.test.js` cases PASS, `npm pack --dry-run` PASS, `git diff --check` PASS. Changes: `src/adopt/runtime.js`, `test/adopt/runtime.test.js`, `package.json`, `package-lock.json`, `migrations/release.json`. Pack dry-run is not an official 1.5.5 release or proof of real Windows recovery. The 1.5.5 pilot publication remains a separate state-bound action under SPC-008 §18.3, ADR-005 and actual Operator control. Once published, the consumer must recover the prior PREPARED journal using the exact official source package, generate a fresh 1.5.5 plan and selected resolutions, obtain READY and apply only after explicit review, then verify fresh 1.5.5 runtime. Do not claim full TSK-026 acceptance.

## 15. 2026-10-26 OPS-007 consumer operability correction — Operator-authorized continuation

**Observed evidence and material objective:** On the real PagoElectronico consumer, adapter 1.5.5 is already pinned and verified, but ordinary closing of TSK-043/044 changed `.dev-foundry/authority-index.yaml` and indexed OVR-002 after the upgrade. `plan.js` currently compares the complete old `receipt.state` to current configured project documents and blocks `doctor/start` with `upgrade-reconciliation-stale`. Independently, Windows CRLF conversion of canonical `.dfc-upgrade-reconciliation.json` caused `upgrade-reconciliation-invalid`, and a prior journal causes `upgrade-recovery-required`. Desktop-launched MCP has also returned `STALE_SESSION` for failed initial projection/recovery preconditions, conflating true session drift and unavailable startup. Two previous Runner attempts (`reconciliation-readiness-v001/v002`) returned *zero source changes*; 158 inherited tests PASS did not establish delivery, and v002's mandatory new test file was absent.

**Operator direction:** Restore the original optional-launcher usability and governed operation from a properly bound Claude Desktop or Claude Code host. On completed updates, routine valid task/index/overview authoring must not require a new upgrade, reconciliation receipt rewrite, reauthorization or special CLI entry point. Fresh session after an actual runtime cutover is mandatory; invoking `dev-foundry-claude start` is not. Telemetry/dashboard availability is not authorization to work. Honor the existing controlled project/root/pin checks, source-governed resolver and strict authorization on *operations*, not a blanket freeze of project documentation.

**OPS-007 minimum sufficient boundary:** Retain the historical anchored canonical receipt as transition proof and retain record-level verification for adapter-managed bytes, runtime pin, framework/runtime bindings, receipt integrity and actual journal state. Stop comparing post-upgrade mutable task/overview/index content byte-for-byte to old receipt history as a universal startup blocker. Reuse the existing live `inspect`, `sessionProjection`, `resolve_governed_operation` and runtime journal controls, without new receipt-refresh API, storage format, consent, daemon, auth engine, background operation or global bypass. Ensure the same host-bound MCP can start independently of the optional `start` wrapper; if project context cannot be securely discovered, identify that precise failure rather than inventing a stale session. Reserve `STALE_SESSION` for change **after** a successfully established session fingerprint. Pending `PREPARED/IN_PROGRESS` or invalid runtime transaction must remain blocked until safe explicit recovery, with a specific code/next action; no journal deletion, auto-rollback or guess. If normal `start` cannot initialize optional telemetry or the dashboard is absent, report auxiliary degradation without inventing permission or hiding failures; only genuine runtime/project insecurity should block Claude launch. Address LF canonicalization at the existing creation/installation boundary with the smallest effective Windows rule, while preserving byte-integrity checks.

**Bounded producer implementation:** Relevant `src/adopt/plan.js`, `src/governance-mcp/session.js`, `src/consumer/{command,help}.js`, and directly necessary `src/adopt/runtime.js`, `src/adopt/upgrade.js`, `src/adopt/apply.js`, `bin/dev-foundry-claude.js`, managed EOL rules and directly affected tests only. Executor does not change governance docs, immutable releases, unrelated integrations or any consumer. Prior receipt-refresh V002 design is superseded; no additional TSK/MTP or full suite by default. Do not promise automatic governed tool invocation merely because a host reads CLAUDE.md/skills: host initialization and actual MCP tool use must be observed, not inferred.

**Focused acceptance:** (1) valid receipt and unchanged managed bindings with later TSK/index/OVR updates remains governable and normal `start` launches; (2) real adapter/pin, managed-agent/bootstrap/profile and transaction mismatch remains blocked correctly; (3) fresh bound Desktop-like MCP session resolves operations directly, and post-cutover old session alone returns STALE; (4) missing host root or pending journal returns truthful non-STALE reason; (5) Windows LF receipt installed and repo EOL rule prevents hash drift; (6) optional telemetry/dashboard outage does not alone become governance denial; (7) produce actual nonempty source diff plus relevant passing tests or a concrete traceable BLOCKED cause. Reuse existing unaffected validation evidence. Producer release and real consumer deployment remain distinct and unapproved here.

**Author self-assessment:** No-change fails due confirmed user-visible denial. Existing immutable pin, historical receipt, resolver, startup identity and journal primitives are sufficient; recurring receipt refresh, broader authority snapshots or another orchestrator add complexity without new safety. New failure classifications are diagnostic, not a new policy gate. The old source session is *not* permitted to continue after runtime identity changes. No independent audit trigger observed on project POP (none configured), subject to actual later material triggers. This is governance-author sufficiency, not mechanical validation or audit PASS.

