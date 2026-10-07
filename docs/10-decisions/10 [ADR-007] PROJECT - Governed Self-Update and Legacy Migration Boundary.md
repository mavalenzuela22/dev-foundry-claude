---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-007
  type: ADR
  title: Governed Self-Update and Legacy Migration Boundary
  status: ACCEPTED
artifactVersion: "1"
authorityScope: governed-self-update-and-legacy-migration-boundary
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-self-update-lifecycle
    - initial-consumer-bootstrap-boundary
    - legacy-pre-self-update-migration-boundary
    - side-by-side-target-release-staging
    - stale-session-after-upgrade-cutover
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - claude-adapter-cli
      - claude-governance-mcp
    operations:
      - initial-consumer-bootstrap
      - legacy-consumer-migration
      - governed-self-update
  excludes:
    - reusable-dev-foundry-methodology-change
    - silent-framework-adoption
    - silent-consumer-authority-mutation
    - consumer-product-code
    - provider-authentication
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-005
    - ADR-006
    - OPS-005
    - OPS-008
    - OPS-009
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-007] PROJECT - Governed Self-Update and Legacy Migration Boundary

## 1. Context

The adapter has three materially different consumer lifecycle problems that must
not be collapsed into one unsafe upgrade mechanism:

1. a Git repository with no DEV FOUNDRY project authority needs an initial,
   explicit bootstrap before the first governed Claude session can exist;
2. consumers pinned to adapter releases created before governed self-update
   support need a one-time bridge into a self-update-capable baseline;
3. once that baseline exists, future releases may change adapter-managed files,
   configured project authority, bootstrap/profile contracts, or the adopted
   DEV FOUNDRY release itself.

ADR-003 correctly prohibited an ordinary adapter install or managed-file refresh
from rewriting established consumer authority. That prohibition remains valid.
It is not sufficient to model a major future upgrade in which the project
legitimately chooses to migrate its own configured authority.

A model-assisted upgrade also cannot start by replacing the runtime that is
currently governing the session. The currently active session must remain bound
to its verified source release until the migration crosses an authorized
cutover. The target release is migration input until that point, not active
authority.

PagoElectronico is the canonical legacy dogfood consumer. Reinstalling it from
scratch would discard the exact legacy state that this product must prove it can
migrate safely, even if historical evidence files themselves were retained.

## 2. Decision

### 2.1 First self-update-capable baseline

Adapter 1.4.0 SHALL be the first self-update-capable consumer baseline.

Consumers older than that baseline use the bounded legacy bridge defined by
SPC-008 to reach the baseline once. From the baseline forward, releases use
governed model-assisted self-update.

This is a lifecycle compatibility boundary, not a promise that every historical
adapter build can migrate directly to every future release.

### 2.2 Initial bootstrap of an ungoverned repository

A repository with no valid DEV FOUNDRY POP and Authority Index may use
dev-foundry-claude setup to preview a minimal initial project bootstrap.

The preview SHALL be read-only and SHALL explain, in user language, detected
project identity, greenfield/brownfield classification or choice, human
Operator/owner identity or choice, selected canonical DEV FOUNDRY release,
project/configuration files to be created, and that application/product code is
outside the bootstrap write boundary.

Applying that bootstrap requires explicit Operator confirmation. The confirmed
bootstrap MAY materialize the minimum project authority/configuration required
by OPS-005, including the POP, Authority Index, selected immutable framework
release, required profiles/bootstrap, a minimal truthful project overview, and
an initial bounded onboarding/baseline task.

This is initial authority creation from canonical release material plus explicit
Operator choices. It is not permission for the adapter to rewrite arbitrary
project authority after governance exists.

For a brownfield repository, the initial task SHALL establish a verified project
baseline before ordinary product implementation. It may be represented
internally as a TSK, but a beginner is not required to know that term to perform
installation and first launch.

### 2.3 Established consumer write boundary

Once a valid active project POP and Authority Index exist, ordinary adapter
installation, setup, managed refresh, or package replacement SHALL NOT
arbitrarily rewrite established consumer authority.

Adapter-owned runtime/configuration surface may continue to use deterministic
plan/apply mechanics. Changes to established POP, Authority Index, Platform
Bootstrap, Actor/Capability Profile bindings, project decisions, or selected
framework release require one of the explicit migration paths below.

### 2.4 Legacy bridge

A pre-self-update consumer may be migrated to the 1.4.0 baseline only through a
declared legacy bridge for an exact supported source release/build.

The bridge SHALL verify exact source and target adapter identities; preserve
existing project authority, historical evidence and consumer product code;
classify prepared versus active legacy states; apply only declared transforms;
require explicit Operator authorization; use exact plan/precondition/hash
enforcement; and fail closed on unknown builds, ambiguous authority, modified
owned files, unsafe paths, or unsupported semantic decisions.

Historical evidence and completed work retain their original meaning. Resetting
or reinstalling a consumer from scratch SHALL NOT satisfy legacy migration
acceptance.

Where a legacy consumer still has a non-Claude active governance runtime, the
bridge SHALL preserve that active authority until a separately authorized
cutover to the 1.4.0 Claude baseline is performed.

PagoElectronico SHALL be the canonical real-consumer dogfood for this bridge
after the producer candidate passes isolated validation. Its consumer migration
is a separate governed operation under PagoElectronico authority; this producer
decision does not itself authorize mutation of that repository.

### 2.5 Governed model-assisted self-update

For a consumer already on the self-update baseline or later, a release that
requires semantic or configured-authority migration SHALL be migrated from the
currently active governed Claude session.

The source session remains governed by the source project's active authority and
source adapter identity throughout migration preparation.

The target release SHALL be acquired and verified side-by-side. Acquisition or
installation of target bytes does not activate them and SHALL NOT destroy or
replace the runtime needed by the source session before cutover.

The source session may inspect the verified target migration package, assess the
delta against current project authority, prepare target project changes, request
reserved Operator decisions/authorization, and execute the bounded migration
under the source authority.

Target release content is migration input until cutover. A target framework
release does not govern the project merely because its bytes are available.

The migration may include established configured authority only when that change
is explicitly within the governed migration boundary, traceable to the target
release requirement and current project decisions, authorized by the Operator
where required, and passes applicable validation/audit gates.

The updater SHALL NOT make reserved project-specific semantic decisions on the
Operator's behalf.

### 2.6 Cutover and mandatory restart

The self-update cutover is atomic with respect to the project-selected adapter
identity and any authority/configuration that defines the new governed runtime.

After a successful cutover, the source session's startup authority/runtime
fingerprint is stale. That session SHALL perform no further governed project
work. Subsequent governed-resolution attempts from the stale session SHALL fail
closed when mechanically detectable. The user SHALL be told to start a new
session with dev-foundry-claude start.

The new session SHALL independently reobserve the new POP, Authority Index,
framework release, role/profile bindings and adapter pin before work resumes.
A session may migrate the project to its successor state; it may not silently
continue operating as though it had been started under that successor state.

## 3. Release migration material

A self-update-capable target release SHALL carry integrity-bound migration
material sufficient for the source session and deterministic tooling to
understand the supported transition.

SPC-008 owns the concrete contract. The material SHALL distinguish supported
source release/build identities, target release identity, mechanical transforms
and preconditions, semantic/configuration changes requiring governed review,
Operator choices that cannot be inferred, required validation/stop conditions,
and mandatory post-cutover restart.

Migration material is part of the immutable target release identity. Producer
main, conversational memory and release marketing text are not migration
authority.

## 4. Three consumer paths

A. no DEV FOUNDRY: setup -> explicit initial bootstrap -> start

B. legacy pre-self-update consumer: legacy bridge -> 1.4.0 baseline -> start

C. 1.4.0 or later: current governed session -> target migration -> atomic
cutover -> new start

All three paths use progressive disclosure. Internal POP/Authority Index/TSK
mechanics remain inspectable but are not prerequisites for a beginner to know
what command or approval is needed next.

## 5. Evidence and history

Migration SHALL be additive with respect to historical truth.

A migration SHALL NOT rewrite or delete historical execution evidence, closed
task meaning, prior release identity, or historical authority merely to make the
new release appear native to the project.

Where schemas or active configured authority evolve, historical records retain
the version and semantics under which they were produced.

## 6. Alternatives not chosen

- Reinstall legacy consumers from scratch: hides migration defects and discards
  the most valuable dogfood boundary.
- Let the target package overwrite the running source installation before review:
  risks invalidating the session that must govern the migration.
- Put every possible historical migration forever into every future release:
  unbounded compatibility debt. Legacy consumers cross one supported bridge to
  the self-update baseline instead.
- Make Node/CLI heuristics decide arbitrary project semantics: mechanical tooling
  is appropriate for exact transforms; project-specific semantic decisions stay
  with the governed model and Operator.
- Continue a source session after authority cutover: conversational continuity
  would incorrectly transfer authority across a runtime/authority boundary.
