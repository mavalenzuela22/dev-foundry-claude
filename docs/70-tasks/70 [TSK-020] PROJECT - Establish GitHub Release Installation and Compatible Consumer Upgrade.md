---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-020
  type: TSK
  title: Establish GitHub Release Installation and Compatible Consumer Upgrade
  status: IN_PROGRESS
artifactVersion: "1"
authorityScope: tsk-020-github-release-install-upgrade
ownerRole: governance-author
canonical: true
scope:
  owns:
    - github-release-adapter-distribution
    - no-checkout-consumer-installation-implementation
    - compatible-consumer-upgrade
    - adapter-minor-release-1.3.0
    - pago-1.2.2-to-1.3.0-upgrade-proof
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - adapter-cli
      - release-automation
  excludes:
    - public-npm-registry-publication
    - github-packages-publication
    - silent-automatic-update
    - consumer-authority-mutation
    - reusable-methodology-change
    - PagoElectronico-product-code
    - database-or-iis-runtime-change
authority:
  governedBy:
    - ADR-005
    - SPC-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-019
lifecycle:
  phase: in-progress
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-020] PROJECT - Establish GitHub Release Installation and Compatible Consumer Upgrade

## 1. Purpose

Make `dev-foundry-claude` installable and upgradable by a normal consumer
without cloning or building the producer repository.

The target user understands the DEV FOUNDRY concepts documented by the project,
but should not need knowledge of npm packing, payload manifests, producer commits,
Windows npm shims, line-ending correctives or internal release engineering.

## 2. Required outcome

Release `@dev-foundry/claude-adapter` 1.3.0 with the smallest complete product
surface that removes the current operational friction:

1. implement ADR-005 GitHub Release asset production;
2. produce versioned tarball, stable latest-compatible tarball alias and
   `SHA256SUMS`;
3. prove installation with no producer checkout using the GitHub Release asset;
4. add explicit `upgrade plan`, `upgrade apply` and `upgrade status` CLI
   behavior governed by SPC-005;
5. implement only the compatible-upgrade profile: target-identical owned surface
   plus runtime pin replacement; fail closed with `upgrade-migration-required`
   for broader migrations;
6. preserve exact payload self-verification and exact plan SHA enforcement;
7. preserve consumer authority and product code;
8. prove 1.2.2 -> 1.3.0 on a Windows machine-local Pago Electronico clone;
9. after producer promotion/publication, prove the public release can be installed
   on Windows and macOS without a producer checkout;
10. leave the real Pago Electronico repository unchanged during producer proof.
    Its real upgrade/cutover remains a separately governed continuation of
    Pago Electronico TSK-041.

## 3. User-facing baseline

First installation should reduce to the equivalent of:

`npm install -g https://github.com/mavalenzuela22/dev-foundry-claude/releases/latest/download/dev-foundry-claude-adapter.tgz`

followed by:

`dev-foundry-claude --version`

An already prepared consumer upgrade should reduce to a reviewed two-step flow:

- create a deterministic upgrade plan;
- apply that exact plan by hash.

The README may explain concepts at length, but the installation mechanics SHALL
not require a producer checkout, local package build, manual payload-root editing
or direct authority-file editing.

## 4. Acceptance

At minimum PASS:

- dependency restore;
- focused upgrade planner/apply/status tests;
- stale-current-pin and stale-plan rejection;
- `upgrade-migration-required` fail-closed coverage;
- existing adoption, MCP, telemetry and dashboard regression suites;
- package 1.3.0 dry-run and isolated install;
- release asset generation proves versioned tarball and stable alias are
  byte-identical and `SHA256SUMS` is correct;
- Windows temporary Pago 1.2.2-prepared clone -> 1.3.0 compatible upgrade PASS;
- post-upgrade target `adopt status` remains truthful and target replan has no
  runtime mismatch or unintended writes;
- real Pago repository remains unchanged during producer validation;
- `git diff --check`;
- after promotion: actual GitHub Release publication;
- after publication: fresh Windows and macOS installation from the release URL
  with no producer checkout.

## 5. Hard constraints

Do not weaken payload verification, silently follow producer `main`, auto-edit
consumer authority, silently upgrade a repository as a side effect of package
installation, publish to npm/GitHub Packages, or implement arbitrary template
migration under the compatible-upgrade command.

The public release may only be published after the exact candidate is promoted.
