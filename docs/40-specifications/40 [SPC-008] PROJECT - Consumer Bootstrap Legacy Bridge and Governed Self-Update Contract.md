---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-008
  type: SPC
  title: Consumer Bootstrap, Legacy Bridge, and Governed Self-Update Contract
  status: ACTIVE
artifactVersion: "2"
authorityScope: consumer-bootstrap-legacy-bridge-and-governed-self-update
ownerRole: governance-author
canonical: true
scope:
  owns:
    - initial-consumer-bootstrap-contract
    - legacy-bridge-contract
    - self-update-migration-package-contract
    - model-assisted-upgrade-contract
    - stale-session-restart-contract
    - version-resolved-runtime-installation-contract
    - managed-runtime-recovery-contract
    - model-assisted-update-acceptance-contract
    - pago-legacy-dogfood-acceptance-boundary
  appliesTo:
    components:
      - claude-adapter-package
      - claude-adapter-cli
      - claude-governance-mcp
      - local-operations-dashboard
      - telemetry-launcher
      - consumer-project-bootstrap
    operations:
      - initial-consumer-bootstrap
      - legacy-consumer-migration
      - governed-self-update
  excludes:
    - reusable-dev-foundry-methodology-change
    - provider-authentication
    - consumer-product-code
    - silent-framework-adoption
    - background-auto-update
authority:
  governedBy:
    - ADR-007
    - ADR-008
    - SPC-005
    - SPC-007
    - OPS-005
    - OPS-008
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-008] PROJECT - Consumer Bootstrap, Legacy Bridge, and Governed Self-Update Contract

## 1. Baseline

Adapter 1.4.0 is the first self-update-capable baseline.

The implementation SHALL support three explicit states:

- unconfigured: no valid adopted DEV FOUNDRY project authority;
- legacy: a supported exact pre-1.4.0 adapter consumer;
- self-update-capable: a valid consumer on 1.4.0 or later implementing this
  contract.

State classification SHALL be read-only and fail closed when repository state is
partially configured, ambiguous, symlinked on managed paths, or inconsistent.

## 2. Initial bootstrap contract

For an unconfigured Git repository, dev-foundry-claude setup SHALL produce a
read-only initial-bootstrap preview.

The preview SHALL identify repository root, proposed project identity, proposed
greenfield/brownfield classification, proposed human Operator identity when
deterministically available or an explicit required value, canonical DEV
FOUNDRY release, exact paths to be created/merged, and application/product files
affected, which SHALL be zero.

The default UX SHALL NOT require the user to manually construct a POP, Authority
Index, TSK, MTP, Actor Profile or Capability Profile.

Mutation requires explicit Operator intent equivalent to confirming authority to
establish the project on the selected DEV FOUNDRY release and enable the
declared Claude governance integration.

For non-interactive use, confirmation and every non-derivable project choice
SHALL be explicit command input; absence fails closed.

The bootstrap SHALL use only immutable framework release bytes shipped and
integrity-bound by the adapter release, deterministic adapter templates,
verified repository facts and explicit Operator choices. It SHALL NOT infer
product decisions from conversational memory or another consumer repository.

The resulting project SHALL include, as applicable, the immutable selected DEV
FOUNDRY release and manifest, active POP, active Authority Index, required Claude
Platform Bootstrap and Capability Profiles, minimal truthful project
overview/documentation routing, one initial onboarding/baseline TSK,
adapter-owned Claude agents, managed CLAUDE.md block, MCP pin and telemetry
ignore, and enough validation/runtime state for status to decide whether start
is permitted.

For a brownfield repository the initial task SHALL be restricted to observing
and establishing the verified existing project baseline before ordinary product
implementation. Existing application files SHALL be preserved.

A successful bootstrap SHALL be idempotent on replanning.

## 3. Legacy bridge contract

The 1.4.0 release SHALL declare the exact legacy release/build identities it can
bridge. Unknown or merely version-similar builds are unsupported.

The bridge need not preserve direct migration support from those legacy builds
in future releases. Its purpose is to move supported legacy consumers once to
the 1.4.0 self-update baseline.

Before mutation the bridge SHALL verify target package payload integrity, exact
current adapter pin when present, the exact previous package needed to prove
managed ownership, current activation state, exact managed/configured paths and
preserved product/evidence boundaries, then produce deterministic plan bytes and
SHA-256.

No write is permitted when required old package bytes, current authority,
ownership or path safety cannot be established.

Apply SHALL require exact plan bytes/hash and revalidate all preconditions.

A recipe MAY migrate known configured authority needed to reach the 1.4.0
baseline only when explicitly declared by that legacy recipe and authorized by
the Operator.

The bridge SHALL NOT invent project-specific semantic decisions. Where a
required choice has no deterministic predecessor mapping, it SHALL stop and
request an explicit Operator choice or preserve the existing active runtime
until a separately governed cutover can resolve it.

Prepared consumers with another active governance runtime SHALL not have that
runtime silently displaced.

PagoElectronico is the canonical real-consumer acceptance case for the legacy
bridge. Producer implementation and isolated fixtures SHALL complete before the
real consumer is mutated.

The real PagoElectronico migration SHALL run as a separate governed consumer
operation using its own authority and shall prove no application/product code
mutation, no historical evidence deletion, no reinterpretation of completed
task/evidence meaning, exact source and target identities, deterministic
migration evidence, and truthful final readiness state.

Resetting or reinstalling PagoElectronico from a clean bootstrap SHALL NOT
satisfy this acceptance case.

## 4. Self-update migration package

Every post-baseline release that requires migration SHALL include
payload-integrity-bound migration material stating or encoding target adapter
identity, supported source identities/range, framework-adoption change if any,
target schema/profile/bootstrap versions, deterministic transforms and
preconditions, configured-authority or semantic deltas requiring model review,
explicit Operator decisions, validation predicates, preserved/forbidden paths,
cutover requirements and mandatory restart.

Migration material SHALL be versioned with the target release and cannot be
fetched implicitly from producer main.

## 5. Side-by-side target staging

A model-assisted self-update SHALL preserve the source runtime until cutover.

The target package SHALL be acquired into an isolated staged location, verified
and addressed by its exact self-pin.

Staging SHALL NOT replace the executable/runtime files currently serving the
source governance session, update the consumer project pin, activate target
framework authority, or modify project files.

## 6. Model-assisted governed self-update

The currently active governed Claude session performs migration analysis under
the source project's authority.

It SHALL resolve the bounded upgrade/migration operation before role-dependent
work and use only minimal current authority plus verified target migration
material. The target release is non-active migration input until cutover.

The governed model is responsible for semantic reconciliation that cannot be
proven by deterministic transforms. Deterministic tooling is responsible for
package verification, plan serialization/hash, bounded transforms, stale-state
checks and mechanical validation.

Reserved Operator decisions remain reserved. The model may explain choices and
prepare a candidate; it SHALL NOT manufacture Operator approval.

Before cutover the source session SHALL establish a stable candidate containing
exact source/target adapter identities, relevant source authority/configuration
hashes, target changes, preserved paths/evidence roots, Operator-decision
disposition, validation results, audit disposition when triggered, and one
cutover/restart instruction.

Any material candidate change after validation or audit invalidates applicable
proof and requires re-evaluation.

## 7. Cutover and stale-session enforcement

Cutover SHALL update the project-selected target identity and any authorized
authority/configuration migration as one bounded transition.

After cutover, the source session SHALL be considered stale even if its process
continues running.

The implementation SHALL provide a mechanically checkable startup/session
fingerprint sufficient to reject later governed work from a session whose
starting authority/runtime identity no longer matches the project.

The stale session MAY report completion and the restart instruction. It SHALL
NOT author, implement, validate, audit, promote or close subsequent governed
work.

The required next action is a fresh, independently bound session using any
supported Claude host; `dev-foundry-claude start` is one optional Claude Code
launcher, not a prerequisite for MCP governance or a substitute for resolving
current authority. The new session SHALL resolve authority from current
repository state and SHALL not inherit the old session's governance resolution
by conversation alone. Invalid or unavailable startup context, and an actually
pending runtime-recovery journal, SHALL return their respective actionable
diagnostics; they SHALL NOT be labeled `STALE_SESSION` unless a previously
established session identity subsequently changed.

A completed adapter upgrade receipt is historical transition evidence, not an
immutable snapshot of ordinary ongoing project documentation. Later valid
TSK/OVR/index authoring SHALL NOT require receipt refresh or another adapter
upgrade. Runtime pin, verified payload, managed integration bytes, active
framework/role bindings and transaction safety remain checked by their
existing applicable guards. A pending or ambiguous journal still blocks the
governed mutation it protects; no automatic rollback or guard bypass follows.

## 8. Framework-version migration

An adapter self-update and a DEV FOUNDRY framework adoption are distinct changes
even when one release carries both.

If the target requires a later framework release, target framework bytes may be
staged as migration input, the source framework remains active until explicit
project adoption, OPS-005 impact review occurs under current authority, the
Operator explicitly authorizes adoption, historical evidence retains original
framework semantics, and the target framework becomes active only at cutover.

A target framework SHALL NOT govern the operation that decides whether to adopt
it solely because it is the desired target.

## 9. User experience

The normal product experience SHALL remain goal-oriented. Users may see outcomes
equivalent to:

- This repository is not configured yet. I can establish DEV FOUNDRY here.
  Application files affected: 0.
- This project uses a legacy adapter. A one-time migration to the self-update
  baseline is available.
- This release changes project governance configuration. Continue the upgrade
  in your current governed Claude session.
- Upgrade complete. This session belongs to the previous project state. Start a
  new session.

Internal artifact names and diagnostic codes remain advanced detail.

## 10. Fail-closed conditions

At minimum stop on unknown/unverifiable package identity, unsupported legacy
source, partial/ambiguous authority, unresolved Operator choice, modified managed
bytes whose ownership cannot be proven, dirty migration paths, symlink/path
escape, plan/hash/precondition mismatch, failed required validation/audit,
target package replacement during migration, or stale-session governed work
after cutover.

## 11. Managed runtime acquisition and identity (TSK-026 design)

A post-1.4.2 managed-runtime-capable release SHALL expose a stable launcher
that is **separate from** the active immutable adapter runtime. First setup
remains CLI-first under section 2. Source and target packages SHALL remain
addressed by exact `<version>:sha256:<payload-root>` identity, including
metadata for runtime ABI/Node version compatibility. A bare SemVer label,
`latest`, package filename, mutable producer branch or URL alone is not an
authorized identity.

Runtime acquisition SHALL:
- obtain target bytes only from an explicitly configured/trusted release source
  and retain verifiable release-origin evidence; transport SHA-256 and the
  internal payload manifest prove byte consistency, **not publisher identity**;
- check exact source/target transition support, archive boundaries and payload
  integrity before allowing target code to run; extraction must prevent traversal,
  symlink escape, device files, name collisions and platform-ambiguous paths;
- avoid target installation lifecycle scripts and arbitrary commands before
  provenance/trust is established; an untrusted migration recipe is data, not
  executable code;
- stage in isolated storage before any project pin or authority mutation; only
  publish a complete, verified installation to the immutable version store;
- preserve source installations until target verification and preserve other
  projects' pins and active/recovery reservations on version cleanup;
- fail closed with a clear diagnostic on unavailable network, unsupported
  Node/npm/OS, corrupt archive, publisher/provenance uncertainty, unknown
  identity or insufficient filesystem permissions.

The immutable runtime store SHALL permit two different release builds with the
same SemVer only when addressed distinctly by their payload roots; the resolver
must not silently select one from a bare-version lookup. Global npm installation
or launcher maintenance is a separate host operation and SHALL NOT silently
repin any consumer.

## 12. Project-scoped runtime resolution and concurrency

The launcher MUST discover an unambiguous Git consumer root, read the active
project runtime pin without following untrusted symlinks outside the root,
resolve the matching installed package, reverify required identity, and dispatch
only entry points from that package. CLI, Governance MCP, dashboard server/UI,
OTel launcher/collector, distributed managed templates and migration material
MUST be traceable to the same selected adapter package; the framework selected
by the consumer POP remains separately authoritative.

Two consumers with different exact pins SHALL work simultaneously through the
same stable launcher; upgrading one SHALL cause zero file/configuration/authority
changes in the other. Parallel update attempts on the same consumer MUST use
a mutually exclusive scoped lock with detectable owner/age; a stale lock may
be reconciled only after determining journal and process state. Distinct
consumers MAY stage targets concurrently without sharing mutable plan or
transaction state. Runtime GC MUST fail closed for unknown consumer usage.

A source-governed session SHALL record its startup package self-pin and
applicable authority fingerprint and reject governed operations following a
different cutover. New launcher discovery of a later package NEVER makes an
already-started source session eligible to run under that package.

## 13. Migration candidate and deterministic boundary

After staging, a source-governed Claude operation SHALL construct a candidate
with at least: project/repository identity and HEAD, immutable source/target
package pins, verified release-origin evidence, current POP/index/bootstrap/
profile/selected-framework versions and hashes, supported transition, exact
owned-path and preserved/forbidden-path inventory, preconditions, deterministic
transforms, semantic/configured-authority deltas, reserved Operator choices,
validation and audit requirements, cutover/restart steps and recovery envelope.

Deterministic tooling SHALL serialize one canonical plan with SHA-256 and
verify exact plan bytes/hash, source authority, touched-path bytes and target
package identity immediately before each material side effect. Model-generated
semantic proposals are candidate data until approved by the Operator and
verified against current authority. Where no supported deterministic mapping
exists, refuse an invented project-specific semantic decision. Framework
adoption requires the separate OPS-005 path in section 8.

A single scoped Operator authorization MAY cover explicitly named later
mechanical phases while plan identity and other bound invariants remain
unchanged. New semantic choice, source/target identity, touched file, security
boundary, framework adoption, failed audit or changed plan invalidates that
authorization as applicable. Never represent an unresolved audit as PASS.

## 14. Journaled cutover and recovery state machine

The updater SHALL persist recoverable intent and inverse/forward data before
changing project identity. Each transition is idempotent and independently
checkable; no requirement may assume an atomic rename of the entire consumer
authority tree.

Required observable states (exact machine tokens may differ if a mapped schema
is specified and tested):

```text
SOURCE_ACTIVE -> TARGET_VERIFIED -> PLAN_READY -> AUTHORIZED
    -> PREPARED -> CUTOVER_IN_PROGRESS -> AWAITING_NEW_SESSION
    -> TARGET_VERIFIED_ACTIVE -> COMPLETED
                   |                  |
                   +-> RECOVERY_REQUIRED -> ROLLED_BACK
                                       \-> TARGET_VERIFIED_ACTIVE
```

The durable transaction records exact source/target identities, plan hash,
before/after hashes, staged bytes, lock owner, phase, decisions, side effects,
journal integrity, applicable rollback eligibility and successful verification.
An interruption MUST restart in a proven state: unchanged source, proven
target, or explicit recovery-blocked; unknown state MUST NOT be guessed or
blindly retried. Startup guard SHALL block mixed or ambiguous authority. A
complete target activation is not equivalent to complete task/evidence closure.

Rollback is permitted only if mechanically safe against later target-governed
writes and schema/authority irreversibility. Otherwise perform separately
verified forward reconciliation or report explicit recovery-required; no
automatic destructive downgrade, evidence deletion or semantic rewinding.
The source package and recovery shim must remain usable even when the target
CLI, MCP, dashboard or Node compatibility fails. A failed target startup SHALL
not orphan the consumer.

Git work is distinct from runtime transition. If final commit/PR/merge/closure
remains pending after the source session becomes stale, the journal SHALL
provide a stable handoff so the fresh target-governed session can reobserve,
resolve the eligible role and complete only separately authorized gates. The
stale source session must not finish governed Git work after cutover.

## 15. Dashboard, telemetry and historical data

The packaged dashboard frontend, backend, evidence reader and OTel launcher
SHALL run from the selected package identity. Dashboard and telemetry data
are consumer-owned persistent records, not disposable runtime cache. An upgrade
MUST preserve all historical bytes and original schemas/framework meaning;
a new reader may support older schemas, or must report explicit bounded
degradation without inventing reinterpretation or deleting data.

A running source dashboard is not automatically replaced by publishing the
target package. The updater SHALL identify process ownership, listener/port,
project root and package self-pin before proposing a controlled restart; it
SHALL NEVER kill an unrelated process sharing a preferred port. Where safe
automatic restart is unsupported, deliver a single actionable instruction
and require fresh-process verification rather than claiming success.

Telemetry remains loopback-only and respects current privacy policy. Existing
collector processes may retain old code until restart; final parity evidence
must confirm the actual code/version after target startup.

## 16. First managed-runtime transition from installed 1.4.2

The source 1.4.2 global CLI cannot be assumed to discover the future stable
launcher, runtime store or migration API. The first target release providing
this architecture SHALL declare an exact, separately tested handover from a
real installed 1.4.2 source to the new manager. Handover SHALL preserve
source package bytes/self-pin and live sessions, stage verified target, install
the stable launcher without destructive in-place replacement of a running
source runtime, and only then perform consumer-scoped governed cutover.

If platform restrictions make a zero-manual-step initial handover impossible,
the product MUST surface one explicit safe exceptional bootstrap operation;
it SHALL NOT silently falsify the normal model-assisted-upgrade guarantee or
assume that reinstalling globally is the same as governing consumer migration.
Every later managed-runtime-to-managed-runtime upgrade must avoid the
exceptional bridge.

## 17. Security and compatibility gates

Stop before mutation on identity/provenance mismatch, mutable target
replacement, wrong project, unauthorized execution script, unknown source
package, unsupported migration recipe, inconsistent indexes/profiles, dirty or
symlinked touched path, path escape, hard exclusion, unresolved Operator
choice, expired plan, concurrent conflicting writer, unexpected process
ownership, failed validation/audit, impossible safe recovery, or changed
framework selected without explicit adoption.

The implementation SHALL not expose local services publicly, grant CLI/MCP
unbounded file or shell access, hide untrusted file mutation, delete historical
evidence, claim a failed launcher is healthy, or automatically modify another
consumer merely because its runtime store is shared.

## 18. Minimum independent acceptance

Acceptance SHALL be proportional to the actual release or task boundary,
supported hosts, material failure modes and observable product risk. There is
no prescribed count of tests, exhaustive host-by-host matrix, mandatory
GitHub Actions job, or obligation to inject every internal write/checkpoint
failure. Valid state-bound evidence SHALL be reused under OPS-007.

**Non-waivable safety proof:** The applicable packaged/source or installed
consumer evidence MUST establish trusted exact source/target package identity
and payload integrity; fail-closed tamper, authorization, stale-plan,
unresolved-choice and path/concurrency rejection; preservation of unrelated
consumer changes and the source runtime; and recoverability without silent
mixed authority. An observed defect in these controls blocks the affected
operation, regardless of a pilot risk acceptance.

**Representative functional proof:** Use the smallest complete combination
of focused deterministic tests, verified packaged binaries, actual installed
consumer observations and targeted negative/failure cases needed to establish
the approved capability. For a first 1.4.2 handover, prove the real source and
target package identities and the actual transition, rather than substituting
only source imports or synthetic pins. Verify relevant runtime component
identity, version isolation, persistence and restart/recovery at materially
distinct state boundaries. Exhaustive interruption at every implementation
subphase or every supported host is not an independent acceptance gate unless
a concrete risk, defect or external obligation requires it.

**Host evidence and verdicts:** Windows and macOS compatibility remain
product goals, but proof can come from trustworthy native automation OR from
a representative installed consumer and recorded operation on that host.
A failing test harness, unavailable executable, broken fixture or CI
environment is classified separately under OPS-004 as VALIDATION ERROR,
BLOCKED or INCOMPLETE; it is not a product FAIL without evidence of product
nonconformance. Nor does it count as a test PASS. Unverified platform behavior
must be recorded as NOT VERIFIED with the affected capability, risk,
operator disposition and condition for further verification; do not claim
general host compatibility on that basis. A bounded Operator-accepted pilot
may proceed with that declared risk if all non-waivable controls above hold.
Evidence of an actual unsafe host failure cannot be waived as a harness issue.

**Model-assisted workflow:** Full TSK-026 capability acceptance still needs
representative real source-governed model/Operator semantic migration when
configured authority changes, and an in-session natural-language update
demonstration with an independently verified fresh target session. These
may be proved once for the applicable behavior and reused while relevant.
An exceptional first-bridge recovery or a successful advanced CLI alone does
not establish the normal conversational workflow; classify its unproven
behavior as NOT VERIFIED rather than claiming terminal capability PASS.

Mechanical validation, Governance Author semantic assessment, any genuinely
triggered independent audit, bounded Operator risk acceptance, publication,
consumer adoption and terminal task closure remain distinct facts. Record
actual verified scope and limitations; never convert partial evidence or a
successful limited pilot into an unconditional conformance or closure claim.

### 18.2. Limited recovery pilot disposition — 1.5.4 (2026-10-21)

Following the Operator's explicit urgency-driven instruction to proceed with what is necessary after a **limited pilot** was proposed, this release alone may be evaluated for an **operator-controlled, limited recovery pilot**, separate from terminal TSK-026 acceptance. The pilot is restricted to an existing exact-pin 1.4.2 consumer whose normal 1.5.3 upgrade is deadlocked; release and consumer cutover are distinct authorized side effects. Full host and normal natural-language model workflow acceptance remains required before general conformance is claimed.

For this limited pilot only, the Operator accepts the remaining uncertainty from (a) no live model/Operator natural-language semantic-upgrade demonstration, (b) incomplete exhaustive power-loss/process-exit injection at every new journal subphase, and (c) incomplete live-host component-parity proof beyond the tested packaged CLI, launcher, status and runtime. These are **NOT VERIFIED**, not PASS, and must appear in the release record; no generic waiver or automatic change to later releases. The existing independent packaged 1.4.2-to-1.5.4 recovery cases, complete archive-integrity checks, plan/hash-bound decisions, stale-session rejection and dirty-file preservation remain mandatory. This exception does not authorize unsafe plan apply, source runtime destruction, silent configured-authority choices, manual pin falsification, Windows test claims or changing protected consumer files outside the exact approved plan.

The pilot may be published only after separately evidenced mechanical validation, legitimate source publication/merge authorization, and a verifiable release package built from the exact integrated commit. The consumer's plan must be READY, all required decisions explicitly resolved and exact preconditions stable before any apply; startup after cutover must be verified rather than inferred. Any missing material source/target integrity, unresolved collision or indeterminate side effect is a stop. Operator acceptance is for a **known limited pilot risk**, not a declaration that the full product contract passes.

### 18.3. Follow-up limited Windows recovery hotfix — 1.5.5 (2026-10-21)

The 1.5.4 limited recovery pilot encountered a real Windows `EPERM` before writing any managed consumer files: `writeDurable` attempted unsupported directory-handle synchronization, leaving a hash-bound journal in `PREPARED`. The Operator explicitly requested that the team remain focused on delivering an actually working 1.5.x consumer and authorized proceeding with the smallest 1.5.5 hotfix while continuing to defer comprehensive Windows test suites until PagoElectronico can upgrade. This authorizes **preparing and attempting one additional Operator-controlled 1.5.5 recovery pilot**, not extending the 1.5.4 exception to arbitrary later releases or declaring full acceptance.

The 1.5.5 risk disposition is bounded to portability of journal-directory fsync and explicit integrity-checked `PREPARED -> ROLLED_BACK` source recovery; the consumer may adopt 1.5.5 only with a verified released package, original source-package integrity, a READY exact state-bound plan, explicit resolution of conflicts, recovery provenance and fresh-session verification. Valid reusable 1.5.4 packaged/source proof and the actual 1.5.5 focused tests/Mechanical Validation apply; unrerun Windows host suites, exhaustive journal power-loss injection, natural-language model flows and all-component live-host parity remain **NOT VERIFIED**, not PASS. Do not repeat the full suite just for the patch version.

The 1.5.5 pilot still requires separate legitimate producer integration/publication from exact `main` and release-asset checksums before a consumer write. Preserve the verified old source until the new runtime is proven; never delete or bypass the existing `PREPARED` journal, assume a partial migration succeeded, falsify the target pin, relax protected consumer file boundaries or assert TSK-026 terminal acceptance.

### 18.1. Operator-authorized Windows evidence exception — adapter 1.5.4 only (2026-10-21)

For the first managed-runtime recovery release **1.5.4** only, the Operator explicitly authorizes deferring **Windows installed-host execution and Windows file-lock tests** from the pre-publication acceptance evidence because the prolonged release delay is materially preventing PagoElectronico development. This is a release-scoped exception to the Windows-specific portions of §18 and TSK-026 §5(I), not a claim that Windows behavior passed. The product remains intended for Windows consumers, but **Windows compatibility is unverified for this release** until exercised on the real consumer or other representative installed host; report this residual risk in release and adoption records.

The exception does not waive archive/payload integrity, authorized plan and decisions, preservation of consumer modifications and source runtime, recovery safety, actual macOS installed-package acceptance, or other applicable product and publication gates. Existing valid evidence may be reused under OPS-007. No invented PASS, unrelated test expansion, extra process or general relaxation for later releases. A Windows production consumer MUST still verify its actual source/target plan, package identity and observed readiness before applying the upgrade; a failed or unavailable recovery remains blocked, never force-applied.
