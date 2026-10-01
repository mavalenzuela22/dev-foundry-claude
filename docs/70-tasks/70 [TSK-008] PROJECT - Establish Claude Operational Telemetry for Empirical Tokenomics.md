---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-008
  type: TSK
  title: Establish Claude Operational Telemetry for Empirical Tokenomics
  status: COMPLETE
artifactVersion: "4"
authorityScope: tsk-008-claude-operational-telemetry
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-operational-telemetry-instrumentation
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - synthetic-claude-benchmark
    - claude-native-cutover
    - empirical-tokenomics-conclusions
    - model-selection
    - hooks
    - skills
    - agent-teams
    - external-telemetry-backend
    - public-or-lan-listener
authority:
  governedBy:
    - ARC-001
    - SPC-002
    - SPC-003
    - SPC-004
    - OPS-002
    - OPS-003
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-007
lifecycle:
  phase: complete
  dependsOn:
    - TSK-007
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-008] dev-foundry-claude - Establish Claude Operational Telemetry for Empirical Tokenomics

## 1. Purpose

Prepare zero-Claude-cost operational telemetry so real Claude-native work can be
measured after cutover instead of spending money on synthetic benchmarks.

TSK-008 SHALL NOT invoke Claude Code.

## 2. Provider mechanics revalidated

Current Claude Code documentation revalidated on 2026-10-01 establishes that:

- OpenTelemetry is enabled through `CLAUDE_CODE_ENABLE_TELEMETRY=1`;
- metrics and logs/events support OTLP exporters;
- OTLP `http/json` is supported;
- cost/token telemetry includes model, query-source, effort, token/cache counts,
  and reported cost;
- API-request events expose request duration and token/cache counts;
- prompt, assistant-response, tool-detail, tool-content, and raw-body logging are
  separately gated and are disabled by default;
- repository `.claude/settings.json` cannot be relied upon to enable or route
  OTLP exporters, so the project uses a launcher environment instead.

These are host mechanics, not DEV FOUNDRY methodology authority.

## 3. Authority reconciliation

TSK-008:

- establishes SPC-004;
- changes SPC-003 from paid pre-cutover benchmark qualification to
  post-cutover empirical review using real work;
- changes SPC-002 so cutover requires statically qualified subagents plus
  telemetry instrumentation readiness, not synthetic runtime benchmarking;
- records the local loopback collector as an adapter component in ARC-001.

## 4. Material implementation boundary

Codex may change exactly:

- create `src/telemetry/telemetry.js`;
- create `scripts/telemetry/collector.mjs`;
- create `scripts/telemetry/claude.mjs`;
- update `src/governance-mcp/server.js` only to emit opt-in operation markers
  after successful resolution;
- create `test/bootstrap/claude-telemetry.test.js`;
- update `.gitignore` only to ignore
  `.dev-foundry/telemetry/local/`;
- update `test/bootstrap/claude-cutover-readiness.test.js` only to reconcile
  the stale SPC-002 isolation/cutover prerequisite assertion with current
  SPC-002 v4: statically qualified Executor/Auditor plus SPC-004 telemetry
  readiness, with no paid synthetic benchmark prerequisite.

No package dependency or package-script change is authorized.

## 5. Collector contract

The collector SHALL:

- accept only OTLP HTTP JSON metrics and logs paths;
- bind only to `127.0.0.1`;
- reject or fail startup for a non-loopback host;
- sanitize content and identity attributes required by SPC-004 before writing;
- write UTC-date NDJSON envelopes under the local ignored telemetry directory;
- use atomic append semantics appropriate for one local collector process;
- expose no public API beyond accepting local OTLP POSTs;
- return a valid empty OTLP success response;
- use Node.js built-ins only.

## 6. Launcher contract

The launcher SHALL:

- create a UUID telemetry run id;
- set metrics and logs OTLP exporters to `http/json` loopback;
- explicitly disable all SPC-004 content logging flags and beta traces;
- disable account UUID metrics and enable version, entrypoint, repository, and
  session correlation metadata;
- set the telemetry directory and run id for the MCP child process;
- start the collector before Claude;
- pass all user arguments through to the installed `claude` executable;
- preserve stdin/stdout/stderr interaction;
- stop the collector after Claude exits;
- never send a prompt automatically.

## 7. Operation-marker contract

The governance MCP server SHALL preserve the existing
`resolve_governed_operation` request/response contract byte-for-byte
semantically.

Only after a successful resolver result, and only when the launcher telemetry
variables are present, it may append one SPC-004 operation marker. Marker-write
failure is observable to stderr but does not alter the resolver result.

No second MCP tool is added.

## 8. Static proof

The focused test SHALL prove at least:

1. telemetry environment selects OTLP metrics+logs and `http/json`;
2. exporter endpoint is loopback only;
3. all content-bearing flags are explicitly disabled;
4. beta traces are disabled;
5. account UUID metrics are disabled;
6. version/entrypoint/repository/session correlation settings are enabled;
7. sanitizer removes content-bearing and personal identity attributes from a
   representative OTLP payload while retaining model, query source, effort,
   tokens, cache, cost, timestamps, request id, prompt id, and session id;
8. collector accepts sanitized metrics/logs and persists NDJSON envelopes;
9. collector rejects unsupported paths/methods and non-loopback hosts;
10. operation markers contain only the SPC-004 allowlisted fields;
11. telemetry-disabled governance MCP behavior remains unchanged;
12. exactly one governance MCP tool remains exposed;
13. telemetry local storage is Git-ignored;
14. no dependency, model, hook, Skill, agent-team, settings, POP, Platform
    Bootstrap, subagent definition, or authority-release mutation occurs;
15. `test/bootstrap/claude-cutover-readiness.test.js` expects the current
    SPC-002 v4 cutover prerequisite and no longer encodes the superseded
    pre-TSK-008 wording;
16. `npm ci`, `npm test`, and `git diff --check` pass.

Tests use synthetic OTLP JSON directly against the collector implementation.
They SHALL NOT invoke Claude Code or any model.

## 9. Fit and validation

Implementation remains with Codex through the current runner-bound
Implementation Executor Capability Profile.

Separate governed mechanical validation follows executor self-verification.
No independent Governance Audit runs unless a configured trigger applies.

## 10. Completion

TSK-008 completion means operational telemetry instrumentation is ready for the
later atomic Claude-native cutover.

It does not prove token savings, does not activate Claude-native bindings, and
does not produce empirical tokenomics conclusions.

## 11. Corrective after first implementation execution

The first implementation execution,
`execution_13635a9b5305c1ce19429be468029787cf1645e512350179e51b835102617be4`,
changed exactly the original six authorized paths with zero path-policy
violations. `npm ci` and `git diff --check` passed; `npm test` reported
45/48 passing.

Three failures were observed:

1. one pre-existing cutover-readiness assertion still encoded SPC-002 v3 wording
   and therefore contradicted the newly promoted SPC-002 v4 telemetry-readiness
   prerequisite;
2. the local collector's oversized-body path could reset the client connection
   before returning the required 413 response;
3. the post-close test assumed only `ECONNREFUSED`, while a closed local TCP
   endpoint may observably reject the race with `ECONNRESET` instead.

The smallest sufficient corrective is therefore:

- reconcile only the stale SPC-002 assertion in the existing readiness test;
- keep the oversized-body contract as an HTTP 413 and correct the collector
  implementation so the body is safely drained before responding;
- make the post-close assertion accept either connection-refused or
  connection-reset as evidence that the collector no longer serves requests.

No other task, authority, runtime, dependency, privacy boundary, or telemetry
surface is expanded.

## 12. Second corrective observation

The second corrective execution,
`execution_426a706ae799a2abc825853331d893a8fff7fae9bc2f2d88f00806d50a2f165f`,
changed exactly the three authorized corrective paths with zero path-policy
violations. `npm ci` and `git diff --check` passed; `npm test` improved to
47/48 passing.

The cutover-readiness reconciliation passed, and the post-close network
assertion passed. The only remaining failure is the oversized-body collector
test: the client still observes `ECONNRESET` instead of receiving the required
HTTP 413 response.

The next corrective remains inside the already-authorized telemetry collector
and focused telemetry test surfaces. It SHALL:

- determine the exact request-handling condition that resets the client;
- preserve bounded memory and the configured body-size limit;
- drain or otherwise handle the request safely enough to deliver HTTP 413;
- keep the test requiring HTTP 413 rather than weakening it to accept a reset;
- preserve every privacy, loopback, persistence, and no-Claude constraint.

No additional path or capability is authorized by this observation.


## 13. Completion result

The third corrective execution,
`execution_b0d37f02b49a3109ec7379b66562675d1880e4031b5ee7981f1efe30f5c96fc1`,
completed PASS with executor exit code 0, runner exit code 0, zero path-policy
violations, and the final corrective confined to the two authorized telemetry
paths.

The complete TSK-008 implementation surface is exactly:

- `.gitignore`;
- `scripts/telemetry/claude.mjs`;
- `scripts/telemetry/collector.mjs`;
- `src/governance-mcp/server.js`;
- `src/telemetry/telemetry.js`;
- `test/bootstrap/claude-cutover-readiness.test.js`;
- `test/bootstrap/claude-telemetry.test.js`.

Executor self-verification passed `npm ci`, `npm test`, and
`git diff --check`. The full regression suite reported 48/48 tests passing.

Separate governed mechanical validation
`tsk008-final-mechanical-20261001` completed PASS with complete evidence and
`executorInvoked:false`.

Governance Author projection reconciliation is `projection match`. Semantic
self-assessment confirmed:

- the collector binds only to `127.0.0.1`;
- OTLP metrics/logs use local `http/json` and beta traces remain disabled;
- prompt/assistant/tool/raw-body telemetry flags are explicitly disabled;
- sanitizer tests remove content-bearing, host-path, credential, and personal
  identity fields while preserving the allowed measurement/correlation fields;
- oversized requests are bounded and return HTTP 413 without requiring socket
  reset as accepted behavior;
- local telemetry persists only beneath the Git-ignored
  `.dev-foundry/telemetry/local/` boundary;
- operation markers remain opt-in, privacy-minimized, and do not change resolver
  success/failure semantics;
- exactly one governance MCP tool remains exposed;
- no dependency, model selection, Hook, Skill, agent team, Claude setting, POP,
  Platform Bootstrap, subagent definition, or framework-release mutation
  occurred;
- Claude Code was not invoked during TSK-008 and no synthetic benchmark cost was
  incurred.

No independent Governance Audit is required because the active POP contains no
audit trigger for this boundary.

TSK-008 completion establishes telemetry instrumentation readiness for the later
atomic Claude-native cutover. Actual telemetry arrival is verified during the
first real Claude-native session, and empirical tokenomics conclusions remain a
later natural-work evidence boundary.
