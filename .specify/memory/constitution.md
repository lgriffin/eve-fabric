<!--
  Sync Impact Report
  ==================
  Version change: 2.0.0 -> 2.1.0 (MINOR)
  Modified principles:
    - VI. Semantic Type System: values, references and records; every
      reference names its resolver; `attach`; port and configured values
      checked; eve.* reserved for the core pack.
  Added requirements: FAB-TYPE-01, FAB-TYPE-02 (both Enforced).

  Previous amendment
  ------------------
  Version change: 1.0.0 -> 2.0.0 (MAJOR)
  Modified principles:
    - V. Capability-First Design: a capability is one module holding its
      contract and its `run`; its source is inferred from what it declares
      it `uses`, no longer hand-labelled.
    - VII. Pipeline Composition: the "explicit iteration construct" is named:
      a per-item map with a stated cap, never a loop.
    - IX. Custom Schema Principle: package format v2 (the weave), data only,
      with a digest; code travels as packs.
    - XIV. Caching: the fabric defers to ESI.ts's ETag cache for ESI steps.
    - XVIII. Testing / XIX. Specification Style: the question bank and EARS
      rules become gates.
  Added sections:
    - XXVII. Runtime Baseline (Node.js 22.12 or later)
    - XXVIII. Valid by Construction
    - Requirements Register (FAB-* ids, each with its enforcing mechanism
      and status)
  Removed sections: None
  Source: the EVE Fabric Overhaul architecture review (1 Oct 2026).
  Templates requiring updates: none (plan, spec and tasks templates read
  principles by number; numbers I to XXVI are unchanged).
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

A capability MUST be one module that holds both its contract and the
`run` function that implements it. A contract without a `run` MUST NOT
register (FAB-VAL-01). No capability is implemented by looking up its id
in a table held somewhere else.

A capability's source (ESI, SDE or DERIVED) MUST be inferred from what
it declares it `uses` (`esi.public`, `esi:<scope>`, `sde`, or nothing),
not declared by hand. The same declaration types the context its `run`
receives, so a capability that did not declare `sde` cannot reach it.

A capability MUST declare:

- Stable identifier
- Human-readable name
- Semantic description
- Inputs and outputs
- Semantic input and output types
- What it uses (from which its source classification is derived)
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
uses: [esi.public] # source ESI, no scope, inferred
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

A semantic type is a value, a reference or a record (a list is a list of
one of these). A record's fields are themselves semantic types, so an
ESI market order's `location_id` is a location reference, not a number.
Every reference type MUST name the capability that resolves it to its
record, and a capability MUST NOT register if it emits a reference that
cannot be followed (FAB-TYPE-01). A capability MAY `attach` to a type,
which makes it a field of that type (`market.orders` is `orders` on
`eve.type`). Port values are checked against their types when a step
runs, and configured values when a pipeline compiles (FAB-TYPE-02). The
`eve.*` namespace belongs to the core pack; other packs name their own.

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

The runtime MUST prevent cyclic dependency graphs. The one iteration
construct is a per-item map: a step that runs once per item of a list,
with ids deduplicated, a stated cap, and the call count reported by the
plan before anything runs. It is a map, never a loop.

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

Package format v2 is the **weave**: a pipeline, the contract it
provides, the capability version ranges it requires, the scopes the
compiler computed for it, the ESI compatibility date and SDE build it
was verified against, and a digest over its canonical form. A weave is
data and MUST NOT carry code. Code is shared as a **pack**, an npm
package of capabilities installed by whoever operates the fabric. A
weave that does not compile against the local catalog MUST be refused
whole (FAB-VAL-08).

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

For ESI steps the fabric MUST defer to ESI.ts's own cache, rate
limiter, retry and circuit breaker, and MUST NOT add a second TTL cache
of its own over them. Fabric caching applies to SDE and DERIVED steps.

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

## Runtime and Construction

### XXVII. Runtime Baseline

The fabric MUST run on Node.js 22.12 or later, the baseline of
`@lgriffin/esi.ts` 11. CI MUST test the baseline and the current LTS.
Node 18 and 20 are end of life and are not supported.

### XXVIII. Valid by Construction

Nothing that fails to compile may be built, registered or imported, and
anything that compiles MUST have code behind every step. Three gates hold
this:

- **Catalog gate**: a capability registers only with a `run`, with every
  port type known, and with a resolver for every reference type it emits.
- **Construction gate**: a draft changes only through moves the engine
  offered. A draft is complete or has typed holes; there is no third
  state.
- **Publish and import gate**: only a complete draft becomes a field, a
  weave or a saved query.

The compiler is the oracle: a move is offered when applying it yields a
pipeline that compiles, or fails only with `MISSING_INPUT` diagnostics,
which are the draft's holes. There is one rule set.

This cannot promise that execution succeeds. ESI can be down and an
order can vanish between calls; those arrive as typed errors on the node
that failed, with the rest of the result intact.

## Requirements Register

Each requirement has an id, the mechanism that enforces it, and a
status. A requirement is **Enforced** only when its mechanism runs in
CI. Statuses move forward as the overhaul phases land.

| Id          | Requirement                                                                                                                                    | Enforced by                                             | Status            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------- |
| FAB-ARCH-01 | The core (`packages/domain`) imports `zod` and nothing else.                                                                                   | `pnpm run lint:layers`                                  | Enforced          |
| FAB-ARCH-02 | The engine (compiler, planner, executor, graphql, cache, persistence, schema-package) and the kit and packs never import a source adapter.     | `pnpm run lint:layers`                                  | Enforced          |
| FAB-ARCH-03 | Only source adapters and composition roots import `@lgriffin/esi.ts` values; the kit and packs import its types only.                          | `pnpm run lint:layers`                                  | Enforced          |
| FAB-DET-01  | Source code reads the time only through the `Clock` port.                                                                                      | `pnpm run lint:determinism` (shrink-only baseline)      | Enforced          |
| FAB-RUN-01  | The fabric runs on Node.js 22.12 or later.                                                                                                     | `engines`, CI matrix 22 and 24                          | Enforced          |
| FAB-SRC-01  | A configured source that fails to load is an error, never an empty substitute.                                                                 | gateway runtime tests                                   | Enforced          |
| FAB-BANK-01 | The question bank runs in CI; a question that passed never regresses.                                                                          | `pnpm run test:bank`                                    | Enforced          |
| FAB-VAL-01  | When a capability is registered without a `run` function, the catalog shall reject it and name the capability.                                 | `CapabilityCatalog({ executable: true })`, fabric tests | Enforced          |
| FAB-TYPE-01 | When a capability emits a reference type that names no installed resolver, the fabric shall refuse to install it and name the type.            | `CapabilityCatalog({ types })`, fabric install          | Enforced          |
| FAB-TYPE-02 | If a port or configured value is not a value of its port's type, then the step shall fail, or the pipeline shall not compile, naming the port. | executor and compiler tests                             | Enforced          |
| FAB-VAL-02  | The engine shall offer a move only if applying it yields a draft that compiles once its holes are filled.                                      | property test over random walks                         | Enforced          |
| FAB-VAL-03  | If a move is applied that the engine did not offer for that draft, then the draft shall reject it and remain unchanged.                        | draft tests                                             | Enforced          |
| FAB-VAL-04  | While a draft has an unfilled hole, the fabric shall not plan, publish or export it.                                                           | draft tests                                             | Enforced          |
| FAB-VAL-05  | The schema shall expose a field only if every input of its capability is supplied by the parent entity or by an argument.                      | schema derivation tests                                 | Enforced          |
| FAB-VAL-06  | When a document is valid against the derived schema, the compiler shall produce a plan for it.                                                 | GraphQL round-trip tests                                | Enforced          |
| FAB-VAL-07  | While the caller's identity lacks a scope a move requires, the engine shall mark the move unavailable and name the scope.                      | bank Q6, identity tests                                 | Enforced          |
| FAB-VAL-08  | If an imported weave does not compile against the local catalog, then the fabric shall refuse it and add nothing.                              | bank Q8                                                 | Planned (phase 8) |

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

**Version**: 2.1.0 | **Ratified**: 2026-08-19 | **Last Amended**: 2026-10-01
