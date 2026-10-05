# TSK-015 — session-first corrective self-verification

Date: 2026-10-04. Section 15 implementation is complete within the eight-path
corrective boundary. Live browser appearance and Operator acceptance remain
unverified. This is Implementation Executor self-verification, not independent
Mechanical Validator evidence or lifecycle acceptance.

## Authority and preserved entry state

- Repository: `/Users/martin.valenzuela/Development/dev-foundry-claude`.
- Branch: `task/tsk-015-claude-otel-dashboard-integration`.
- HEAD: `ffc78bcff8f2fe638e11651c0ea2900fdc4f1a6e`.
- Authoritative task SHA-256 verified before implementation:
  `0ae32edcb937e10257ac90e6db21db963e35e227c3d9223fbf097312133648bf`.
- Authority: task section 15 and the current Operator request's exact eight-path
  mutation boundary. No AGENTS.md was found in the checkout/ancestor search.
- Existing dirty authoring and dashboard work were preserved; no delegation,
  provider workload, collector/launcher change, commit or promotion was performed.

## Corrective implementation

The changes since entry are confined to these authorized paths:

1. `server/claude-otel.mjs`: validated internal session identities on selected
   metrics and API-request logs; shared aggregation semantics applied independently
   to exact run/session partitions; session-only ranges/models; safe 12-character
   SHA-256 display identities; newest-first session ordering and 30-session limit;
   freshness and bounded observed-task union. Correlated dimension rows now retain
   truthful run counts with null consumption fields for every task/role/mode.
2. `ui/claude-otel.tsx`: heading freshness; prominent Latest observed session;
   Previous sessions cards; secondary global exact-values disclosure; the existing
   single full-width dimension selector; Tasks observed and secondary launcher
   context. Context selector states expose no allocated tokens or USD.
3. `ui/style.css`: complete card borders, internal padding, bottom spacing,
   full-width surfaces, five primary consumption values and intentional responsive
   stacking. Context lists wrap. Unrelated dashboard styles are preserved.
4. `test/claude-otel.test.mjs`: focused direct-session and context-only fixtures.
5. `test/dashboard.test.mjs`: read-only API integration with hashed session/run
   identities, raw-ID exclusion, measured zero and preserved global totals.
6. `test/render.test.mjs`: session-first hierarchy, previous-session scan values,
   exact global values, context-only selector states and complete layout hooks;
   loading/error/retry/unavailable/zero/partial-session regressions retained.
7. `README.md`: current API fields, bounds, aggregation and presentation semantics.
8. `TSK-015-SELF-VERIFICATION.md`: this evidence handoff.

No run/session total is divided across tasks by elapsed time, marker count,
request count, operation count, role count or any other heuristic. Task presence
comes only from exact launcher-run correlation. Session objects contain no task
attribution, raw identities, arbitrary attributes or payloads. Samples with no
validated session identity remain unattributed.

The selected per-session fields prefer metrics independently and use request logs
only where metrics are unavailable. Zero remains zero and missing remains null.
Cumulative snapshots/resets and delta deduplication retain the existing semantics.
Totals derive only from measured token categories after field selection. Cache
ratio requires all three input categories and a positive denominator. Sessions
with only a session-count metric truthfully expose unavailable consumption.

A resumed session in two runs produces two independent projections with the same
hashed session ID and distinct run hashes. Session ranges include that session's
supported measurement samples only; API log duplication does not redistribute
consumption. Envelope receipt is a timestamp fallback for its own sample only.
Global freshness includes considered run envelope/sample timestamps, including
unattributed telemetry, and never substitutes dashboard refresh time.

## Focused verification

Tests prove multiple independent sessions in one run, session-specific metric
preference/log fallback, zeros/missing fields, unattributed/invalid identities,
raw-ID privacy, stable SHA-256 identities, session-only ranges/models, independent
resumed-session run partitions, cumulative/delta deduplication, exclusion of
non-request logs from session evidence, end/start/hash ordering, 30-session output
truncation, global freshness and null empty freshness. Task union fixtures cover
runs omitted from recent history and bounded task truncation. All correlated
consumption fields are null while truthful run counts/task IDs remain visible.

Render tests prove latest/history/global/breakdown/context ordering, compact and
exact accessible values, optional active duration, previous-session requests,
context selectors without token/USD columns, task context copy and complete card
layout hooks. Layout hooks are structural evidence, not browser measurements.

## Mechanical validation

| Command | Result |
| --- | --- |
| `npm --prefix tools/dashboard run typecheck` | PASS |
| `npm --prefix tools/dashboard run build` | PASS; existing Vite >500 kB chunk notice |
| `npm --prefix tools/dashboard test` | 72 PASS, 0 FAIL, 3 SKIP; 75 total |
| `npm test` | Initial: 94 PASS, 11 FAIL; scratch-cache retry: 100 PASS, 5 FAIL; environment-blocked, not PASS |
| `git diff --check` | PASS |

The three dashboard skips explicitly report host `EPERM` socket restrictions:
loopback/occupied-port transport and the two real launcher transport scenarios.
In-process API, host/read-only/privacy invariants, parsing and rendering pass.

The initial root suite has seven package-test failures because npm subprocesses
cannot write `/Users/martin.valenzuela/.npm`; the remaining four failures are
collector/launcher loopback restrictions. The package-test helper deliberately
strips npm-prefixed environment variables, so simply setting a temporary npm
cache did not fix the subprocess cache writes. A scratch-only npm wrapper passes
the permitted temporary cache as an explicit CLI option. That retry reports
100 PASS and 5 FAIL: the installed-package launcher scenario plus the four
collector/launcher scenarios are blocked by loopback listener restrictions.
Two collector failures explicitly report `listen EPERM`; three launcher failures
report startup failure when they reach the same collector startup path. No root
test, package, permissions or repository config was changed to suppress failures.

Logs are in `/private/tmp/tsk015-session-dashboard.log`,
`/private/tmp/tsk015-session-build.log`, `/private/tmp/tsk015-session-root.log`,
`/private/tmp/tsk015-session-root-tempcache.log` and
`/private/tmp/tsk015-session-root-scratchcache.log`.

## Existing real telemetry observation

A read-only projection of the current real local evidence reports:

- six direct session projections, one observed run, no truncation or parse issues;
- latest observed telemetry: `2026-10-02T19:29:11.051Z`;
- latest session hash: `0874597f6ff5`, containing run hash: `5d1ed1ef48ad`;
- session sample range: `2026-10-02T17:05:52.664Z` to
  `2026-10-02T19:29:11.048Z`;
- directly observed model: `claude-sonnet-5-5`;
- latest-session measured tokens: `12527281`, reported USD:
  `4.182619200000001`, API requests: `84`, active duration: `1108870 ms`,
  cache-read ratio: `0.980674372903826`;
- exact global total: `47017369` measured tokens and reported USD
  `18.442839499999998`; floating-point values are preserved in exact titles;
- Tasks observed: TSK-010, TSK-011, TSK-012, TSK-013, with no per-task consumption.

The six sessions include one whose consumption is entirely unavailable; no share
of other sessions or the run is assigned to it. Real evidence was read only.

## Integrity and visual acceptance limits

Entry inventory: `/private/tmp/tsk015-session-before.json`. SHA-256 comparison
covers tracked/untracked non-ignored repository files and every existing local
telemetry file. Final reconciliation confirms exactly the eight authorized
source/document paths changed. Existing out-of-bound dirty files, task authority
and `.dev-foundry/telemetry/local` retain identical contents and membership.
Requested build/test commands also produce ignored build/cache artifacts.

Starting the built candidate with
`npm --prefix tools/dashboard run dashboard -- --port 43215` fails with
`listen EPERM: operation not permitted 127.0.0.1:43215`. Available browser tabs
contain no existing dashboard surface to validate this build. No security or
sandbox bypass was attempted. Live transport, 1440x900 appearance, narrow viewport
layout, interactive dimension switching and the visual finish of the final run
card remain UNVERIFIED.

On a listener-capable host, restart the candidate and review
`http://127.0.0.1:43215/telemetry?tab=claude-otel`. Verify freshness, latest and
previous session consumption, global disclosure, all six dimension states,
TSK-010–TSK-013 context without allocation, and complete bottom card spacing at
1440x900 and narrower widths. Operator visual acceptance remains required before
promotion under section 15; this corrective does not mark the task accepted.
