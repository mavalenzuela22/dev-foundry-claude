---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: ADR-005
  type: ADR
  title: GitHub Release Distribution and Consumer Installation Boundary
  status: ACCEPTED
artifactVersion: "1"
authorityScope: claude-adapter-github-release-distribution
ownerRole: governance-author
canonical: true
scope:
  owns:
    - github-release-adapter-distribution-channel
    - claude-adapter-release-asset-layout
    - no-checkout-consumer-installation
    - latest-release-acquisition-alias
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
    - OPS-008
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

## 3. Consequences

- End users no longer need the producer repository.
- Installation is the same command shape on Windows, macOS and Linux where Node
  and npm are available.
- Package build/release engineering remains a producer responsibility.
- Existing payload integrity and fail-closed runtime pinning remain unchanged.
- The adapter can later add another distribution channel without changing
  consumer release identity.

## 4. Alternatives not chosen

- Require a producer checkout and local `npm pack`: too much consumer friction.
- Use producer `main` or a Git ref as the install source: not an immutable
  release boundary and may require build lifecycle behavior.
- Publish immediately to the public npm registry: unnecessary additional
  governance and account/repository publication surface for the current need.
