---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-021
  type: DAT
  title: Framework Candidate and Release Integrity Contracts
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - framework-candidate-manifest-v2-contract
    - release-integrity-manifest-v2-contract
    - candidate-release-hash-binding
    - integrity-dag-contract
  appliesTo:
    operations:
      - framework-evolution
      - framework-promotion
  excludes:
    - consumer-product-release-manifests
    - git-provider-metadata
    - runtime-evidence-layout
authority:
  governedBy:
    - OPS-005
    - OPS-008
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-021] DF - Framework Candidate and Release Integrity Contracts

## 1. Purpose

Define closed machine-readable contracts for binding the exact bytes of a DEV
FOUNDRY framework candidate and a promoted immutable release.

These contracts standardize framework integrity, not consumer product packaging.

## 2. Candidate manifest v2

Schema identifier:

`dev-foundry.framework-candidate-manifest.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `candidate_id`
- `base_framework_version`
- `canonical`
- `methodology_authority`
- `authority_index`
- `artifacts`
- `excluded_from_candidate`
- `promotion_preconditions`
- `release_model`
- `invalidation`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal
  `dev-foundry.framework-candidate-manifest.v2`;
- `kind` MUST equal `framework-candidate-manifest`;
- `status` is `authoring | validation-ready | audit-ready | audited |
  promotion-eligible | superseded`;
- `artifact_version`, `candidate_id`, and `base_framework_version` are
  non-empty strings;
- `canonical` MUST be false;
- `methodology_authority` MUST be false until a distinct release is promoted;
- `authority_index` is one repository-relative path/locator to the candidate
  Authority Index.

### artifacts

`artifacts` is a non-empty array. Each entry contains exactly:

- `path`: repository-relative path/locator;
- `role`: stable artifact role;
- `sha256`: lowercase SHA-256, or null only for the manifest's own entry;
- `hash_binding`: `direct | external-self`.

Rules:

- every candidate artifact appears exactly once;
- the manifest itself appears exactly once with
  `sha256: null` and `hash_binding: external-self`;
- every other entry uses `hash_binding: direct` and the hash of its final
  candidate bytes;
- the candidate Authority Index and all framework-distributed profiles/contracts
  are included;
- project-local task/evidence/runtime/configured bindings are excluded unless
  they are intentionally part of reusable methodology.

### excluded_from_candidate

Array of stable category identifiers describing intentionally excluded classes.

### promotion_preconditions

Object with exactly these booleans:

- `terminal_mechanical_validation_required`;
- `governance_author_self_assessment_required`;
- `independent_governance_audit_required`;
- `separate_operator_promotion_authorization_required`;
- `immutable_framework_version_required`;
- `release_integrity_manifest_required`;
- `automatic_consumer_adoption`.

For a canonical DEV FOUNDRY candidate, the first six MUST be true and
`automatic_consumer_adoption` MUST be false.

### release_model

Object with exactly:

- `candidate_snapshot_immutable_after_audit`: boolean, MUST be true;
- `promotion_mutates_candidate`: boolean, MUST be false;
- `distinct_versioned_release_required`: boolean, MUST be true;
- `semantic_payload_preserved`: boolean, MUST be true;
- `allowed_promotion_transform_classes`: array;
- `integrity_graph_acyclic`: boolean, MUST be true.

Allowed promotion transform classes are limited to lifecycle/version identity,
release-namespace routing, canonical/methodology-authority state, and immutable
candidate provenance. Semantic methodology changes are not an allowed transform.

### invalidation

Array of non-empty strings defining conditions that invalidate candidate
eligibility or require manifest reconciliation.

## 3. Release integrity manifest v2

Schema identifier:

`dev-foundry.release-integrity-manifest.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `framework_version`
- `canonical`
- `methodology_authority`
- `source_candidate`
- `artifacts`
- `integrity`

No other top-level fields are valid.

Constraints:

- `kind` MUST equal `release-integrity-manifest`;
- `status` MUST equal `canonical`;
- `framework_version` is a non-empty immutable version string;
- `canonical` and `methodology_authority` MUST both be true.

### source_candidate

Contains exactly:

- `candidate_id`;
- `candidate_manifest_path`;
- `candidate_manifest_sha256`.

The candidate manifest hash is computed after candidate finalization and bound by
promotion evidence or higher routing; it is never written into the candidate
manifest itself.

### artifacts

Non-empty array. Each release artifact entry contains exactly:

- `path`;
- `role`;
- `sha256`.

The release integrity manifest MUST NOT include its own final hash as content.

### integrity

Contains exactly these booleans:

- `release_artifacts_hashed_after_materialization`;
- `manifest_self_hash_embedded`;
- `integrity_graph_acyclic`;
- `candidate_snapshot_mutated`;
- `semantic_payload_preserved`.

For a conforming release:

- all except `manifest_self_hash_embedded` and
  `candidate_snapshot_mutated` MUST be true;
- those two MUST be false.

## 4. Promotion evidence

Promotion evidence is governed evidence rather than a new Source of Truth
document type.

It MUST bind at least:

- explicit Operator-authorized framework version;
- exact candidate ID and candidate-manifest hash;
- exact release artifact hashes;
- exact release-integrity-manifest path and hash;
- declared promotion transform;
- proof that semantic/normative payload did not change outside that transform;
- proof that the candidate snapshot remained unchanged;
- proof that the integrity dependency graph is acyclic.

Its storage format is product/repository implementation detail unless another
framework DAT standardizes it.

## 5. Integrity dependency order

The required dependency order is acyclic:

1. finalize candidate artifacts except the candidate manifest;
2. hash those candidate artifacts;
3. write the candidate manifest with direct hashes and external-self binding;
4. after audit and Operator promotion authorization, materialize release
   artifacts in a distinct immutable version namespace;
5. hash final release artifacts;
6. write the release integrity manifest without its own hash;
7. hash that manifest;
8. bind the manifest hash in promotion evidence and/or higher authority routing.

No layer may require a hash that can be known only after mutating the same layer
or a dependency whose hash already depends on it.

## 6. Versioning

Any incompatible shape or invariant change requires a new schema identifier.
