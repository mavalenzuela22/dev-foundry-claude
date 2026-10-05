---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-016
  type: TSK
  title: Integrate Local Operations Dashboard into Reusable Claude Adapter Package
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-016-package-dashboard-distribution
ownerRole: governance-author
canonical: true
scope:
  owns:
    - claude-adapter-dashboard-packaging
    - claude-adapter-dashboard-cli
    - claude-adapter-installation-documentation
    - claude-adapter-package-consumer-smoke
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - local-operations-dashboard
  excludes:
    - dashboard-product-redesign
    - telemetry-collector-change
    - telemetry-launcher-change
    - telemetry-enable-policy-change
    - consumer-authority-mutation
    - consumer-cutover
    - package-registry-selection-or-publication
    - release-tag-publication
    - mature-runner-modification
    - reusable-dev-foundry-methodology
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - SPC-004
    - SPC-005
    - SPC-006
    - OPS-003
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-012
    - TSK-015-CLOSURE
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-012
    - TSK-015-CLOSURE
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-016] PROJECT - Integrate Local Operations Dashboard into Reusable Claude Adapter Package

## 1. Purpose

Bring the accepted local operations dashboard into the reusable
`@dev-foundry/claude-adapter` package so every adapter installation can launch the
same supported dashboard against the consumer repository in which the adapter is used.

TSK-012 established the reusable package before TSK-014 and TSK-015 created the
dashboard. This task closes that distribution gap without redesigning the dashboard.

The Operator authorizes implementation, validation, any audit required by current
governance, promotion, integration, reconciliation, cleanup, README documentation,
and formal closure end-to-end while all applicable gates remain PASS.

## 2. Required outcome

A packed and installed adapter SHALL include a runnable local operations dashboard
with the TSK-015 accepted baseline, including Throughput, Claude OTEL, and
Transactions.

The installed dashboard SHALL:

- run through the package CLI, with a supported command such as
  `dev-foundry-claude dashboard --port <port>`;
- resolve the consumer repository root rather than reading producer state;
- remain read-only, loopback-only on `127.0.0.1`, GET/HEAD-only, Host-validated,
  and preserve the existing dashboard privacy and bounded-read rules;
- require no checkout of `dev-foundry-claude` after the package has been obtained;
- require no nested dashboard dependency installation at runtime;
- use packaged, versioned dashboard runtime/static assets corresponding to the
  adapter release;
- remain covered by the adapter payload integrity manifest.

The adapter release version SHALL advance from the current 1.1.0 baseline because
the shipped runtime surface changes.

## 3. Packaging contract

Implementation SHALL make `npm pack` produce a self-contained adapter tarball that
contains all runtime files needed by the dashboard but excludes producer-only state,
runtime evidence, `node_modules`, task history, and consumer data.

Dashboard build-time dependencies may remain producer build dependencies, but an
installed consumer MUST NOT need to run Vite, TypeScript, React/UUI build tooling,
or `npm --prefix tools/dashboard install` merely to launch the packaged dashboard.

The payload manifest SHALL cover the shipped dashboard runtime and static assets and
the existing integrity-pin behavior SHALL remain fail-closed.

Package generation SHALL remain deterministic/reproducible under the existing
TSK-012 package model.

## 4. Consumer-root behavior

When the dashboard command is invoked inside a consumer repository:

1. resolve the consumer git top-level by default;
2. allow an explicit consumer root only if the existing CLI conventions make that
   safe and testable;
3. require the expected DEV FOUNDRY consumer structure needed by the dashboard;
4. read only that consumer's local evidence;
5. never fall back to producer paths or package installation paths as evidence roots.

The dashboard UI assets may be served from the installed package path. Evidence must
come from the consumer root.

## 5. README requirement

The repository root `README.md` is a required product deliverable of TSK-016 and
SHALL be brought up to date.

It SHALL explain, in concise user-facing form:

- what `dev-foundry-claude` is and what the package includes;
- prerequisites;
- how to build/create the package from the producer repository;
- how to install the packed adapter in a consumer repository;
- the `adopt plan|apply|status` flow and the authority boundary;
- how `mcp`, `run`, and the new dashboard command work;
- how to launch the dashboard, its loopback/read-only security posture, and what
  evidence it displays;
- package integrity/pinning at a useful operational level;
- upgrade/reinstallation expectations that are actually implemented today;
- clear separation between producer, package, and consumer state.

### 5.1 Nice-to-have: installation without cloning the producer

Investigate whether a user can install a governed immutable package without first
cloning the `dev-foundry-claude` repository, using only mechanics already permitted
by current authority.

If this is mechanically possible without choosing/publishing to a registry,
inventing a release channel, weakening the immutable package identity, or requiring
new provider credentials, implement and document the verified path.

If current authority or mechanics do not support it safely, do NOT invent a
distribution channel. Document it as a follow-on limitation; this nice-to-have does
not block TSK-016 closure.

## 6. Validation and acceptance

Mechanical validation SHALL include at minimum:

- clean root dependency install;
- clean dashboard dependency install/build/typecheck/test in the producer;
- full root test suite;
- `npm pack` from the producer;
- verification that the tarball/payload manifest contains the required dashboard
  runtime and excludes forbidden producer/runtime state;
- installation of that tarball into an isolated temporary consumer fixture;
- invocation of the installed CLI from that fixture;
- launch or bounded server-level smoke of the packaged dashboard against the
  temporary consumer root;
- health/API verification proving consumer-root evidence is used;
- proof the packaged dashboard does not depend on the producer checkout;
- `git diff --check`.

Tests SHALL cover CLI argument rejection, root resolution, loopback-only serving,
packaged asset availability, payload verification, and a regression proving the
existing adoption/MCP/run behaviors remain intact.

## 7. Explicit non-goals

TSK-016 does not authorize:

- redesigning the accepted TSK-015 dashboard;
- changing telemetry collection or launcher behavior;
- changing consumer authority or performing a consumer cutover;
- publishing to npm or another registry;
- creating release tags/releases;
- mutating a real consumer repository;
- changing the mature runner;
- changing DEV FOUNDRY methodology.

Any required follow-on outside these bounds must be surfaced as a blocker or
separate governed task.
