---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OVR-001
  type: OVR
  title: DEV FOUNDRY Framework Overview
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - framework-purpose
    - framework-terminology
    - framework-authority-direction
    - source-of-truth-definition
    - self-containment-principle
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
    - consumer-product-design
    - provider-specific-operation
    - runtime-tool-implementation
authority:
  governedBy: []
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 00 [OVR-001] DF - DEV FOUNDRY Framework Overview

## 1. Purpose

DEV FOUNDRY is a provider-neutral methodology for turning bounded intent into
governed product or governance change while preserving explicit authority,
responsibility, validation, evidence, review, lifecycle state, and controlled
evolution.

DEV FOUNDRY is not a product runtime, agent implementation, repository tool,
model provider, Git workflow engine, prompt format, or transport. Products may
implement the methodology differently as long as they satisfy the adopted
framework contracts and project bindings.

The framework is self-contained only when a reader can determine the meaning,
authority, lifecycle, artifact vocabulary, metadata contracts, role boundaries,
and adoption rules from the selected DEV FOUNDRY version and the adopting
project's explicit bindings without relying on conversation history, model
memory, another product repository, or undocumented convention.

## 2. Core terminology

**Framework** — the versioned reusable methodology distributed by
`dev-foundry`.

**Project** — a repository or bounded body of work that explicitly adopts one
framework version and supplies project-specific authority and bindings.

**Source of Truth (SoT)** — the authoritative home selected through applicable
authority routing for one bounded concept. Within its declared scope and
version, the SoT owns the normative definition of that concept and prevails over
summaries, copies, evidence, historical material, implementation behavior, and
other non-authoritative representations. A SoT is scoped; DEV FOUNDRY does not
assume that one universal file owns every concept.

**Authoritative home** — the single artifact or stable section permitted to own
one normative concept.

**Authority Index** — the routing artifact that identifies authoritative homes.
An index routes to authority; it does not acquire the routed authority merely by
summarizing it.

**Capability** — one coherent, independently demonstrable outcome or behavior
that has a traceable need and a bounded acceptance condition.

**Actor** — a governed participant performing work.

**Role** — a reusable responsibility and authority boundary.

**Implementation** — the concrete human, model, agent, service, team, or other
mechanism assigned to perform a role.

**Platform** — the environment and governed capability surface through which an
implementation receives context and acts.

**Evidence** — verifiable information about what was observed or performed.
Evidence proves facts; it does not create methodology or product authority.

**Material implementation boundary** — the already-authorized capability,
behavioral objective, side-effect authority, invariants, and hard exclusions that
determine what implementation work is materially permitted.

**Mutation-surface projection** — the Governance Author's bounded prediction of
the concrete paths or implementation surface expected to change. It guides
execution and proof, but it is not a claim that every directly necessary
consistency or regression effect has been perfectly enumerated unless applicable
authority explicitly makes that surface a hard closed boundary.

**Projection variance** — an observed implementation delta outside the initial
mutation-surface projection. A projection variance requires semantic
reconciliation against the material implementation boundary and is not, by
itself, evidence of unauthorized scope expansion.

## 3. Authority direction

Reusable authority flows in one direction:

`dev-foundry canonical framework -> explicit project adoption -> project authority -> bounded work -> evidence`

A product, consumer repository, runtime behavior, repeated implementation
practice, generated text, conversation, or evidence record does not become
framework authority by use alone.

Within an adopting project, authority is resolved in this order unless the
selected framework explicitly defines a narrower rule:

1. explicit Operator decisions at boundaries reserved to the Operator;
2. the explicitly adopted immutable DEV FOUNDRY framework version;
3. the Project Operating Profile, which binds the framework locally without
   redefining reusable semantics;
4. project OVR/ADR/ARC/SPC/DAT/TSK/OPS and approved deviations according to the
   artifact authority model;
5. MTP, prompts, execution contracts, and other bounded derived instructions;
6. evidence and runtime records as descriptive proof.

A lower layer MUST NOT silently override a higher layer.

## 4. Capability does not grant authority

Technical ability, model intelligence, filesystem access, repository access,
tool availability, automation, or platform privilege does not grant permission
to cross a role, scope, lifecycle, repository, product, or promotion boundary.

Every side effect is authorized by applicable authority and the current bounded
operation, not by the fact that an implementation can perform it.

## 5. Methodology versus product

Reusable methodology defines concepts and contracts that remain meaningful
across multiple implementations, including artifact semantics, roles, lifecycle,
validation/audit distinctions, metadata, evidence principles, adoption, and
versioning.

A consumer product owns its concrete architecture, runtime protocols, API or
tool schemas, persistence, concurrency, process control, host integration,
provider selection, transport, telemetry, UI, repository transaction mechanics,
and other implementation choices unless a future framework version
independently standardizes a reusable abstraction.

A product may expose capabilities that make framework operation easier. The
existence of those capabilities does not move their implementation into the
methodology.

## 6. First reading path

A new reader SHOULD follow this path:

1. OVR-001 for framework purpose and terminology;
2. OVR-002 for artifact taxonomy, authority routing, and portability;
3. OPS-001 for the governed lifecycle;
4. OPS-003 for roles and separation of duties;
5. OPS-006 and DAT-008 for SoT metadata and frontmatter;
6. OPS-005 and DAT-016 for project adoption, profiles, and platform bootstrap;
7. DAT-020 for the Authority Index contract;
8. DAT-021 when authoring or promoting a DEV FOUNDRY framework version;
9. the remaining OPS artifacts when their operating concern applies;
10. the adopting project's Authority Index and Project Operating Profile;
11. only the project-specific authority required by the current bounded work.

This reading path is navigation, not a new authority hierarchy.

## 7. Framework evolution

Canonical framework versions are immutable. New reusable semantics are authored
as a new candidate, validated and reviewed according to the active framework,
then promoted only through an explicit framework-version boundary.

Consumers adopt versions explicitly. No product silently inherits a later
framework version, and no consumer implementation flows authority back into
`dev-foundry`.
