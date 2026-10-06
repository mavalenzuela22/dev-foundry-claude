---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: TSK-017
  type: TSK
  title: Fix Windows Installed Payload Verification and Consumer Packaging Guidance
  status: IN_PROGRESS
artifactVersion: "2"
authorityScope: tsk-017-windows-installed-payload-pin-corrective
ownerRole: governance-author
canonical: true
scope:
  owns:
    - windows-installed-payload-verification
    - npm-bin-shim-integrity-boundary
    - cross-platform-package-consumer-smoke
    - adapter-installation-documentation-corrective
    - adapter-patch-release
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
      - payload-integrity-verifier
      - consumer-installation-documentation
  excludes:
    - public-registry-publication
    - public-release-channel-selection
    - reusable-dev-foundry-methodology
    - mature-runner-modification
    - consumer-product-code
    - consumer-database-or-runtime
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - SPC-005
    - OPS-003
    - OPS-005
    - OPS-007
    - OPS-008
    - OPS-009
  supersedes: []
traceability:
  dependsOn:
    - TSK-016-CLOSURE
lifecycle:
  phase: in-progress
  dependsOn:
    - TSK-016-CLOSURE
  blockedBy:
    - TSK-018
  promotionRequired: true
portability: project-specific
---

# 70 [TSK-017] PROJECT - Fix Windows Installed Payload Verification and Consumer Packaging Guidance

## 1. Purpose

Correct a real Windows consumer defect discovered while dogfooding the closed
TSK-016 package in Pago Electronico.

The exact TSK-016 runtime payload builds successfully on Windows with the same
canonical payload-manifest identity as the accepted producer build:

`911931b64ffa1b94b2a089a23def034fee4a597ae7c84c05ca89bf57424ed4de`.

After normal Windows `npm install`, npm creates regular command shims under
`node_modules/.bin/`. The current verifier tolerates installer-created symlinks
there but rejects regular files, so `selfPin()` rejects an otherwise untampered
Windows installation before `adopt plan` can run.

Pago Electronico diagnosis observed only these additional installer-created files,
with no missing or modified manifest-listed payload bytes:

- `node_modules/.bin/yaml`
- `node_modules/.bin/yaml.cmd`
- `node_modules/.bin/yaml.ps1`

The Operator authorizes this bounded corrective, validation, patch release,
README correction, promotion, integration, reconciliation, cleanup and closure
while applicable gates remain PASS.

## 2. Required outcome

Release `@dev-foundry/claude-adapter` 1.2.2 so that:

1. every manifest-listed payload byte remains fail-closed by exact size and SHA-256;
2. installer-generated `node_modules/.bin/` launch artifacts are treated as
   installer-owned rather than payload-owned;
3. arbitrary unlisted files outside that exact boundary still fail verification;
4. the packaged `bin/dev-foundry-claude.js` launcher has a canonical LF shebang boundary that npm does not rewrite during Windows install;
5. a real Windows offline install verifies and can run `adopt plan`;
6. existing adoption, MCP, launcher and dashboard behavior remains unchanged;
7. README explains the Windows behavior and archive-vs-payload identity plainly.

## 3. Integrity boundary

The payload manifest remains the authoritative installed-runtime content pin.

The verifier SHALL continue to reject missing or changed manifest-listed files,
unlisted regular files outside `node_modules/.bin/`, unexpected filesystem
objects outside explicitly tolerated installer output, version drift, and
manifest drift.

A corrective MAY tolerate regular package-manager launch shims under the exact
`node_modules/.bin/` boundary in addition to existing symlink tolerance.
Tests must prove the exception is path-bounded.

## 4. Second Windows finding — launcher shebang normalization

The promoted 1.2.1 package fixed the installer-generated `.bin` shim boundary but
the exact Windows consumer smoke still failed closed. Byte diagnosis proved that
npm rewrites only the first line ending of the package executable:

- packed: `#!/usr/bin/env node\r\n`;
- installed: `#!/usr/bin/env node\n`;
- packed size: 5149 bytes;
- installed size: 5148 bytes;
- first differing offset: 19;
- all other observed payload differences were already explained by installer-owned
  `node_modules/.bin/` shims.

The 1.2.2 corrective SHALL make the launcher packaging stable across supported
checkouts/installers by storing and enforcing the executable with an LF shebang
before payload-manifest generation. The preferred minimal mechanism is repository
line-ending authority for the launcher plus canonical LF source bytes.

The verifier MUST NOT accept two hashes, normalize payload bytes while verifying,
or otherwise weaken exact manifest verification to accommodate this behavior.

## 5. Cross-platform identity

Documentation SHALL distinguish:

- the concrete `.tgz` archive delivered to a consumer, whose SHA-256 verifies
  that exact delivered file; and
- the canonical installed payload identity, the SHA-256 of
  `payload-manifest.json`.

Do not claim cross-platform tarball byte identity unless mechanically proven.

## 6. Validation and acceptance

At minimum:

- `npm ci`;
- dashboard dependency install/build/typecheck/test where packaging invokes it;
- root `npm test`;
- `npm pack --dry-run --json`;
- isolated offline package install;
- installed self-verification/adoption smoke;
- explicit Windows-style regular `.bin` shim regression;
- rejection of unlisted files outside `.bin`;
- `git diff --check`;
- real Windows consumer smoke in Pago Electronico before closure.

## 7. Explicit non-goals

TSK-017 does not authorize public package publication, registry/release-channel
selection, methodology changes, mature-runner changes, or Pago Electronico
product/database/runtime mutation.


## 8. Corrective successor

TSK-018 owns the post-1.2.1 launcher LF packaging corrective discovered by the real Windows consumer smoke. TSK-017 remains in-progress until TSK-018 proves the 1.2.2 consumer path and supplies terminal corrective evidence.
