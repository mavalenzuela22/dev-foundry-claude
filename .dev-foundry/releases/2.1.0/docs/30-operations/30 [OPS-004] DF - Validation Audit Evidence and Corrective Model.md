---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-004
  type: OPS
  title: Validation, Audit, Evidence, and Corrective Model
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - mechanical-validation-semantics
    - governance-audit-semantics
    - audit-trigger-model
    - audit-finding-freeze
    - corrective-review-convergence
    - evidence-semantics
    - verdict-model
  appliesTo:
    artifactTypes:
      - TSK
      - MTP
      - AUDIT
      - CLOSURE
  excludes:
    - product-specific-test-commands
    - runtime-evidence-file-formats
    - provider-specific-auditing
authority:
  governedBy:
    - OPS-001
    - OPS-003
    - OPS-007
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-004] DF - Validation, Audit, Evidence, and Corrective Model

## 1. Purpose

Separate deterministic proof, semantic judgment, evidence, corrective work, and
Operator decisions so that a passing tool result cannot silently become product
or lifecycle authority.

## 2. Distinct outcomes

These outcomes are distinct:

- implementation completion;
- mechanical validation;
- governance metadata validation;
- Governance Author self-assessment;
- Governance Audit when triggered;
- evidence custody;
- Operator acceptance;
- persistence/publication/promotion;
- closure.

One outcome does not imply the next.

## 3. Mechanical validation

Mechanical validation evaluates only observable or deterministically decidable
facts against a declared boundary and bound state.

Validation depth is proportional to the acceptance and risk boundary. Focused
proof SHOULD be reused while its state binding and applicability remain valid.

Canonical validation outcomes are:

- `VALIDATION PASS` — complete required deterministic proof holds;
- `VALIDATION FAIL` — complete proof establishes nonconformance of the
  delivered governed state or product boundary;
- `VALIDATION ERROR` — validator, harness, command, cleanup, or evidence
  mechanism malfunctioned;
- `VALIDATION BLOCKED` — a required precondition prevents a valid verdict;
- `VALIDATION INCOMPLETE` — available evidence cannot establish complete proof.

A command failure, harness failure, environment failure, unavailable dependency,
port conflict, stale fixture, transport error, or validator defect MUST NOT be
converted into a product or governance corrective unless evidence establishes
that the delivered boundary caused the nonconformance.

Focused checks run by an Implementation Executor while its mutation authority
remains open are executor self-verification, not governed mechanical validation.
They may support the implementation claim, but they do not create governed
validation evidence and do not satisfy an independent validation gate.

After executor mutation authority closes, governed validation independently
executes or re-executes the authoritative proof against the resulting bound
state. When OPS-008 requires projection reconciliation, that reconciliation
precedes reliance on the variance as authorized delivered state.

## 4. Governance metadata validation

Metadata validation may deterministically verify:

- frontmatter presence and parseability;
- schema version;
- identity/type/title/status consistency;
- required fields;
- declared references;
- stable section IDs;
- lifecycle and portability value sets;
- inventory equality when a complete baseline is declared.

Metadata validation does not infer semantic ownership, necessity, correct
authority, or body truthfulness. DAT-008 and OPS-006 own the metadata rules.

## 5. Governance Author self-assessment

Before a candidate boundary is handed to a required independent audit, the
Governance Author reviews the complete candidate for material defects,
including:

- missing or contradictory authority;
- duplicated authoritative homes;
- broken taxonomy or metadata contracts;
- provider/product/runtime contamination;
- stale terminology or lifecycle state;
- role/profile contradictions;
- unnecessary ceremony or structure;
- audit/corrective non-convergence;
- version/adoption contradictions;
- self-containment gaps.

Known material defects inside the authorized boundary are corrected before
handoff when possible.

Self-assessment is not an independent audit.

## 6. Audit triggers

Independent Governance Audit is triggered, not universal.

It is mandatory only when at least one applies:

- the selected framework version requires it for the boundary;
- project authority, a TSK, ADR, decision, or approved risk policy requires it;
- separation of duties materially requires an independent actor;
- the Operator explicitly requires it.

Historical habit, artifact count, tool availability, or desire for extra
assurance does not silently create an independent-audit gate.

## 7. Fresh Governance Audit

A fresh audit is read-only through verdict formation.

The auditor reviews the complete declared observable boundary before issuing
`AUDIT FAIL`, unless missing authority, evidence, observability, or required
independence requires `AUDIT BLOCKED`.

Allowed verdicts are:

- `AUDIT PASS`;
- `AUDIT FAIL`;
- `AUDIT BLOCKED`.

Discovering the first defect does not end discovery.

A blocking finding includes:

- stable finding ID;
- violated authority;
- observed defect and evidence;
- affected boundary;
- explicit closure predicates;
- proof required for closure;
- regression boundary that must remain valid.

Preference, optional cleanup, stylistic disagreement, and unrequired hardening
are not blocking findings.

On FAIL, the complete materially blocking finding set observable within the
declared boundary is frozen.

## 8. Corrective review and convergence

Corrective work addresses only frozen findings plus the smallest directly
necessary consistency and regression effects.

Corrective review continues the same frozen audit lineage. It verifies:

- named closure predicates;
- directly affected boundaries;
- regressions introduced by the corrective delta;
- permitted late material exceptions.

It does not restart unrestricted discovery or require a new auditor, provider,
model, platform session, or tool merely for ceremony.

A new independent audit is required only when an explicit re-audit trigger
applies, such as:

- material corrective scope expansion;
- material authority change;
- invalidated original audit premise;
- applicable risk/separation rule;
- explicit Operator decision.

Repeated scope expansion or repeated late material exceptions require replanning
rather than indefinite author/auditor cycling.

A corrective execution is required when the governed product or repository state
still needs mutation to satisfy applicable authority or acceptance. It is not
required merely because the Governance Author's initial mutation-surface
projection was incomplete when the executor has already produced the correct,
materially authorized, minimal delta and OPS-008 reconciliation confirms that
the projection variance crossed no hard exclusion.

Harness, validator, command, environment, fixture, transport, or evidence
mechanism defects remain validation errors or blockages unless evidence
establishes delivered-state nonconformance; they do not become product
correctives merely to keep a lifecycle moving.

## 9. Evidence

Evidence proves what occurred; it does not define methodology or product
requirements.

Governed evidence SHOULD distinguish:

- authority used;
- observed state;
- implementation claims;
- mechanical results;
- semantic audit findings;
- Operator decisions;
- material reuse;
- deliberate exclusions;
- known limits and deferred work.

Products may choose their own evidence storage, filenames, envelopes, hashes,
request identifiers, or runtime formats unless a framework contract explicitly
standardizes one.

Missing, contradictory, indeterminate, or unverifiable required evidence MUST
NOT be converted to PASS.

## 10. Audit and closure relationship

Audit PASS does not authorize publication, promotion, adoption, or closure.

CLOSURE requires applicable acceptance and evidence plus the Operator decision
or other authority required by the Project Operating Profile.

An AUDIT artifact records evaluation. A CLOSURE artifact records terminal
disposition. Neither becomes product authority merely by existing.
