---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-015
  type: TSK
  title: Integrate Claude OTEL Telemetry into Local Operations Dashboard
  status: CLOSED
artifactVersion: "2"
authorityScope: tsk-015-claude-otel-dashboard-integration
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-otel-dashboard-integration
    - claude-otel-dashboard-read-model
  appliesTo:
    components:
      - dev-foundry-claude
      - local-operations-dashboard
  excludes:
    - telemetry-collector-change
    - telemetry-launcher-change
    - telemetry-enable-policy-change
    - codemie-analytics-dashboard-integration
    - synthetic-telemetry-generation
    - external-observability-backend
    - public-or-lan-listener
    - adapter-release-change
    - consumer-repository-read-or-modification
    - mature-runner-modification
    - reusable-dev-foundry-methodology
authority:
  governedBy:
    - SPC-004
    - SPC-006
    - OVR-001
    - OPS-001
    - OPS-002
    - OPS-003
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn:
    - TSK-008
    - TSK-014-CLOSURE
  closureArtifact: TSK-015-CLOSURE
lifecycle:
  phase: closed
  dependsOn:
    - TSK-008
    - TSK-014-CLOSURE
  blockedBy: []
  closureArtifact: TSK-015-CLOSURE
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-015] dev-foundry-claude - Integrate Claude OTEL Telemetry into Local Operations Dashboard

## 1. Purpose

Extend the accepted TSK-014 local operations dashboard with a truthful, read-only
Claude OpenTelemetry view backed by the existing SPC-004 local telemetry evidence.

TSK-015 SHALL preserve the TSK-014 dashboard shell and SHALL NOT change how Claude
telemetry is collected, enabled, sanitized, or persisted.

## 2. Observed baseline

At task start:

- repository: `dev-foundry-claude`;
- task branch: `task/tsk-015-claude-otel-dashboard-integration`;
- base/default branch: `main`;
- base HEAD: `ffc78bcff8f2fe638e11651c0ea2900fdc4f1a6e`;
- TSK-008 is COMPLETE and established the loopback-only OTLP collector, privacy
  sanitizer, runtime launcher and local NDJSON telemetry evidence;
- TSK-014 is CLOSED through `TSK-014-CLOSURE` and established the accepted
  dashboard parity shell;
- `.dev-foundry/telemetry/local/` currently contains OTEL and operation-marker
  evidence from real Claude-native work;
- the current Telemetry / Diagnostics page exposes Throughput and Transactions;
  Throughput truthfully reports unavailable because no runner call-throughput source
  is configured.

Runtime telemetry is observational evidence, not product authority.

## 3. Required outcome

Add one dashboard tab named **Claude OTEL** under the existing Telemetry / Diagnostics
section without replacing or reinterpreting Throughput or Transactions.

The tab SHALL provide an immediately useful empirical view of real Claude usage when
telemetry exists and a truthful unavailable/empty state when it does not.

## 4. OTEL read-model contract

The dashboard server MAY read only the existing producer-local telemetry evidence under:

- `.dev-foundry/telemetry/local/otel-YYYY-MM-DD.ndjson`;
- `.dev-foundry/telemetry/local/operations-YYYY-MM-DD.ndjson`.

TSK-015 SHALL NOT read CodeMie analytics as a substitute for OTEL.

The read model SHALL:

- accept only `dev-foundry.claude-otel-envelope.v1` telemetry envelopes;
- accept only `dev-foundry.claude-operation-marker.v1` operation markers;
- correlate records only by exact `telemetryRunId`;
- distinguish direct measurement from correlation/inference;
- tolerate malformed/truncated individual records by surfacing bounded issues rather
  than failing the complete page;
- avoid exposing raw OTLP payloads or arbitrary attribute maps through the API/UI.

Recognized measurement fields may be derived from sanitized OTLP metric/log structures
and safe attributes already allowed by SPC-004, including model, query source, effort,
session/request/prompt identifiers, durations, input/output/cache token counts and
reported cost.

No missing numeric field may be estimated.

## 5. Dashboard presentation

Preserve the existing UUI/Loveship shell and Telemetry / Diagnostics heading.

The Telemetry tabs SHALL include:

1. Throughput;
2. Claude OTEL;
3. Transactions.

Claude OTEL SHALL expose, when directly supported by evidence:

- telemetry runs / sessions observed;
- API requests observed;
- input tokens;
- output tokens;
- cache-read input tokens;
- cache-creation input tokens;
- total measured tokens;
- reported USD cost;
- measured/request duration when available;
- cache-read ratio when the denominator is directly supported.

It SHALL also expose bounded breakdowns for:

- model;
- effort;
- query source;
- correlated task;
- correlated selected role;
- launch mode.

At least one recent-run table SHALL show run identity, observed time range, model(s),
measured tokens, reported cost, and correlated task/role/launch mode when available.

The UI SHALL label unavailable dimensions as `unavailable` rather than zero.

## 6. API and route boundary

Add a read-only endpoint:

- `GET /api/dashboard/v1/claude-otel`.

The existing local server invariants remain unchanged:

- loopback-only listener;
- GET/HEAD only;
- host validation;
- no CORS or external network dependency;
- no repository or telemetry mutation;
- no provider action.

The browser route remains the existing `/telemetry` page. The Claude OTEL tab SHALL be
addressable through a stable query state, for example
`/telemetry?tab=claude-otel`, while preserving current Throughput and Transactions
navigation semantics.

## 7. Privacy and safety

The dashboard SHALL implement a second presentation allowlist rather than trusting that
sanitization alone is sufficient.

The API/UI MUST NOT expose:

- prompts or assistant responses;
- tool input/output/details/content;
- diffs or commands;
- source/workspace paths;
- API bodies;
- user email/account/persistent identifiers;
- credentials, authorization headers or secrets;
- arbitrary raw telemetry payloads.

Safe identifiers such as telemetry run id, session id, request id and prompt id MAY be
used internally for correlation, but the UI SHOULD prefer shortened display forms where
full identity is unnecessary.

## 8. Boundedness and failure behavior

Telemetry reading SHALL be bounded and deterministic.

The implementation SHALL define explicit limits for files, bytes and records and SHALL:

- read newest matching telemetry files first;
- reject unsafe/path-traversal reads;
- avoid unbounded recursive scans;
- expose a truthful truncated/scan-limit indication when limits are reached;
- return a useful empty/unavailable model when no telemetry exists;
- keep malformed individual records from crashing the dashboard.

A telemetry parsing failure MUST NOT break Executions, Validations, Transactions,
Overview, or the dashboard shell.

## 9. Implementation boundary

Product implementation is limited to:

- `tools/dashboard/**`.

Authoring/closure bookkeeping may additionally touch:

- this TSK;
- OVR-002;
- the project Authority Index;
- bounded DEV FOUNDRY runtime prompt/contract/evidence records.

TSK-015 SHALL NOT modify:

- `src/telemetry/**`;
- `scripts/telemetry/**`;
- root adapter `package.json` or `package-lock.json`;
- `bin/**`;
- adapter `src/**` outside the excluded telemetry subtree;
- `templates/**`;
- `payload-manifest.json`;
- consumer repositories.

The adapter release remains 1.1.0.

## 10. Validation

Implementation validation SHALL include:

- dashboard typecheck;
- dashboard build;
- dashboard tests;
- focused OTEL read-model fixtures covering metrics, logs, operation correlation,
  malformed records, missing dimensions, truncation and privacy allowlisting;
- loopback/read-only API tests for `/api/dashboard/v1/claude-otel`;
- root `npm test`;
- `git diff --check`;
- exact changed-path reconciliation.

When real local telemetry is present, final browser validation SHALL confirm that the
Claude OTEL tab renders truthful non-synthetic values from that evidence. When real
telemetry is absent, the truthful unavailable/empty state is acceptable.

## 11. Acceptance criteria

TSK-015 is accepted when:

1. the existing TSK-014 shell and routes remain intact;
2. Telemetry / Diagnostics includes Throughput, Claude OTEL and Transactions;
3. Claude OTEL reads only the SPC-004 OTEL + operation-marker evidence boundary;
4. KPI values are direct measurements or explicitly unavailable;
5. task/role/launch-mode attribution appears only through exact run-id correlation;
6. the API/UI never expose raw payloads or disallowed content-bearing telemetry;
7. scan limits and malformed records fail boundedly and visibly;
8. no telemetry collector/launcher behavior changes;
9. no adapter release or consumer mutation occurs;
10. all mechanical validation passes;
11. real local evidence, when present, is visibly rendered in the browser;
12. the Operator accepts the resulting OTEL dashboard view before promotion.

## 12. Independent audit rule

No independent Governance Audit is required by default.

Audit SHALL be triggered only if the implementation crosses an active POP trigger such
as a privacy/security boundary change, persistence-integrity change, repeated corrective
loop, validator/auditor disagreement, or material complexity exception.

## 13. First implementation observation and corrective boundary

The first bounded implementation request
`req_ed3e59afbf403153c0273905c8b666e4` produced the intended dashboard-only
candidate delta but the runner terminated with `PATH_POLICY_FAILED`.

The failure is a harness/contract path-policy mismatch rather than product-test evidence:
the execution contract declared `allowedPaths: ["tools/dashboard/**"]`, while the
process-bound runner treated each concrete `tools/dashboard/...` mutation as
`outside-allowed`.

The candidate delta observed after that run remains limited to the preexisting three
authoring paths plus these twelve product paths:

- `tools/dashboard/README.md`;
- `tools/dashboard/TSK-015-SELF-VERIFICATION.md`;
- `tools/dashboard/server/claude-otel.mjs`;
- `tools/dashboard/server/http.mjs`;
- `tools/dashboard/test/claude-otel.test.mjs`;
- `tools/dashboard/test/dashboard.test.mjs`;
- `tools/dashboard/test/render.test.mjs`;
- `tools/dashboard/ui/claude-otel.tsx`;
- `tools/dashboard/ui/main.tsx`;
- `tools/dashboard/ui/pages.tsx`;
- `tools/dashboard/ui/routes.mjs`;
- `tools/dashboard/ui/style.css`.

A bounded corrective MAY replace the wildcard allowed-path entry with those exact
twelve product paths and rerun the same implementation/validation boundary. It SHALL
NOT broaden product scope, mutate telemetry collection, or authorize any additional
repository path.

## 14. Operator visual rejection and density rework

After the path-policy corrective passed, the candidate dashboard was restarted and the
Operator reviewed the real Claude OTEL view at 1440x900 using existing local telemetry.

The Operator accepted the information content but rejected the current presentation
density: too much information is compressed into narrow panels, causing pervasive text
wrapping and poor scanability.

Direct browser measurement confirmed the issue:

- the page body is approximately 1775px tall for the current single-run data set;
- the breakdown surface lays out four approximately 339px-wide panels in the first row;
- because CSS grid rows stretch to the tallest member, the Model, Effort, Query source
  and Task panels each become approximately 789px tall when Query source has many rows;
- the Task breakdown label `multiple · shared run` wraps to four lines in its narrow
  first column;
- the Selected role breakdown wraps the same label to three lines;
- the Recent runs table compresses eight columns into the available width and wraps run
  id, time range, model list, task list and selected-role list;
- the real read model itself is healthy and the browser console has zero errors and zero
  warnings.

This is a visual/interaction corrective only. The OTEL read model, API semantics,
correlation rules, privacy boundary, scan limits, measured values and existing outer
Telemetry tab routing SHALL remain unchanged.

The corrective SHALL:

1. establish a clear information hierarchy instead of rendering all measurements at the
   same visual weight;
2. keep a small primary KPI set visible at first glance, with the remaining measurements
   retained as secondary details rather than removed;
3. prefer human-readable compact display formatting for primary values (for example
   compact token magnitudes and human-readable durations) while retaining exact measured
   values in accessible secondary text or equivalent non-lossy presentation;
4. replace the six simultaneous narrow breakdown tables with one full-width breakdown
   surface and an internal dimension selector for Model, Effort, Query source, Task,
   Selected role and Launch mode;
5. prevent breakdown rows from fragmenting labels across multiple narrow lines at the
   1440px acceptance viewport;
6. replace or restructure the eight-column Recent runs table so a run's identity,
   observed range, models, tokens, cost, tasks, roles and launch mode remain available
   without forcing those fields into narrow columns; a full-width run card/list or other
   scan-friendly composition is acceptable;
7. move methodology/explanatory copy that is not needed for first-glance operation into
   a collapsed disclosure or secondary-details surface;
8. preserve the existing UUI/Loveship visual language and use no new dependency or chart
   library;
9. remain responsive at narrower widths without hiding data;
10. preserve truthful `unavailable`, direct-measurement and exact-correlation semantics.

At 1440x900 the resulting view SHOULD read as an operational dashboard first and a
technical report second. The rework is not accepted until the Operator visually reviews
the restarted candidate again.

## 15. Session-first consumption corrective

After reviewing the density rework, the Operator accepted the information content but
identified two remaining usability problems:

1. the bottom of the Recent runs composition appears visually clipped/split against the
   viewport and does not read as a clean finished card;
2. global totals do not answer the primary operational question: how much the latest
   observed Claude session consumed, and how prior sessions compare.

The current evidence supports direct session-level measurement because sanitized OTEL
samples carry allowed `session.id` correlation and the existing read model already
observes six distinct session identifiers. The current evidence does NOT support exact
token/cost allocation by TSK: operation markers carry `taskId`, role and timestamp but
are correlated only by exact `telemetryRunId`, not by `session.id`. A multi-task run
therefore proves task presence but not each task's share of run/session consumption.

The corrective SHALL remain evidence-first:

- no run total may be divided among tasks by elapsed time, marker count, request count or
  any other heuristic;
- task-level consumption remains `unavailable` until a future governed instrumentation
  change records an exact task/session or task/measurement correlation;
- task ids observed in a run MAY be presented as contextual activity without assigning
  them tokens or USD.

### 15.1 Session read model

Extend the existing Claude OTEL API model with a bounded recent-session projection based
only on exact observed `session.id` values.

For each directly observed session, retain when supported:

- shortened display id; raw session id remains internal;
- containing telemetry-run display id;
- observed start/end time derived from that session's own samples;
- directly observed model set;
- API request count;
- input/output/cache-read/cache-creation tokens;
- total measured tokens;
- reported USD cost;
- request/measured active duration when present;
- cache-read ratio only when the direct denominator is supported.

Per-session aggregation SHALL use the same metric-preferred/log-fallback and
missing-versus-zero rules as the existing run summary. Samples without a session id SHALL
remain unattributed and MUST NOT be distributed among sessions.

Session projection is bounded; the implementation SHALL define and expose a maximum
recent-session count and truthful truncation state.

### 15.2 Session-first UI hierarchy

The Claude OTEL page SHALL prioritize:

1. **Latest observed session** — prominent consumption summary and observed timestamp
   range;
2. **Previous sessions** — scan-friendly session history with direct consumption values;
3. **All observed telemetry** — existing global totals retained but visually secondary;
4. direct dimension breakdowns;
5. run/task/role/launch-mode correlation context.

The UI SHALL say `Latest observed session`, not `current session`, because the stored
evidence does not prove that a session is still active. While a telemetry-enabled Claude
session is writing new evidence, refreshing the dashboard may naturally update the
latest observed session.

The local telemetry directory currently contains OTEL/operation evidence only for
2026-10-01 and 2026-10-02. The dashboard SHALL expose the latest observed timestamp so a
user can immediately see whether telemetry is fresh; it SHALL NOT imply that today's
session is being collected when no current evidence exists.

### 15.3 Task context

TSK ids correlated to a telemetry run SHALL be displayed as **Tasks observed** or
equivalent context. For the current real run this includes TSK-010 through TSK-013.

The UI SHALL NOT display a token or USD value beside an individual TSK unless future
evidence makes that attribution exact. If task-level consumption is unavailable, the UI
SHALL state that current operation markers identify task presence at run level only.

### 15.4 Recent-run visual finish

The run/context composition SHALL no longer appear cut off at the bottom of the visible
surface. Run cards SHALL have an explicit complete visual boundary, internal padding and
bottom spacing. Correlation/context content may wrap intentionally as tag/list content
but SHALL not collide with the panel or viewport edge.

This corrective MAY modify the OTEL read model and Claude OTEL presentation only. It
SHALL NOT change collector/launcher behavior, telemetry persistence, privacy allowlists,
outer dashboard routing, adapter release surfaces or consumer repositories.

## 16. Final Operator acceptance — 2026-10-04

After restarting the candidate with the session-consumption corrective, the Operator
reviewed the Claude OTEL page and explicitly accepted the current result for closure,
noting that further additions may be made later after more telemetry runs exist.

Fresh browser verification at 1440x900 confirmed:

- the page exposes `Latest observed session` rather than claiming a current live session;
- the latest observed telemetry timestamp is visible and currently reflects the most
  recent stored evidence from 2026-10-02;
- the latest observed session presents direct per-session cost, measured tokens,
  requests, cache-read ratio, active duration, models and observed range;
- prior observed sessions are presented individually with their own direct consumption
  values when measurements exist;
- one observed session truthfully reports unavailable consumption where session identity
  exists without attributable consumption measurements;
- the global aggregate remains available as secondary `All observed telemetry` detail;
- TSK-010 through TSK-013 are shown as `Tasks observed` context without fabricated
  per-task token or USD attribution;
- the launcher-run context card has a complete visual boundary, internal spacing and no
  measured horizontal or vertical overflow;
- the candidate browser console reports zero errors and zero warnings.

The accepted known limitation is that current operation markers provide exact task
presence only at telemetry-run level; they do not support exact per-TSK consumption.
No heuristic allocation is authorized. Exact TSK-level consumption, if later desired,
requires separately governed instrumentation that records an exact task/session or
task/measurement correlation.

The Operator authorizes TSK-015 final validation, promotion and formal closure with the
current accepted baseline. Future dashboard refinements discovered after additional
telemetry runs are separate follow-on work and do not block this closure.

## 17. Formal closure

TSK-015 is formally CLOSED through `TSK-015-CLOSURE` after terminal mechanical
validation PASS, independent Governance Audit PASS, promotion through PR #30,
integration, reconciliation, source-branch cleanup, and explicit Operator
authorization for end-to-end closure.
