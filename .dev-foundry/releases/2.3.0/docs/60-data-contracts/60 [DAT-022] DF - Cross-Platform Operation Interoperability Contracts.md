---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-022
  type: DAT
  title: Cross-Platform Operation Interoperability Contracts
  status: ACTIVE
artifactVersion: "2.3.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - operation-diagnostics-contract
    - operation-readiness-contract
    - operation-outcome-contract
    - capability-authorization-separation-contract
    - cross-platform-continuation-contract
    - interoperability-conformance-semantics
  appliesTo:
    artifactTypes:
      - TSK
      - AUDIT
      - CLOSURE
  excludes:
    - provider-runtime-api
    - runner-or-mcp-transport
    - centralized-platform-registry
    - product-implementation
authority:
  governedBy:
    - OPS-001
    - OPS-002
    - OPS-003
    - OPS-004
    - OPS-007
    - OPS-008
    - OPS-009
    - DAT-016
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-022] DF - Cross-Platform Operation Interoperability Contracts

## 1. Scope and precedence

DF-INTEROP-001, contract version `0.1.0-candidate`, is the candidate
interoperability contract. Its five INT sections are normative only once a
framework release adopts them. The provisional Operator baseline is input, not
independent existing methodology authority. DAT-022 owns the normative
interoperability semantics; the co-distributed machine contract encodes field
identifiers and enums and the conformance fixtures test them. A contradiction
between these artifacts blocks candidate acceptance rather than establishing
two competing authoritative interpretations.

These contracts apply to governed operations independently of provider, model,
CLI, IDE, human implementation, plugin, service or transport. No concrete
runtime protocol, central implementation registry, MCP endpoint, or particular
repository product is mandatory.

## 2. INT-001 — Structured diagnostics

A failed, blocked, rejected or indeterminate interoperability operation MUST
return a structured diagnosis with: `code` (stable nonempty identifier),
`stage` (the boundary that failed), `category` (error class), `cause`
(human-readable observable explanation), `next_action` (safe, actionable
instruction), `retry_policy` (`never | after_correction |
after_reobservation | safe_immediate`), `side_effect_status`
(`none | confirmed | indeterminate`), and `evidence` (zero or more
source/state references, including an explicit empty array when unavailable).

An unknown failure is not a fabricated implementation failure. The diagnostic
MUST distinguish invalid contract, missing capability, missing authority,
unverified identity, environment/transport failure, validation failure,
indeterminate side effect, and inconsistent repository state where observable.
Codes identify the condition and MUST NOT change merely because transport or
wording changes. Diagnostic messages MUST avoid disclosing secrets.

`safe_immediate` retry is forbidden after an indeterminate side effect.
`confirmed` describes observed side effects, not authorized success.

## 3. INT-002 — Pre-dispatch execution readiness

Before costly or mutating execution, determine critical prerequisites from the
current task, bound repository state, Actor Profile, operation authorization,
implementation identity and required capability/proof/environment.

Readiness has exactly three states:

- `READY`: required critical prerequisites were verified against the
  current operation and state; it is not authorization.
- `BLOCKED`: one or more required prerequisites are known missing,
  incompatible or forbidden. The operation MUST NOT dispatch.
- `INDETERMINATE`: current evidence cannot establish readiness or definite
  failure. The operation MUST NOT dispatch an expensive or mutating step until
  the uncertainty is reconciled or separately authorized under current rules.

Preflight MUST identify missing capabilities before dispatch when they are
knowable. A missing operation authorization independently BLOCKS dispatch
regardless of capability or readiness. Fit failure cannot be promoted to READY
by a tool's success response. Readiness records verified prerequisites,
unknowns, state binding, and diagnosis when not READY.

## 4. INT-003 — Operation outcomes

An operation result MUST independently report:
`transport` (`completed | failed | indeterminate`),
`implementation` (`not_started | completed | incomplete | failed |
indeterminate`),
`acceptance` (`not_evaluated | pass | fail | blocked | incomplete`),
`validation` (`not_run | pass | fail | error | blocked | incomplete`),
`audit` (`not_required | not_run | pass | fail | blocked`),
`side_effect_status` (`none | confirmed | indeterminate`),
and `evidence` (array of state-bound references).

A zero process exit code, completed transport, tool success envelope, or
completed implementation MUST NOT by itself imply acceptance PASS, governed
VALIDATION PASS, or AUDIT PASS. An operation claiming required implementation
PASS with no delivered implementation or demonstrable authorized no-op MUST
instead be `incomplete` or `blocked`. A validation harness/transport/
environment malfunction maps to `error` or `blocked` under OPS-004, not
product FAIL without causal evidence. A required independent audit is never
inferred from the author's self-assessment. Missing or indeterminate required
evidence prevents PASS.

An initial independent AUDIT FAIL and subsequent verified closure of frozen
findings are distinct evidence states. The original audit verdict remains FAIL;
a separately recorded finding disposition identifies the corrected snapshot,
closure predicate/proof, verification outcome, and any remaining semantic
review. A completed independent initial audit plus verified closure of all
material findings MAY satisfy the required audit gate under OPS-004; neither
the Author's claim nor the operation's transport/acceptance status may silently
convert the original audit verdict to PASS.

Side effects are recorded separately from outcome verdicts and MUST be
reconciled as required by OPS-008.

## 5. INT-004 — Capability, identity, selection and authorization

An Actor Profile defines role behavior; a Capability Profile defines
implementation-specific constraints; project role bindings define eligible role
behavior and policy; operation authority defines permitted work; operation
selection chooses one implementation for one role and boundary. These concepts
are not interchangeable.

A concrete selection MUST bind: role and Actor Profile, task/boundary identifier,
current project/framework authority references, implementation kind and
identity or sufficient operational attribution, platform when relevant,
required capabilities and supporting proof, Capability Profile when applicable,
authorized material scope and hard exclusions, and resulting state/evidence
references. The evidence needed for identity or attribution is proportional
to the actual role and independence requirement; no single identification
technology is mandated for every ordinary authorized operation.

A platform self-claim or Capability Profile MUST NOT grant role, task,
mutation, promotion, audit, or Operator authority. Required independent audit
eligibility MUST be established under OPS-003 and OPS-004 from trustworthy
evidence of actual material participation. If such evidence is insufficient,
the independent audit is BLOCKED, without converting unrelated authorized
operations into identity failures. No platform membership list, identity
issuer, or global registry is required. Capability Profiles may be reused
across tasks while actual capability/limits remain applicable. A changed TSK
alone does not demand a new profile version; material changes to the
Capability Profile's constraints do.

A single concrete implementation MAY perform different roles only in
separately resolved operations and only if OPS-003 independence and actual
participation permit it. Switching platform or session does not erase
participation or itself establish auditor independence. Hard exclusions
apply regardless of selected platform.

## 6. INT-005 — Cross-platform continuation

Continuation MUST independently reobserve: repository identity, active
framework and POP/Authority Index, bound branch/HEAD/visible and hidden changes,
the current task/boundary and its authorization, applicable Actor/Capability
Profiles, implementation attribution sufficient for the applicable operation,
previous/proposed material participation where independence is required, and
prior action/side-effect state.

An incoming platform MAY reuse evidence only after checking provenance,
authority/profile version, subject and baseline/HEAD, scope, freshness,
applicability, and independence where required. Reuse is rejected if a changed
boundary invalidates proof. Historical 2.1.0 records preserve their versioned
meaning. A new platform does not assume that an earlier tool success implies
product completion.

An indeterminate remote or local side effect MUST be reobserved/reconciled before
an operation can retry or cross a dependent lifecycle boundary. Failure to
reconcile blocks that dependent boundary. An otherwise eligible platform change
requires NO POP, Authority Index, Actor Profile, or bootstrap mutation solely to
change platform; such mutation requires a separate material authority reason.

Continuation records actual participation (not merely claimed role names),
reused versus rejected evidence, unresolved effects, and the selected next safe
operation. Provenance and state binding travel with the handoff, not as a
claim of automatic authorization.

### 6.1. Independent audit continuation projection

OPS-003 and OPS-004 govern independent-auditor eligibility, the original audit
verdict and finding freeze, documentary corrective authority, and bounded
corrective review. INT-004 and INT-005 transfer the evidence needed to apply
those rules across eligible implementations; they do not introduce an identity
provider, provenance protocol, or a second normative audit policy.

For required audit continuation, the projection retains a traceable original
audit record with its subject snapshot/manifest hash and branch/HEAD where
applicable, authority/profile versions, auditor participation assessment,
original verdict, frozen findings, closure predicates, regression scope, and
supporting evidence references. Session loss alone does not invalidate
sufficient durable evidence; missing essential original audit provenance
blocks dependent closure rather than fabricating an audit lineage.

INT-005 distinguishes two corrective dispositions under OPS-004:

- **Verified objective finding closure:** the Author may supply corrections
  and bound proof, and an authorized verification mechanism establishes the
  original objective closure predicates and direct regressions. The resulting
  finding disposition links to the original independent audit without requiring
  another independent auditor or replacing its FAIL verdict. Participation
  evidence is not newly required solely to verify an objective finding.
- **Bounded independent semantic review:** when an unresolved finding requires
  new material semantic judgment or an applicable separation rule requires it,
  the eligible reviewer reobserves current authority and the corrected
  boundary, then links that review to the original audit and frozen findings.

Neither route permits the correcting Author to issue an independent audit
verdict. All findings must be demonstrably closed before dependent audit gates
can be treated as satisfied. Missing essential lineage or independent eligibility
when actually required blocks only that dependent decision; fixture assertions
and reconstructed conversation are not substitutes.

Cross-platform selections distinguish author-permitted documentary correction
from materially separate implementation work under OPS-003 and OPS-004.
Conformance results MUST distinguish `fixture_expectation`,
`fixture_execution_result`, and `real_audit_evidence`: a hypothetical
positive fixture proves no actual actor eligibility, execution, or verdict.

## 7. Legacy and adoption boundary

Existing 2.1.0 `project-operating-profile.v2`, `platform-bootstrap.v2`,
Capability Profile v1 and Actor Profile v2 retain their precise 2.1.0 meanings;
the new scheme MUST NOT silently reinterpret or rewrite them. Under explicit
adoption of the later canonical release, a project performs bounded impact
review and migrates its active project role bindings to
`project-operating-profile.v3` and, only when needed for repository-stored
bootstrap configuration, `platform-bootstrap.v3`. Existing concrete v2
implementation identities become initial operation-selection candidates, not
exclusive membership of v3 project roles. Legacy completed boundaries and
evidence retain predecessor semantics and audit lineage.

A project cannot claim platform-switch interoperability conformance while its
active v2 single-implementation role binding still requires POP changes for
each switch. During migration, old operations may finish under their own
versioned authority; new cross-platform operations wait for valid v3 bindings.
No automatic adoption or consumer mutation follows framework release.

## 8. Mechanical conformance

The indexed `DF-INTEROP-001.yaml` provides the machine-decidable field and
enum vocabulary. The indexed `CT-001-015.yaml` contains fifteen positive or
negative scenarios with explicit expected readiness, authorization,
implementation, validation, audit, side effect, continuation or diagnostic
outcomes. A conforming implementation MUST evaluate all applicable cases using
its own platform-neutral adapter, against the current framework and bound
repository state. Missing test harness or incomplete evidence is validation
BLOCKED/INCOMPLETE/ERROR as applicable, never a passing result. A fixture's
expected value does not constitute execution evidence. If a fixture contradicts
OPS-004, OPS-007 or OPS-008, the candidate is invalid until reconciled.

## 9. Machine files, fixture interpretation and versioning

The machine contract schema identifier is
`dev-foundry.interoperability-contract.v1`. Its closed top-level shape is
`schema_version, id, status, contract_version, framework_base,
authority_owner, provider_neutral, mandatory_transport,
mandatory_platform_registry, sections, compatibility`. Each `sections`
entry uses only `title, required_fields, enums` (when applicable), and
`invariants`. Consumers reject missing or unknown required fields, unknown
enum values, duplicate section IDs and unsatisfied invariants. A new
incompatible machine shape requires a new schema identifier, not silent
reinterpretation of v1. A contract-version change preserves separate,
explicit framework-version adoption.

The conformance file schema identifier is
`dev-foundry.interoperability-conformance.v1`. Its closed top-level shape
is `schema_version, id, contract_ref, contract_version, authority_owner,
status, case_count, test_contract, cases`. Each `cases` entry has exactly
`id, title, given, expect` with stable nonempty ID/title and finite maps for
`given` and `expect`. `case_count` MUST equal the number of unique
cases, the declared INT contract version MUST agree, and all CT-001 through
CT-015 IDs MUST occur exactly once. `test_contract` contains exactly
`given, expect, semantics, oracle, passing_condition, execution_status`.

A conformance adapter uses `given` as hypothetical operation facts; it
computes its implementation's normalized result independently, then checks
EVERY `expect` key for exact equality, including arrays and booleans.
An adapter MUST reject any `expect` projection it cannot evaluate rather
than skipping it. Projection keys not understood are INCOMPLETE or BLOCKED,
not PASS. Expected values describe the normative oracle only; no fixture is
self-executing evidence. Recording runtime observations, independent
authorization/identity inputs, actual test results, state binding and
unexecuted/blocked cases is required to claim conformance.
