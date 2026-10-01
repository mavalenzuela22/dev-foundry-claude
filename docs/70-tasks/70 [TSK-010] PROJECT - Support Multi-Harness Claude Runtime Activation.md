---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-010
  type: TSK
  title: Support Multi-Harness Claude Runtime Activation
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-010-multi-harness-claude-runtime-activation
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-multi-harness-runtime-activation
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - model-selection
    - hooks
    - skills
    - agent-teams
    - new-subagents
    - framework-version-change
    - public-or-remote-telemetry
    - synthetic-benchmarking
    - provider-authentication
    - provider-routing
    - codemie-or-dial-configuration
authority:
  governedBy:
    - ARC-001
    - SPC-003
    - SPC-004
    - OPS-003
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-008
    - TSK-009
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-008
    - TSK-009
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-010] dev-foundry-claude - Support Multi-Harness Claude Runtime Activation

## 1. Purpose

Correct a runtime activation gap found immediately after the TSK-009 cutover:
the canonical launcher `scripts/telemetry/claude.mjs` assumes the child
executable is always `claude <args>` and assumes loopback port 4318 is free.

This task makes the one canonical launcher support exactly three Claude Code
launch modes, selects the collector port dynamically, records the launch mode as
a closed telemetry dimension, adds one thin convenience script, and isolates
CodeMie-generated analytics from promotion.

It does not select models, change authentication or provider routing, add Hooks,
Skills, agent teams, subagents, remote telemetry, or reusable methodology.

## 2. Observed baseline

Verified from repository SoT and local state at the start of this task:

- repository `dev-foundry-claude`, branch `main`, HEAD
  `8b1aad3c0a17479c6ec0b329142181fe9d12dabc` equal to remote `main`;
- Claude-native POP/Bootstrap bindings are active as defined by SPC-002;
- `resolve_governed_operation` is callable through the project governance MCP and
  resolved the Governance Author operation for this boundary;
- one untracked generated file existed:
  `docs/codemie/analytics/codemie-analytics-876baa87-cb5e-42d1-a724-656be9f7561f.json`.

### 2.1 Generated CodeMie analytics

The file is a CodeMie per-session analytics report. Its structure contains
`meta` and `sessions` with model, token, cost, tool-call, project, branch, title
and session-source fields. It is runtime evidence, not product authority, and it
carries local/session metadata that must not enter repository history.

Installed CodeMie 0.11.0 writes this report on session exit to
`<cwd>/docs/codemie/analytics/` without accepting a destination path from the CLI
or environment. The only supported control is disabling the report
(`--no-analytics-report` or `CODEMIE_SESSION_ANALYTICS_REPORT=0`), which is
provider configuration outside this task and is not used.

Governed disposition:

- the observed file is preserved, uncommitted, under the Git-ignored
  `.dev-foundry/telemetry/local/codemie-analytics/`;
- `docs/codemie/analytics/` (only that subtree) is Git-ignored so future
  generated reports cannot dirty or enter the promoted change set;
- `docs/codemie/**` is not broadly ignored.

### 2.2 First real post-cutover telemetry observation

Inspected without synthetic workload:

- before this session's own governance resolution, `.dev-foundry/telemetry/local/`
  did not exist and contained no `otel-*.ndjson` envelope;
- the Claude process environment carried `CLAUDE_CODE_ENABLE_TELEMETRY=1`,
  `DEV_FOUNDRY_TELEMETRY_RUN_ID`, `DEV_FOUNDRY_TELEMETRY_DIR`,
  `DEV_FOUNDRY_TELEMETRY_HOST` and `DEV_FOUNDRY_TELEMETRY_PORT=4325`, but no
  `OTEL_*` exporter variables;
- no listener existed on port 4325; port 4318 was held by an unrelated local
  process (`node dist/src/dashboard.js`), which is the collision the dynamic-port
  requirement removes;
- the resolver operation marker for this session was written, proving the
  marker path functions; no OTLP signal arrived.

Recorded fact: **no real Claude Code OTLP telemetry from the first DIAL session
arrived.** The evidence supports only that the OTLP exporter variables were
absent from the Claude process and that the collector was not listening on the
configured port. It does not establish whether DIAL strips environment from its
harness, because the session was started by a standalone, not canonical,
launcher. The canonical launcher passes the complete telemetry environment to
its child, so no DIAL-specific propagation workaround is authorized. Whether
`dial run` forwards that environment to Claude Code is verified by the next real
session started through the launcher and reconciled afterward; it is not
fabricated here.

## 3. Roles and operation split

- Governance Author (`claude-main-agent`): this task, SPC-004 amendment,
  Authority Index route. It does not implement product changes.
- Implementation Executor (`dev-foundry-executor`): the implementation surface in
  section 7 only, dispatched explicitly after `implement` role resolution.
- Mechanical Validator (`claude-code-native-validation`): `npm ci`, `npm test`,
  `git diff --check`, and change-set validation.
- Evidence Custodian (`claude-main-agent`): separate bounded operation for
  evidence, promotion and reconciliation.

The active POP has no audit trigger and this task does not touch methodology,
bindings, or resolver authority. No independent Governance Audit is required.

## 4. Launcher contract

`scripts/telemetry/claude.mjs` remains the single launcher implementation:

```
node scripts/telemetry/claude.mjs --runtime <direct|dial|codemie> -- <claude args>
```

Launch-plan construction is deterministic and spawns nothing:

| runtime | executable | args |
| --- | --- | --- |
| `direct` | `claude` | `<claude args>` |
| `dial` | `dial` | `run --harness claude-code -- <claude args>` |
| `codemie` | `codemie-claude` | `-- <claude args>` |

Rules:

- exactly one `--runtime <name>` before a mandatory `--`;
- unknown runtime, missing/duplicate/unknown launcher option, or missing `--`
  fails closed with a generic error and starts no collector and no child;
- arguments after the first `--` are passed as argv entries unchanged and in
  order (an empty list is permitted);
- parsing and plan construction live in an importable module so they are tested
  without invoking Claude, DIAL, CodeMie, or any model.

Runtime behavior is the SPC-004 launcher boundary: repository root as cwd,
inherited stdio, forwarded SIGINT/SIGTERM, child exit status preserved, collector
closed afterwards. The launcher never submits a prompt, selects a model, changes
authentication, alters DIAL/CodeMie provider routing, or enables remote
telemetry.

## 5. Dynamic port

By default the launcher starts the collector with port `0` and builds the Claude
telemetry environment from the actual bound port. The explicit local override
`DEV_FOUNDRY_TELEMETRY_PORT` remains supported with its existing validation. The
collector remains bound only to `127.0.0.1`. The standalone `collector.mjs`
default is unchanged.

## 6. Launch-mode correlation

The launcher sets `DEV_FOUNDRY_CLAUDE_LAUNCH_MODE` to the selected runtime.
Closed values: `direct`, `dial`, `codemie`. Any other value is rejected by the
environment builder and omitted by the marker writer. Operation markers gain only
the optional closed `launchMode` field. No credentials, harness configuration,
prompts, commands, local paths, or authentication information are recorded.

All three modes receive the identical SPC-004 privacy policy. The sanitizer is
not changed.

## 7. Implementation surface

The Implementation Executor may change exactly:

- `scripts/telemetry/claude.mjs`;
- `src/telemetry/launch.js` (new: argument parsing, launch plan, child run);
- `src/telemetry/telemetry.js` (closed launch mode in environment and markers);
- `scripts/telemetry/run-claude.sh` (new, executable);
- `.gitignore` (add only `docs/codemie/analytics/`);
- `test/bootstrap/claude-telemetry.test.js` (reconcile launcher assertions);
- `test/bootstrap/claude-launcher.test.js` (new);
- `test/bootstrap/claude-cutover-readiness.test.js` (one assertion only, see 7.1).

### 7.1 Operator-local Claude settings tolerance

The first real post-cutover session revealed that the exact `.claude` tree
assertion fails once the Operator approves the project MCP, because Claude Code
writes `.claude/settings.local.json`. That file is Operator-local provider
mechanics (Platform Bootstrap constraint: workspace trust and project MCP
approval are Operator-side), is Git-ignored, and is never promoted. The assertion
SHALL permit exactly that one file only when Git ignores it, and SHALL continue
to reject `settings.json`, Hooks, Skills, teams, extra agents, and any other
entry. No other assertion in that file changes.

Hard exclusions: no change to the sanitizer, collector binding, resolver,
`server.js`, subagent definitions, POP, Platform Bootstrap, Authority Index,
`package.json`, dependencies, `.mcp.json`, or `CLAUDE.md`; no Claude, DIAL,
CodeMie, or model invocation; no commit, push, PR, or merge by the Executor.

## 8. Convenience script

`scripts/telemetry/run-claude.sh <direct|dial|codemie> -- <claude args>` locates
the repository root from its own path, changes to it, and `exec`s
`node scripts/telemetry/claude.mjs --runtime <mode> -- <claude args>`. It
contains no telemetry policy, authentication, provider configuration, model
selection, or collector logic, and does not validate the runtime name itself; the
Node launcher is the only validator. A smaller alternative is not adopted because
the positional form is the requested ergonomics and costs one delegating line.

## 9. Mechanical validation

Tests prove, without invoking Claude, DIAL, CodeMie, or any model:

1. `direct` plan executable and exact args;
2. `dial` plan executable and exact `run --harness claude-code --` prefix;
3. `codemie` plan executable and exact `--` prefix;
4. Claude arguments are preserved as exact argv entries;
5. unknown runtime rejects;
6. missing or malformed `--` rejects;
7. default collector launch uses an OS-selected loopback port, not 4318;
8. the actual bound port reaches `OTEL_EXPORTER_OTLP_ENDPOINT`;
9. every SPC-004 privacy flag remains enforced;
10. launch mode is restricted to the three values in environment and markers;
11. the shell script delegates and contains no duplicated policy;
12. `docs/codemie/analytics/` is Git-ignored while the rest of `docs/codemie/` is
    not, so generated analytics cannot enter the change set;
13. existing telemetry, resolver, bootstrap, and subagent tests stay green.

Then `npm ci`, `npm test`, `git diff --check`, and exact change-set validation.

## 10. Completion

TSK-010 is complete when the implementation surface passes validation, semantic
self-assessment is PASS, evidence is recorded, the exact candidate is promoted to
`main`, reconciliation confirms a clean `main`, and the task branch is cleaned up.
Actual telemetry arrival through the new launcher remains a first-use runtime
fact to verify in the next real session.
