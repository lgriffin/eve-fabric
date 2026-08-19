<!--
  Sync Impact Report
  ==================
  Version change: N/A (initial) -> 1.0.0
  Modified principles: N/A (initial population from template)
  Added sections:
    - Core Principles (I-VII): Purpose, Core Architecture,
      TypeScript-First, Clean Architecture, Capability-First,
      Semantic Type System, Pipeline Composition
    - Schema and Execution (VIII-XI): GraphQL Contract, Custom Schema,
      Schema Compiler, Execution Planner
    - Data Integrity (XII-XV): Source Authority, Provenance, Caching,
      Authentication and Authorization
    - Interfaces and AI (XVI-XVII): Designer Independence,
      AI Assistance
    - Quality Standards (XVIII-XXI): Testing, Specification Style,
      Documentation, Backward Compatibility
    - Operational Excellence (XXII-XXIV): Observability, Error Model,
      Performance Principle
    - Boundaries and Compliance (XXV-XXVI): Repository Boundary,
      Definition of Done
    - Governance (XXVII): Governing Rule, Amendment Procedure,
      Compliance Review
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md         aligned
      (Constitution Check is dynamically populated at plan time)
    - .specify/templates/spec-template.md          aligned
      (BDD/EARS style aligns with principles XVIII-XIX)
    - .specify/templates/tasks-template.md         aligned
      (Phase structure compatible with all principles)
    - .specify/templates/checklist-template.md     aligned
  Follow-up TODOs: None
-->
# EVE Schema Gateway Constitution

## Core Principles

### I. Purpose

This repository provides a TypeScript-first gateway for composing
EVE Online data capabilities from multiple sources, principally:

- Real-time ESI/OpenAPI data exposed through `ESI.ts`
- Static Data Export (SDE) data exposed through the SDE capabilities
  of `ESI.ts`
- Derived capabilities produced by the gateway itself
- Cached or precomputed data where explicitly permitted

The gateway MUST NOT replace, duplicate, or obscure the role of
`ESI.ts`. `ESI.ts` remains the strongly typed developer SDK and
source-specific integration layer.

This repository exists to provide a higher-order capability model
that can semantically compose those sources into reusable,
user-defined GraphQL schemas.

### II. Core Architectural Principle

The system MUST treat GraphQL as the public contract and capability
composition model, not as a direct reflection of ESI endpoints.

The architecture is:

```text
User / Application / Agent
          |
          v
GraphQL Schema / Custom Schema
          |
          v
Capability Graph
          |
          v
Semantic Compiler / Query Planner
          |
    +-----+------+---------+
    |            |         |
   ESI          SDE      Derived
    |            |         |
    +------------+---------+
          |
        ESI.ts
```

The system MUST distinguish between:

1. Source data
2. Domain capabilities
3. Composed schemas
4. Runtime execution plans

These concepts MUST remain independently testable and replaceable.

### III. TypeScript-First Rule

All first-party runtime, compiler, schema, planner, validation, API,
and designer code MUST be implemented in TypeScript unless there is a
documented technical reason otherwise.

TypeScript MUST run with strict compiler settings.

The project MUST avoid `any` except at explicit external trust
boundaries.

External input MUST be validated at runtime.

Preferred validation technology: Zod.

Generated TypeScript types MUST NOT be treated as runtime validation.

### IV. Clean Architecture

The project MUST follow Clean Architecture and Domain-Driven Design
principles.

The core domain MUST NOT depend on:

- GraphQL server implementations
- Web frameworks
- Database implementations
- ESI.ts transport details
- UI frameworks
- Cache providers
- Message brokers

Dependencies MUST point inward.

Recommended boundaries:

```text
domain/
application/
infrastructure/
interfaces/
```

The domain contains:

- Capability definitions
- Semantic types
- Schema composition rules
- Pipeline definitions
- Execution plan models
- Provenance models

The application layer contains:

- Compile schema
- Validate pipeline
- Build execution plan
- Execute plan
- Register capability
- Export schema
- Import schema

Infrastructure contains adapters for:

- ESI.ts
- SDE
- GraphQL
- Persistence
- Cache
- Telemetry

### V. Capability-First Design

Every executable building block MUST be represented as a capability.

A capability MUST declare:

- Stable identifier
- Human-readable name
- Semantic description
- Inputs and outputs
- Semantic input and output types
- Source classification
- Dependencies
- Authentication requirements
- Cache policy
- Freshness characteristics
- Expected execution cost
- Provenance behavior
- Version

Example:

```yaml
id: market.orders
version: 1
inputs:
  region:
    type: RegionReference
  item:
    type: TypeReference
outputs:
  orders:
    type: MarketOrderCollection
source: ESI
requires:
  - universe.resolveRegion
  - universe.resolveType
```

Capabilities MUST NOT expose raw implementation classes as their
public contract.

### VI. Semantic Type System

The gateway MUST distinguish semantic compatibility from structural
compatibility.

For example:

- `SolarSystemId` and `TypeId` may both be integers structurally.
- They MUST NOT be treated as semantically interchangeable.

The compiler MUST reject invalid capability wiring even when
underlying TypeScript or GraphQL scalar types would otherwise
permit it.

Semantic types SHOULD include concepts such as:

- TypeReference, SolarSystemReference, RegionReference
- CharacterReference, CorporationReference, LocationReference
- ISK, Distance, SecurityStatus, Timestamp
- MarketOrderCollection

Semantic types MUST be extensible without modifying the compiler
core.

### VII. Pipeline Composition

Users MUST be able to construct pipelines from capabilities.

A pipeline MUST itself be publishable as a reusable capability.

This permits recursive composition:

```text
Primitive Capability
        |
        v
Composite Capability
        |
        v
Higher-Level Capability
        |
        v
Published GraphQL Schema
```

The runtime MUST prevent cyclic dependency graphs unless a future
explicit iteration construct is introduced.

Pipeline composition MUST be deterministic.

## Schema and Execution

### VIII. GraphQL Contract

GraphQL is the primary external query interface.

The GraphQL schema MUST be domain-oriented.

The system MUST NOT automatically expose the ESI OpenAPI model as
the primary GraphQL schema.

Raw ESI/SDE access MAY be provided under explicit advanced
namespaces.

Example:

```graphql
query {
  type(name: "Tritanium") {
    market {
      orders(region: "The Forge") {
        price
      }
    }
  }
}
```

is preferred over mirroring REST endpoint structure.

GraphQL selection sets SHOULD inform execution planning so that
unnecessary source calls are avoided.

### IX. Custom Schema Principle

Users MUST be able to:

- Create a schema
- Compose capabilities into it
- Validate it
- Preview its execution plan
- Save, version, export, import, execute, and share it where
  policy allows

A saved schema MUST contain enough metadata to reproduce its
behavior.

A `.graphql` file alone is insufficient for a composed schema.

A schema package SHOULD support:

```text
schema-package/
├── schema.graphql
├── pipeline.yaml
├── mappings.yaml
├── policies.yaml
├── metadata.yaml
└── README.md
```

The exact serialization format MAY evolve, but the logical
separation MUST remain.

### X. Schema Compiler

The system MUST contain a semantic compilation stage between a
user-defined schema and runtime execution.

Compilation MUST include:

1. Parse
2. Validate GraphQL structure
3. Resolve declared capabilities
4. Validate semantic wiring
5. Resolve dependencies
6. Construct a capability graph
7. Detect cycles
8. Determine source requirements
9. Determine authentication requirements
10. Determine cache opportunities
11. Estimate execution cost
12. Produce an immutable execution plan

The compiler MUST fail before runtime execution for statically
detectable errors.

Compiler diagnostics MUST be human-readable and machine-readable.

### XI. Execution Planner

Execution plans MUST support:

- Dependency ordering
- Parallel execution of independent nodes
- Request batching and coalescing
- Cache lookup
- ESI request minimization
- Source freshness constraints
- Authentication-aware execution
- Failure propagation
- Provenance generation

The planner SHOULD use the GraphQL selection set to prune
unnecessary work.

Execution optimization MUST NOT change observable schema semantics.

## Data Integrity

### XII. Source Authority

The gateway MUST retain knowledge of authoritative data sources.

Examples:

- Static item metadata → SDE
- Live market orders → ESI
- Current character location → ESI
- Blueprint material requirements → SDE
- Calculated profitability → DERIVED

A derived value MUST be distinguishable from a source fact.

The gateway MUST NOT silently substitute stale static data for live
data where the capability contract requires live state.

### XIII. Provenance

Every capability result MUST be capable of carrying provenance.

Minimum provenance model:

```text
source
sourceVersion
retrievedAt
calculatedAt
cached
capability
capabilityVersion
```

The public GraphQL schema MAY expose provenance directly or through
optional metadata fields.

Provenance MUST survive composition.

If a derived field combines multiple sources, the system MUST retain
the dependency provenance internally.

### XIV. Caching

Caching MUST be capability-aware.

Cache policy MUST NOT be globally inferred from transport alone.

Each capability SHOULD declare:

- Whether it is cacheable
- Default TTL
- Whether stale results are permitted
- Whether authentication identity participates in the cache key

SDE-derived immutable or release-bound data SHOULD be aggressively
cacheable.

ESI cache headers SHOULD be respected.

### XV. Authentication and Authorization

Authentication MUST be separated from domain logic.

Capabilities MUST declare required scopes.

The compiler SHOULD identify authentication requirements before
execution.

A schema MUST NOT gain access to an ESI scope merely because another
schema or capability possesses that scope.

User credentials MUST never be embedded into exported schema
packages.

## Interfaces and AI

### XVI. Designer Independence

The visual designer MUST consume the same capability catalog and
compiler used by non-visual clients.

The designer MUST NOT implement a second set of composition rules.

Anything valid in the designer MUST be representable in the
serialized pipeline model.

Anything representable in the serialized pipeline model SHOULD be
renderable in the designer.

The UI is an adapter over the domain model.

### XVII. AI Assistance

AI MAY assist with:

- Schema construction
- Capability discovery
- Pipeline suggestions
- Documentation
- Natural-language-to-schema conversion

AI MUST NOT be the authority on schema validity.

Any AI-produced schema or pipeline MUST pass through the
deterministic semantic compiler.

AI MUST NOT invent capabilities that do not exist in the capability
catalog.

## Quality Standards

### XVIII. Testing

Development MUST use TDD for domain and application behavior.

BDD MUST be used for externally observable capability behavior.

Preferred stack:

- Vitest
- Cucumber.js
- Testcontainers where integration infrastructure is required
- Stryker for mutation testing of critical compiler and planner
  behavior

Compiler rules MUST have focused unit tests.

Pipeline execution MUST have integration tests.

GraphQL contracts MUST have schema-level tests.

### XIX. Specification Style

Requirements MUST use EARS-style statements where practical.

Examples:

- WHEN a user connects two semantically incompatible capability
  ports, THE compiler SHALL reject the pipeline.
- WHEN a GraphQL selection omits a field requiring ESI, THE planner
  SHALL NOT execute the associated ESI capability.
- IF a capability requires an unavailable ESI scope, THEN THE
  compiler SHALL report the missing scope before execution.

Specifications MUST describe observable behavior rather than
implementation detail unless the implementation itself is
architectural.

### XX. Documentation

Every public capability MUST be self-describing enough for:

- Human developers
- The visual designer
- GraphQL schema generation
- Automated documentation
- AI-assisted composition

TypeDoc SHOULD be used for TypeScript API documentation.

GraphQL descriptions MUST be populated from capability metadata
where appropriate.

### XXI. Backward Compatibility

Published schema packages and capabilities MUST use semantic
versioning.

Breaking changes include:

- Removing a capability
- Renaming required inputs
- Changing semantic input/output meaning
- Removing GraphQL fields
- Changing nullability in a breaking direction
- Changing data authority guarantees

Implementation refactoring is not a breaking change where observable
capability behavior remains stable.

## Operational Excellence

### XXII. Observability

Every execution MUST support trace correlation across:

```text
GraphQL request
→ schema
→ execution plan
→ capability
→ ESI/SDE/cache/derived source
```

Preferred standard: OpenTelemetry.

Observability MUST NOT leak user tokens, secrets, or sensitive
payloads.

### XXIII. Error Model

Errors MUST distinguish:

- Schema error
- Semantic composition error
- Missing capability
- Missing authentication scope
- Source unavailable
- Source rate limited
- Invalid source response
- Derived computation failure
- Policy rejection

Raw infrastructure errors MUST NOT leak directly through the public
GraphQL contract.

### XXIV. Performance Principle

Correctness and semantic integrity take priority over
micro-optimization.

After correctness:

1. Avoid unnecessary source requests
2. Batch equivalent source requests
3. Parallelize independent work
4. Use cache
5. Precompute static relationships where valuable

The planner MUST be measurable before being optimized.

## Boundaries and Compliance

### XXV. Repository Boundary

This repository MUST NOT reimplement ESI.ts.

Any required enhancement to ESI or SDE source access SHOULD be
contributed to ESI.ts when it logically belongs to the SDK.

The gateway depends on ESI.ts.

ESI.ts MUST NOT depend on the gateway.

### XXVI. Definition of Done

A feature is complete only when:

- Domain behavior is modeled
- Runtime validation exists
- Unit tests pass
- Relevant BDD scenarios pass
- GraphQL behavior is documented
- Capability metadata is complete
- Errors are modeled
- Provenance behavior is defined
- No architectural boundary is violated
- TypeScript strict compilation passes
- Linting passes

## Governance

When a design choice conflicts with this constitution, the
implementation MUST either:

1. Conform to the constitution, or
2. Amend the constitution explicitly before implementing the
   exception.

Architectural drift MUST NOT occur implicitly.

### Amendment Procedure

1. Propose the amendment with rationale in a pull request.
2. The amendment MUST document what changes, why, and what
   existing behavior is affected.
3. All affected templates and specifications MUST be updated
   as part of the same amendment.
4. The constitution version MUST be incremented per semantic
   versioning rules:
   - MAJOR: Backward-incompatible governance or principle
     removals/redefinitions
   - MINOR: New principle or section added, or materially
     expanded guidance
   - PATCH: Clarifications, wording, typo fixes,
     non-semantic refinements

### Compliance Review

All pull requests and code reviews MUST verify compliance with
this constitution. Complexity MUST be justified against these
principles.

**Version**: 1.0.0 | **Ratified**: 2026-08-19 | **Last Amended**: 2026-08-19
