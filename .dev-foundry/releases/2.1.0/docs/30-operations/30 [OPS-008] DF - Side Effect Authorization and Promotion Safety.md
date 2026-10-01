---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: OPS-008
  type: OPS
  title: Side Effect Authorization and Promotion Safety
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - side-effect-authorization
    - standing-authorization-semantics
    - promotion-gate-separation
    - state-revalidation
    - indeterminate-side-effect-handling
    - implementation-projection-reconciliation
  appliesTo:
    artifactTypes:
      - TSK
      - AUDIT
      - CLOSURE
  excludes:
    - git-provider-implementation
    - shell-command-protocol
    - repository-transaction-runtime
authority:
  governedBy:
    - OPS-001
    - OPS-003
    - OPS-004
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 30 [OPS-008] DF - Side Effect Authorization and Promotion Safety

## 1. Purpose

Define authorization semantics for mutating, persisting, publishing, promoting,
deploying, adopting, or closing governed state without prescribing a particular
Git provider, repository product, command runner, or transaction implementation.

## 2. Core rule

Capability does not grant authority.

Every side-effect boundary has an explicit authorization source. Completion of a
prior gate does not implicitly authorize a later gate.

Examples of distinct boundaries may include:

- governance mutation;
- product implementation;
- deterministic validation with side effects;
- persistence/commit;
- remote publication/push;
- review-request creation;
- merge/integration;
- deployment;
- framework promotion;
- consumer adoption;
- closure.

A project maps these abstract boundaries to the mechanisms it actually uses.

## 3. Direct authorization

An explicit Operator decision may authorize one bounded side effect or a named
set of side effects.

Authorization identifies enough invariants to distinguish the approved operation
from a materially different one, such as:

- scope or task identity;
- target project/repository/environment;
- bound state or baseline when relevant;
- allowed phases;
- prohibited phases;
- required validation/audit state;
- material exclusions.

## 4. Standing bounded authorization

A project MAY use one standing bounded authorization package to cover multiple
later phases when doing so reduces repeated ceremony without weakening control.

The package remains valid only while all bound invariants remain true.

Before each covered side effect, the acting role rechecks applicable invariants.
The package stops on:

- scope expansion;
- target change;
- unexpected bound-state change;
- unresolved conflict;
- required audit/validation not satisfied;
- new security/integrity decision;
- unsupported capability;
- indeterminate prior side effect;
- an explicitly prohibited phase.

A standing package is authorization, not evidence that a phase occurred.

## 5. Indeterminate outcomes

If a side effect may have happened but cannot be established reliably, the
state is indeterminate.

Do not blindly retry an indeterminate side effect when duplication or divergence
is possible. Reobserve or reconcile the external/current state first.

## 6. Promotion separation

Validation PASS, AUDIT PASS, persistence, publication, review approval,
integration, framework promotion, consumer adoption, and closure are separate
facts.

Projects may authorize several of them together through a valid standing
package, but the evidence and resulting state of each phase remain separately
observable.

## 7. Framework promotion

Framework-version promotion follows OPS-005.

A canonical framework release is materialized only from the exact eligible
candidate under explicit Operator authorization for that version boundary.

No product runtime or consumer can promote a framework version merely because it
can write the canonical repository.

## 8. Consumer-specific mechanics

Git commands, pull requests, branch naming, transaction services, deployment
systems, approval UIs, CI mechanics, host prompts, tunnels, and other side-effect
mechanisms belong to project/product authority.

They may implement this policy but do not define it.

## 9. Material implementation boundary and projection reconciliation

Implementation authorization distinguishes the material implementation boundary
from a mutation-surface projection.

The material implementation boundary is established by the authorized capability,
behavioral objective, side-effect authority, invariants, and hard exclusions.
The mutation-surface projection is the Governance Author's current prediction of
the concrete paths or implementation surface expected to change.

Unless applicable authority explicitly declares the projected surface to be a
hard closed mutation boundary, omission of a directly necessary path from the
projection does not by itself revoke material authority already granted for the
same capability. The projection also never expands that authority.

During implementation, an executor MAY complete a projection variance in the
same operation only when OPS-007 establishes that the additional delta is a
directly necessary, causally attributable, minimal consistency or regression
effect inside the same material implementation boundary. The executor MUST
report each such variance and its observable causal justification.

After execution, the Governance Author semantically reconciles every reported
projection variance against the material implementation boundary before the
lifecycle relies on it as authorized delivered state. The reconciliation
classifies the result as one of:

- **projection match** — observed mutation stayed inside the initial projection;
- **reconciled projection variance** — mutation exceeded the projection but was
  already materially authorized, directly necessary, minimal, and crossed no
  hard exclusion;
- **material authority violation** — mutation required authority not already
  granted, crossed a hard exclusion, or was not directly necessary to the
  authorized capability.

A reconciled projection variance is documented and the lifecycle continues to
governed validation without manufacturing a corrective solely to repair the
Author's prediction.

A material authority violation is not retroactively authorized by
reconciliation. It stops the affected lifecycle boundary and is handled under
the applicable existing category, such as unnecessary executor expansion,
missing product work, material authority expansion, or another governed stop
condition.

Hard exclusions remain hard. Without new authority, projection reconciliation
cannot permit a new capability, materially different public API or behavior,
dependency, security or integrity decision, persistence decision, transport or
infrastructure decision, target repository or environment change, protected or
prohibited-path mutation, promotion/lifecycle action, or another applicable
explicit exclusion.

These projection semantics apply only to boundaries prepared under a framework
and Actor Profile version that defines them. A boundary or durable evidence
created under an earlier adopted version retains that version's mutation-surface
meaning. Adoption of a later version does not retroactively reinterpret an
earlier authorized mutation surface as a non-binding projection; projects
reconcile later profile bindings and future boundaries explicitly under OPS-005.
