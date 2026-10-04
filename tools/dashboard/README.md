# dev-foundry-claude local operations dashboard

Independent producer tool for SPC-006 / TSK-014. The adapter package and its 1.1.0
release payload do not include this workspace. No runner application source was
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
failure, signals and exit codes. No root package script or dependency is added.

Open `http://127.0.0.1:43127`. A port is mandatory (1024–65535); an occupied port
fails explicitly. There is no automatic fallback, LAN bind or development server.
The Node server serves the production build and GET/HEAD APIs only.

The UI uses React 19.1.0, UUI/Loveship 6.5.1, history 4.10.1, Vite 7.0.4 and the
React plugin 4.6.0. TypeScript 5.9.3 checks code using syntax compatible with 5.8.
UUI typography/color/surface tokens are used throughout. UUI's upstream CSS includes
CDN font declarations; CSP permits the fixed EPAM font origin while scripts and
connections remain local. The body uses `Inter, Arial, sans-serif`.

Navigation: Overview, Live Activity, Executions, Validations, Telemetry. The UUI
adaptive MainMenu exposes hidden navigation via More. Telemetry has Throughput
and Transactions tabs. List/detail routes match SPC-006; record links carry opaque
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
directory. No telemetry directory is read.

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
