---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-003
  type: OPS
  title: Roles, Responsibilities, and Separation of Duties
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - role-model
    - actor-role-implementation-platform-separation
    - separation-of-duties
    - role-handoffs
    - boundary-exception-semantics
  appliesTo:
    profiles:
      - actor-profile
      - project-operating-profile
      - capability-profile
  excludes:
    - concrete-provider-bindings
    - consumer-filesystem-ownership
    - runtime-tool-routing
authority:
  governedBy:
    - OPS-001
    - OPS-007
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-003] DF - Roles, Responsibilities, and Separation of Duties

## 1. Purpose

Define reusable role responsibilities and the separation between role,
implementation, platform, capability, and authority.

## 2. Operator

The **Operator** is the final human or project authority for boundaries reserved
to the Operator by the framework or Project Operating Profile.

The Operator may:

- authorize scope and exceptions;
- approve role bindings and deviations;
- authorize side-effect boundaries;
- accept or reject audit/closure disposition;
- authorize framework adoption or version changes.

Operator authority is not inferred from tool ownership or implementation
capability. A project MUST explicitly identify who or what holds Operator
authority. The framework does not automatically delegate Operator authority to
an AI model, agent, runtime, or service.

## 3. Governance Author

The **Governance Author** owns the clarity and coherence of governed authority.

Responsibilities include:

- resolving applicable authority;
- defining the smallest safe complete material boundary;
- authoring/reconciling necessary OVR/ADR/ARC/SPC/DAT/TSK/MTP/OPS material;
- maintaining truthful SoT metadata;
- separating methodology from product implementation;
- performing necessity, reuse, fit, and self-assessment;
- preparing bounded implementation or audit handoffs;
- semantically reconciling reported mutation-surface projection variances against
  the already-authorized material implementation boundary before later lifecycle
  gates rely on them.

The Governance Author does not silently implement product code, approve its own
required independent audit, retroactively authorize material scope expansion, or
cross a reserved lifecycle boundary without authorization.

## 4. Implementation Executor

The **Implementation Executor** completes one approved material implementation
boundary.

It may:

- modify implementation surfaces already covered by the material implementation
  boundary, including directly necessary projection variances allowed by OPS-007
  and OPS-008;
- reuse existing implementation and approved dependencies;
- perform the smallest sufficient focused self-verification and add focused proof;
- repeat directly affected self-checks until they pass or a real stop condition
  is established;
- report every projection variance with its observable causal justification;
- report contradictions, missing authority, or unexpected state.

It does not:

- create product or framework authority;
- treat the initial mutation-surface projection as permission for unrelated
  changes;
- resolve open architecture by implementation preference;
- mutate governance by default;
- broaden the capability or self-authorize a materially different capability;
- cross a hard exclusion;
- perform adjacent cleanup;
- treat its self-verification as governed validation evidence;
- author the final semantic audit verdict;
- cross promotion/publication boundaries without authorization.

An Implementation Executor may be a human, model, agent, service, team, IDE,
CLI, plugin, or other mechanism capable of satisfying the applicable profile.

## 5. Mechanical Validator

The **Mechanical Validator** proves deterministic or focused facts about an
existing bound state.

It may evaluate schemas, exact state, commands, tests, manifests, references,
hashes, declared invariants, or other mechanically decidable facts.

It does not decide semantic authority, necessity, ownership, sufficiency, or the
governance audit verdict and does not repair the subject as part of validation.

## 6. Governance Auditor

The **Governance Auditor** performs read-only semantic evaluation against
applicable authority and evidence.

It evaluates correctness, completeness, authority coherence, metadata/body
truthfulness, minimality, sufficiency, contamination, lifecycle, evidence, and
required separation of duties.

When independence is required, the actor satisfying this role must meet the
independence rule for the bounded audit. Session, provider, or tool separation
is not automatically required unless applicable authority says so; material
participation in authoring or mutation is the relevant default disqualifier.

## 7. Evidence Custodian

The **Evidence Custodian** records and maintains governed evidence after the
underlying facts and verdicts are established.

It distinguishes:

- claims from observations;
- mechanical results from semantic judgments;
- Operator decisions from actor recommendations;
- accepted limits and deferred work from delivered scope.

Evidence custody does not create product or methodology authority.

## 8. Role switching

One concrete implementation may be bound to multiple roles only when the
Project Operating Profile allows it and applicable separation-of-duty rules are
satisfied.

Role selection is operation-scoped:

1. resolve one role/profile before role-dependent work;
2. keep that role fixed through the bounded operation;
3. end the operation before selecting another role;
4. re-establish applicable authority and state for the new role;
5. never use conversational continuity as a substitute for independence or
   reobservation.

A documentation-only operation may omit the Implementation Executor. A
validation-only operation may omit implementation. Role-chain symmetry is not a
reason to create unnecessary work.

## 9. Handoff minimums

A handoff supplies only what the receiving role needs.

Typical handoffs:

- Author -> Executor: bounded objective, applicable authority, material
  implementation boundary, hard exclusions, either an initial mutation-surface
  projection or explicit projection absence, profile, proof, stop conditions,
  authorization state;
- Executor -> Author: any reported projection variance with its changed surface,
  observable causal justification, resulting state, or any missing/conflicting
  authority blocker;
- Author -> Validator: reconciled resulting state and proof boundary when a
  projection variance required semantic reconciliation;
- Executor -> Validator: implementation claim and observable resulting state
  when no projection variance remains unreconciled;
- Validator -> Auditor: deterministic results, state binding, limitations;
- Auditor -> Custodian/Operator: verdict, findings, evidence, limitations,
  closure predicates;
- Custodian -> Operator: verified disposition package.

## 10. Exceptions

A role-boundary exception states:

- exact role and operation;
- why the normal separation cannot satisfy the approved outcome;
- exact additional authority;
- affected scope;
- risk;
- rejected simpler alternatives;
- duration;
- Operator authorization;
- required independent evidence or review.

An exception is not a permanent role expansion unless the Project Operating
Profile is explicitly changed.
