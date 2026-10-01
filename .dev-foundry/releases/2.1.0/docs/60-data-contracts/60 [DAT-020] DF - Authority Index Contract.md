---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-020
  type: DAT
  title: Authority Index Contract
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - authority-index-v2-contract
    - authority-route-contract
    - authoritative-home-uniqueness
  appliesTo:
    operations:
      - authority-routing
  excludes:
    - repository-discovery-runtime
    - connector-specific-routing
authority:
  governedBy:
    - OVR-001
    - OVR-002
    - OPS-006
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-020] DF - Authority Index Contract

## 1. Purpose

Define a closed machine-readable contract for routing bounded concepts to their
authoritative homes.

Schema identifier:

`dev-foundry.authority-index.v2`

An Authority Index routes to authority. It does not become the normative owner
of every rule it references.

## 2. Required top-level fields

Required:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `canonical`
- `subject`
- `routes`
- `bindings`
- `rules`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal `dev-foundry.authority-index.v2`;
- `kind` MUST equal `authority-index`;
- `status` is `candidate | active | superseded | retired`;
- `canonical` is boolean.

## 3. subject

Required object with exactly:

- `kind`: `framework-candidate | framework-release | project`;
- `id`: stable identifier;
- `version`: framework/project version string or null;
- `base_version`: prior/adopted framework version string or null;
- `manifest`: path/locator or null.

The subject states what boundary this index routes.

## 4. routes

Required array.

Each route contains exactly:

- `id`: stable route identifier;
- `path`: repository-relative path or stable locator;
- `authority_class`: one of
  `methodology | product | configured | decision | task | historical`;
- `governs`: non-empty array of unique concern identifiers;
- `section_id`: stable section ID or null.

Rules:

- active route IDs are unique;
- one governed concern has exactly one active authoritative route within the
  same applicable scope;
- paths/locators MUST resolve before the route can be used as authority;
- a `historical` route cannot satisfy active authority;
- `section_id` is used only when the target document registers that section
  under DAT-008.

## 5. bindings

Required array.

Bindings connect configured or external local project artifacts needed to use
the routed authority but which do not own the routed reusable rule.

Each binding contains exactly:

- `id`;
- `path`;
- `kind`;
- `authority_class`: `configured | runtime | historical`;
- `required`: boolean.

Examples include a POP, Platform Bootstrap, local Capability Profile, or
historical migration record.

## 6. rules

Required object with exactly these booleans:

- `single_authoritative_home_required`;
- `unindexed_active_authority_forbidden`;
- `evidence_is_normative`;
- `consumer_copy_is_canonical`;
- `runtime_capability_grants_authority`;
- `automatic_framework_upgrade`.

For a conforming DEV FOUNDRY index:

- the first two MUST be true;
- the remaining four MUST be false.

## 7. Validation

Mechanical validation may prove:

- schema/field conformance;
- unique route IDs;
- unique active governed concerns;
- target resolution;
- section resolution;
- required binding resolution;
- fixed framework boolean invariants.

Semantic review remains responsible for whether the chosen authoritative home is
correct and whether the route's declared `governs` set is truthful.

## 8. Versioning

An incompatible field, shape, or invariant change requires a new Authority Index
schema identifier.

A project may add routes and bindings under v2 without changing the schema when
the shape and semantics remain unchanged.
