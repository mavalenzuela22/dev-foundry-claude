---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-018-CLOSURE
  type: CLOSURE
  title: Canonicalize Adapter Launcher for Windows Package Stability Closure
  status: CLOSED
artifactVersion: "1"
authorityScope: tsk-018-launcher-lf-package-stability-terminal-disposition
ownerRole: evidence-custodian
canonical: true
scope:
  owns:
    - tsk-018-terminal-disposition
    - adapter-1.2.2-windows-package-stability-closure
  appliesTo:
    tasks:
      - TSK-018
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
    - TSK-018
    - OPS-004
    - OPS-007
    - OPS-008
  supersedes: []
traceability:
  dependsOn:
    - TSK-018
lifecycle:
  phase: closed
  dependsOn:
    - TSK-018
  blockedBy: []
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-018-CLOSURE] PROJECT - Canonicalize Adapter Launcher for Windows Package Stability Closure

## 1. Purpose

Record terminal disposition for TSK-018 after adapter 1.2.2 made the CLI launcher
byte-stable across Windows checkout/package/install without weakening exact payload
verification.

## 2. Final disposition

`CLOSED — ADAPTER 1.2.2 LAUNCHER LF CANONICALIZATION VALIDATED ON PRODUCER AND REAL WINDOWS CONSUMER, PROMOTED, RECONCILED, CLEANED UP, AND FORMALLY CLOSED`

Verified lineage:

- producer implementation execution:
  `execution_434a475e8eccabc33dfc0d4531bb612ab387fd41ced85723494944efbdc77eaf`;
- producer execution status: PASS; 9/9 validation commands passed;
- canonical closure evidence envelope: `TSK-018-closure-20261005`;
- independent Governance Audit: not required by current project audit triggers;
- exact product candidate:
  `bf5f590b609e7aed972ad25be12e17ea984a6da8`;
- real Windows/Pago smoke:
  `TSK-041-WINDOWS-RELEASE-SMOKE-V014` /
  `execution_31cfb0533625c21071837005e460bff81234cc06fe0adab228cf98882ef0d1c7` -> PASS;
- V014 used Windows checkout with `core.autocrlf=true` and observed
  `bin/dev-foundry-claude.js: text: set; eol: lf`;
- source, packed, and installed launcher SHA-256:
  `6b37ed4d09efb17258df83edf53d88d44c86fa2c1be35c06d75c6638184bc6cd`;
- launcher size: 5061 bytes;
- payload manifest SHA-256:
  `c2beefd78db3417c20d313cf7e189152c134d1f6abc11c14555630e2036462c2`;
- manifest verification: 1213 listed, 0 missing, 0 mismatched;
- generated package SHA-256:
  `6a32bb742b6102f9859492be62795eab980e1a1fda29d4baacd8bc1e863f4774`;
- Windows `adopt plan`: `ready`, blockers empty, consumer repository unchanged;
- Windows plan SHA-256:
  `950af843641c4a717fe0666b2dc6ab10add1aaf18a2e9cd1357560219ffdf82b`;
- promotion pull request: #36;
- promotion merge/default-branch head:
  `4d79923bb9bcdda3d3efed061e0b91c25a85dc2c`;
- promotion transaction: `tx_tsk018_candidate_20261005`;
- integration digest:
  `7e21306c20be2532af166d494cccd99497685ab6c65bb95226d6498b0e805a35`;
- reconciliation digest:
  `60a9aaf7fee42d945c8ab4ca06c7df1db8a8d94fd9fb76b85adc3284a11d01b1`;
- cleanup digest:
  `9d0c74595f391951eb453bee676549260b807bc179cf6005d1c2aa8df16e621b`.

## 3. Delivered scope

TSK-018 delivered the smallest safe complete producer correction:

- package version advanced to `1.2.2`;
- root `.gitattributes` pins only `bin/dev-foundry-claude.js` to LF;
- the launcher is stored with canonical LF bytes and npm no longer rewrites a
  manifest-listed executable byte on the proven Windows path;
- regression coverage proves canonical LF, bounded `.bin` tolerance, and
  rejection of unlisted payload content;
- `src/adopt/pin.js` remained unchanged from the promoted 1.2.1 verifier;
- every manifest-listed payload byte remains fail-closed by exact size and SHA-256;
- README package/version guidance identifies 1.2.2 and the LF launcher boundary.

## 4. Known limits

TSK-018 does not establish a public registry, hosted package channel, release tag,
or automatic consumer upgrade mechanism. The proven package handoff remains a
governed immutable artifact flow.

TSK-018 does not apply the Pago Electronico adoption plan. That consumer cutover
remains governed by Pago Electronico TSK-041.

## 5. Final decision

The Operator authorized the bounded corrective through implementation, real Windows
consumer proof, promotion, reconciliation, cleanup and closure while gates remained
PASS. Those conditions are satisfied. TSK-018 is formally closed when this closure
record and reconciled routing are integrated to clean `main`.
