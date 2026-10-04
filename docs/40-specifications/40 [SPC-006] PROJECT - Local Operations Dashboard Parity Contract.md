---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: SPC-006
  type: SPC
  title: Local Operations Dashboard Parity Contract
  status: ACTIVE
artifactVersion: "1"
authorityScope: local-operations-dashboard-parity
ownerRole: governance-author
canonical: true
scope:
  owns:
    - producer-local-dashboard-parity
    - producer-dashboard-navigation-and-visual-contract
    - producer-dashboard-package-isolation
  appliesTo:
    components:
      - dev-foundry-claude
  excludes:
    - claude-otel-dashboard-integration
    - adapter-release-payload-change
    - consumer-repository-change
    - mature-runner-modification
    - private-runner-observation-protocol-dependency
    - public-or-lan-listener
    - reusable-dev-foundry-methodology
authority:
  governedBy:
    - OVR-001
    - ADR-004
    - OPS-007
    - OPS-008
  supersedes: []
lifecycle:
  phase: active
portability: project-specific
---

# 40 [SPC-006] dev-foundry-claude - Local Operations Dashboard Parity Contract

## 1. Purpose

Define the producer-local operations dashboard baseline for `dev-foundry-claude`.

The dashboard SHALL intentionally present the same visual language, navigation model,
section structure, UUI/Loveship composition and responsive interaction patterns as the
observed `foundry-runner` dashboard, while remaining an independently implemented
producer tool with truthful `dev-foundry-claude` data.

Claude/OpenTelemetry analysis is deliberately deferred. TSK-014 establishes the parity
baseline first; later governed work may add OTEL-derived views on top of this shell.

## 2. Frozen implementation reference

The visual/interaction reference for TSK-014 is the read-only observed
`foundry-runner` repository state:

- branch: `main`;
- commit: `c5946e880c09bb362f47d46919cd303eb30db75f`;
- UI stack observed in `src/dashboard-ui/**`;
- runtime/read-model behavior observed in `src/dashboard/**` and
  `src/dashboard.ts`.

That repository is implementation reference only. It is not project or methodology
authority. Runtime/source implementation SHALL be reproduced independently and runner
history is not imported. One deliberate static-asset exception applies: the MainMenu
logo SHALL be byte-identical to the frozen mature-runner asset
`src/dashboard-ui/assets/foundry-runner.svg` at the commit above, per explicit Operator
visual direction. Later runner changes do not silently move this task's acceptance
target.

## 3. Required visual and navigation parity

The dashboard SHALL use the same UUI Loveship product-shell composition and expose the
same primary sections and route shapes:

| Section | Route |
| --- | --- |
| Overview | `/` |
| Live Activity | `/calls` |
| Live Activity detail | `/calls/:callId` |
| Executions | `/executions` |
| Execution detail | `/executions/:taskId/:executionId` |
| Validations | `/validations` |
| Validation detail | `/validations/:validationId` |
| Telemetry | `/telemetry` |
| Transactions | `/transactions` |
| Transaction detail | `/transactions/:transactionId` |

Telemetry SHALL initially retain the same `Throughput` and `Transactions` tab
structure. OTEL-derived Claude telemetry is not part of TSK-014.

Parity also includes, where applicable:

- the Loveship `MainMenu`, product-logo slot and collapsed `More` behavior;
- the connection/status strip placement and visual hierarchy;
- UUI panels, status indicators, search/filter controls, compact tables and pagination;
- list/detail navigation, detail sections, tabs and technical payload presentation;
- loading, empty, error, stale/unavailable and reconnect-style visual states;
- the same responsive breakpoints and small-screen composition intent;
- matching spacing, typography hierarchy, divider treatment and UUI token usage.

Rendered parity is structural, not merely thematic. At the frozen desktop reference
viewport (1440x900 class), the producer dashboard SHALL preserve the reference
composition and geometry within normal font/rendering tolerance:

- the 112x40 product-logo slot begins at the left edge of the MainMenu; product
  identity may change, but an extra horizontal inset may not shift the navigation;
- the status strip keeps the same single-row hierarchy and approximately the same
  48px footprint as the reference; truthful caption text may differ, but additional
  badges, refresh controls or parallel status clusters SHALL NOT change the shell;
- page title typography and semantic heading level match the reference rendered
  hierarchy, including the reference `Inter, Arial, sans-serif` body stack;
- Overview uses the same single cockpit composition: `Operational snapshot`,
  `Latest execution`, `Latest validation`, `Earlier executions`, and
  `Earlier validations`; summary-count cards and a two-column recent-activity layout
  are not parity-equivalent substitutes;
- Executions uses the same title/search/table/footer composition, current-page search,
  compact row density, column order `Task | Status | Executor | Time`, and footer
  pagination; extra page subtitles, refresh buttons, state dropdowns or a `Record`
  column are not parity-equivalent substitutes;
- Validations and Transactions follow the corresponding frozen reference list/detail
  compositions rather than a generic shared CRUD layout when the reference differs;
- Telemetry retains the frozen reference `Telemetry / Diagnostics` panel hierarchy and
  tab presentation; unavailable Throughput preserves that hierarchy while stating the
  truthful unavailable condition;
- CSP and asset policy SHALL NOT create repeated browser-console font-load failures in
  normal local use. The rendered font stack must match the frozen reference without
  weakening loopback-only runtime isolation.

The Operator's browser comparison is an acceptance input. If the candidate is visibly
non-equivalent at the same viewport, TSK-014 remains incomplete even when component,
route and mechanical tests pass.

## 4. Truthful allowed divergence

Visual parity MUST NOT fabricate operational facts.

The only intentional divergences from the reference are:

- product/runtime text identity remains `dev-foundry-claude` where independently rendered, while the MainMenu graphical logo uses the exact frozen mature-runner asset required by section 2;
- record values come only from this repository's observable data;
- connection/status captions describe the actual available source;
- a section whose source is unavailable renders the parity-equivalent unavailable or
  empty state instead of synthetic data.

Truthfulness overrides cosmetic literalism.

## 5. UI technology baseline

The producer dashboard SHALL use the same relevant UI dependency versions observed in
the frozen reference:

- React `19.1.0`;
- React DOM `19.1.0`;
- `@epam/assets` `6.5.1`;
- `@epam/loveship` `6.5.1`;
- `@epam/uui` `6.5.1`;
- `@epam/uui-components` `6.5.1`;
- `@epam/uui-core` `6.5.1`;
- `history` `4.10.1`;
- Vite `7.0.4` and React plugin `4.6.0`.

The dashboard is a producer-local tool and SHALL own its build dependencies under its
own tool workspace rather than changing the root adapter package dependency graph.

## 6. Producer/package isolation

Dashboard product implementation SHALL live beneath:

`tools/dashboard/**`

A single producer convenience launcher MAY also exist at:

`scripts/dashboard.mjs`

The launcher is a thin entry point only; it SHALL delegate to the dashboard runtime,
add no second implementation, and preserve explicit local-port selection.

TSK-014 SHALL NOT modify the adapter release surface:

- root `package.json` or `package-lock.json`;
- `bin/**`;
- adapter `src/**`;
- `templates/**`;
- `payload-manifest.json`;
- adapter version `1.1.0`.

The dashboard is not part of the adapter package payload and does not create a new
adapter release identity. No consumer is modified or upgraded.

## 7. Initial data boundary

TSK-014 may project read-only operational views from repository-local durable evidence
already created by the process-bound runner under:

- `.dev-foundry/executions/**`;
- `.dev-foundry/validations/**`;
- `.dev-foundry/repository-transactions/**`;
- the minimum related request metadata required to resolve those records.

The dashboard SHALL NOT mutate those artifacts or treat them as product authority.

For TSK-014:

- Overview may derive recent execution and validation summaries from durable evidence;
- Executions SHALL project the same bounded candidate model as the frozen reference:
  union valid execution-request registry records with durable execution evidence,
  deduplicate by task/execution-or-request identity, order newest-first by observed time,
  and paginate 20 rows per default page;
- Validations SHALL project only governed validation-request registry records. It SHALL
  NOT recursively reinterpret execution `result.json`, execution validation reports, or
  corrective evidence packets as standalone validation rows;
- Transactions SHALL read governed repository-transaction records and derive the visible
  label from the first safe observed fact among `taskId`, `task`, `operation`, `branch`,
  yielding `Repository transaction · <context>` when such context is safely available;
- list footers use the frozen bounded-snapshot language `records in considered candidates`
  and paginator semantics reflect the validated projected row count;
- Executions, Validations and Transactions expose read-only list/detail views using those
  reference-equivalent identities and projections;
- Live Activity does not create or depend on a new private runner observation protocol;
- Throughput does not reinterpret OTEL as runner call throughput;
- unavailable live sources use the parity-equivalent unavailable state.

Reading `.dev-foundry/telemetry/**` for Claude OTEL analysis is explicitly deferred.

## 8. Local runtime boundary

The dashboard server SHALL:

- bind only to `127.0.0.1`;
- expose only read-only local dashboard APIs and static UI assets;
- perform no repository mutation, execution, validation, promotion or provider action;
- reject unsafe/path-traversal reads fail-closed;
- require no cloud, LAN, tunnel or external telemetry service.

A local configured port is producer mechanics. It must not collide silently with the
runner dashboard port.

## 9. Acceptance

TSK-014 acceptance requires:

1. all routes and primary section labels in section 3 exist;
2. the UI uses the section 5 stack and UUI/Loveship shell;
3. Overview, Executions, Validations and Transactions render truthful local durable data
   when present;
4. unavailable Live Activity/Throughput sources render truthful parity-equivalent states;
5. no OTEL-derived view is implemented;
6. no runtime/source implementation from `foundry-runner` is copied; the only byte-identical reuse is the explicitly governed frozen MainMenu SVG asset;
7. the server binds loopback-only and all APIs are read-only;
8. the root adapter release surface in section 6 is byte-identical to the task base;
9. the nested dashboard typecheck/build/tests pass;
10. `node scripts/dashboard.mjs --port <local-port>` starts the same loopback-only dashboard runtime and fails closed on invalid/occupied ports;
11. root `npm ci`, root `npm test`, and `git diff --check` pass;
12. changed paths remain inside the governed dashboard/docs/launcher boundary;
13. the Operator visually confirms the parity baseline before promotion.

## 10. Evolution

After TSK-014 is promoted, a separate governed task may extend the Telemetry section
with the existing SPC-004 OTEL evidence. That task must preserve this dashboard shell
unless a later explicit product decision changes it.
