---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-004
  type: SPC
  title: Claude Operational Telemetry and Empirical Tokenomics Contract
  status: ACTIVE
artifactVersion: "2"
authorityScope: claude-operational-telemetry-and-empirical-tokenomics
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-operational-telemetry-collection
    - claude-telemetry-privacy-boundary
    - dev-foundry-operation-telemetry-correlation
    - empirical-tokenomics-evidence-policy
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - provider-pricing-policy
    - synthetic-benchmark-workloads
    - external-observability-platforms
    - production-monitoring-sla
    - reusable-dev-foundry-methodology
authority:
  governedBy:
    - ADR-001
    - ARC-001
    - SPC-003
    - OPS-002
    - OPS-008
    - OPS-009
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-004] dev-foundry-claude - Claude Operational Telemetry and Empirical Tokenomics Contract

## 1. Purpose

Capture enough privacy-minimized Claude Code telemetry during real governed work
to evaluate token economics later without paying for synthetic benchmark
workloads.

Telemetry is observational evidence. It is not product authority, does not grant
role authority, and does not replace repository SoT or governed validation.

## 2. Measurement policy

The project SHALL NOT run synthetic Claude workloads solely to benchmark cost,
tokens, cache behavior, context isolation, or subagent overhead before cutover.

Instead:

- static architecture and capability gates are proven before cutover;
- telemetry instrumentation is prepared before cutover;
- the first real Claude-native work begins collecting telemetry immediately;
- a later governed empirical review analyzes naturally occurring work;
- unavailable or insufficient samples are reported as such rather than replaced
  with estimated or synthetic measurements.

No cost-saving percentage, token-saving percentage, break-even threshold, or
model-routing benefit is authoritative until supported by observed runtime data.

## 3. Provider telemetry surface

The initial implementation relies only on stable Claude Code OpenTelemetry
metrics and logs/events.

It SHALL collect, when emitted by the runtime:

- session count;
- token usage by input, output, cache read, and cache creation;
- reported USD cost;
- active time;
- API request duration, model, effort, query source, token counts, cache counts,
  and reported cost;
- subagent-completion and compaction events when emitted;
- tool-result size and duration metadata that does not require content logging.

Beta distributed tracing is not required and SHALL remain disabled in the
initial implementation.

## 4. Local transport boundary

The project telemetry path is local-only:

- Claude Code exports OTLP using `http/json`;
- the collector binds only to `127.0.0.1`;
- no wildcard, LAN, public, tunnel, cloud, or externally reachable telemetry
  listener is authorized;
- the standalone collector defaults to loopback port 4318; the canonical launcher
  lets the OS select a free loopback port (`port: 0`) and uses the actual bound
  port, and accepts an explicit safe local port only through
  `DEV_FOUNDRY_TELEMETRY_PORT`;
- telemetry is persisted under
  `.dev-foundry/telemetry/local/`;
- that directory is ignored by Git and SHALL NOT be promoted.

The collector uses only Node.js built-ins. TSK-008 introduces no telemetry
service dependency.

## 5. Launcher boundary

Repository project settings are not treated as the mechanism that enables OTLP
export.

A versioned local launcher SHALL:

1. establish a telemetry run identifier;
2. start the loopback collector and wait until it is ready;
3. launch Claude Code through exactly one governed runtime (section 5.1) in the
   repository root with metrics and logs exporters pointed at that collector;
4. pass through user Claude CLI arguments after a mandatory `--` boundary;
5. preserve interactive stdio;
6. stop the collector after Claude exits;
7. return Claude's exit status.

The launcher SHALL NOT store credentials, select a Claude model, modify
authentication, alter DIAL or CodeMie provider routing, enable remote telemetry,
or invoke any synthetic prompt.

### 5.1 Launch modes

The single launcher `scripts/telemetry/claude.mjs` accepts
`--runtime <direct|dial|codemie> -- <claude args>` and deterministically maps:

- `direct` -> `claude <claude args>`;
- `dial` -> `dial run --harness claude-code -- <claude args>`;
- `codemie` -> `codemie-claude -- <claude args>`.

Unknown runtimes and malformed launcher syntax fail closed before any collector
or child process starts. Mode-specific launcher copies are not authorized. A
convenience script `scripts/telemetry/run-claude.sh <mode> -- <claude args>` may
only delegate to the launcher. All modes receive the identical section 6 policy.

### 5.2 Generated CodeMie analytics

CodeMie writes per-session analytics reports to `docs/codemie/analytics/` in the
working directory and offers no supported destination override. That subtree is
generated runtime evidence, SHALL be Git-ignored, and SHALL NOT be promoted. The
rest of `docs/codemie/` is not ignored by this contract.

## 6. Privacy boundary

The launcher SHALL explicitly keep all content-bearing telemetry gates disabled:

- `OTEL_LOG_USER_PROMPTS=0`;
- `OTEL_LOG_ASSISTANT_RESPONSES=0`;
- `OTEL_LOG_TOOL_DETAILS=0`;
- `OTEL_LOG_TOOL_CONTENT=0`;
- `OTEL_LOG_RAW_API_BODIES=0`.

The collector SHALL additionally sanitize incoming OTLP JSON before persistence
so an accidental upstream configuration change cannot persist:

- prompt or assistant-response text;
- tool input, tool output, tool parameters, diffs, or full commands;
- source file paths and workspace host paths;
- raw API request or response bodies;
- user email, account UUID, account ID, or persistent user identifier;
- authorization headers or credentials.

Session ids, prompt ids, request ids, timestamps, model ids, query-source
metadata, effort, durations, token counts, cache counts, reported cost, Claude
Code version, repository identity, and telemetry run id MAY be retained for
correlation and analysis.

## 7. Operation correlation

The local launcher SHALL set a unique `DEV_FOUNDRY_TELEMETRY_RUN_ID` and a
repository-local `DEV_FOUNDRY_TELEMETRY_DIR`.

The launcher also sets `DEV_FOUNDRY_CLAUDE_LAUNCH_MODE` to `direct`, `dial`, or
`codemie`; no other value is valid.

When the run id and directory variables are present, the existing
`resolve_governed_operation` MCP implementation MAY append a privacy-minimized
operation marker after a successful resolution.

A marker contains only:

- telemetry run id;
- timestamp;
- requested action;
- target project;
- task id or boundary id;
- selected role id;
- Actor Profile path;
- Capability Profile paths;
- context fingerprint;
- optionally, `launchMode`, only when the launch-mode variable holds one of the
  three closed values.

It contains no authority bodies, prompt text, model output, tool payloads, file
contents, credentials, or conversation transcript.

Resolver behavior and output remain unchanged. Telemetry recording failure MUST
NOT convert an otherwise valid authority resolution into a successful-looking
different result; the marker is best-effort observational evidence and is not
part of the resolver contract.

## 8. Stored format

Each sanitized OTLP POST is stored as one newline-delimited JSON envelope with:

- schema `dev-foundry.claude-otel-envelope.v1`;
- telemetry run id;
- receive timestamp;
- signal `metrics` or `logs`;
- sanitized OTLP JSON payload.

Operation markers are stored separately as newline-delimited JSON using schema
`dev-foundry.claude-operation-marker.v1`.

Files rotate by UTC date. No automatic network upload, retention sweep, or
remote replication is authorized.

## 9. Empirical review

A later governed empirical tokenomics review may derive, when supported by real
samples:

- tokens and reported cost per session and bounded operation;
- main versus subagent token/cost share;
- input/output/cache composition;
- cache-read ratio;
- request count and duration;
- model and effort distribution;
- context-isolation overhead inferred from main/subagent query sources;
- operation-level cost grouped by Governance Author, Implementation Executor,
  Governance Auditor, and Evidence Custodian where correlation is available;
- compaction and subagent completion frequency.

The review SHALL distinguish direct measurement from correlation/inference and
record missing categories as `unavailable`.

No artificial Governance Audit, implementation, or other model workload is
created merely to fill a missing telemetry category.

## 10. Cutover readiness

Operational telemetry is ready for cutover when:

- the launcher and loopback collector are statically/mechanically validated
  without invoking Claude;
- the collector rejects non-loopback binding;
- privacy sanitization tests pass;
- telemetry storage is ignored by Git;
- resolver operation markers are opt-in and transparent when telemetry is
  disabled;
- no Claude runtime benchmark is required.

Actual telemetry arrival is verified during the first real Claude-native
session. Failure to observe telemetry is a runtime instrumentation issue to
reconcile; it does not retroactively fabricate pre-cutover benchmark evidence.
