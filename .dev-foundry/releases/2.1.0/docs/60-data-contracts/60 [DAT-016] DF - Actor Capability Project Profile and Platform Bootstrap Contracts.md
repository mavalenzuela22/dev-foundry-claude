---
schemaVersion: dev-foundry.sot-document.v2
artifact:
  id: DAT-016
  type: DAT
  title: Actor, Capability, Project Profile, and Platform Bootstrap Contracts
  status: ACTIVE
artifactVersion: "2.1.0"
authorityScope: reusable-dev-foundry-methodology
ownerRole: governance-author
canonical: true
scope:
  owns:
    - actor-profile-v2-contract
    - capability-profile-v1-contract
    - project-operating-profile-v2-contract
    - platform-bootstrap-v2-contract
    - project-actor-binding-contract
  appliesTo:
    profiles:
      - actor-profile
      - capability-profile
      - project-operating-profile
      - platform-bootstrap
  excludes:
    - product-runtime-schema
    - automatic-platform-configuration
authority:
  governedBy:
    - OPS-003
    - OPS-005
    - OPS-009
  supersedes: []
lifecycle:
  phase: active
portability: reusable
---

# 60 [DAT-016] DF - Actor, Capability, Project Profile, and Platform Bootstrap Contracts

## 1. Purpose

Define closed reusable/configured contracts that separate provider-neutral role
behavior from concrete implementations and startup platforms.

Canonical framework 1.0.0 already used the identifier
`dev-foundry.actor-profile.v1` with a shape incompatible with the historical
incubation contract. This candidate therefore defines
`dev-foundry.actor-profile.v2` rather than silently redefining v1.

## 2. Actor Profile v2

Schema identifier:

`dev-foundry.actor-profile.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `role`
- `authority_scope`
- `owner_role`
- `canonical`
- `portability`
- `purpose`
- `responsibilities`
- `allowed_actions`
- `prohibited_actions`
- `preconditions`
- `required_inputs`
- `required_outputs`
- `handoffs`
- `context_policy`
- `stop_conditions`
- `independence`

Optional:

- `modes`
- `capability_profile_refs`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal `dev-foundry.actor-profile.v2`;
- `id`, `title`, `role`, `authority_scope`, and `owner_role` are
  non-empty strings;
- `artifact_version` is a non-empty string;
- `kind` MUST equal `actor-profile`;
- `status` is `candidate | active | deprecated | retired`;
- `canonical` is boolean;
- `portability` is `reusable | configure`;
- `purpose` is a non-empty string;
- action/responsibility/input/output/condition fields are arrays of unique
  non-empty stable strings;
- `modes` is a map whose values contain exactly `purpose`,
  `allowed_actions`, and `prohibited_actions`;
- `context_policy` contains exactly `authoritative`, `non_authoritative`,
  and optional `retrieval`;
- `handoffs` is an array; each entry contains exactly `to_role`, `when`,
  and `requires`, where `requires` is an array of stable strings;
- `independence` contains exactly `required_when`,
  `disallowed_prior_participation`, `distinct_implementation_required_when`,
  and `distinct_session_required_by_default`; the first three are arrays of
  stable strings and the last is boolean.

Actor Profile IDs are immutable once used by durable governed evidence. Material
behavior change requires a new profile artifact version or identifier according
to the adopted release policy.

## 3. Capability Profile v1

Schema identifier:

`dev-foundry.capability-profile.v1`

A Capability Profile is project-configured and implementation-specific.

Required fields:

- `schema_version`: MUST equal `dev-foundry.capability-profile.v1`;
- `id`: non-empty stable string;
- `status`: `active | transitional | deprecated | retired`;
- `implementation_class`: non-empty project-specific string;
- `supported_actions`: array of unique non-empty strings;
- `prohibited_actions`: array of unique non-empty strings;
- `limits`: object described below;
- `proof_capabilities`: array of unique non-empty strings;
- `environment_constraints`: array of unique non-empty strings;
- `stop_conditions`: array of unique non-empty strings;
- `portability`: MUST equal `configure`.

Unknown top-level fields are invalid.

`limits` is the one deliberate project-extension map in this contract. Each key
is a stable project-defined limit identifier and each value is a YAML scalar,
array, or object whose semantics are documented by the same Capability Profile.
A limit applies only to the bound implementation and cannot redefine framework
semantics.

A Capability Profile may name a provider, model, tool, service, human/team class,
or environment because it is configured project authority. It cannot redefine
Actor Profile or framework semantics.

An **Executor Profile** is the canonical specialization of a Capability Profile
bound to the `implementation-executor` role. The historical term remains valid;
the generalized Capability Profile contract exists so other roles may declare
implementation-specific limits without inventing unrelated profile schemas.

## 4. Project Operating Profile v2

Schema identifier:

`dev-foundry.project-operating-profile.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `canonical`
- `repository`
- `framework`
- `operator`
- `actor_bindings`
- `platform_bootstraps`
- `policies`
- `deviations`

No other top-level fields are valid.

Top-level scalar constraints:

- `schema_version` MUST equal `dev-foundry.project-operating-profile.v2`;
- `id`, `title`, and `artifact_version` are non-empty strings;
- `kind` MUST equal `project-operating-profile`;
- `status` is `planned | partial | active | migrating | stale | retired`;
- `canonical` MUST be false.

### repository

Exactly:

- `name`;
- `classification`: `greenfield | brownfield`;
- `authority_index`: path or stable locator.

### framework

Exactly:

- `adopted_version`;
- `selected_authority_index`;
- `selected_manifest`;
- `adoption_status`: `planned | partial | active | migrating | retired`.

### operator

Exactly:

- `kind`: `human | team | service | other`;
- `identity`: project-specific identity/role reference.

The framework does not define a default AI Operator.

### actor_bindings

Map keyed by project role. Each binding contains exactly:

- `profile`: Actor Profile ID/path;
- `implementation` object with `kind`, `identity`, and optional `platform`;
- `capability_profiles`: array;
- `status`: `active | transitional | deferred`.

Implementation kind is one of:

`human | model | agent | service | team | tool | other`.

### platform_bootstraps

Map keyed by bootstrap ID. Each entry contains exactly:

- `path`;
- `status`: `prepared | active | stale | retired`.

An empty map is valid when no startup platform binding is required.

### policies

Exactly:

- `frontmatter_schema`;
- `metadata_migration_mode`: `none | on-touch | complete-baseline`;
- `audit_triggers`: array of project-added trigger identifiers;
- `promotion_rules`: array of project-specific rule identifiers;
- `default_role`: role ID or null.

`default_role`, when non-null, MUST name a key present in `actor_bindings`.
Project-added `audit_triggers` may only add triggers; they MUST NOT disable or
weaken triggers required by the adopted framework.

### deviations

Array. Each deviation contains exactly:

- `id`;
- `framework_rule`;
- `scope`;
- `rationale`;
- `risk`;
- `reconciliation_trigger`;
- `operator_approval`.

The POP binds methodology locally and MUST NOT redefine reusable framework
semantics through configuration values.

## 5. Platform Bootstrap v2

Schema identifier:

`dev-foundry.platform-bootstrap.v2`

Required top-level fields:

- `schema_version`
- `id`
- `title`
- `kind`
- `status`
- `artifact_version`
- `canonical`
- `methodology_authority`
- `repository`
- `sources`
- `actor_resolution`
- `platform`
- `constraints`

No other top-level fields are valid.

Constraints:

- `schema_version` MUST equal `dev-foundry.platform-bootstrap.v2`;
- `id`, `title`, and `artifact_version` are non-empty strings;
- `kind` MUST equal `platform-bootstrap`;
- `canonical` MUST be false;
- `methodology_authority` MUST be false;
- `status` is `prepared | active | stale | retired`.

### repository

Contains exactly:

- `expected_name`;
- optional `workspace_binding`.

### sources

Contains exactly:

- `project_operating_profile`;
- `authority_index`.

### actor_resolution

Contains exactly:

- `mode`: `fixed | governed-project-bindings`;
- `eligible_profiles`: non-empty array for governed-project-bindings, or empty
  for fixed mode;
- `fixed_profile`: profile ID/path for fixed mode, otherwise null;
- `default_role`: role ID or null;
- `rule`: human-readable bounded selection rule.

### platform

Contains exactly:

- `id`: generic or project platform ID;
- `startup_constraints`: array of indispensable constraints unavailable from
  repository SoT before retrieval.

### constraints

Array of startup/fail-closed rules.

A bootstrap MUST direct retrieval to repository SoT and MUST NOT reproduce broad
methodology, product authority, task history, or complete role behavior.

Binding invariants:

- every eligible or fixed profile MUST resolve through the POP;
- every eligible role/profile represented by one bootstrap MUST resolve to the
  same concrete implementation identity and compatible platform represented by
  that bootstrap;
- `fixed_profile` MUST be non-null only in `fixed` mode and MUST be null in
  `governed-project-bindings` mode;
- `eligible_profiles` MUST be empty in `fixed` mode and non-empty in
  `governed-project-bindings` mode;
- `default_role`, when non-null, MUST resolve to an active POP binding compatible
  with the bootstrap;
- an explicitly selected role MUST be eligible under the POP and current
  separation-of-duty rules before the bounded operation begins.

## 6. Contract relationship

The normal relationship is:

`canonical framework -> POP -> Actor Profile + Capability Profile bindings ->
Platform Bootstrap -> bounded operation`

A Platform Bootstrap is derived configuration. An Actor Profile is reusable role
behavior. A Capability Profile is implementation-specific constraint. The POP is
the project binding that joins them.

None of these artifacts acquires product authority merely by being machine
readable.

## 7. Compatibility and evolution

A material incompatible contract change requires a new schema identifier.

A project adopting a later framework version reconciles its POP, profiles, and
bootstrap explicitly. Existing durable evidence keeps the schema/profile
identifiers applicable when it was produced.
