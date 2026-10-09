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

The required next action is dev-foundry-claude start.

The new session SHALL resolve authority from current repository state and SHALL
not inherit the old session's governance resolution by conversation alone.

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

Producer tests SHALL include (1) real packed installed bootstrap on macOS and
Windows; (2) exact installed 1.4.2 initial transition; (3) two consumers with
different simultaneous package pins; (4) CLI/MCP/dashboard/telemetry true
runtime-package consistency; (5) actual configured-authority semantic migration
requiring a real model/Operator disposition; (6) injected interruption at every
durable phase and target CLI/MCP failure without corrupting source; (7) negative
security/provenance/path/concurrency tests; (8) historical evidence/dashboard
compatibility or truthful degradation; and (9) natural-language governed UX
with no routine manual npm or pin edits.

Fixtures alone are insufficient for the installed-package and host tests.
Test reports SHALL distinguish deterministic tests, model semantic evidence,
host-limited assumptions and independent audit verdict where triggered.
A user-facing “upgrade complete” requires independently verified fresh target
session and component identity; merely applying the pin is not completion.
