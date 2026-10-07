---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-008
  type: SPC
  title: Consumer Bootstrap, Legacy Bridge, and Governed Self-Update Contract
  status: ACTIVE
artifactVersion: "1"
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
    - pago-legacy-dogfood-acceptance-boundary
  appliesTo:
    components:
      - claude-adapter-package
      - claude-adapter-cli
      - claude-governance-mcp
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
