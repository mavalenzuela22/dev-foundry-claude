---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-007
  type: OPS
  title: Minimal Sufficient Change and Sufficiency Review
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - necessity-assessment
    - reuse-assessment
    - minimal-sufficient-change
    - sufficiency-review
    - evidence-triggered-evolution
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
  excludes:
    - automatic-scope-reduction
    - product-feature-prioritization
authority:
  governedBy:
    - OPS-001
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-007] DF - Minimal Sufficient Change and Sufficiency Review

## 1. Purpose

Require every governed addition to justify why it exists and why the chosen
delta is the smallest safe complete solution.

Minimality never permits weakening required authority, security, integrity,
compatibility, evidence, or acceptance.

## 2. Necessity test

Before adding structure, determine:

1. what approved requirement, observed evidence, or necessary control makes the
   work necessary;
2. whether no change can satisfy the outcome;
3. what existing authority or behavior can be reused;
4. what platform capability or approved dependency already exists;
5. why the proposed delta is the smallest safe complete option;
6. what related work is deliberately excluded;
7. what observable trigger would justify later evolution.

Work justified only by symmetry, imagined scale, generic best practice,
aesthetic consistency, speculative extensibility, or preferred artifact counts
is invalid scope unless an applicable concrete risk or authority requires it.

## 3. Reuse order

Evaluate, proportionally:

1. no change;
2. reuse existing authority or behavior;
3. compose existing elements;
4. use standard platform capability;
5. use an already approved dependency;
6. make one local bounded change;
7. create a new abstraction, dependency, component, artifact, or lifecycle
   concept.

Skipping an earlier option requires a concrete reason proportional to the later
addition.

## 4. Artifact discipline

New SoT exists only when it owns an independently meaningful responsibility.

- OVR maps and summarizes.
- ADR records a material decision and its consequences.
- ARC defines necessary structure.
- SPC defines required behavior and acceptance.
- DAT defines necessary contracts, states, fields, invariants, and errors.
- TSK delivers one capability.
- MTP decomposes only materially distinct implementation boundaries.
- OPS defines operating policy with reusable or explicitly project-scoped value.
- AUDIT records evaluation.
- CLOSURE records terminal disposition.

Do not create documents merely to make the hierarchy look complete.

## 5. TSK/MTP sufficiency

A TSK states why the capability is needed and what remains outside scope.

An MTP exists only when decomposition is materially useful. It contains the
minimum MTs needed to preserve real authority, role, side-effect, risk,
reversibility, evidence, or validation boundaries.

No universal minimum or maximum MT count is methodology. A project may configure
a practical review threshold, but the semantic boundary remains authoritative.

## 6. Implementation sufficiency

Implementation instructions contain only what is needed for the current bounded
change.

They do not invite:

- broad repository archaeology;
- unrelated requirement discovery;
- optional cleanup;
- redesign;
- speculative abstractions;
- arbitrary test expansion;
- dependency changes not required by authority;
- future capability work.

A directly necessary consistency or regression effect discovered by focused
executor self-verification remains inside the same material implementation
boundary only when all of the following hold:

- it is causally attributable to the authorized implementation delta;
- it is directly necessary for the already-authorized outcome to be correct and
  internally coherent;
- it is the smallest sufficient correction;
- it remains inside the same capability and behavioral objective;
- it introduces no new product capability or public behavior;
- it introduces no new dependency;
- it requires no new security or integrity decision;
- it requires no new persistence, transport, infrastructure, target, or
  lifecycle decision;
- it crosses no explicit hard exclusion or protected surface;
- observable evidence identifies the directly affected relationship, such as a
  focused test, compile relationship, contract consumer, fixture, generated
  expectation, or equivalent boundary.

A mutation-surface projection is therefore not permission for adjacent cleanup,
and a projection variance is not permission to broaden the capability. If any
required effect needs new authority or crosses a hard exclusion, implementation
stops for governance resolution.

An implementation boundary fails sufficiency when a reasonable executor could
interpret it as permission to broaden the approved capability.

## 7. Validation sufficiency

Every validation reduces uncertainty relevant to acceptance, safety,
compatibility, integrity, or another explicit boundary.

Reuse valid proof when its state binding and applicability still hold. Repeat or
broaden proof only when the delta can invalidate it, a new risk is named, or
applicable authority requires fresh evidence.

## 8. Audit sufficiency

When audit applies, the auditor asks:

- Is every new artifact, rule, abstraction, dependency, test, validation, and
  compatibility path necessary?
- Was reusable authority or implementation ignored?
- Did the change implement future capability not required now?
- Can anything be removed without violating authority, safety, or acceptance?
- Are known limits and evolution triggers explicit when operationally relevant?

An unnecessary addition may be a finding even when all tests pass.

## 9. Evidence-triggered evolution

When a deliberately simple solution has a meaningful ceiling, record:

- current limit;
- accepted consequence;
- observable trigger for reconsideration;
- possible direction without implementing it prematurely.

Future capability remains outside delivered scope until the trigger is observed
and separately governed.
