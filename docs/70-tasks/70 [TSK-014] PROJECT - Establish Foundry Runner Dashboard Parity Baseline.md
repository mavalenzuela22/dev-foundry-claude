---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-014
  type: TSK
  title: Establish Foundry Runner Dashboard Parity Baseline
  status: CLOSED
artifactVersion: "2"
authorityScope: tsk-014-foundry-runner-dashboard-parity
ownerRole: governance-author
canonical: true
scope:
  owns:
    - foundry-runner-dashboard-parity-baseline
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - claude-otel-dashboard-integration
    - adapter-release-change
    - consumer-repository-read-or-modification
    - mature-runner-modification
    - copied-runner-runtime-implementation
    - private-runner-observation-protocol
    - public-or-lan-listener
    - reusable-dev-foundry-methodology
authority:
  governedBy:
    - SPC-006
    - ADR-004
    - OVR-001
    - OPS-001
    - OPS-002
    - OPS-003
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn: []
  closureArtifact: TSK-014-CLOSURE
lifecycle:
  phase: closed
  dependsOn: []
  closureArtifact: TSK-014-CLOSURE
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-014] dev-foundry-claude - Establish Foundry Runner Dashboard Parity Baseline

## 1. Purpose

Implement SPC-006: establish a producer-local `dev-foundry-claude` dashboard whose
visual shell, sections, navigation and UUI/Loveship interaction model intentionally
match the frozen `foundry-runner` dashboard baseline before any Claude OTEL-specific
visualization is added.

## 2. Observed task base

Task authoring starts from:

- repository: `dev-foundry-claude`;
- base branch: `main`;
- base HEAD: `9d6cc20a22d48ca2e85d1c5b9fd161d143f2a004`;
- task branch: `task/tsk-014-foundry-runner-dashboard-parity`;
- tree: clean before branch creation;
- active producer bindings: ChatGPT project Governance Author/Auditor/Custodian,
  process-bound runner Code Executor V3, and process-bound Mechanical Validator;
- TSK-013: promoted producer-maintenance cutover.

TSK-013 is an observed promoted baseline, not a lifecycle prerequisite for this
capability. TSK-014 depends on the currently observed producer configuration, not on
retroactive closure metadata for TSK-013.

The implementation-reference runner state was observed read-only at
`c5946e880c09bb362f47d46919cd303eb30db75f`.

## 3. Necessity and minimality

The Operator explicitly requires one operational dashboard language across
`foundry-runner` and `dev-foundry-claude`: same sections, same UUI/Loveship shell
and same visual/interaction model, with Claude OTEL added only afterward.

No existing project authority owns that durable dashboard product contract, so SPC-006
is necessary. No new ADR is required: ADR-004 already permits producer evolution
independently of adapter consumers. No new ARC is required for this local producer tool.

The smallest safe complete implementation is one isolated producer tool beneath
`tools/dashboard/**`. It reuses standard UUI dependencies and independently
implements the required presentation; it does not copy runner source, wrap the runner,
or modify the adapter package.

No MTP is required unless implementation discovers a materially separate authority,
risk, side-effect or persistence boundary.

## 4. Frozen parity target

SPC-006 section 2 is the fixed reference.

Required primary navigation:

`Overview | Live Activity | Executions | Validations | Telemetry`

Telemetry retains:

`Throughput | Transactions`

Required routes and detail routes are exactly those listed in SPC-006 section 3.

Product identity is `dev-foundry-claude`; operational facts must come from this
repository. A missing live source is displayed as unavailable rather than fabricated.

## 5. Material implementation boundary

Implementation Executor MAY create or modify dashboard product code beneath:

`tools/dashboard/**`

and MAY create or modify exactly one producer convenience launcher:

`scripts/dashboard.mjs`

The tool workspace may contain its own:

- `package.json` and lockfile;
- Vite/TypeScript configuration;
- React/UUI dashboard UI;
- loopback-only Node dashboard server;
- read-only durable evidence projectors;
- tests;
- local dashboard asset/logo;
- tool-local ignore/build output configuration.

The executor may read the frozen `foundry-runner` reference and the repository-local
durable evidence needed for implementation, but SHALL NOT copy source text from the
runner.

Hard exclusions:

- root `package.json` and root `package-lock.json`;
- root adapter `bin/**`, `src/**`, `templates/**`, `payload-manifest.json`;
- `CLAUDE.md`, `.mcp.json`, `.claude/**`;
- POP, Platform Bootstrap, framework release or Capability Profiles;
- any consumer repository;
- `.dev-foundry/telemetry/**` as a dashboard data source;
- mature-runner modification;
- public/LAN listeners;
- repository mutation endpoints or actions;
- OTEL/token/cost/cache/model visualization.

Governance Author documentation/index changes for task activation and closure are
outside the Executor product boundary and remain role-separated.

## 6. Initial read model

The dashboard may read, never mutate:

- `.dev-foundry/executions/**`;
- `.dev-foundry/validations/**`;
- `.dev-foundry/repository-transactions/**`;
- minimum associated request metadata needed to resolve list/detail state.

It SHALL expose truthful Overview, Executions, Validations and Transactions records
where those durable artifacts support them.

Live Activity and Throughput retain the same user-facing sections and visual states but
do not create a new runner observation protocol in this task.

Malformed, missing, partial or unsupported records fail closed at the record boundary
and are surfaced as unavailable/issue state rather than guessed.

## 7. Runtime and UI constraints

The dashboard:

- binds only `127.0.0.1`;
- requires an explicit safe local dashboard port or equally deterministic local
  configuration that cannot silently collide with the runner dashboard;
- serves only static UI and read-only dashboard APIs;
- uses the exact UI dependency versions in SPC-006 section 5;
- preserves the responsive UUI/Loveship composition of the frozen reference;
- contains no authentication/provider/model/consumer behavior.

## 8. Focused proof

Executor self-verification SHALL prove at least:

1. all SPC-006 primary routes parse and render;
2. UUI/Loveship dependencies resolve at the required versions;
3. top-level menu captions and Telemetry tabs match SPC-006;
4. execution rows are the reference-equivalent union of valid execution requests and
   durable execution evidence, deduplicated and newest-first; validation rows come only
   from governed validation-request records; transaction labels preserve safe observed
   task/operation/branch context; all three use reference-equivalent bounded pagination;
5. malformed paths and traversal attempts cannot escape allowed local evidence roots;
6. APIs are GET/HEAD/read-only and unsafe methods fail;
7. server host is loopback-only;
8. missing Live Activity/Throughput sources render unavailable rather than synthetic
   data;
9. no `.dev-foundry/telemetry/**` read is part of the dashboard implementation;
10. no root adapter package/runtime surface changed;
11. nested typecheck/build/tests pass;
12. `node scripts/dashboard.mjs --port <local-port>` starts the same loopback-only dashboard runtime and preserves explicit-port validation;
13. root regression tests and `git diff --check` pass.

## 9. Validation and semantic review

After implementation:

- Mechanical Validator runs nested dashboard validation plus root regression validation;
- Governance Author reconciles the exact changed-path projection and performs semantic
  self-assessment against SPC-006;
- Operator performs visual parity review against the frozen runner reference.

The active POP has no configured independent-audit trigger. No audit is manufactured
unless the resulting boundary or evidence activates an applicable trigger.

### 9.1 Operator visual review corrective — 2026-10-03

The first browser-visible baseline was rejected by the Operator as not visually equal
to the frozen Foundry Runner dashboard. Playwright comparison used the same 1440x900
class viewport against the live frozen reference on port 4322 and the candidate on
port 4324.

Observed non-parity includes:

- reference MainMenu logo at x=0 with navigation beginning immediately after the
  112px slot; candidate logo began at x=16 and shifted all navigation by 32px;
- reference shell status area presented one compact connection-summary row; candidate
  added durable-evidence text, a read-only badge, a live-source indicator and a
  Refresh button, changing the shell composition;
- reference rendered body stack was `Inter, Arial, sans-serif`; candidate rendered
  `Source Sans Pro` and produced 72-73 repeated browser-console font CSP failures;
- reference Overview used one full-width cockpit containing `Operational snapshot`,
  `Latest execution`, `Latest validation`, `Earlier executions`, and
  `Earlier validations`; candidate substituted three summary metric cards plus two
  recent-activity columns;
- reference Executions used title, full-width current-page search, compact
  `Task | Status | Executor | Time` table and footer pagination; candidate added a
  subtitle, Refresh button, state dropdown and `Record` column, with different table
  density and geometry.

These differences are semantic acceptance failures for SPC-006 parity, not cosmetic
observations. The corrective SHALL preserve truthful `dev-foundry-claude` data and
unavailable-source behavior while matching the frozen reference shell, page structure,
UUI composition and rendered geometry. Operator visual review remains pending after the
corrective; prior mechanical PASS does not satisfy this gate.

### 9.2 Post-restart visual review residual — 2026-10-03

After the visual corrective completed, the Operator restarted the dashboard runtime and
a fresh Playwright comparison used the same 1440x900-class viewport.

Confirmed closed from section 9.1:

- browser console: 0 errors / 0 warnings after restart;
- MainMenu logo slot and all five navigation item positions/sizes match the frozen
  reference exactly at the measured viewport;
- rendered font stack matches `Inter, Arial, sans-serif`;
- status-strip outer geometry matches the frozen 48px shell;
- Executions title/search/table/footer geometry and `Task | Status | Executor | Time`
  columns match the frozen reference;
- Telemetry / Diagnostics heading and Throughput/Transactions tab geometry match the
  frozen reference, with truthful unavailable Throughput content.

Residual Overview non-parity remains:

- candidate `Latest execution` measured 158px high while the frozen reference measured
  154px, shifting all later Overview sections by 4px;
- candidate renders Overview task labels as links while the reference renders those
  labels as plain text;
- candidate uses generic `Recorded` labels while the reference uses execution-specific
  `Observed` and validation-specific `Created` wording;
- candidate execution facts are separate flex children rather than the frozen
  `overview-facts` grid with 4px internal gap.

This residual is still within the already-authorized parity boundary. A focused final
corrective SHALL change only the Overview presentation needed to eliminate these
measured differences and SHALL not disturb the now-matching shell, durable lists,
Telemetry hierarchy, read-only runtime, launcher, or data safety behavior.

### 9.3 Durable-list and logo parity corrective — 2026-10-03

After the Overview corrective, the Operator rejected remaining non-parity in the
MainMenu logo and requested exact comparison of Executions, Validations, and the
Transactions tab against the mature-runner dashboard.

Fresh Playwright comparison at the same 1440x900-class viewport observed:

- MainMenu geometry matched, but the candidate used a custom cube/wordmark SVG while
  the mature runner uses `src/dashboard-ui/assets/foundry-runner.svg`; the mature
  runner asset is the required graphical logo reference;
- Executions columns, widths, search, row height, and table geometry matched, but the
  mature runner projected 23 considered execution candidates while the candidate
  projected only 14 scanned records. Missing rows were request/phase/retry/corrective
  executions such as TSK-014 request-backed runs and `*-rN`/phase identities;
- Validations had the inverse semantic defect: the mature runner projected 9 governed
  validation-request rows while the candidate projected 26 rows because recursive
  `result.json` scanning reclassified execution/corrective evidence as validations;
- Transactions projected the same 54 considered records, page count, columns, row
  heights, and ordering, but the candidate dropped safe contextual labels such as
  `Repository transaction · impl/tsk-009-atomic-claude-native-cutover` and
  `Repository transaction · main` because it did not derive labels from observed facts;
- mature-runner list footers use `records in considered candidates`; candidate used
  `records in scanned candidates`.

Reference behavior was independently reobserved from the frozen mature-runner read
model without treating that repository as authority:

- executions are the union of valid execution-request registry records and durable
  execution evidence, deduplicated by task plus execution/request identity and ordered
  newest-first;
- validations are validation-request registry records only;
- transaction labels select the first safe observed fact among `taskId`, `task`,
  `operation`, and `branch`;
- default page size is 20 and footer counts describe validated rows in the bounded
  candidate snapshot.

The next corrective remains inside the existing product boundary. It SHALL independently
implement those observable semantics, replace the MainMenu SVG with the exact frozen
static asset allowed by SPC-006, and SHALL not copy mature-runner runtime/source code.
The follow-up Playwright gate must compare list counts/identities, labels, pagination,
row geometry, detail navigation, and the logo before Operator acceptance.

### 9.4 Equal-viewport residual after read-model/logo corrective — 2026-10-03

After restarting the candidate and forcing both browser tabs to an actual 1440x900
viewport, the earlier 118px footer-height difference disappeared. It was a comparison
artifact caused by one Playwright tab remaining at 782px height, not a product defect.
No CSS corrective is authorized for that artifact.

Fresh equal-viewport comparison confirmed:

- the MainMenu SVG now matches the frozen mature-runner asset byte-for-byte and its
  rendered 112x40 geometry matches;
- Transactions matches the mature runner in count (54 at observation time), ordering,
  labels, columns, row heights, footer text, paginator, and tab geometry; Transactions
  is accepted for this corrective and SHALL NOT be changed;
- Validations now matches the mature runner in row count (9 at observation time), row
  identities/order, geometry, footer, and paginator, but presentation still differs:
  candidate uses `status / verdict` while reference uses `status · verdict`, and the
  failing TSK-009 row shows `Complete` instead of `2 failures` because candidate does
  not aggregate failure reasons plus error codes into the displayed failure count;
- Executions geometry, columns, row heights, footer placement and current-page search
  match, but candidate projects only 19 rows while reference projects 24 at observation
  time. Missing durable identities include `TSK-009-phase-a`, `TSK-008-r3`,
  `TSK-008-r2`, `TSK-007-r3`, and `TSK-007-r2`; candidate also overstates `codex-cli`
  on request-only older TSK-014 rows where the mature runner correctly displays
  `unknown` when no trustworthy current contract/evidence projection supports an executor.

Reobservation of the frozen mature-runner implementation explains the execution delta:

- execution evidence is discovered only under `.dev-foundry/executions/**`, never by
  reclassifying `.dev-foundry/validations/**` post-execution artifacts as executions;
- the durable execution task identity is anchored by the safe task-directory candidate
  being enumerated, preserving retry/phase task identities even when a status payload
  carries a base task id;
- request rows are merged with matching durable evidence without collapsing distinct
  retry/phase identities;
- request-only executor falls back to `unknown` unless a trustworthy current contract
  relationship supports the executor; durable status may provide the executor when
  present.

The next corrective SHALL be limited to those execution projection semantics and the two
validation presentation/counting differences. It SHALL not change Transactions, logo,
Overview, shell geometry, Telemetry structure, runtime security, or launcher behavior.

### 9.5 Final DataTable cell-alignment corrective — 2026-10-03

After the v6 corrective and a fresh candidate restart, equal-viewport Playwright
comparison confirmed execution and validation row identities, counts, status/executor
semantics, validation failure presentation, column widths, row heights, footer text,
pagination, logo, and console state all match the frozen mature runner.

The Operator identified one final minor visual residual across the durable DataTables.
Direct DOM geometry measurement at 1440x900 showed the outer column boxes are already
identical, but the mature runner offsets cell content farther inward:

- first-column content begins 12px farther inward than the candidate;
- subsequent durable-table cell content begins approximately 6px farther inward;
- the mature runner's rendered row carries the additional `compact-table-row` class,
  while the candidate currently uses the default DataTable row renderer without it;
- the same pattern is present in Executions, Validations, and Transactions.

This is the final authorized parity corrective before accepting any remaining tiny
visual residual and moving on to a separate OTEL telemetry task. The corrective SHALL
only reproduce the mature durable-row rendering/alignment behavior for the existing
three durable DataTables. It SHALL NOT alter column widths, data projection, counts,
ordering, row heights, footer/paginator geometry, Transactions semantics, logo,
Overview, shell, Telemetry structure, runtime security, or launcher behavior.

If this bounded corrective does not fully eliminate the residual, the Operator has
explicitly directed that no further TSK-014 corrective loop is required for this minor
DataTable alignment difference; the residual may be accepted and TSK-014 closure may
proceed subject to the remaining governed validation/promotion gates.

### 9.6 Final v7 comparison and accepted residual — 2026-10-03

After the v7 row-renderer corrective and a fresh candidate restart, both dashboards were
measured again at an actual 1440x900 viewport. The candidate now uses the same explicit
UUI `DataTableRow` composition and carries `compact-table-row` on Executions,
Validations, and Transactions. All material data, identity, count, ordering, column,
row-height, footer/pagination, logo, shell, and console-parity criteria remain satisfied.

The final inner-cell offset remains measurable but minor:

- mature runner first-column child inset: 25px; candidate: 13px;
- mature runner subsequent-cell child inset: 13px; candidate: 7px;
- residual delta: approximately 12px for the first column and 6px for subsequent cells;
- the residual is consistent across Executions, Validations, and Transactions;
- candidate console remains at zero errors and zero warnings during the final comparison.

Per the Operator's explicit preauthorized stop condition, this residual is ACCEPTED and
no further TSK-014 corrective is required. This acceptance is limited to the minor
DataTable inner-cell alignment difference described above and does not waive any other
mechanical, semantic, changed-path, promotion, or clean-main requirement.

The next product concern after TSK-014 governance completion is a separately governed
OTEL telemetry integration task built on this accepted dashboard baseline.

## 10. Promotion and completion

Promotion requires:

- focused proof PASS;
- mechanical validation PASS;
- semantic self-assessment PASS;
- exact changed-path reconciliation;
- confirmation that the adapter 1.1.0 release surface is unchanged;
- explicit Operator visual acceptance and promotion authorization.

Completion was achieved when the parity baseline was promoted and reconciled on clean
`main`. Terminal disposition is recorded by `TSK-014-CLOSURE`.

OTEL integration remains a separately governed follow-on task.
