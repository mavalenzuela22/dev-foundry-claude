---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-001
  type: OPS
  title: Governed Planning and Delivery Lifecycle
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - governed-lifecycle
    - lifecycle-stage-separation
    - task-and-microtask-operation
    - lifecycle-stop-conditions
  appliesTo:
    artifactTypes:
      - ADR
      - ARC
      - SPC
      - DAT
      - TSK
      - MTP
      - OPS
      - CLOSURE
      - AUDIT
  excludes:
    - consumer-runtime-mechanics
    - provider-specific-execution
authority:
  governedBy:
    - OVR-001
    - OVR-002
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-001] DF - Governed Planning and Delivery Lifecycle

## 1. Purpose

Define the reusable lifecycle that turns bounded Operator intent into governed
change, verifiable evidence, controlled promotion, and truthful closure.

OPS-001 governs process. It does not replace product authority.

## 2. Lifecycle principles

All governed work follows these principles:

1. clarity and necessity precede structure;
2. required authority is explicit before a lower artifact must rely on it;
3. one capability is owned by one TSK;
4. decomposition follows material boundaries, not preferred document counts;
5. implementation applies approved authority rather than inventing it;
6. every side effect has an authorization source and a bounded scope;
7. validation, semantic review, evidence, promotion, and closure remain distinct;
8. capability does not grant authority;
9. evidence is independently inspectable to the degree required by the boundary;
10. the smallest safe complete change is preferred over broad improvement;
11. provider, product, and runtime mechanics remain consumer concerns unless the
    framework explicitly standardizes them.

## 3. Applicable lifecycle

The maximum reusable lifecycle is:

`intent -> authority -> TSK -> optional MTP/MT -> preparation -> implementation ->
post-execution boundary reconciliation when needed -> mechanical validation ->
semantic self-assessment where applicable -> independent governance audit when
triggered -> bounded corrective review when needed -> evidence -> explicit
promotion/publication/adoption decision -> closure`

Not every bounded operation requires every stage.

Examples:

- documentation-only governance work does not manufacture implementation work;
- an atomic TSK does not manufacture an MTP;
- an operation with no independent-audit trigger does not manufacture an
  independent audit;
- a validation-only operation does not reopen implementation authority;
- closure does not imply publication, and publication does not imply closure.

## 4. Intent and authority

The Operator or other permitted project authority states the desired outcome,
constraints, prohibited actions, and any reserved boundary authorization.

Before authoring or implementation, the acting role determines:

- why the work is necessary;
- which existing authority owns the affected concepts;
- whether new ADR/ARC/SPC/DAT/OPS authority is actually required;
- the smallest safe complete boundary;
- which related work remains outside scope;
- which roles and evidence are required.

Unresolved decisions MUST NOT be silently pushed down into a TSK, MTP, prompt,
executor, validator, or auditor.

## 5. TSK operation

A TSK represents one necessary, coherent, independently demonstrable capability.

A TSK states at least:

- purpose and necessity;
- lifecycle status;
- applicable authority;
- in-scope and out-of-scope behavior;
- acceptance criteria;
- dependencies;
- evidence expectations;
- completion/closure policy;
- deliberate exclusions and known limits when relevant.

A TSK is not an unbounded epic, generic backlog bucket, speculative hardening
placeholder, or bundle of independently deliverable capabilities.

## 6. MTP and MT operation

An MTP is optional.

Create an MTP only when a TSK contains materially distinct boundaries across one
or more of:

- authority;
- role or ownership;
- reversibility;
- side effects;
- risk;
- implementation subsystem;
- evidence;
- independently failing validation;
- stop conditions.

Each MT has one bounded objective, closed authority, explicit mutation boundary,
focused proof, and stop conditions.

An atomic TSK may carry its bounded implementation definition directly. Artifact
count, file count, or a preferred number of steps does not justify decomposition.

## 7. Preparation

When implementation is required, preparation defines only the current bounded
change:

- objective;
- preconditions;
- directed authority;
- material implementation boundary and hard exclusions;
- mutation-surface projection when one is useful;
- acceptance behavior;
- focused proof;
- required validation;
- applicable implementation/capability profile;
- stop conditions.

A product may represent this preparation as a prompt, execution contract,
workflow, ticket, command package, or another mechanism. DEV FOUNDRY does not
require one transport or runtime representation.

Preparation MUST stop when implementation would require a new decision, broader
scope, unavailable authority, incompatible role, or unapproved side effect.

## 8. Implementation

The Implementation Executor completes only the already-authorized material
implementation boundary.

Preparation MAY include a mutation-surface projection of expected concrete paths
or implementation surface. The executor handoff MUST communicate either that
projection or its explicit absence. A projection guides execution and proof; it
does not silently narrow the material implementation boundary unless applicable
authority explicitly declares the projected surface to be a hard closed boundary.

Before handoff, the executor performs the smallest sufficient focused
self-verification available for the boundary it changed. When those checks expose
a directly necessary consistency or regression effect, the executor corrects it
in the same implementation operation only when OPS-007 and OPS-008 establish
that the effect remains inside the same material implementation boundary and no
hard exclusion is crossed.

The executor:

- follows the applicable product authority;
- reuses existing implementation where appropriate;
- preserves required safety and compatibility;
- produces focused proof;
- repeats directly affected self-checks until they pass or a real stop condition
  is established;
- reports every projection variance and its observable causal justification;
- reports contradictions and unexpected state;
- stops rather than inventing missing authority, crossing a hard exclusion, or
  expanding into a materially different capability.

Executor self-verification is implementation behavior, not governed validation
evidence. Any projection variance is reconciled semantically under OPS-008
before the lifecycle relies on it as authorized state.

Implementation completion is a claim until independently observable evidence and
applicable validation support it.

## 9. Validation, audit, evidence, promotion, and closure

OPS-004 owns validation, audit, evidence, verdict, and corrective semantics.

OPS-008 owns side-effect authorization and promotion-safety semantics.

CLOSURE records terminal disposition after applicable acceptance, evidence,
review, and Operator decision. It does not retroactively authorize prior work.

## 10. Stop conditions

Work stops when any applicable condition holds:

- authority is missing, conflicting, or cannot be resolved;
- repository/project identity or bound state is materially inconsistent;
- a lower artifact would need to invent a decision;
- required SoT metadata is missing or contradictory;
- scope expands beyond the authorized capability;
- the active implementation does not fit the role or workload;
- an unauthorized side effect becomes necessary;
- evidence required for the next gate is incomplete or indeterminate;
- a role would have to violate separation of duties;
- a product-specific implementation detail is being promoted into reusable
  methodology without independent justification.

Stopping, removing work, or deferring work is a valid governed outcome.
