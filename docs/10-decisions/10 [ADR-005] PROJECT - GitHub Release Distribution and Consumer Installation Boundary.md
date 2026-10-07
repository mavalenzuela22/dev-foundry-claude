---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-005
  type: ADR
  title: GitHub Release Distribution and Consumer Installation Boundary
  status: ACCEPTED
artifactVersion: "3"
authorityScope: claude-adapter-github-release-distribution
ownerRole: governance-author
canonical: true
scope:
  owns:
    - github-release-adapter-distribution-channel
    - claude-adapter-release-asset-layout
    - no-checkout-consumer-installation
    - latest-release-acquisition-alias
    - side-by-side-upgrade-target-acquisition
  appliesTo:
    components:
      - dev-foundry-claude
      - claude-adapter-package
    operations:
      - adapter-release
      - consumer-installation
  excludes:
    - public-npm-registry-publication
    - github-packages-publication
    - silent-consumer-upgrade
    - consumer-authority-mutation
    - methodology-change
authority:
  governedBy:
    - ADR-003
    - ADR-004
    - OPS-007
  supersedes: []
lifecycle:
  phase: accepted
portability: project-specific
---

# 10 [ADR-005] PROJECT - GitHub Release Distribution and Consumer Installation Boundary

## 1. Context

The adapter package is already self-contained and integrity-pinned, but the
consumer handoff still assumes somebody first obtains a producer-built tarball.
Dogfooding in Pago Electronico proved that this operational seam is too expensive:
a normal user should not clone, build or understand the producer repository just
to install the Claude adapter.

## 2. Decision

1. GitHub Releases for `mavalenzuela22/dev-foundry-claude` are the official
   downloadable distribution channel for the adapter.
2. A released version SHALL provide:
   - `dev-foundry-claude-adapter-<version>.tgz`;
   - stable alias `dev-foundry-claude-adapter.tgz` with identical bytes;
   - `SHA256SUMS` covering both tarball names.
3. The release assets are produced from the exact governed release commit through
   repository release automation. Consumers do not build the adapter.
4. A first-time consumer installation SHALL require no producer checkout. The
   baseline cross-platform install UX is:
   `npm install -g https://github.com/mavalenzuela22/dev-foundry-claude/releases/latest/download/dev-foundry-claude-adapter.tgz`.
5. The `latest` alias is acquisition convenience only. After installation,
   `dev-foundry-claude --version`, the package payload manifest and the adapter
   self-pin determine the exact release identity.
6. Installing a newer package does not upgrade any repository. Consumer upgrade
   remains an explicit planned/applied operation governed by SPC-005.
7. Release publication happens only after producer validation and promotion. A
   GitHub Release is not created from an unpromoted working tree or task branch.
8. The anonymous no-checkout installation URL in this decision requires the
   producer repository and its GitHub Release assets to be publicly readable.
   Repository visibility is therefore an operational precondition of this
   distribution baseline, not an adapter capability.
9. A private repository MAY use an authenticated GitHub acquisition flow, but
   that flow is outside this baseline and MUST NOT be represented as equivalent
   to the anonymous public installation UX.
10. A self-update-capable consumer SHALL acquire a target release side-by-side
    with the runtime serving the current governed session. Target acquisition and
    integrity verification do not update the consumer pin, activate target authority
    or replace the source runtime before the authorized cutover.
11. Migration material required by ADR-007/SPC-008 SHALL be payload-integrity-bound
    as part of the immutable target release. Producer `main` or mutable release
    prose cannot substitute for the migration material carried by that release.

## 3. Consequences

- End users no longer need the producer repository checkout.
- The baseline public install command requires no GitHub credentials because the
  producer repository and release assets are publicly readable.
- Making the producer repository private changes the acquisition boundary and
  requires a separately documented authenticated flow.
- Installation is the same command shape on Windows, macOS and Linux where Node
  and npm are available.
- Package build/release engineering remains a producer responsibility.
- Existing payload integrity and fail-closed runtime pinning remain unchanged.
- The adapter can later add another distribution channel without changing
  consumer release identity.
- First-time global installation and side-by-side upgrade staging are different
  acquisition modes. A future implementation may use an isolated npm prefix,
  extracted verified tarball or equivalent staging location, but it must preserve
  the source runtime until cutover.

## 4. Alternatives not chosen

- Require a producer checkout and local `npm pack`: too much consumer friction.
- Use producer `main` or a Git ref as the install source: not an immutable
  release boundary and may require build lifecycle behavior.
- Publish immediately to the public npm registry: unnecessary additional
  governance and account/repository publication surface for the current need.
