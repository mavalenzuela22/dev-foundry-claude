---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-005
  type: OPS
  title: Project Adoption, Versioning, and Framework Evolution
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - project-adoption
    - greenfield-adoption
    - brownfield-adoption
    - portability-actions
    - project-operating-profile-requirements
    - framework-versioning
    - framework-evolution
    - deviation-semantics
  appliesTo:
    artifactTypes:
      - OVR
      - ADR
      - ARC
      - SPC
      - DAT
      - TSK
      - MTP
      - OPS
      - CLOSURE
      - AUDIT
    profiles:
      - project-operating-profile
      - actor-profile
      - capability-profile
      - platform-bootstrap
  excludes:
    - automatic-framework-upgrade
    - consumer-product-implementation
authority:
  governedBy:
    - OPS-001
    - OVR-002
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-005] DF - Project Adoption, Versioning, and Framework Evolution

## 1. Purpose

Define how a project explicitly adopts DEV FOUNDRY, how portability values map
to adoption actions, and how canonical framework versions evolve without
allowing consumers to become implicit upstream authority.

## 2. Project Operating Profile

Every adopting project has one active Project Operating Profile (POP) that
declares at least:

- project/repository identity;
- greenfield or brownfield classification;
- adopted canonical framework version and authority entry point;
- framework adoption status;
- Operator authority;
- role-to-Actor-Profile bindings;
- concrete implementations and applicable Capability Profiles;
- Platform Bootstrap bindings where applicable;
- SoT metadata/frontmatter schema and migration policy;
- project audit triggers or risk rules beyond framework defaults;
- project promotion/publication rules where applicable;
- approved deviations;
- status of transitional or deferred bindings.

The POP configures adopted methodology. It MUST NOT redefine reusable framework
semantics.

DAT-016 defines the machine-readable POP and binding contract.

## 3. Portability actions

| Portability | Greenfield action | Brownfield action | Prohibited interpretation |
| --- | --- | --- | --- |
| `reusable` | Explicitly adopt the selected framework version | Assess compatibility, then explicitly adopt | Automatic inheritance |
| `configure` | Instantiate required project values | Reconcile existing values and bind only what is needed | Treat configured values as reusable methodology |
| `adapt` | Use the governed structure and author project-specific content | Map structure to verified current behavior | Blind copy of another product's decisions |
| `project-specific` | Create project-owned authority | Preserve or create project-owned authority | Import another project's TSK/ADR/evidence as current authority |
| `runtime-only` | Generate only for the applicable runtime boundary | Retain/clean under local runtime policy | Promote runtime records into permanent SoT |

Portability never grants automatic adoption.

## 4. Greenfield adoption

A greenfield project establishes only what its first governed capability needs.

Minimum bootstrap normally includes:

1. Project Operating Profile;
2. Authority Index;
3. Actor Profiles required by the roles currently in use;
4. configured Platform Bootstrap when the platform requires startup binding;
5. OVR overview/documentation map;
6. OPS-006/DAT-008 metadata support;
7. only the ADR/ARC/SPC/DAT authority materially needed for the first capability;
8. one TSK;
9. an MTP only when decomposition is materially required;
10. an Implementation Executor and Capability Profile only when implementation is required.

A greenfield project does not copy historical TSKs, audits, closures, prompts,
contracts, evidence, or runtime records from another project as current
authority.

## 5. Brownfield adoption

A brownfield project inventories verified current behavior, architecture,
interfaces, delivery process, existing governance, authority conflicts, metadata
coverage, and runtime dependencies.

Facts are separated from assumptions.

Metadata migration may be:

- `on-touch` when incomplete historical metadata does not block safe current
  operation;
- `complete-baseline` when a concrete approved need requires full corpus
  inventory, ownership, lifecycle, portability, or authority routing.

Brownfield adoption does not rewrite historical evidence merely for
consistency.

## 6. Minimum operational readiness

Before a project claims governed operation for a capability, it has:

- one adopted framework version;
- an Authority Index;
- a truthful POP;
- Actor Profiles for roles actually required;
- valid SoT metadata for active authority required by the capability;
- applicable product authority;
- one approved TSK;
- an MTP only when required;
- an eligible Implementation Executor and Capability Profile when implementation
  is required;
- enough validation capability or procedure to prove the current acceptance
  boundary.

A documentation-only governance operation does not require an executor.

## 7. Framework versions

A canonical framework version is immutable.

Canonical DEV FOUNDRY framework releases use three-part semantic versions in the
form `MAJOR.MINOR.PATCH`, where each component is a non-negative integer.

For every candidate derived from one immediately preceding canonical framework
version, the Governance Author classifies the complete semantic delta using the
highest applicable class below.

### 7.1 PATCH

A `PATCH` change has no normative semantic effect. It corrects a non-semantic
defect or clarifies existing reusable semantics while preserving their normative
meaning and required behavior exactly.

It introduces, removes, relaxes, narrows, or redefines no normative obligation,
reusable capability, role behavior, lifecycle requirement, contract invariant,
adoption requirement, authority direction, or other normative guarantee. If any
part of the complete candidate changes normative meaning or required behavior,
that part is not PATCH.

A project conforming to the preceding version requires no material project
authority, behavior, profile, or binding change solely because of the patch.

The next version from `A.B.C` is `A.B.(C+1)`.

### 7.2 MINOR

A `MINOR` change has a normative semantic effect and every such effect is
backward-compatible with the immediately preceding canonical version.

Backward-compatible means a previously conforming adopting project can adopt the
new version through bounded compatibility reconciliation without invalidating or
requiring incompatible reinterpretation of existing project authority, completed
governed state, historical evidence, or predecessor-bound Actor/Capability
Profile semantics.

A MINOR change may add, relax, refine, or compatibly redefine reusable
obligations, lifecycle behavior, role behavior, profiles, or other methodology
semantics. Previous-version state and evidence retain the meaning of the version
under which they were produced; new semantics apply only after explicit adoption
and any required bounded reconciliation.

Examples include an additive lifecycle rule, a compatible relaxation, a
compatible role refinement, a new version of an Actor Profile required by the
new behavior, or another reusable capability whose adoption does not require
incompatible reinterpretation of predecessor-governed state.

Adopting projects MAY require bounded profile, POP, bootstrap, or other local
reconciliation to use the new semantics.

The next version from `A.B.C` is `A.(B+1).0`.

### 7.3 MAJOR

A `MAJOR` change has at least one normative semantic effect that is not
backward-compatible under the MINOR compatibility test.

A MAJOR change therefore includes removal, narrowing, or incompatible
redefinition of an existing framework concept, authority direction, role
meaning, lifecycle gate, required contract shape or invariant, adoption rule, or
another normative guarantee when adoption would invalidate or require
incompatible reinterpretation of predecessor-governed authority, completed
state, historical evidence, or bound profile semantics.

The next version from `A.B.C` is `(A+1).0.0`.

### 7.4 Classification and selection rules

Classification is exhaustive and deterministic over the complete candidate
delta:

1. If the complete candidate has no normative semantic effect, classify it
   `PATCH`.
2. Otherwise evaluate every normative semantic effect against the MINOR
   backward-compatibility test. If every effect is backward-compatible,
   classify the candidate `MINOR`.
3. If any normative semantic effect fails that compatibility test, classify the
   candidate `MAJOR`.

When a candidate contains changes of more than one class, the highest class
controls the release version: `MAJOR > MINOR > PATCH`.

Classification is based on semantic effect rather than artifact count, file
count, implementation effort, perceived importance, or preferred release number.

The Governance Author records the classification and its concrete basis during
candidate preparation or self-assessment. When independent Governance Audit is
required for framework promotion, the auditor evaluates the classification
against the complete candidate delta as part of the audited boundary.

If the semantic effect or compatibility of a change cannot be established,
work stops for authority resolution; ambiguity MUST NOT be used to select a
lower version class.

Once this rule is canonical, the next release number is mechanically derived
from the preceding canonical version and the verified classification. The
Operator still authorizes the framework-promotion boundary, but a preferred
number does not override the derived version without separately governed
authority.

A candidate that introduces or changes this version-selection rule MUST NOT use
its own not-yet-canonical rule as the sole authority for selecting its release
number. That transition requires an already-canonical predecessor rule or
explicit Operator authority for the bootstrap release number.

A project explicitly records the version it adopts and does not inherit later
versions automatically.

Adopting a later version requires:

- impact review against active project authority and work;
- metadata/schema compatibility review;
- Actor/Capability Profile reconciliation;
- POP and Platform Bootstrap reconciliation;
- explicit project authorization;
- migration or deviation records where required.

Historical evidence retains the versions applicable when it was produced.

## 8. Framework evolution

Reusable improvements discovered in a consumer return to `dev-foundry` only as
proposals.

Framework evolution occurs as:

1. bounded candidate authoring under the currently active canonical framework;
2. mechanical validation appropriate to the candidate;
3. Governance Author self-assessment;
4. independent Governance Audit when required for framework-version promotion;
5. explicit Operator authorization for framework-version promotion;
6. materialization of a distinct immutable release;
7. authority routing to the new release;
8. separate explicit consumer adoption.

A promoted release is not rewritten in place.

## 9. Candidate and release integrity

An audited candidate snapshot is immutable after its audit lineage completes.

Promotion creates a distinct versioned release. Candidate hashes identify
candidate bytes; release hashes identify release bytes.

Release integrity binding MUST avoid self-referential hash cycles. Manifest
creation and higher-level hash binding occur in an acyclic dependency order.

A promotion transform may alter only declared lifecycle/version/routing metadata
needed to express canonical state. Semantic change requires a new candidate and
applicable review.

## 10. Deviations

A project deviation states:

- affected framework rule;
- exact scope;
- rationale and concrete need;
- risk;
- simpler alternatives rejected;
- duration or reconciliation trigger;
- approving Operator authority.

A deviation does not silently modify the framework, weaken unrelated controls,
or become reusable methodology through repetition.
