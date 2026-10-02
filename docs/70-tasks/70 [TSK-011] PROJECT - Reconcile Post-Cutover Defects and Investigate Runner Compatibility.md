---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-011
  type: TSK
  title: Reconcile Post-Cutover Defects and Investigate Runner Compatibility
  status: COMPLETE
artifactVersion: "1"
authorityScope: tsk-011-post-cutover-reconciliation
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-post-cutover-reconciliation
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - mature-runner-modification
    - runner-wrapping-or-compatibility-layer
    - cross-surface-protocol
    - resolver-behavior-change
    - methodology-change
    - model-selection
    - hooks
    - skills
    - agent-teams
    - new-subagents
    - framework-version-change
    - public-or-remote-telemetry
    - provider-authentication
    - provider-routing
authority:
  governedBy:
    - ARC-001
    - SPC-001
    - SPC-004
    - OPS-003
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-009
    - TSK-010
lifecycle:
  phase: complete
  dependsOn:
    - TSK-009
    - TSK-010
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-011] dev-foundry-claude - Reconcile Post-Cutover Defects and Investigate Runner Compatibility

## 1. Purpose and necessity

Correct three defects observed after the TSK-009 cutover and TSK-010 launcher
work, and define one bounded, evidence-driven comparison of the Claude-native
resolver against the mature ChatGPT-side runner.

Necessity (OPS-007): each item below is an observed defect or an observed
discrepancy, not symmetry or hardening. Nothing here is justified by imagined
scale.

The mature runner is the established compatibility baseline for DEV FOUNDRY
runtime semantics and is outside this project. This task does not modify,
redesign, wrap, or replace it, creates no intermediate synchronization layer,
no shared abstraction and no cross-surface protocol, and does not change
methodology to accommodate Claude-specific behavior. Where an equivalent
governed capability exists in the runner, `dev-foundry-claude` converges on the
runner's established behavior unless repository or canonical DEV FOUNDRY
authority explicitly supersedes it.

The runner is not available to this project. Its behavior is not guessed. It is
external compatibility evidence supplied only by the Operator (section 6).

## 2. Observed baseline

Verified from repository state at authoring time:

- repository `dev-foundry-claude`, branch base `main`, HEAD
  `87a03e78e23b432c8c074bd4315e1a277fda2638`, clean working tree;
- Claude-native POP/Bootstrap bindings active (SPC-002); governance MCP callable;
- `test/bootstrap/claude-telemetry.test.js:222` builds the MCP child environment
  from `{ ...process.env }`.

The post-cutover ChatGPT runner inspection was intentional and read-only. It did
not act as an active Implementation Executor or Mechanical Validator and is not
evidence of a stale binding.

## 3. Defects

### D1 - Launcher-inherited environment breaks the test suite

Reproduced: running `npm test` with only `DEV_FOUNDRY_CLAUDE_LAUNCH_MODE=direct`
in the environment yields 61/62 passing; failing test 43, `MCP markers follow
successful resolution only and preserve exact results when
disabled/enabled/failing`.

Cause (observed): the MCP child inherits the launcher's mode through
`process.env`; since TSK-010 the marker writer adds the closed `launchMode`
field, so the test's exact marker `deepEqual` fails. The same inheritance path
applies to every other launcher-exported variable (`DEV_FOUNDRY_TELEMETRY_*`,
`OTEL_*`, `CLAUDE_CODE_ENABLE_TELEMETRY` and the other telemetry flags set by
`buildTelemetryEnvironment`).

Correction: the test helper that starts the MCP child SHALL derive its base
environment from `process.env` with the launcher-owned variables removed, so
results are independent of whether the suite runs inside or outside the
launcher. Test intent and assertions are otherwise unchanged. Production code is
not changed: the launcher legitimately exports these variables.

### D2 - `.claude/settings.local.json` ignore is not repo-owned

TSK-010 section 7.1 tolerates `.claude/settings.local.json` only when Git ignores
it, and its known limit records that the ignore comes from the Operator's global
Git ignore. Operator decision: the ignore becomes repo-owned for exactly that
file.

Correction:

- `.gitignore` gains exactly the entry `.claude/settings.local.json`; neither
  `.claude/**` nor any other `.claude` entry is ignored;
- the one existing tolerance assertion in
  `test/bootstrap/claude-cutover-readiness.test.js` is strengthened so the
  tolerance holds only when the repository's own `.gitignore` ignores the file,
  independent of any global or user-level ignore (`core.excludesFile` neutralized
  and the reported source required to be the repository `.gitignore`), and
  `.claude/settings.json` and `.claude/agents/*` are not ignored by it;
- no other assertion in that file changes.

TSK-010 is COMPLETE and is not edited; this task supersedes its recorded known
limit.

### D3 - Stale overview, documentation map, and README

- `OVR-001` still describes TSK-008 as the current boundary, lists TSK-009
  cutover consequences as non-goals/pending in places, and does not state TSK-010
  or this task.
- `OVR-002` section 5 lists authority through TSK-009 and states that no follow-on
  product TSK is active.
- `README.md` is a single heading.

Correction: reconcile these three documents to the repository state after this
task, without adding authority. The README SHALL be minimal and non-authoritative:
purpose in one sentence, where authority lives (Authority Index, OVR-001),
how to run the tests, how to start a session through the canonical launcher
(`scripts/telemetry/run-claude.sh`), and that `CLAUDE.md`, summaries and
runtime records are not authority. No methodology, runtime design, or secrets
are copied into it.

## 4. Roles and operation split

- Governance Author (`claude-main-agent`): this task, the Authority Index route,
  the compatibility vectors, and - after validated implementation - the D3
  document reconciliation and completion result. Documents are governance
  artifacts; they are not delegated to the Executor.
- Implementation Executor (`dev-foundry-executor`): section 5 surface only,
  dispatched explicitly after `implement` resolution with `taskId` TSK-011.
- Mechanical Validator (`claude-code-native-validation`): section 8.
- Evidence Custodian (`claude-main-agent`): separate bounded operation for
  evidence, promotion and reconciliation.

## 5. Implementation surface (Executor)

The Implementation Executor may change exactly:

- `.gitignore` (add only `.claude/settings.local.json`);
- `test/bootstrap/claude-telemetry.test.js` (hermetic MCP child environment);
- `test/bootstrap/claude-cutover-readiness.test.js` (the one tolerance assertion).

Hard exclusions: no change to `src/**`, `scripts/**`, the resolver, `server.js`,
the sanitizer, collector, subagent definitions, POP, Platform Bootstrap,
`package.json`, dependencies, `.mcp.json`, `CLAUDE.md`, any `docs/**` or
`.dev-foundry/**` file; no Claude, DIAL, CodeMie, or model invocation; no commit,
push, PR, or merge by the Executor.

Governance Author surface after validated implementation: this TSK,
`docs/00-overview/00 [OVR-001]`, `docs/00-overview/00 [OVR-002]`, `README.md`,
`.dev-foundry/authority-index.yaml` (route plus version only).

## 6. Compatibility investigation

Scope: record, for exactly the vectors below, the Claude-native result and the
Operator-supplied runner result, and classify any divergence. Semantic agreement
matters more than byte-identical shape: payload field names and error-code
spelling (for example Claude `AUTHORITY_INVALID` versus runner
`GOVERNANCE_RESOLUTION_AUTHORITY_INVALID`) are compared only as to failure
classification, not as strings.

Compared semantic dimensions for every vector:

1. whether the operation is resolvable;
2. selected governed role;
3. Actor Profile;
4. Capability Profile requirements;
5. applicable authority / boundary;
6. stale-context handling;
7. lifecycle / gate requirements;
8. failure classification (and which authority reference the failure names).

The earlier observation (Claude resolved `inspect` for boundary
`post-cutover-reconciliation` as `governance-author`; the runner rejected a
"conceptually similar" inspection with `GOVERNANCE_RESOLUTION_AUTHORITY_INVALID`)
is not classified as a defect of either side: the request vectors may not have
been identical.

### 6.1 Vector V1 (original taskless request; not expressible in the runner)

- Repository preconditions: `dev-foundry-claude`, `main` at
  `87a03e78e23b432c8c074bd4315e1a277fda2638`, clean working tree.
- Request: `inspect`, `targetProject` `dev-foundry-claude`, `boundaryId`
  `post-cutover-reconciliation`, no `taskId`, no `requestedRole`.
- Claude-native result (observed on an exact `main` snapshot): resolvable; role
  `governance-author`; Actor Profile
  `.dev-foundry/releases/2.1.0/actor-profiles/governance-author-v3.yaml`; no
  Capability Profiles; assessments `[boundary_state]`; gates
  `[authority_resolved]`; 10 authority entries.
- Runner: Operator reports that the runner's resolver schema requires `taskId`,
  so this request cannot be expressed. Claude acceptance is authorized by SPC-001
  sections 3 and 6 (taskless `inspect` with `boundaryId`). This is a
  request-shape difference, recorded and not treated as a defect.

### 6.2 Vector V1r (runner-expressible; Operator-supplied result recorded)

- Preconditions as V1.
- Request: `inspect`, `targetProject` `dev-foundry-claude`, `taskId` `TSK-010`,
  `boundaryId` `post-cutover-reconciliation`; and the same request with
  `requestedRole` `governance-author`.
- Claude-native result (observed, `main@87a03e7` snapshot): both resolvable; role
  `governance-author`; same Actor Profile; no Capability Profiles; assessments
  `[boundary_state]`; gates `[authority_resolved]`; 20 authority entries
  (including TSK-010 and its routed chain ADR-001, ARC-001, SPC-003, SPC-004,
  OPS-001..005, 007..009, framework and project OVR-001, framework OVR-002).
- Runner result (Operator-supplied, external, non-authoritative): both requests
  returned exactly `{"ok":false,"errorCode":"GOVERNANCE_RESOLUTION_AUTHORITY_INVALID","message":"Governed authority is invalid or ambiguous."}`,
  naming no authority artifact, route, role, or profile.
- Dimension comparison: resolvable - **diverges**; role, Actor Profile,
  Capability Profiles, applicable authority, stale-context handling, gate
  requirements - not comparable (runner returned none); failure classification -
  runner `AUTHORITY_INVALID` class, Claude none. Disposition per 6.6: divergence
  confirmed on this vector, cause not localized, defect candidate in the
  Claude-native implementation first.

### 6.3 Localizing vectors (needs Operator-supplied runner results)

Same preconditions and `targetProject`; `requestedAction` `inspect`; no
`boundaryId`, no `requestedRole`:

- R1: `taskId` `TSK-010`. Claude: resolvable, `governance-author`, 20 entries.
- R2: `taskId` `TSK-001`. Claude: resolvable, `governance-author`, 15 entries.

Operator-supplied results (external, non-authoritative): R1 was observed against
`main@87a03e78e23b432c8c074bd4315e1a277fda2638`, clean, and returned
`GOVERNANCE_RESOLUTION_AUTHORITY_INVALID` ("Governed authority is invalid or
ambiguous."), naming no artifact or route: **R1 = FAIL**. R2 could not be
observed on the clean baseline because the runner's process-bound view showed
the modified TSK-011 task branch. R1/R2 on that dirty tree both failed
identically but are not baseline evidence. R2 remains `open`; it does not block
D1-D3 and the branch is not disturbed to obtain it.

Pre-registered reading: R1 fails and R2 passes - the failure follows the TSK-010
authority chain, not the boundary; R1 passes - the failure follows the
`taskId` + `boundaryId` combination; both fail - the failure is repository-wide
authority state. No cause is asserted before the results exist.

### 6.4 Claude-side authority conformance review

Independent of runner results, the Governance Author reviews the Claude resolver
against SPC-001, DAT-001, DAT-008 and DAT-020 for authority that the runner could
legitimately reject. One observed candidate, a hypothesis and not a finding: the
resolved set contains two artifacts with id `OVR-001` (framework and project;
`OVR-002` shares the same pattern), while DAT-008 requires artifact `id` to be
"unique in the governed project corpus", and the resolver disambiguates them by
scope (`project:`/`framework:` key, project-first lookup). The review records
whether the resolver tolerance is authorized by repository or canonical
authority, and whether R1/R2 evidence is consistent with it. It changes no
file other than the completion record.

### 6.5 Out of scope

No other vector is authorized. Stale-fingerprint handling, `implement` and
`promote` semantics, and non-`governance-author` roles are not compared unless
V1r/R1/R2 evidence names them as the cause of a divergence and the Operator
authorizes a further vector.

### 6.6 Disposition rules

- Operator-supplied runner output is external, non-authoritative evidence. It is
  recorded in the completion result with its provenance and is never copied into
  SoT as authority.
- Agreement on all eight dimensions: record "no divergence for the tested
  vectors"; no change.
- Divergence on any dimension: record it as a defect candidate in the
  Claude-native implementation first. The runner is not assumed wrong and is
  never changed. This task does not change resolver behavior, SPC-001 or
  DAT-001; any correction is a separate TSK with its own authority.
- Divergence caused by non-identical request shape: record the corrected vector
  and re-compare only that vector.
- No runner behavior is inferred where no runner result is supplied. Missing
  runner evidence leaves the investigation `open`, not `passed`.

## 7. Audit-trigger disposition

The active POP has `audit_triggers: []` and no framework-required trigger
applies: no methodology, POP, Platform Bootstrap, binding, resolver
authority/behavior, sanitizer, collector, security, or dependency change; the
Authority Index change adds this task's route and a version bump only, as for
every prior task. No independent Governance Audit is required. If the
investigation yields a resolver-behavior correction, that follow-on boundary
re-evaluates the trigger itself.

## 8. Mechanical validation

1. D1: `npm test` passes with the environment clean, and again with a
   launcher-equivalent environment for each of `direct`, `dial`, `codemie`:
   `DEV_FOUNDRY_CLAUDE_LAUNCH_MODE=<mode>` plus the `DEV_FOUNDRY_TELEMETRY_*`,
   `OTEL_*` and `CLAUDE_CODE_ENABLE_TELEMETRY` values that
   `buildTelemetryEnvironment` produces. No Claude, DIAL, CodeMie, or model
   process is started.
2. D2: with `core.excludesFile` neutralized, `git check-ignore -v
   .claude/settings.local.json` reports the repository `.gitignore`; `git
   check-ignore` does not match `.claude/settings.json`, `.claude/agents/*.md`,
   or `.claude/anything-else`; `git diff` of `.gitignore` is exactly one added
   line.
3. D3: OVR-001, OVR-002 and README are consistent with the Authority Index and
   TSK-001 through TSK-011; no authority is created; Authority Index validates
   through a successful `resolve_governed_operation`.
4. `npm ci`, `npm test`, `git diff --check`, and exact change-set validation
   against sections 5 and 4 (Executor surface plus Governance Author surface, no
   other path).
5. Investigation: V1 request and Claude result recorded; runner result recorded
   as supplied, or the item explicitly `open`.

## 9. Completion

TSK-011 is complete when D1, D2 and D3 pass section 8, semantic self-assessment
is PASS, the investigation is either closed with a recorded disposition under
section 6.6 or explicitly `open` awaiting Operator-supplied runner evidence
(an `open` investigation does not block D1-D3 completion), evidence is recorded,
the exact candidate is promoted to `main`, reconciliation confirms a clean
`main`, and the task branch is cleaned up.

## 10. Known limits and evolution triggers

- The investigation cannot establish runner behavior without Operator-supplied
  observations; it will not reach a verdict from the Claude side alone.
- A confirmed divergence triggers a separate resolver-correction TSK; it is not
  pre-authorized here.
- Bundling: D1-D3 and the investigation are kept in one task because they are
  one post-cutover reconciliation boundary and the investigation delivers only
  recorded evidence. If the Operator prefers, the investigation (section 6) is
  the smallest unit to split into its own task without changing D1-D3.

## 11. Execution record

### 11.1 Implementation and validation

The Implementation Executor (`dev-foundry-executor`, resolved as
`implementation-executor` with `DFC-IMPLEMENTATION-EXECUTOR-CLAUDE-CODE-V2`)
changed exactly `.gitignore` (one added line), `test/bootstrap/claude-telemetry.test.js`
and `test/bootstrap/claude-cutover-readiness.test.js`. A first dispatch stopped
with `STALE_CONTEXT` and changed nothing: the Governance Author handoff
fingerprint had been computed without `requestedRole`, which is part of the
fingerprint input; authority files were unchanged. It was re-dispatched with the
correct fingerprint.

One projection variance, reconciled as inside the same material boundary under
OPS-007: the strengthened ignore assertion runs unconditionally instead of only
when `settings.local.json` exists, because a conditional form passes vacuously on
a clean checkout; `spawnSync` was added to the existing `child_process` import.
No hard exclusion is crossed and no assertion other than the tolerance check
changed.

Native mechanical validation (`mechanical-validator`, run by the Governance
Author's session independently of the Executor's self-checks): `npm ci` clean;
`npm test` 62/62 in a clean environment and 62/62 with a launcher-equivalent
environment (generated by `buildTelemetryEnvironment`) for each of `direct`,
`dial`, `codemie`; baseline reproduced before the change (61/62, test 43);
`git diff --check` clean; `.gitignore` diff is exactly +1/-0; with
`core.excludesFile` neutralized `.claude/settings.local.json` is ignored by the
repository `.gitignore` while `.claude/settings.json`,
`.claude/agents/dev-foundry-executor.md` and `.claude/other.json` are not, and
the baseline `.gitignore` does not ignore it (the assertion would fail). No
Claude, DIAL, CodeMie or model process was invoked.

### 11.2 D3

`OVR-001` (sections 4 and 5), `OVR-002` (sections 4 and 5, duplicated role lines
removed) and `README.md` were reconciled to repository state without adding
authority. `OVR-001`/`OVR-002` artifact versions are `2.1.0-local.18`.

### 11.3 Claude-side conformance review (section 6.4)

Reviewed against SPC-001, DAT-001, DAT-008 and DAT-020:

- Mechanical check of the project and framework Authority Indexes: exact
  top-level and route field sets, no duplicate route IDs, no duplicate governed
  concern within or across the two indexes, conforming `bindings` and `rules`.
  Both conform to DAT-020.
- All tested requests are authorized by SPC-001: taskless `inspect` with only
  `boundaryId` (sections 3, 6), both identifiers together, and a COMPLETE task
  resolved as historical state (section 5). Role selection follows section 7.
- Resolver strictness differences from DAT-020, neither triggered by this
  repository: route `authority_class` `historical` is allowed by DAT-020 but makes
  the Claude resolver return `AUTHORITY_INVALID` for the whole index, and
  `profile` is accepted on routes although DAT-020 does not list it.
- Same-ID pair: the resolved set contains project and framework artifacts with
  ids `OVR-001` (and `OVR-002` is routed in both scopes). DAT-008 requires an
  artifact `id` unique in "the governed project corpus"; neither DAT-008, DAT-020,
  OPS-005 nor SPC-001 states whether the adopted release copy belongs to that
  corpus. The resolver disambiguates by scope. Repository and canonical
  authority are silent, so this is neither confirmed as authorized nor as a
  defect.
- Competing hypothesis for R1: before TSK-009 the POP bound every role to
  `chatgpt-project` platforms; it now binds `claude-code`. A runner could reject
  a post-cutover repository on that basis alone, which would make the divergence
  expected. Untested.

Pre-cutover Claude baselines on exact snapshots: `5f0e182` and `2e8eea9` resolve
`inspect` for `TSK-001`, `TSK-008` (and `TSK-009` from `2e8eea9`) as
`governance-author`.

### 11.4 Investigation status

`open`. V1r and R1 diverge (runner `AUTHORITY_INVALID`, Claude resolvable); the
review establishes no Claude-side defect and changes no resolver behavior. Cause
is not localized. Optional Operator-run vectors (none block completion), all
`inspect` with `taskId`, no `boundaryId`/`requestedRole`, clean checkout,
`targetProject` `dev-foundry-claude`:

- R2: `TSK-001` at `main@87a03e7` (Claude: resolvable, 15 entries);
- R3: `TSK-008` at `5f0e182`, pre-cutover (Claude: resolvable, 22 entries);
- R4: `TSK-008` at `8b1aad3`, post-cutover before TSK-010 (Claude: resolvable, 22
  entries).

R3 pass with R4 fail points at the cutover binding change; both pass points at
TSK-010-specific state; R3 fail points at a pre-cutover cause.

## 12. Completion result

Operator authorized promotion with the compatibility investigation explicitly
left open.

Governance Author semantic self-assessment is PASS:

- D1: the suite is hermetic with respect to launcher-owned environment; the
  fix is test-only and production code is unchanged;
- D2: exactly `.claude/settings.local.json` is ignored by the repository's own
  `.gitignore`; no broader `.claude` ignore; the tolerance assertion no longer
  depends on a global ignore and the TSK-010 known limit is retired (TSK-010 is
  unedited);
- D3: OVR-001, OVR-002 and README match repository state and add no authority;
- the mature runner is untouched, no synchronization layer, shared abstraction or
  protocol exists, no runner behavior is inferred, and no resolver, SPC, DAT,
  POP, binding, dependency or methodology file changed;
- the change set is exactly the eight authorized paths.

No independent Governance Audit is required: the POP has no audit trigger and
none applies (section 7).

Compatibility investigation: **open**. V1r and R1 are confirmed divergence
evidence (runner `GOVERNANCE_RESOLUTION_AUTHORITY_INVALID` versus Claude
resolvable), recorded as a defect candidate in the Claude-native implementation
first, cause not localized, no Claude-side defect established by the review in
11.3. R2, R3 and R4 remain optional Operator-run external observations; their
results are not inferred and they do not block this completion. Any resolver
correction, any decision on same-ID scoping, and any elevation of the
runner-convergence principle to an ADR require a separate governed task.

