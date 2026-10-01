---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-008
  type: TSK
  title: Establish Claude Operational Telemetry for Empirical Tokenomics
  status: IN_PROGRESS
artifactVersion: "1"
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
  phase: in-progress
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
  `.dev-foundry/telemetry/local/`.

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
15. `npm ci`, `npm test`, and `git diff --check` pass.

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
