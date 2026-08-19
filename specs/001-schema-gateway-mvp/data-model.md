# Data Model: EVE Schema Gateway MVP

**Branch**: `001-schema-gateway-mvp`
**Date**: 2026-08-19

## Entity Overview

```text
SemanticType ─────────────┐
                          │ references
CapabilityDefinition ─────┤
  ├── inputs: SemanticPort[]
  ├── outputs: SemanticPort[]
  ├── dependencies: CapabilityRef[]
  └── source: CapabilitySource
                          │
PipelineDefinition ───────┤
  ├── nodes: PipelineNode[]
  ├── edges: PipelineEdge[]
  ├── inputs: PipelineInput[]
  └── outputs: PipelineOutput[]
                          │
ExecutionPlan ────────────┤
  ├── steps: ExecutionStep[]
  ├── parallelGroups: StepGroup[]
  └── costEstimate: CostEstimate
                          │
SchemaPackage ────────────┤
  ├── graphqlSchema: string
  ├── pipeline: PipelineDefinition
  ├── mappings: FieldMapping[]
  ├── policies: PolicySet
  └── metadata: PackageMetadata
                          │
ProvenanceRecord ─────────┘
  ├── source: DataSource
  ├── capability: CapabilityRef
  └── upstream: ProvenanceRecord[]
```

## Entities

### SemanticType

Encodes domain meaning beyond structural compatibility. Used by
the compiler to validate pipeline connections.

| Field       | Type      | Constraints                                                   |
| ----------- | --------- | ------------------------------------------------------------- |
| id          | string    | Required, unique, dot-notation (e.g., `eve.region.reference`) |
| description | string    | Required, human-readable                                      |
| schema      | ZodSchema | Required, runtime validation                                  |
| category    | string    | Optional, grouping (e.g., `universe`, `market`)               |

**Validation rules**:

- `id` MUST be unique across the type registry.
- `id` MUST use dot-notation namespace format.
- `schema` MUST be a valid Zod schema.

**Relationships**:

- Referenced by `CapabilityDefinition.inputs` and `.outputs`.
- Referenced by `PipelineEdge` for connection validation.

### CapabilityDefinition

An independently describable data operation.

| Field        | Type               | Constraints                                            |
| ------------ | ------------------ | ------------------------------------------------------ |
| id           | string             | Required, unique, dot-notation (e.g., `market.orders`) |
| version      | integer            | Required, positive                                     |
| name         | string             | Required, human-readable                               |
| description  | string             | Required                                               |
| inputs       | SemanticPort[]     | Required (may be empty)                                |
| outputs      | SemanticPort[]     | Required, at least one                                 |
| source       | CapabilitySource   | Required, one of: ESI, SDE, DERIVED, CACHE, COMPOSITE  |
| dependencies | CapabilityRef[]    | Optional                                               |
| auth         | AuthRequirement    | Required                                               |
| cache        | CachePolicy        | Required                                               |
| cost         | CostModel          | Required                                               |
| provenance   | ProvenanceBehavior | Required                                               |

**SemanticPort**:

| Field        | Type           | Constraints                                |
| ------------ | -------------- | ------------------------------------------ |
| name         | string         | Required, unique within capability         |
| semanticType | SemanticTypeId | Required, must reference a registered type |
| description  | string         | Optional                                   |
| required     | boolean        | Default: true                              |

**AuthRequirement**:

| Field    | Type     | Constraints                    |
| -------- | -------- | ------------------------------ |
| required | boolean  | Required                       |
| scopes   | string[] | Required if `required` is true |

**CachePolicy**:

| Field             | Type    | Constraints           |
| ----------------- | ------- | --------------------- |
| cacheable         | boolean | Required              |
| defaultTtlSeconds | integer | Required if cacheable |
| stalePermitted    | boolean | Default: false        |
| identityInKey     | boolean | Default: false        |

**CostModel**:

| Field              | Type    | Constraints              |
| ------------------ | ------- | ------------------------ |
| estimatedLatencyMs | integer | Required                 |
| esiCallCount       | integer | Required (0 for non-ESI) |

**Validation rules**:

- `id` + `version` MUST be unique (composite key).
- All `inputs` and `outputs` MUST reference registered semantic types.
- `dependencies` MUST reference registered capabilities.
- COMPOSITE source MUST have a linked pipeline definition.

**Relationships**:

- Registered in `CapabilityCatalog`.
- Referenced by `PipelineNode.capability`.
- COMPOSITE capabilities link to a `PipelineDefinition`.

### CapabilityCatalog

Registry of all available capabilities (primitive and composite).

| Operation            | Input                  | Output                     |
| -------------------- | ---------------------- | -------------------------- |
| register             | CapabilityDefinition   | void (or validation error) |
| get                  | CapabilityId, version? | CapabilityDefinition       |
| findBySemanticInput  | SemanticTypeId         | CapabilityDefinition[]     |
| findBySemanticOutput | SemanticTypeId         | CapabilityDefinition[]     |
| findBySource         | CapabilitySource       | CapabilityDefinition[]     |
| search               | query string           | CapabilityDefinition[]     |
| list                 | filters?               | CapabilityDefinition[]     |

**Validation rules**:

- Registration MUST reject definitions with missing required fields.
- Registration MUST reject duplicate `id` + `version`.
- Registration MUST validate all semantic type references.

### PipelineDefinition

A directed acyclic graph of capability connections.

| Field       | Type             | Constraints                             |
| ----------- | ---------------- | --------------------------------------- |
| id          | string           | Required, unique                        |
| version     | integer          | Required, positive                      |
| name        | string           | Required                                |
| description | string           | Optional                                |
| inputs      | PipelineInput[]  | Required (may be empty)                 |
| nodes       | PipelineNode[]   | Required, at least one                  |
| edges       | PipelineEdge[]   | Required (may be empty for single-node) |
| outputs     | PipelineOutput[] | Required, at least one                  |

**PipelineNode**:

| Field      | Type          | Constraints                      |
| ---------- | ------------- | -------------------------------- |
| id         | string        | Required, unique within pipeline |
| capability | CapabilityRef | Required                         |
| config     | Record        | Optional, static configuration   |

**PipelineEdge**:

| Field | Type          | Constraints                                          |
| ----- | ------------- | ---------------------------------------------------- |
| from  | PortReference | Required (format: `nodeId.portName` or `input.name`) |
| to    | PortReference | Required (format: `nodeId.portName`)                 |

**PipelineInput**:

| Field        | Type           | Constraints   |
| ------------ | -------------- | ------------- |
| name         | string         | Required      |
| semanticType | SemanticTypeId | Required      |
| description  | string         | Optional      |
| required     | boolean        | Default: true |

**PipelineOutput**:

| Field  | Type          | Constraints                          |
| ------ | ------------- | ------------------------------------ |
| name   | string        | Required                             |
| source | PortReference | Required (format: `nodeId.portName`) |

**Validation rules**:

- Graph MUST be acyclic (no cycles).
- All edges MUST connect semantically compatible ports.
- All node capability references MUST exist in the catalog.
- All edge port references MUST exist on the referenced node.
- All pipeline inputs MUST be consumed by at least one edge.
- All required capability inputs MUST have an incoming edge.

### ExecutionPlan

Immutable, optimized plan produced by the compiler.

| Field              | Type                | Constraints                  |
| ------------------ | ------------------- | ---------------------------- |
| id                 | string              | Required, generated          |
| pipelineRef        | PipelineRef         | Required                     |
| steps              | ExecutionStep[]     | Required, dependency-ordered |
| parallelGroups     | StepGroup[]         | Required                     |
| sourceRequirements | SourceRequirement[] | Required                     |
| authRequirements   | AuthRequirement     | Required (aggregated)        |
| cacheStrategy      | CacheStrategy[]     | Required                     |
| costEstimate       | CostEstimate        | Required                     |
| createdAt          | timestamp           | Required                     |

**ExecutionStep**:

| Field          | Type           | Constraints             |
| -------------- | -------------- | ----------------------- |
| id             | string         | Required                |
| capability     | CapabilityRef  | Required                |
| inputs         | InputBinding[] | Required                |
| dependsOn      | StepId[]       | Required (may be empty) |
| cacheKey       | string         | Optional                |
| canParallelize | boolean        | Required                |

**CostEstimate**:

| Field             | Type    | Constraints                            |
| ----------------- | ------- | -------------------------------------- |
| totalLatencyMs    | integer | Estimated                              |
| esiCallCount      | integer | Estimated                              |
| parallelLatencyMs | integer | Estimated (accounting for concurrency) |

**State transitions**: None — execution plans are immutable.

### SchemaPackage

Portable, versioned bundle for export/import.

| Field             | Type               | Constraints                    |
| ----------------- | ------------------ | ------------------------------ |
| id                | string             | Required                       |
| name              | string             | Required                       |
| version           | string             | Required, semver format        |
| gatewayMinVersion | string             | Required, semver               |
| pipeline          | PipelineDefinition | Required                       |
| graphqlSchema     | string             | Required (SDL)                 |
| mappings          | FieldMapping[]     | Required                       |
| policies          | PolicySet          | Required                       |
| capabilities      | CapabilityRef[]    | Required (dependency manifest) |
| metadata          | PackageMetadata    | Required                       |

**FieldMapping**:

| Field          | Type          | Constraints         |
| -------------- | ------------- | ------------------- |
| graphqlField   | string        | Required (dot-path) |
| pipelineOutput | PortReference | Required            |

**PackageMetadata**:

| Field       | Type      | Constraints |
| ----------- | --------- | ----------- |
| author      | string    | Optional    |
| description | string    | Optional    |
| createdAt   | timestamp | Required    |
| tags        | string[]  | Optional    |

**Validation rules**:

- MUST NOT contain user credentials or secrets.
- On import, all referenced capabilities MUST exist in target catalog.
- On import, gateway version MUST satisfy `gatewayMinVersion`.

### ProvenanceRecord

Metadata tracking data origin through the execution chain.

| Field             | Type               | Constraints                                        |
| ----------------- | ------------------ | -------------------------------------------------- |
| source            | DataSource         | Required (ESI, SDE, DERIVED, CACHE)                |
| sourceVersion     | string             | Optional (ESI version, SDE release)                |
| capability        | CapabilityRef      | Required                                           |
| capabilityVersion | integer            | Required                                           |
| retrievedAt       | timestamp          | Required for ESI/SDE                               |
| calculatedAt      | timestamp          | Required for DERIVED                               |
| cached            | boolean            | Required                                           |
| upstream          | ProvenanceRecord[] | Required for DERIVED (may be empty for primitives) |

**Validation rules**:

- DERIVED records MUST have at least one upstream provenance entry.
- ESI/SDE records MUST have `retrievedAt`.
- Provenance MUST survive composition (upstream chain preserved).

## Domain Error Types

| Category                   | When                                 | Compiler or Runtime |
| -------------------------- | ------------------------------------ | ------------------- |
| SchemaError                | Invalid GraphQL structure            | Compiler            |
| SemanticCompositionError   | Incompatible type wiring             | Compiler            |
| MissingCapabilityError     | Referenced capability not in catalog | Compiler            |
| MissingAuthScopeError      | Required ESI scope not available     | Compiler            |
| SourceUnavailableError     | ESI/SDE endpoint unreachable         | Runtime             |
| SourceRateLimitedError     | ESI rate limit exceeded              | Runtime             |
| InvalidSourceResponseError | Unexpected response from source      | Runtime             |
| DerivedComputationError    | Derived calculation failure          | Runtime             |
| PolicyRejectionError       | Policy constraint violated           | Runtime             |

Each error type carries structured context: the specific capability,
types involved, source details, and a human-readable message.
Machine-readable error codes follow the pattern
`GATEWAY_{CATEGORY}_{DETAIL}`.
