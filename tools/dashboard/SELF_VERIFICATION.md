# TSK-014 implementation handoff — 2026-10-03

Implementation proof only. Mechanical Validator validation, Governance Author
semantic review/reconciliation, Operator visual acceptance and promotion remain
separate gates. No commit, push, PR or promotion was performed.

## Binding and mutation surface

- Repository: `dev-foundry-claude`.
- Branch: `task/tsk-014-foundry-runner-dashboard-parity`.
- HEAD: `9d6cc20a22d48ca2e85d1c5b9fd161d143f2a004`.
- Authority: current SPC-006 v1 and TSK-014 v1, registered in the active Authority
  Index; POP adopts DEV FOUNDRY 2.1.0 and binds Implementation Executor V3.
- Every authored product/proof file is beneath `tools/dashboard/**`.
- The four preexisting status entries (Authority Index, OVR-002, SPC-006 and
  TSK-014) were preserved byte-for-byte from the initial snapshot.
- SHA-256 comparison found zero differences across the 30 protected adapter,
  template, package, manifest and Claude configuration files captured initially.
  Root adapter version remains 1.1.0; the root dependency graph is unchanged.
- Full initial-snapshot comparison additionally observed a changing, ignored,
  preexisting `.dev-foundry/telemetry/workflow-throughput/sessions/` artifact.
  Its cause was not established here. The executor did not restore or edit it;
  neither dashboard runtime nor read model accesses it. This observation is not
  a claim that every volatile/generated file remained byte-identical.

## Required commands

| Command | Result |
| --- | --- |
| `npm --prefix tools/dashboard ci` | PASS; 111 packages restored from cache |
| `npm --prefix tools/dashboard run typecheck` | PASS |
| `npm --prefix tools/dashboard run build` | PASS; ordinary Vite bundle-size warning |
| `npm --prefix tools/dashboard test` | 10 PASS, 0 FAIL, 1 explicit socket SKIP |
| root `npm ci` | PASS; 15 packages restored from cache |
| root `npm test` | NOT PASS: 100 PASS, 5 FAIL out of 105 |
| `git diff --check` | PASS |
| `git status --short` | Four unchanged initial entries plus the new dashboard subtree |

Registry DNS is unavailable and the sandbox cannot write the global npm cache.
Restoration used offline mode with a writable cache copy in `/tmp`. Root package
checks sanitize npm environment variables, so a temporary `/tmp` npm wrapper
supplied the same writable cache to their child npm processes. No root configuration
or test was changed. Standard `ci` needs no wrapper on an unrestricted operator host.

The five remaining root failures are socket-dependent cases:

- adoption: verified `run` launches its telemetry child;
- launcher: selects a loopback port;
- launcher: closes the collector after child exit;
- collector: persists accepted metrics/logs;
- collector: rejects unsupported/malformed/oversized requests.

The collector directly reports `listen EPERM ... 127.0.0.1` in this sandbox; the
launcher cases fail before successful collector startup. The dashboard's real socket
probe has the same EPERM and is explicitly skipped, never reported as live acceptance.

## Focused observations

- Installed React/React DOM 19.1.0, all five EPAM packages 6.5.1, history 4.10.1,
  Vite 7.0.4 and React plugin 4.6.0 match the frozen contract. TypeScript 5.9.3
  is pinned; application syntax remains compatible with the reference 5.8 line.
- All ten routes parse and server-side render the actual React/UUI shell. Loading
  list/detail states, product identity and Telemetry tabs are asserted. This is
  rendering proof, not browser responsiveness or visual parity acceptance.
- Real local projections: 14 executions, 22 validations, 54 transactions; all
  supported at observation time, with no scan truncation or record issues.
- Fixtures cover malformed JSON, partial/incomplete evidence, identity conflict,
  unsupported schema/state, oversized records, raw excerpts, missing roots,
  symlinks, scan limits and timezone-correct recent ordering.
- The actual HTTP handler passes in-process checks for all shell/detail routes,
  list/detail APIs, GET/HEAD, 405 rejection of unsafe methods, Host restriction,
  traversal rejection, missing records and truthful health.
- `listenLocal` options are asserted as `host: '127.0.0.1'`, the requested explicit
  port and exclusive binding. Occupied-port errors propagate without fallback.
- Primary labels/order and Throughput/Transactions tabs match SPC-006; the shell
  uses Loveship MainMenu, UUI adaptive More, Panels, StatusIndicators, SearchInput,
  dropdown filters, compact DataTable and Paginator, with responsive CSS at
  800/650/480px and an independently authored 112×40 SVG.
- Live Activity, call detail and Throughput are deliberate unavailable states.
  No calls, throughput, costs or timing are fabricated. Existing recorded execution
  durations/timestamps are presented only as generated evidence.
- There is no OTEL data source, SSE protocol, provider action, consumer behavior,
  work execution, validation action, repository writer or backend framework.

## Remaining limits

Live server startup/port collision behavior and browser/mobile More-menu interactions
must be checked on a host that permits loopback sockets. The exposed Playwright code
tool also required approval unavailable under this session's `never` policy, so no
browser acceptance was produced. The Operator's frozen-reference visual review is
still pending. UUI CDN font definitions are blocked by the local-only CSP; fonts use
local installation/system fallback as described in README. No overall acceptance,
mechanical-validation PASS, promotion or task closure is claimed.

## Corrective launcher pass — 2026-10-03

This pass adds `scripts/dashboard.mjs`, a single direct import of the existing
`tools/dashboard/server/start.mjs`. It runs in the same Node process, so arguments,
explicit-port validation, fixed loopback bind, occupied-port failure, signal handlers
and exit behavior remain owned by the existing runtime. No second server or root
package script is introduced. The first-pass runtime/UI implementation is preserved.

Focused coverage in `test/launcher.test.mjs` compares direct and wrapper CLI failures
for missing, malformed, out-of-range and extra arguments. Live tests launch from a
different working directory, compare health with the direct runtime and static HTML
with the built dashboard, check read-only method rejection, send SIGINT/SIGTERM,
assert clean exit and rebind the port after shutdown. A separate test compares
occupied-port failure and verifies there is no fallback success message.

| Required command | Current result |
| --- | --- |
| `npm --prefix tools/dashboard ci` | PASS; 111 packages |
| `npm --prefix tools/dashboard run typecheck` | PASS |
| `npm --prefix tools/dashboard run build` | PASS; Vite bundle-size warning |
| `npm --prefix tools/dashboard test` | 11 PASS, 0 FAIL, 3 explicit socket SKIP |
| root `npm ci` | PASS; 15 packages |
| root `npm test` | NOT PASS; initial 94 PASS / 11 FAIL; writable-cache retry 100 PASS / 5 FAIL |
| `git diff --check` | PASS |
| `git status --short` | Initial four governance entries preserved; dashboard subtree and authorized launcher untracked |

Both `ci` commands succeeded without the earlier offline workaround. The initial
root test run hit global npm cache write restrictions during packaging. Repeating
`npm test` with the existing temporary `/tmp/tsk014-npm-bin` wrapper and writable
`/tmp/tsk014-npm-cache` fixed packaging failures without modifying root files. The
remaining five failures are the same collector-dependent cases listed above;
collector socket creation reports `listen EPERM ... 127.0.0.1`. Retry output is in
`/tmp/tsk014-launcher-root-tests.log` for this session.

The existing live runtime test and the two new live launcher tests explicitly skip
when this host refuses loopback sockets. Argument/exit parity passes in actual
subprocesses. Live startup, occupied-port rejection and clean signal termination
are covered by automated tests but remain **UNVERIFIED on this host**. No live
launcher acceptance, root regression PASS or Operator visual acceptance is claimed.

Current real durable projections contain 14 executions, 23 validations and 54
transactions, all supported, with no issues or scan truncation. Existing tests pass
for all ten route parsers and React/UUI initial render states, exact menu/tab labels,
API GET/HEAD behavior, unsafe-method/path rejection, bounded evidence and truthful
unavailable Live Activity/Throughput. Fixed `127.0.0.1` listen options pass the
in-process assertion. No OTEL source or consumer behavior was added.

The corrective snapshot covers 128 tracked/preexisting untracked files. Only
`tools/dashboard/README.md` and this handoff changed; the new files are
`scripts/dashboard.mjs` and `tools/dashboard/test/launcher.test.mjs`. All other
snapshotted files are SHA-256 identical. In particular, the preexisting governance
changes were preserved and dashboard runtime/UI/package files were unchanged.
Protected root adapter/configuration paths also have no diff against task-base
`9d6cc20a22d48ca2e85d1c5b9fd161d143f2a004`. Product/proof changes remain under
`tools/dashboard/**` with only the explicitly authorized convenience launcher outside.
No commit, push, PR or promotion was performed.

## Section 9.3 durable-list and exact-logo corrective — 2026-10-03

This pass independently replaces the execution/validation projections and transaction
label projection inside the dashboard workspace. It supersedes the earlier read-model
counts and independent-logo description above. No mature-runner runtime/source code
was copied. The static SVG was extracted from the exact frozen asset embedded in the
authorized corrective prompt and verified against SHA-256
`71e8330fd12ab24d58d6a424e5094902352052a2c89dd0d5a798b1275be7549c`.

Executions union validated flat request registry records with durable status evidence
from the two fixed evidence roots. Fixed sibling handoffs supply identities; safe
request output directories only correlate already-discovered evidence and never
expand reads. Rows deduplicate by task plus execution identity (or request identity
until the request supplies an execution ID). Valid request/status timestamps determine
newest-first ordering. Missing executor facts remain missing.

Validations consume only validated flat validation-request records. Creation time
controls ordering; request/validation/task IDs, lifecycle timestamps, status/verdict,
evidence metadata and separate failure/error counts are retained. Arbitrary execution,
validation-report or corrective result files never produce standalone validation rows.
Transactions retain the original scan, ordering and detail projection, with labels
chosen from safe taskId, task, operation, branch facts in that order. All three lists
retain their column definitions, CSS, compact UUI rows and footer paginator placement;
footers now use `records in considered candidates` and projected rows paginate by 20.

Focused tests cover union/deduplication (including identity before handoff creation),
phase/retry/corrective requests, evidence-only/request-only detail API navigation,
validation schema/state/identity rejection, ignored arbitrary results and nested
registries, timestamp ordering, label priority, bounded reads, current-page search,
projected pagination, rendered validation metadata and the exact logo hash. Existing
shell, Overview, Telemetry, geometry-contract, routes, API safety, CSP and launcher
coverage remains in the same suite. Rendering/CSS assertions are not visual acceptance.

| Required command | This pass result |
| --- | --- |
| `npm --prefix tools/dashboard ci` | PASS; 111 packages |
| `npm --prefix tools/dashboard run typecheck` | PASS |
| `npm --prefix tools/dashboard run build` | PASS; Vite bundle-size warning |
| `npm --prefix tools/dashboard test` | 32 PASS, 0 FAIL, 3 explicit loopback socket SKIP |
| `npm ci` | PASS; 15 packages |
| `npm test` | NOT PASS; 94 PASS / 11 FAIL initially; writable-cache retry 100 PASS / 5 FAIL |
| `git diff --check` | PASS |
| `git status --short` | Preexisting governance, launcher and dashboard entries retained |

The root test retry used the preexisting `/tmp/tsk014-npm-bin/npm` wrapper and
`/tmp/tsk014-npm-cache` to avoid restricted global-cache writes. The remaining five
root failures are the same socket-dependent adapter run, launcher and collector
cases described above; direct collector errors report `listen EPERM ... 127.0.0.1`.
No root test/configuration was modified. Logs are at
`/tmp/tsk014-corrective-dashboard-tests.log`, `/tmp/tsk014-corrective-root-tests.log`
and `/tmp/tsk014-corrective-root-tests-writable-cache.log`.

At this observation, the identity union contains 19 execution rows, 9 governed
validation requests and 54 transactions, without scan truncation or source issues.
The 19 execution requests include the current running corrective; the 18 available
status/handoff pairs deduplicate into their corresponding execution identities.
These observed counts are not assertions or frozen-reference acceptance. Both required
branch-context transaction labels are present in the local projection.

The before/after SHA-256 snapshot found no changes to any visible tracked/preexisting
untracked file outside `tools/dashboard/**`, including `scripts/dashboard.mjs`, root
packages/locks, adapter payload/source/templates and preexisting governance changes.
The proof does not assert immutability of ignored volatile artifacts produced by the
host runner. No commit, push, PR, merge or promotion was performed. Live socket and
Operator/Playwright visual/semantic acceptance remain pending.
