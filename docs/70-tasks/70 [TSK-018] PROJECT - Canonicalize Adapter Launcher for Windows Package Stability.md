---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-018
  type: TSK
  title: Canonicalize Adapter Launcher for Windows Package Stability
  status: CLOSED
artifactVersion: "2"
authorityScope: tsk-018-launcher-lf-package-corrective
ownerRole: governance-author
canonical: true
scope:
  owns:
    - launcher-line-ending-canonicalization
    - windows-package-install-byte-stability
    - adapter-patch-release-1.2.2
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - adapter-cli-launcher
  excludes:
    - payload-verifier-weakening
    - reusable-methodology-change
    - public-registry-publication
    - consumer-product-mutation
    - dashboard-behavior-change
    - telemetry-change
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - SPC-005
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  derivedFrom:
    - TSK-017
  closureArtifact: TSK-018-CLOSURE
lifecycle:
  phase: closed
  blockedBy: []
  closureArtifact: TSK-018-CLOSURE
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-018] PROJECT - Canonicalize Adapter Launcher for Windows Package Stability

## 1. Purpose

Fix the second Windows consumer defect discovered after promotion of adapter 1.2.1.

Exact Windows diagnosis proved npm rewrites only the launcher shebang line ending:
packed `#!/usr/bin/env node\r\n` becomes installed
`#!/usr/bin/env node\n`, changing `bin/dev-foundry-claude.js` from 5149 to
5148 bytes and correctly causing exact payload-manifest verification to fail.

## 2. Required outcome

Release `@dev-foundry/claude-adapter` 1.2.2 with a canonical LF launcher such
that supported npm installation no longer mutates any manifest-listed payload byte.

The smallest safe complete corrective SHALL:

- store `bin/dev-foundry-claude.js` with LF bytes;
- add repository line-ending authority sufficient to preserve LF for that launcher
  across producer checkouts;
- keep the 1.2.1 direct-child `node_modules/.bin/` installer-artifact exception
  unchanged;
- keep every manifest-listed payload byte fail-closed by exact size + SHA-256;
- add regression coverage for canonical LF launcher/shebang and installed package
  stability;
- advance package metadata and minimal README version guidance to 1.2.2;
- prove the exact candidate in the real Windows Pago Electronico consumer before
  promotion/closure.

## 3. Hard constraints

Do not normalize payload bytes at verification time, accept alternate hashes,
ignore the launcher, broaden the `.bin` exception, change dependencies, or
modify adoption/MCP/dashboard/telemetry semantics.

## 4. Acceptance

At minimum PASS:

- producer dependency restore;
- launcher LF assertion;
- dashboard build/typecheck/tests;
- root tests;
- package dry-run;
- isolated package install;
- exact real Windows consumer `adopt plan` against Pago Electronico;
- `git diff --check`.

Promotion and formal closure are permitted only after the Windows consumer proof
passes with zero manifest-listed mismatches.


## 5. Terminal disposition

TSK-018 is CLOSED after producer validation PASS, exact Windows/Pago V014 consumer
proof PASS, promotion through PR #36, integration/reconciliation/cleanup, and
formal closure through TSK-018-CLOSURE.
