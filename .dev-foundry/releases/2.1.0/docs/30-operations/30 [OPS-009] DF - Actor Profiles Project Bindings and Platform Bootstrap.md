---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-009
  type: OPS
  title: Actor Profiles, Project Bindings, and Platform Bootstrap
  status: ACTIVE
artifactVersion: "2.1.0"
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

The Project Operating Profile binds roles to concrete implementations.

A binding distinguishes:

- role;
- Actor Profile;
- concrete implementation identity and kind;
- platform when relevant;
- Capability Profiles when relevant;
- binding/adoption status.

Changing provider, model, human, service, or platform does not change reusable
role semantics unless the behavior contract itself changes.

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

A Platform Bootstrap is a minimal configured startup binding.

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

Capability Profiles are implementation-specific and configured by the project.

They may describe model/tool/team limits, supported operations, environment
constraints, or proof capabilities.

They cannot expand an Actor Profile or grant authority.

OPS-002 governs fit.

## 7. Reconciliation

A POP, Actor Profile binding, or Platform Bootstrap becomes stale when a
material source binding changes.

Governed operation stops until the stale configured artifact is reconciled when
the inconsistency affects the current operation.

Reconciliation changes configured state; it does not automatically change the
adopted framework version.
