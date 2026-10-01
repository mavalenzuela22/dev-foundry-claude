---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-002
  type: OPS
  title: Implementation Capability Profiles and Workload Fit
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - capability-profile-semantics
    - implementation-fit-assessment
    - workload-decomposition
    - execution-scope-fit
  appliesTo:
    artifactTypes:
      - TSK
      - MTP
    profiles:
      - capability-profile
      - actor-profile
  excludes:
    - provider-selection
    - model-ranking
    - fixed-token-budgets
    - product-runtime-adapters
authority:
  governedBy:
    - OPS-001
    - OPS-007
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-002] DF - Implementation Capability Profiles and Workload Fit

## 1. Purpose

Define how a project describes implementation-specific capability and determines
whether one concrete implementation can safely perform one bounded MT or atomic
TSK.

The methodology constrains fit. It does not prescribe a provider, model, tool,
team, operating system, runtime, or commercial tier.

## 2. Capability Profile

A Capability Profile is configured project authority describing implementation
facts and limits that are narrower than a reusable Actor Profile.

A profile may declare:

- stable identifier and version;
- concrete implementation or implementation class;
- supported and prohibited work;
- available mutation and observation capabilities;
- context or workload limits;
- proof/test capabilities;
- environment or platform constraints;
- required stop and escalation triggers.

A Capability Profile constrains operation. It MUST NOT grant product authority,
override Actor Profile prohibitions, weaken project authority, or substitute for
Operator authorization.

Material behavior or limit changes require a new profile version or a truthful
project reconciliation.

## 3. Fit assessment

Before implementation, the Governance Author or other permitted planning role
checks whether the proposed boundary fits the selected Implementation Executor
and any applicable Capability Profile.

The assessment considers at least:

- number of distinct objectives;
- unresolved decisions;
- number of materially distinct subsystems;
- side-effect classes;
- external integration needs;
- risk boundaries;
- proof boundaries;
- documentation/governance mutation needs;
- context or environment constraints;
- required new abstractions or dependencies;
- whether the objective can be stated as one concrete bounded change.

A fit result is `PASS`, `FAIL`, or `BLOCKED`.

`FAIL` means the work must be decomposed, reassigned, or re-governed.
`BLOCKED` means fit cannot be validly determined because required authority,
profile, environment, or evidence is unavailable.

## 4. Bounded implementation rule

A normal implementation slice has:

- one primary objective;
- no unresolved architectural or product decision;
- one coherent responsibility boundary;
- the smallest mutation surface that can safely complete the objective;
- focused proof that directly supports acceptance;
- explicit stop conditions.

No universal file-count, token-count, prompt-size, model-size, or MT-count limit
is framework authority. Projects may configure implementation-specific ceilings
when evidence justifies them.

## 5. Split and stop triggers

Split, reassign, or re-govern when:

- a new ADR/ARC/SPC/DAT decision is required;
- multiple independently deliverable capabilities appear;
- independently governed ownership boundaries must be crossed;
- distinct side-effect or risk classes require separate authorization;
- separate proof groups can fail independently and materially;
- the executor must infer lifecycle, ownership, failure semantics, or authority;
- the boundary exceeds a declared capability limit.

Do not split solely to satisfy a preferred count or tool collection limit.

Stop rather than broaden when completion requires an unapproved dependency,
abstraction, product decision, path, permission, or capability.

## 6. Provider neutrality

A framework version may define the semantics of Capability Profiles and fit
assessment. Concrete provider/model profiles belong to the adopting project or
product.

Experience with a provider may justify a framework proposal, but the provider's
behavior does not become reusable methodology until independently governed in
`dev-foundry`.
