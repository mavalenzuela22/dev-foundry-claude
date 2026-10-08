---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-022
  type: TSK
  title: Implement Recoverable Governed Consumer Authority Cutover
  status: CLOSED
artifactVersion: "3"
authorityScope: tsk-022-recoverable-governed-consumer-authority-cutover
ownerRole: governance-author
canonical: true
scope:
  owns:
    - verified-consumer-authority-cutover-plan
    - staged-and-recoverable-claude-activation
    - fail-closed-partial-authority-recovery
    - producer-cutover-mechanics-acceptance
  appliesTo:
    components:
      - claude-adapter-cli
      - consumer-project-bootstrap
      - claude-governance-mcp
      - migration-runtime
  excludes:
    - real-consumer-repository-mutation
    - application-product-code
    - historical-evidence-modification
    - immutable-framework-modification
    - global-install-or-release-publication
    - independent-release-reproducibility-corrective
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - ADR-007
    - SPC-002
    - SPC-005
    - SPC-007
    - SPC-008
    - OPS-001
    - OPS-002
    - OPS-004
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-021
  closureArtifact: TSK-022-CLOSURE
lifecycle:
  phase: closed
  closureArtifact: TSK-022-CLOSURE
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-022] PROJECT - Implement Recoverable Governed Consumer Authority Cutover

## 1. Operator intent and bounded objective

The Operator on 2026-10-07 explicitly authorized a new governed producer implementation to unblock the separately governed PagoElectronico TSK-041 cutover. Implement one safe and recoverable transition capability for existing foreign-runner-governed consumers moving to Claude 1.4.x, with proof in isolated fixtures and no mutations of real consumers. Do not publish or promote in this bounded implementation operation; downstream phases require separate authorization and evidence.

## 2. Verified producer facts and consumer references

Baseline: dev-foundry-claude main commit 366e03510f13c6191ef845d52a2b38e3dae045ac, DEV FOUNDRY 2.1.0. src/adopt/cutover.js produces a reviewable proposal but no authorized apply. src/adopt/activation.js detects partially installed Claude authority and returns partial. src/adopt/plan.js refuses partial-claude-binding-state. src/adopt/apply.js stages and renames managed files, but does not transact authority cutover.

Operator-reported PagoElectronico TSK-041: V058 PASS preparation, V059 FAIL when capability/bootstrap were written before POP activation, V060 PASS diagnostic; source remains runner-governed and was restored to the previous bounded state. These reports are consumer references, not producer evidence or permission to read/mutate PagoElectronico.

## 3. Required behavior

- Add an explicit deterministic cutover prepare/commit/reconcile operation (or minimal equivalent) over the entire *configured authority set*. Generate read-only exact before/after and hash-bound plan from an unchanged consumer state. A package install, setup --yes, or upgrade --yes does not authorize cutover.
- Explicitly bind operator/governed consumer approval, source and target package identities, role/capability selection, branch/HEAD, exact path manifest, clean touched paths and current active bootstrap. Do not create cross-platform authority automatically from an installed adapter.
- Stage all proposed target authority bytes **outside the active authority namespace**. No preparatory standalone Claude bootstrap/profile file may be interpreted as active or cause partial-claude-binding-state. Validate staged target as a whole before starting promotion.
- Commit the single logical transition with verifiable fault recovery (persistent intent/journal or equivalent) and durable before/after identities. Never claim filesystem-wide atomic rename of multiple independent files. On interruption, fail closed and resume/rollback without mixed authoritative roles, lost history or deleted evidence.
- Preserve the foreign active runner until the final authorized transition. After success, active POP contains only the compatible Claude-bound roles; retire the former runner bootstrap correctly, require fresh Claude start and invalidate stale sessions.
- Maintain external **read-only** observation through a Windows runner without retaining an active ChatGPT governance role in the consumer. Do not change consumer product files, historical validations, unrelated decisions or the immutable framework release.
- Refuse stale hash/branch/package, symlink/path traversal, unknown preexisting artifact, mismatched role/profile, missing consumer authorization, unresolved semantic choice, and partially applied undocumented authority.
- Make diagnostics and CLI help actionable. The installed target version must equal the exact consumer MCP pin before launch; do not silently rewrite a pin to hide release build differences.

## 4. Minimal implementation and proof boundary

Potential files: src/adopt/{cutover,activation,plan,apply,common}.js, src/consumer/{command,help}.js, bin/dev-foundry-claude.js, src/governance-mcp/session.js and focused tests under test/adopt/**. The executor must independently assess minimal necessity and declare exact paths before mutation. No new dependency, package version change or unrelated dashboard/framework mutation unless re-governed.

Mechanical acceptance includes a prepared foreign-runtime fixture, successful complete cutover, no-auth/no-write refusal, exact SHA and stale plan checks, fault injection at staging and activation boundaries, persistent recovery or rollback, unchanged foreign authority before commit, Windows newline/path behavior, rejection of partial state and verified complete target, unaffected consumer product and historical evidence, correct fresh-session behavior, relevant package tests, full regression and git diff --check. The synthetic producer fixture proves producer cutover mechanics only; the real PagoElectronico acceptance remains a separately governed TSK-041 consumer acceptance gate, not a producer TSK-022 terminal prerequisite.

## 5. Gates and exclusions

The active Governance Author authors only authority and handoff. Product implementation requires a separately selected implementation-executor bound to the runner v3 capability and a validated exact execution contract. Validation PASS, independent audit if triggered, commit, push, PR, merge, release, consumer activation, and terminal closure remain distinct. That initial implementation operation did not authorize promotion or release; the Operator separately authorized and completed TSK-022 promotion on 2026-10-07 through PR #44. The Operator subsequently explicitly authorized the producer-only TSK-022 closure before a separately governed new-version release. **This authorization does not permit real-consumer mutation or release publication as a side effect of closure.** The separate 1.4.0 public artifact mismatch (Pago candidate da37df3d vs public 0bf9949b) remains a deployment gate and must be reconciled independently.

## 6. Producer closure versus downstream release and Pago acceptance

The Operator on 2026-10-07 explicitly resolved the dependency cycle by assigning TSK-022 terminal acceptance to the **implemented and promoted producer cutover mechanics** only. The cutover product implementation is validated by the independently inspectable TSK-022 V002 309/309 mechanical PASS, governed evidence envelope `tsk022-promotion-v002`, PR #44, integration/reconciliation/cleanup and clean producer main `b411e89fa83642ea0a274c03d84f7f9ba4dccd9e`. No actual Pago consumer cutover or package publication is asserted by these facts.

A subsequent separately governed adapter release (new identity, not 1.4.0 overwrite) will distribute this promoted producer implementation. Release reproducibility, exact tarball/payload identity, GitHub asset publication, fresh installed-target verification and the known global/staged 1.4.0 identity discrepancy are **release gates**, not completed producer-cutover mechanics. A future PagoElectronico TSK-041 execution separately governs authorization, staged consumer conversion, live acceptance, startup and preservation of read-only external Windows runner observation. These are not waived and cannot be silently represented as PASS in this closure.

The source implementation proof and applicable promotion/audit dispositions remain bound to the TSK-022 lineage; any later defect discovered during real consumer dogfooding requires a new bounded corrective rather than retroactively changing this closure.

