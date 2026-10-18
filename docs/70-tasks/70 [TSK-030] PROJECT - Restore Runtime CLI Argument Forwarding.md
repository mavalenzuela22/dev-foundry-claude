---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-030
  type: TSK
  title: Restore Runtime CLI Argument Forwarding
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-030-runtime-cli-argument-forwarding
ownerRole: governance-author
canonical: true
scope:
  owns:
    - runtime-cli-argument-forwarding-correctness
    - launcher-pass-through-regression-recovery
  appliesTo:
    components:
      - consumer-start-cli
      - telemetry-launcher
      - direct-dial-codemie-runtime-adapters
      - exact-cli-argument-regression-tests
  excludes:
    - mutation-of-upstream-framework-release
    - mutation-of-project-pop-or-platform-bootstrap
    - consumer-repository-or-other-project-changes
    - model-provider-authentication-or-credential-changes
    - rewriting-tsk-029-implementation-or-validation-evidence
    - new-runtimes-new-launchers-or-new-external-services
    - publication-or-promotion-without-separate-acceptance
authority:
  governedBy:
    - SPC-004
    - SPC-007
    - OPS-001
    - OPS-003
    - OPS-004
    - OPS-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-010
    - TSK-029
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# TSK-030 — Restore Runtime CLI Argument Forwarding

## Operator defect and acceptance
The Operator reported that `dev-foundry-claude start --runtime dial -- -p "esto no va a jalar"` does not recognize/forward Claude arguments; similar behavior was reported with `direct` and `codemie`. Restore correct **literal, lossless** forwarding of flags/values passed after the one user-facing `--` boundary to the selected underlying Claude runtime while preserving secure telemetry startup and process/exit handling. Distinguish CLI-wrapper argument recognition from Claude Code native flags and runtime/provider errors. A passing mock of our own current faulty argv shape is **not** enough: test against actual runtime-specific documented or locally inspected CLI semantics where available.

## Observed source facts
- Active producer POP remains DEV FOUNDRY 2.1.0 until separately adopted under TSK-029.
- `src/consumer/command.js` `optionsFor('start', argv)` preserves tokens following `--` and passes them to the packaged `runLauncher` in `src/telemetry/launch.js`.
- `buildLaunchPlan` currently maps direct => `claude <args>`, dial => `dial run --harness claude-code -- <args>`, and codemie => `codemie-claude -- <args>`. The last two mappings also appear literally in active `SPC-004` §5.1 and in launcher tests.
- Official Claude Code CLI documentation supports `claude -p "prompt"`. CodeMie CLI public command documentation demonstrates `codemie-claude -p "prompt"` with **no mandatory inserted** `--`. The installed DIAL CLI's argument contract is not yet independently verified and must **not** be guessed from an unrelated product sharing the DIAL name.
- Current tests assert that our internal plan preserves suffix arrays but do not test wrapper-level interpretation. The reported DIAL failure is not disproved by those tests.

## Minimal sufficient correction — OPS-007
1. Reproduce the argument-handling difference without launching paid Claude requests. Read only the relevant `src/consumer/command.js`, `src/telemetry/launch.js`, `test/adopt/consumer.test.js`, `test/bootstrap/claude-launcher.test.js`, and their directly necessary harness definitions. Where available, inspect **local CLI help** for DIAL and CodeMie to verify pass-through syntax; do not use interactive authentication or remote-paid prompts for diagnosis.
2. Correct existing runtime-specific argv planning **only where evidenced**. Keep the user-facing `--` separator, exact argument tokens/quoting, environment, stdio, collector lifecycle, signal forwarding, return codes, runtime selection, security limits and read-only governed project authority. No shell interpolation, rewritten prompts, extra CLI tool, hook, service, model pin or additional runtime.
3. If an existing **normative** `SPC-004` §5.1 mapping is contradicted by observed runtime semantics, Governance Author must reconcile that project authority (and only its exact affected mapping) with concrete evidence before/alongside implementation. The Code Executor does **not** independently rewrite SoT, extrapolate another runtime's semantics, or silently override a closed authority requirement.
4. Add focused end-to-end argv regression coverage for `start --runtime <direct|dial|codemie> -- -p "..." --model ...`, including whitespace/special arguments and `--` after the boundary, using existing fake spawn/runtime wrapper harness and no actual model calls. Verify that missing/invalid CLI flags fail at the correct layer with actionable diagnostics, not a misleading successful invocation. Reuse current tests and existing telemetry infrastructure. No new fixtures/tools if those are sufficient.
5. Run affected focused Node tests and `git diff --check`; reconcile actual changed paths and tested behavior under OPS-007. Do not repeat unrelated 2.3.0 adoption tests without a direct regression boundary. No independent Governance Audit solely from the existence of this defect; apply only actual triggers in current authority.

## Isolation and lineage
The change is independently bounded from TSK-029's framework/role adoption, which has its own **committed candidate checkpoint**
`310c50e59dc61a269bdbf60212f641262f64349e`. This task uses
`task/tsk-030-runtime-cli-argument-forwarding` branched from that clean
checkpoint; no active implementation was running at branch creation.
Do not reopen or overwrite C001/C002 immutable history. TSK-029 still
owns eventual producer adoption and promotion; stacking of commit ancestry
does not authorize automatic promotion of either task.
