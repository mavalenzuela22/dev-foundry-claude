# dev-foundry-claude local operations dashboard

Shared dashboard source for SPC-006 / TSK-014, extended by SPC-004 / TSK-015.
TSK-016 includes its server and prebuilt UI in adapter 1.2.0; build dependencies
and producer state remain outside the package. See the root README for installed
consumer operation and integrity requirements. No runner application source was
copied; the UI uses the frozen published UUI packages. SPC-006 authorizes the exact
frozen MainMenu SVG, whose SHA-256 is
`71e8330fd12ab24d58d6a424e5094902352052a2c89dd0d5a798b1275be7549c`.

```sh
npm --prefix tools/dashboard ci
npm --prefix tools/dashboard run build
npm --prefix tools/dashboard run dashboard -- --port 43127
```

The repository convenience entry point runs that same runtime:

```sh
node scripts/dashboard.mjs --port 43127
```

It delegates directly, preserving argument validation, loopback binding, occupied-port
failure, signals and exit codes. The root package prepack script builds this UI; it adds
no root runtime dependency. The installed CLI supplies an explicit consumer
evidence root and uses the same server and static build.

Open `http://127.0.0.1:43127`. A port is mandatory (1024–65535); an occupied port
fails explicitly. There is no automatic fallback, LAN bind or development server.
The Node server serves the production build and GET/HEAD APIs only.

The UI uses React 19.1.0, UUI/Loveship 6.5.1, history 4.10.1, Vite 7.0.4 and the
React plugin 4.6.0. TypeScript 5.9.3 checks code using syntax compatible with 5.8.
UUI typography/color/surface tokens are used throughout. UUI's upstream CSS includes
CDN font declarations; CSP permits the fixed EPAM font origin while scripts and
connections remain local. The body uses `Inter, Arial, sans-serif`.

Navigation: Overview, Live Activity, Executions, Validations, Telemetry. The UUI
adaptive MainMenu exposes hidden navigation via More. Telemetry has Throughput, Claude OTEL
and Transactions tabs. Claude OTEL is addressable at `/telemetry?tab=claude-otel`;
Transactions retains both `/transactions` and `/telemetry?tab=transactions`. List/detail routes match SPC-006; record links carry opaque
IDs derived from validated row identities (transaction IDs remain derived from
evidence-relative paths), never arbitrary filesystem paths.

## Read boundary

Executions union `.dev-foundry/execution-requests/requests/*.json` with validated
`status.json` evidence beneath `.dev-foundry/executions/**` and
`.dev-foundry/validations/**`. Fixed sibling `execution-handoff.json` files can
supply execution/request identities for deduplication. Requests prefer their
execution ID, retaining the request ID when none exists. Validations consume only
`.dev-foundry/validation-requests/requests/*.json`; arbitrary `result.json` files
never become rows. Transactions retain the existing
`.dev-foundry/repository-transactions/*.json` scan, with contextual labels selected
from safe observed facts in taskId, task, operation, branch order. The repository
root is fixed relative to this producer tool, independent of the launch working
directory. These durable views do not use telemetry sources.

Each source scan visits at most 2,000 entries, 200 candidate files, and four
directory levels; request registries are flat. The final projection is bounded to
200 rows, with 20 rows per page and current-page search. Footers report
`records in considered candidates`. Invalid requests/status evidence are excluded
from row counts and surfaced as source issues.
Evidence JSON is limited to 1 MiB; detail payload excerpts to 32,768 characters.
Limits, missing roots, unsupported/partial records and read errors are surfaced.
Recent/latest means latest within the bounded scan, based on recorded timestamps;
no file modification timestamp is substituted. Counts refer to the bounded view.
All symlinks are excluded, including evidence root/ancestor symlinks. Payload paths
are never followed. Raw detail is generated evidence only and is never executed.

Live Activity, call details and Throughput deliberately remain unavailable. The
health endpoint describes actual local evidence availability; there is no runner
connection, SSE, work execution, validation, mutation, provider or consumer action.

## Verification

```sh
npm --prefix tools/dashboard run typecheck
npm --prefix tools/dashboard run build
npm --prefix tools/dashboard test
```

Tests cover real producer records, disposable malformed/partial/oversize/symlink
fixtures, bounded lists/details, API methods and traversal, loopback configuration,
port collision behavior, and React/UUI rendering of all ten routes. A real socket
probe is explicitly skipped if the host sandbox returns EPERM; this is not live
server acceptance. Browser responsiveness and Operator visual parity review remain
separate checks before governed promotion.

## Claude OTEL read model

`GET /api/dashboard/v1/claude-otel` (also HEAD) returns
`dev-foundry.dashboard.claude-otel.v1` with `availability`, `semantics`, `summary`,
`breakdowns`, `recentSessions`, `recentSessionsTruncated`, `latestObservedAt`,
`tasksObserved`, `tasksObservedTruncated`, `recentRuns`, `recentRunsTruncated`,
`truncated`, `issues` and `scan`.
Only the flat `.dev-foundry/telemetry/local/otel-YYYY-MM-DD.ndjson` and
`operations-YYYY-MM-DD.ndjson` files are considered. CodeMie analytics is not read.
Accepted schemas are `dev-foundry.claude-otel-envelope.v1` and
`dev-foundry.claude-operation-marker.v1`; task, selected role and launch mode
correlate only by exact telemetryRunId. Markers alone never create telemetry runs.

Bounds: 4,096 directory entries, newest 32 matching files, 8 MiB per file,
32 MiB total, 1 MiB per NDJSON line, 10,000 candidate lines and 50,000 OTLP
points/logs/operation markers. All limits are returned under `scan.limits`.
Only 30 recent runs, 30 recent sessions and 20 rows per breakdown/dimension or
observed-task union are presented. Each display limit has a truthful truncation
indication; global totals continue to cover all considered evidence.
If the entry bound interrupts discovery, the newest global files are unknown;
this is reported explicitly. Unsafe/symlink, oversized and malformed records
produce fixed issue codes with counts, never raw exception text or source paths.

Delta metric intervals add once; cumulative series use their latest snapshot per
start interval, including resets. Metrics are preferred per run and numeric field;
request logs fill unavailable fields without adding overlapping metric/log totals.
API requests count observed `api_request` events, deduplicating only explicit
request identities within a session. Anonymous events remain distinct even when
their timestamp and measurements match. Session IDs are counted only
internally and deduplicated across runs, with measured session-count metrics as
fallback only when no session IDs are observed. Missing numbers are
`null`, displayed as `unavailable`; explicit observed zeros remain zero. Token
totals include measured categories only, summed after per-category metric/log
fallback. Safe run IDs need not be UUIDs and are matched case-sensitively. Cache ratio requires all three measured
input categories and a nonzero denominator. Seconds/micro-USD are converted by
exact unit scale; no provider pricing or numeric estimates are used.

Direct breakdowns describe their own observed coverage, which can differ from
summary coverage. Task, role and launch-mode breakdowns are context-only rows with correlated run
counts and null consumption fields. No run/session total is divided by time,
marker/request/operation/role counts or any other heuristic. The recent-run cards
retain observed task/role sets; they do not establish per-task consumption. Display IDs are shortened hashes; no raw run,
session, request or prompt IDs are exposed. A second field/value presentation
allowlist excludes content, paths, account identifiers, raw payloads and arbitrary
attribute maps. Unknown dimension values remain unavailable.

The view uses the existing UUI panels and typography, with scoped CSS tables,
KPI and breakdown surfaces, loading/error/empty states and collapsed parse issues.
Throughput remains unavailable and Transactions behavior is unchanged.


## Session-first consumption (TSK-015 section 15)

The direct session projection groups validated measurement samples by exact
`(telemetryRunId, sessionId)`. Supported metric points and API-request logs retain
validated session identities internally. Missing or invalid session identities
remain unattributed; totals are never distributed into sessions. Within each
session, metric-preferred/log-fallback selection, cumulative/delta deduplication,
missing-versus-zero handling and measured token totals match the run aggregation.
Selection is independent per session, so summing session fallback values need not
reproduce the global run-preferred totals when measurement coverage differs.

Each safe session object contains `displayId`, `runDisplayId`, `startTime`,
`endTime`, `models`, `measures` and `cacheReadRatio`. Display identities are the
first 12 hexadecimal characters of SHA-256 over the respective raw identity.
The same resumed session in two runs produces independent projections with the
same session display ID and different containing-run display IDs. Raw identities
are never returned. Session ranges and models come only from that session's
supported measurement samples, not operation markers, other sessions or unrelated
run envelopes. Sample timestamps fall back to the containing envelope receipt
only when the sample timestamp is unavailable.

`scan.limits.recentSessions` is 30. Sessions sort newest-first by end time, then
start time, then display ID (containing-run hash breaks any remaining tie).
`recentSessionsTruncated` reports the projection limit. `latestObservedAt` is the
latest observed telemetry time across considered run envelope/sample timestamps,
including unattributed telemetry; it is not the dashboard refresh time. Empty
telemetry returns null freshness and an empty session projection.

The UI prioritizes Latest observed session and Previous sessions, with compact
consumption and exact accessible titles/labels and measurement disclosures. It
shows the global latest observed timestamp by the Claude OTEL heading. All
observed telemetry retains every global exact value in a secondary disclosure.
The single full-width dimension selector preserves direct Model, Effort and
Query source measurements; Task, Selected role and Launch mode show context and
run counts only. Tasks observed is the union across considered telemetry runs,
including runs outside recent history, with an explicit display-limit notice.
Current markers prove launcher-run task presence, not per-task cost or tokens.
Run/session cards have complete borders, internal padding and bottom spacing;
history and context intentionally stack at narrow widths.

The dashboard does not invoke Claude/provider workloads or write local telemetry.
Operator browser review of the restarted candidate remains the visual acceptance
gate; render tests do not certify viewport appearance.
