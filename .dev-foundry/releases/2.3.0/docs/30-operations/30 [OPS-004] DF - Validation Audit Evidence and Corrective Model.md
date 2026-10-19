---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-004
  type: OPS
  title: Validation, Audit, Evidence, and Corrective Model
  status: ACTIVE
artifactVersion: "2.3.0"
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

## 5. Governance Author semantic self-assessment

The Governance Author owns the ordinary semantic sufficiency control. Before
creating a new TSK, SoT obligation, mechanism, actor, test, or review step,
the Author MUST interpret the Operator's authorized outcome and apply OPS-007:
necessity, no-change and reuse alternatives, proportionality, exact ownership,
and the smallest complete acceptance and evidence boundary.

Before handing off or closing a candidate, the Author MUST review its complete
material boundary for missing or conflicting authority, duplicated authoritative
homes, metadata/body contradictions, product/provider contamination,
unnecessary ceremony, role/authorization conflicts, traceability, coverage of
applicable security and external obligations, validation sufficiency, and
version/adoption integrity. The Author MUST correct known material defects
inside authorized scope and reuse valid state-bound proof where applicable.

This ordinary review is a **semantic self-assessment**, never an independent
audit or an AUDIT PASS. It does not replace an independent evaluation when
a specific applicable obligation requires one, or mechanical validation and
reserved Operator approval when they apply. Its sufficiency is judged against
the authorized objective, not a synthetic review checklist or extra gate.

## 6. Independent evaluation triggers

Independent Governance Audit is **not an ordinary SSDLC gate**, including for
TSK, MTP/MT, documentary or implementation correctives, ordinary SoT changes,
repository adoption, routine closure, or framework-version promotion.

An independent evaluation is required only when one of the following applies
to the exact boundary:

- an external legal, regulatory, compliance or contractual obligation requires
  independence for that specific control or assessment;
- approved project authority or an actual material risk imposes a concrete
  independent review with an identifiable purpose and scope;
- separation of duties materially requires a distinct eligible actor;
- the Operator explicitly requires an independent evaluation.

A task or project decision MUST identify the applicable source and its concrete
trigger before creating an independent-audit obligation. A TSK's existence,
artifact or corrective count, historical habit, generic desire for assurance,
framework release status, or available auditor is not a trigger. Do not insert a
replacement review ceremony under another name.

Where independence is genuinely required, determine the actual evaluator and
proof required by that source; do not automatically assign the Governance
Auditor to a third-party, security, regulatory, or contractual assessment.
Sections 7-8 apply to independently required Governance Audits and their
correctives, without expanding their triggers. Completed predecessor-version
audit evidence retains its original version-bound meaning.

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

### 7.1. Independent participation and recoverable audit lineage

For a required independent audit, the auditor MUST establish eligibility from
trustworthy evidence of actual material authoring or mutation participation in
the exact audited boundary, under OPS-003 and the applicable Actor Profile.
Role labels, shared POP implementation aliases, provider or model names, and
fresh or different sessions alone neither establish nor disprove independence.
Evidence MUST be sufficient for the actual required separation-of-duty decision;
a particular identity issuer, authenticated-principal system, registry,
service, or platform-specific attestation is not mandated. If the required
participation assessment cannot be established, the independent audit is
BLOCKED, identifying the missing evidence and affected boundary; unrelated
authorized operations are not blocked by that uncertainty.

Under the existing Auditor-to-Evidence-Custodian handoff, the completed fresh
audit is recorded durably with enough provenance to recover its exact original
subject (candidate manifest hash and applicable branch/HEAD where relevant),
authority/profile versions, auditor attribution and participation assessment,
verdict, frozen findings and closure/regression predicates, and supporting
evidence references. This is an audit record, not a new identity system or
mandatory evidence format. A blocked attempt is not represented as a completed
FAIL lineage; historical audit records and original snapshots are not rewritten
by later corrections.

For any subsequent finding closure, the verifier reobserves the corrected
state and original durable audit record, including its frozen predicates and
direct regression boundary. A lost session alone does not trigger fresh audit.
If essential original independent-audit lineage cannot be established, closure
cannot be claimed from that lineage; the required independent audit must be
re-established where its gate still applies. Whether an independent reviewer
is needed for closure is determined under section 8, not by session continuity.

### 7.2. Documentation-only corrective boundary

The Governance Author MAY directly correct documentation or governance
artifacts within the authorized frozen finding scope, with ordinary mutation,
manifest and validation controls. A separate Implementation Executor is
required only for a genuinely distinct authorized implementation boundary,
not for ceremonial separation of documentary authoring.

When the original independent auditor froze sufficiently objective closure
predicates and required proof, the correcting Author MAY provide that proof
in the same operation. The applicable Mechanical Validator or other already
authorized evidence-verification mechanism checks observable predicates and
direct regressions against the corrected bound state; evidence custody records
the result. This is **verified finding closure**, not an independent audit,
a new semantic verdict or permission for the Author to issue AUDIT PASS.
If a predicate cannot be conclusively verified without a fresh material
semantic judgment, use the bounded independent corrective-review path in
section 8. Documentary format alone does not determine eligibility.

The original independent audit's actual verdict and frozen findings remain
unaltered. Neither a new session nor a role/bootstrap switch erases material
participation or independently establishes eligibility.

## 8. Corrective review and convergence

Corrective work addresses only frozen findings plus the smallest directly
necessary consistency and regression effects.

Corrective disposition continues the same frozen audit lineage and evaluates:

- named closure predicates and the proof the original auditor required;
- the actual corrective delta and directly affected boundaries;
- regressions introduced by the corrective delta;
- permitted late material exceptions.

There are two proportionate closure paths:

1. **Objective finding verification.** When the frozen closure conditions can
   be conclusively evaluated from observable, state-bound evidence without a
   new material semantic determination, the correcting Author supplies the
   evidence and an authorized verification mechanism checks it. Record each
   finding's closed/open status, verification source and affected snapshot.
   No second independent Governance Audit or independent corrective auditor
   is mandated solely because the original audit returned FAIL.
2. **Independent bounded corrective review.** When closure requires a new
   material semantic judgment, the original findings do not contain sufficiently
   decidable closure criteria, or applicable separation-of-duty authority
   explicitly requires independent evaluation, an eligible Governance Auditor
   reviews only those unresolved findings, the corrective delta and directly
   affected regressions. This is not an unrestricted fresh audit.

A finding MUST remain open when its predicates or required evidence are
incomplete, contradictory or indeterminate; an author assertion or fixture
expectation cannot satisfy proof. An existing required independent audit remains
a real independent audit: objective closure cannot replace the *initial*
independent verdict or retrospectively grant the correcting Author auditor
eligibility. The historical FAIL is never rewritten to PASS.

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

AUDIT PASS does not authorize publication, promotion, adoption, or closure.
Where an initial required independent audit was FAIL, its gate may be satisfied
by that completed independent audit together with demonstrably verified closure
of **all** material findings under section 8, with no unresolved material
semantic judgment or independent-review trigger. This is a recorded finding
disposition, not a fabricated replacement AUDIT PASS. Dependent gates still
require their own validation, applicable acceptance and Operator authorization;
a consuming system MUST NOT infer satisfaction merely from the historical FAIL
or an Author's closure claim.

CLOSURE requires applicable acceptance and evidence plus the Operator decision
or other authority required by the Project Operating Profile.

An AUDIT artifact records evaluation. A CLOSURE artifact records terminal
disposition. Neither becomes product authority merely by existing.
