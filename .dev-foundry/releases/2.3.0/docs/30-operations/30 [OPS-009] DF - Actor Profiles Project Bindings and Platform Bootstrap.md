---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-009
  type: OPS
  title: Actor Profiles, Project Bindings, and Platform Bootstrap
  status: ACTIVE
artifactVersion: "2.3.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - actor-profile-operation
    - actor-binding-operation
    - project-operating-profile-operation
    - platform-bootstrap-operation
    - profile-versioning
    - operation-scoped-role-selection
  appliesTo:
    profiles:
      - actor-profile
      - project-operating-profile
      - capability-profile
      - platform-bootstrap
  excludes:
    - provider-selection
    - automatic-agent-orchestration
    - automatic-platform-deployment
authority:
  governedBy:
    - OPS-003
    - OPS-005
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-009] DF - Actor Profiles, Project Bindings, and Platform Bootstrap

## 1. Purpose

Define how reusable role behavior is separated from concrete implementations and
how a platform obtains enough startup context to retrieve repository authority
without duplicating the methodology.

DAT-016 owns the machine-readable contracts.

## 2. Actor Profiles

Every governed role performed through a reusable profile references one approved
versioned Actor Profile.

An Actor Profile defines provider-neutral:

- role and purpose;
- responsibilities;
- allowed/prohibited actions;
- operation modes when materially distinct;
- preconditions;
- required inputs and outputs;
- handoffs;
- context/authority discipline;
- stop conditions;
- independence constraints.

Actor Profiles constrain behavior. They do not authorize product decisions,
side effects, exceptions, promotion, or adoption.

A material behavior change creates a new profile version. Historical evidence
retains the profile version applicable when it was produced.

## 3. Project bindings

The Project Operating Profile binds roles to governed project role policies.
Under the version-scoped legacy POP v2, the project role binding also contains
one concrete implementation identity, kind and optional platform. Under POP v3,
role/Actor Profile and stable eligibility requirements are the project binding;
concrete implementation identity, capability fit, selection and verification
are bound to each operation. The role's semantics do not change merely because
the selected implementation changes. DAT-016 governs the closed v2 and v3
shapes without reinterpreting historic v2 state. Operation selection never
grants new scope or overrides an Actor Profile prohibition.

## 4. Operation-scoped role selection

When one implementation is eligible for multiple roles:

1. resolve exactly one role/profile before role-dependent work;
2. explicit Operator role intent wins when it names an eligible binding;
3. otherwise use the project-configured default when one exists;
4. keep the selected role fixed through the bounded operation;
5. end that operation before switching;
6. on the next operation, read the new profile and re-establish its authority,
   state, and preconditions.

A platform session is not itself a role. Conversational continuity does not
transfer authority or satisfy an independence requirement.

## 5. Platform Bootstrap

A Platform Bootstrap is minimal startup configuration for securely locating
and retrieving current repository authority. Under v3 it is not an exhaustive
membership list of implementations and is not an authorization source.

It identifies only what is needed before repository authority can be retrieved:

- project/repository/workspace identity;
- POP location;
- Authority Index entry point;
- eligible/fixed Actor Profile binding and selection rule;
- bounded SoT retrieval requirement;
- prohibition on treating memory/history/generated text as authority;
- indispensable platform constraints unavailable from repository SoT before
  startup;
- fail-closed behavior when repository identity, authority, profile, or required
  capability cannot be established.

It does not reproduce:

- complete role definitions;
- complete lifecycle policy;
- product authority;
- task history;
- audit ceremony;
- broad runtime instructions.

The repository-stored bootstrap is configured project authority. Any copy
deployed into a platform is a derivative and MUST remain semantically aligned.

## 6. Capability Profiles

Capability Profiles are implementation-specific configured project constraints
when required or provided by project policy. Under POP v3 they can be reused
across task boundaries and are evaluated against operation-scoped verified
implementation facts rather than permanently tying the role to a platform.
Where project policy allows independently verified operation-scoped capability
proof instead of a configured profile, such proof remains runtime evidence and
never becomes project authority merely by existing.

Profiles may describe model/tool/team limits, supported operations, environment
constraints, or proof capabilities.

They cannot expand an Actor Profile or grant authority.

OPS-002 governs fit.

## 7. Reconciliation

A POP, Actor Profile binding, or Platform Bootstrap becomes stale when a
material governed policy or authority binding changes, not merely when an
eligible concrete platform is selected for a new operation under POP v3.

Governed operation stops until genuinely stale configured authority is
reconciled when the inconsistency affects the current operation.

Every operation rechecks its actor/profile, eligibility, implementation
attribution sufficient for its boundary, capability, bound repository state,
authorization and participation when material.
A candidate cannot self-attest authority or turn platform switching into
authorization. Reconciliation does not automatically change the adopted version.
DAT-022 governs cross-platform continuation and observable outcomes.
