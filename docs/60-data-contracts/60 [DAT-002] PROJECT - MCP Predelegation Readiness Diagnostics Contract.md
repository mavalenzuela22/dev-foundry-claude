---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-002
  type: DAT
  title: MCP Predelegation Readiness Diagnostics Contract
  status: ACTIVE
artifactVersion: "3"
authorityScope: claude-governance-mcp-predelegation-readiness
ownerRole: governance-author
canonical: true
scope:
  owns:
    - model-facing-predelegation-readiness-tool
    - readiness-diagnostic-serialization
    - non-authorizing-mcp-handoff-presentation
  appliesTo:
    components:
      - claude-governance-mcp
      - claude-adapter-role-workflow
    tasks:
      - TSK-027
  excludes:
    - generic-repository-or-git-operations
    - project-authority-mutation
    - implementation-dispatch
    - framework-methodology-evolution
    - consumer-or-runner-repository-mutation
authority:
  governedBy:
    - ADR-001
    - ADR-002
    - ARC-001
    - SPC-001
    - SPC-003
    - DAT-001
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 60 [DAT-002] PROJECT - MCP Predelegation Readiness Diagnostics Contract

## 1. Corrected product consumer and responsibility

TSK-027's readiness classifier is intended to help the **Claude Code main
Governance Author** determine why a task cannot be delegated, without
reconstructing authority or looping through opaque BLOCKED responses.
The **project-scoped local stdio governance MCP** is the primary
model-facing entry point; the previously added
`dev-foundry-claude readiness check --input -` CLI is an optional,
advanced diagnostic, **not** the model's required gateway and not a
justification for considering TSK-027 complete.

The single existing `resolve_governed_operation` tool and the
DAT-001 exact input, output, error and context fingerprint contracts
MUST remain unchanged. This later task establishes a distinct, narrow
read-only governance capability. ADR-001/ARC-001 permit it because
deterministic authority-bound delegation diagnostics are not equivalent
to Claude Code's generic repository/shell capabilities.

## 2. MCP capability

One additional read-only tool may be registered on the **same**
`dev-foundry-governance` MCP stdio server with exact name
`assess_predelegation_readiness`.

Minimum arguments:
- `targetProject`: required nonempty expected project identity;
- `taskId`: required normal DAT-001 task identifier;
- `expectedContextFingerprint`: optional **resolver** fingerprint,
  exactly 64 lowercase hexadecimal SHA-256;
- `observations`: optional already-observed evidence bundle using the
  existing pure `evaluateReadiness` input structure.

The JSON Schema advertised by `tools/list` must be accurate, closed
(`additionalProperties:false`) and name when Claude should use
this capability. The tool is consulted by the Governance Author
**after** operation-scoped resolver selection and **before**
delegation, not by the executor as an authorization shortcut.

This tool MAY invoke `resolveGovernedOperation` locally with
`requestedAction:'implement'` and an explicit
`requestedRole:'implementation-executor'`; it SHALL NOT
re-resolve the *same* operation in a different runner, inspect
another repository, invoke Codex/Claude, or initiate side effects.
If the target project, task, selected role or authority resolution
cannot be established, return an actionable BLOCKED diagnosis,
never READY.

## 3. Independent source binding and evidence limits

The MCP server MUST first enforce the **same packaged
consumer-mode activation and stale-session guards** as the
existing resolver. It MUST verify the target project identity,
task route and actual authority references, their SHA-256 values,
and the selected implementation role/Capability Profile through
its own current resolver; it may not accept arbitrary
`observations` as source authority.

When supplied, observed project/task/role/profile and every
directed authority reference MUST be consistent with freshly
resolved source references. A missing, extra, conflicting or stale
authority reference, mismatched task/project, or invalid/stale
expected resolver fingerprint yields BLOCKED. Verify
authorization evidence references against actual indexed sources,
rather than accepting a self-asserted `sourceBound:true` in
isolation. Input booleans alone are **not** authenticated
Operator authorization or proof of host executor availability.

External facts the local MCP cannot reliably observe (actual
Operator semantic authorization, pending/indeterminate prior
side effects, external executor availability or native host predelegation
eligibility) MUST be marked `INDETERMINATE` with precise
`reasonCodes` and `nextActions` until the owning host supplies
source-bound evidence sufficient for this *diagnostic* boundary.
A caller-supplied `READY` from the pure classifier cannot
override unverified external facts; do not synthesize missing
claims as positive evidence. A result of `READY`, if supported
after verification, means only that the **documented handoff
evidence is complete**, not that implementation is authorized.
The actual platform's governed dispatch, permission and
independence checks remain separately required.

The existing pure `src/governance-mcp/readiness.js` remains a
bounded deterministic drift/diagnostic component. It may be reused
for normalized evidence and a compact handoff once evidence
has been bound; there is no requirement to reimplement it.

## 4. Diagnostic result and hard prohibitions

The MCP returns exactly one text content item with one JSON
object carrying:
- `outcome`: `READY | BLOCKED | INDETERMINATE`;
- `reasonCodes`: ordered stable machine-oriented codes;
- `nextActions`: corresponding actionable, safe next steps;
- `contextFingerprint`: a digest or null;
- `handoff`: a source-referenced compact handoff or null;
- `nonAuthorizing: true`;
- `dispatchAllowed: false`.

Unverified evidence, missing authority/authorization, stale
binding or indeterminate prior side effects MUST NOT produce
a delegable handoff. Unknown prior effects dominate a mere
ordinary BLOCKED for no-retry safety. Even when handoff exists,
it is `readOnly`, compact (SPC-003 <8192 UTF-8 bytes),
source-hash-bound and MUST NOT copy secrets, complete authority
bodies or method text. Use exact field-specific diagnostics,
never an opaque MCP SDK validation error, accidental generic
`isError` or misleading PASS.

The new tool SHALL NOT expose generic file or Git APIs, run
a shell, mutate repository authority, run implementations,
call external runner plugins, contact networks, add an HTTP
listener, bypass consumer activation, relax subagent isolation,
or issue audit/promotion verdicts.

## 5. Acceptance and compatibility gates

Verify the actual MCP stdio transport with an MCP client:
`tools/list` advertises both names, without changing DAT-001
`resolve_governed_operation` behavior; positive resolver
fixtures still pass. Real source-bound observations must be
verified against a synthetic project, not only mocked booleans.
Prove invalid/missing arguments produce precise structured
diagnostics; wrong project/task, stale fingerprints,
unknown/inflight effects, unsupported authorization, missing
role/profile, conflicting refs and absent external proof
block or are indeterminate with **no handoff**. Preserve
session/activation guards on both tools and the existing
MCP help resources. Prove no runner/consumer/network/side
effects and no changes to unrelated repositories.
A new tool in source is not yet a shipped release or
adopted consumer capability.

Update the minimal agent-facing discovery instruction so Claude
knows the appropriate timing, without copying methodology,
bloating always-loaded context or allowing the delegated executor
to treat the tool as implementation authorization. Broad suite,
governed audit-trigger review and promotion remain separate.

## 6. Corrective: truthful diagnostic without a model deadlock (TSK-027 / MT-003-C-A001)

An indexed source path, correct source SHA-256, or caller-provided
`sourceBound:true`, `predelegation.outcome:'READY'`,
`executor.available:true`, `priorEffects:'none'` or
`contract.preflight:'READY'` is **not** independently authenticated
Operator authorization, host/git evidence, validated execution contract,
executor state, or reconciled prior side effects. Even if all such
observations are structurally internally consistent and refer to existing
authority, the local source-reading MCP does not thereby prove the
external state. It **MUST NOT return `READY` or a handoff** solely
from these model-/caller-supplied assertions. There is no implicit
"trust the caller" fast path.

For the currently available local stdio MCP transport there is no
separately authenticated Claude Code host attestation interface. Rather than
fabricating it or adding an unrelated executor framework,
return `INDETERMINATE` for only the unresolved **external** gates,
with stable distinct codes and succinct next actions identifying:
human semantic intent/authorization, actual Git/branch/HEAD, validated
execution-contract/preflight, actual executor availability and prior
execution side-effect status. In contrast, a *demonstrated contradiction*
against the freshly resolved POP, indexed task, role/profile, canonical
authority source paths and SHA-256, or provided stale resolver fingerprint
is `BLOCKED` and must identify the source conflict. An explicitly
`unknown`, `inflight` or `unreconciled` prior-effect input remains
`INDETERMINATE` and **dominates** any ordinary blocker for retry safety.
The MCP must never treat absence of evidence as an affirmative
`BLOCKED` for unrelated authoring work or as `READY` for execution.

**Actionability and non-deadlock invariant:** this tool is **advisory to
the Governance Author**, not a mandatory second permission gate on top
of the actual project-governed authorization/dispatch mechanism.
An `INDETERMINATE` from external facts means "finish checks in the
current authorized native/host workflow"; it does not prohibit the
Author from reading the directed SoT, recording evidence, writing
authorized task documents, reconciling effects or performing other safe
work. It MUST NOT command Claude to rerun this MCP repeatedly,
fabricate evidence flags, request human reauthorization for an already
source-supported authorized bound, or wait for this MCP to become READY.
Any Implementation Executor launch still requires the separately
authorized, independently verified current host/platform checks
under the adopted project authority. `dispatchAllowed` stays
`false` in every MCP response.

The MCP should resolve and report actionable *specific* missing
external gates, preferably with the current source-bound task/profile
references in safe nextAction text, without reproducing authority
bodies or inventing an attestation endpoint. No observation bundle
should be required merely to receive a useful next step. A source-only
positive check may legitimately have `INDETERMINATE` as its final
diagnostic outcome; it is not a product failure, and no unverified
handoff is emitted. Future authenticated attestation support requires
separately governed authority, not a silent change to this contract.

**Corrective proof:** real stdio tests cover source-consistent forged
authorization/executor/contract/Git/prior-effect flags (no `READY`, no
handoff), missing evidence with precise one-shot recommended actions,
stale/mismatched authority `BLOCKED`, explicit unresolved side
effects `INDETERMINATE`, and unchanged DAT-001 resolver and both
consumer guards. The tests must check that actionable next steps
allow continued safe Governance Author work without lowering any
dispatch or audit independence gate.

## 7. Consumer runtime clarification (TSK-027 diagnostic usability)

In **Claude Code consumer runtime**, Foundry Runner is not installed or
available to the model. References in this contract to independently verified
external facts mean checks performed by the owning Claude Code native/host
workflow under the consumer project's authority; they do **not** require a
Foundry Runner MCP, runner execution contract, second external MCP or manual
Operator intervention solely because the diagnostic cannot authenticate those
facts. Advisory `INDETERMINATE` must identify available native next steps and
must never prescribe an inaccessible runner or repeat identical MCP calls.
This clarification does not weaken host authorization, side-effect safety,
role separation or the existing DAT-002 wire envelope.
