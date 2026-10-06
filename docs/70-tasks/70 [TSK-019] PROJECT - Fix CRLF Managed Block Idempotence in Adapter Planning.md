---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-019
  type: TSK
  title: Fix CRLF Managed Block Idempotence in Adapter Planning
  status: CLOSED
artifactVersion: "3"
authorityScope: tsk-019-crlf-managed-block-idempotence
ownerRole: governance-author
canonical: true
scope:
  owns:
    - managed-claude-block-line-ending-idempotence
    - windows-post-prepare-replanning
    - adapter-patch-release-1.2.3
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - adapter-adoption-planner
  excludes:
    - payload-verifier-weakening
    - consumer-cutover
    - reusable-methodology-change
    - public-registry-publication
    - dashboard-behavior-change
    - telemetry-change
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - SPC-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-017
  closureArtifact: TSK-019-CLOSURE
lifecycle:
  phase: closed
  blockedBy: []
  closureArtifact: TSK-019-CLOSURE
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-019] PROJECT - Fix CRLF Managed Block Idempotence in Adapter Planning

## 1. Purpose

Fix the third Windows consumer defect discovered while dogfooding adapter adoption
against Pago Electronico after the exact 1.2.2 preparation bytes had already been
materialized and committed.

The 1.2.2 consumer state is not corrupt. Pago Electronico remains clean and
`dev-foundry-claude adopt status --root <repo>` reports `prepared`.

## 2. Exact defect

The adapter-created `CLAUDE.md` in Pago Electronico is byte-identical to the
reviewed plan output:

- current SHA-256:
  `4abc73c1ae7eea89adf9e3027edd6e5affb21515639b9aced202790cbc1ea1ff`;
- repository state:
  clean at `0321f44f9e1c7c37e681769eac8d6598f0006b28`;
- status:
  `prepared`.

A fresh 1.2.2 plan nevertheless returns exit code 2 with:

- status: `blocked`;
- blocker: `managed-block-modified`;
- message: `The managed CLAUDE.md block was modified.`.

The defect is in `src/adopt/plan.js::blockSpan()`.

Current logic adds one trailing byte to the managed span only when the byte
immediately after `BLOCK_END` is `\n`. On Windows the adapter-created block
ends with `\r\n`, so `blockSpan()` stops before both line-ending bytes while
`renderClaudeBlock()` still includes them. The planner then compares unequal
strings that represent the same unmodified managed block.

## 3. Required corrective

Release `@dev-foundry/claude-adapter` 1.2.3 with the smallest safe complete fix:

1. recognize a managed block terminator followed by either `\n` or `\r\n`;
2. preserve strict managed-block integrity for all block content;
3. do not normalize arbitrary content at verification time;
4. do not ignore edits inside the managed block;
5. add regression coverage proving both LF and CRLF blocks re-plan idempotently;
6. prove a modified managed block still fails closed;
7. advance package metadata and minimal README version guidance to 1.2.3;
8. prove the exact candidate on Windows against a machine-local clone of the
   Pago Electronico consumer baseline immediately before the 1.2.2 preparation
   commit;
9. preserve the real Pago Electronico repository unchanged and verify that a
   different adapter release against its existing 1.2.2 pin fails closed with
   `adapter-runtime-mismatch` rather than silently performing an upgrade.

## 4. Acceptance

At minimum PASS:

- producer dependency restore;
- focused LF/CRLF managed-block tests;
- full root test suite;
- dashboard typecheck/build/tests;
- package dry-run;
- `git diff --check`;
- exact 1.2.3 candidate packs and installs normally on Windows with complete
  payload-manifest integrity;
- a machine-local clone of Pago Electronico at the parent of preparation commit
  `0321f44f9e1c7c37e681769eac8d6598f0006b28` can be planned and prepared by
  1.2.3, committed locally, and then freshly replanned as `noop` with no
  blockers, `activation.overall = prepared`, and a separate cutover proposal;
- the real Pago Electronico repository remains clean at
  `0321f44f9e1c7c37e681769eac8d6598f0006b28`;
- the real prepared 1.2.2 consumer is expected to reject the 1.2.3 runtime with
  `adapter-runtime-mismatch`; that cross-release transition is an upgrade
  concern governed separately by SPC-005 and is not implemented by TSK-019.

### 4.1. Windows V028 observation

The exact candidate commit
`7a58c5aac743251a921c76958c56a949bb74f6d3` successfully packed and installed
on Windows as 1.2.3. The installed payload manifest contained 1,213 listed files
with zero missing files and zero mismatches, and `--version` returned 1.2.3.

When that runtime inspected the real Pago Electronico repository, `adopt status`
remained `prepared`, while fresh `adopt plan` correctly failed closed with
`adapter-runtime-mismatch` because the repository is pinned to the previously
prepared 1.2.2 release. The real consumer remained unchanged.

This is not a CRLF regression. It demonstrates the already-governed separation
between same-release replanning and cross-release upgrade.

### 4.2. Windows V029 same-release proof

The follow-up Windows proof used candidate
`7a58c5aac743251a921c76958c56a949bb74f6d3` and a machine-local clone of
Pago Electronico at pre-preparation baseline
`da6e9d79c6366c57c4b80adda4dc5cdbc52f2167`.

V029 passed all required gates:

- candidate package version: `1.2.3`;
- installed payload manifest: 1,213 files, 0 missing, 0 mismatched;
- first 1.2.3 adoption plan on the temporary clone: `ready`;
- exact reviewed plan applied only inside the temporary clone;
- post-preparation `adopt status`: `prepared`;
- fresh 1.2.3 replan: `noop`;
- replan blockers: 0;
- replan preparation writes: 0;
- replan activation: `prepared`;
- separate cutover proposal present;
- real Pago Electronico repository remained clean and unchanged at
  `0321f44f9e1c7c37e681769eac8d6598f0006b28`.

The governed Windows execution was
`TSK-041/windows-release-smoke-v029` /
`execution_940bec7407e1a27591125e8f6dccc021ef889ea620f8ea512bbedc5f1e529d21`
and completed PASS with post-execution validation PASS.

## 5. Hard constraints

Do not weaken payload verification, broaden write scope, alter DEV FOUNDRY 2.1.0,
perform Pago Electronico cutover, modify product code, or establish a public
distribution channel.


## 6. Terminal disposition

TSK-019 is CLOSED after producer validation PASS, exact Windows same-release
consumer proof V029 PASS, promotion/reconciliation/cleanup, and formal closure
through TSK-019-CLOSURE.

The separate cross-release `adapter-runtime-mismatch` observed when 1.2.3 is
pointed at the real Pago Electronico repository prepared with 1.2.2 remains a
deliberate fail-closed upgrade boundary and is not a defect in this corrective.
