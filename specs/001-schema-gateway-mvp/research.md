# Research: EVE Schema Gateway MVP

**Branch**: `001-schema-gateway-mvp`
**Date**: 2026-08-19
**Status**: Complete — all decisions resolved

## R1: GraphQL Schema Construction Approach

**Decision**: Use Pothos GraphQL as the programmatic schema builder.

**Rationale**: The gateway generates GraphQL schemas dynamically from
capability metadata and pipeline definitions. Pothos provides a
strongly typed builder API that maps directly to this use case — the
schema compiler walks the pipeline model and emits Pothos builder
calls, producing a fully typed `GraphQLSchema`. Direct GraphQL.js
schema construction is lower-level and produces weaker TypeScript
integration. Schema-first approaches (SDL-based) are inappropriate
because the schema is generated, not hand-authored.

Pothos remains an infrastructure adapter per Constitution IV (Clean
Architecture). The canonical representation is the gateway's domain
model (capability metadata + pipeline). Pothos is used only in the
`packages/graphql/` infrastructure package to translate domain models
into executable GraphQL schemas.

**Alternatives considered**:
- Raw GraphQL.js `GraphQLObjectType` construction: more verbose,
  weaker type inference, higher maintenance burden.
- Nexus: similar builder pattern but less actively maintained; Pothos
  has stronger TypeScript integration and plugin ecosystem.
- TypeGraphQL: decorator-based, violates constitution rule against
  framework-specific classes as canonical representation.

## R2: Semantic Type System Implementation

**Decision**: Use TypeScript branded types for compile-time safety
combined with Zod schemas for runtime validation.

**Rationale**: Branded types (`type RegionReference = number &
{ readonly __brand: unique symbol }`) prevent accidental assignment
between structurally identical types at compile time. Zod schemas
validate at runtime boundaries (external input, ESI responses, user
pipeline definitions). This dual approach satisfies Constitution III
(TypeScript strict, Zod validation) and Constitution VI (semantic
vs structural compatibility).

The semantic type registry maps type IDs (e.g., `eve.region.reference`)
to their branded TypeScript type and Zod schema. The compiler uses this
registry to validate wiring. New semantic types can be registered
without modifying the compiler (Constitution VI extensibility).

**Pattern**:
```typescript
const RegionReference = createSemanticType({
  id: 'eve.region.reference',
  schema: z.number().int().positive(),
  description: 'Reference to an EVE region',
});
```

**Alternatives considered**:
- Zod-only (no branded types): catches mismatches at runtime but
  permits compile-time errors. Insufficient for the "compiler rejects
  before execution" requirement.
- io-ts: similar dual approach but heavier API and less ecosystem
  adoption than Zod.
- Custom validation without Zod: increases maintenance burden;
  Zod is already the constitution-mandated validation tool.

## R3: ESI.ts Integration Pattern

**Decision**: Wrap ESI.ts behind a `SourceAdapter` port defined in
the domain layer, implemented in `packages/esi-adapter/`.

**Rationale**: Constitution IV (Clean Architecture) requires the
domain to not depend on ESI.ts transport details. Constitution XXV
(Repository Boundary) requires all ESI/SDE access to go through
ESI.ts. The adapter pattern satisfies both: the domain defines
abstract `SourceAdapter` and `SdeAdapter` ports; the infrastructure
packages implement them using ESI.ts.

The `esi-adapter` package imports `@lgriffin/esi.ts`, translates
domain-level capability requests into ESI.ts API calls, and maps
responses back into domain types with provenance. The `sde-adapter`
does the same for SDE lookups.

**Integration surface**:
- `ESI.ts` exposes typed ESI endpoint methods and SDE lookups.
- The adapter maps capability IDs to specific ESI.ts method calls.
- Authentication tokens are passed through the adapter; never stored
  in domain or schema packages (Constitution XV).
- ESI cache headers are read by the adapter and mapped to the
  domain's cache policy model (Constitution XIV).

**Alternatives considered**:
- Direct ESI.ts usage in domain: violates Clean Architecture.
- Abstract HTTP client: too generic; loses ESI.ts type safety.

## R4: Monorepo Structure and Build

**Decision**: pnpm workspaces with shared TypeScript base config
and Changesets for versioning.

**Rationale**: The architecture naturally decomposes into 14
packages (12 packages + 2 apps). pnpm workspaces provide strict
dependency isolation (no phantom dependencies), fast installs via
content-addressed storage, and built-in workspace protocol for
inter-package references.

**Configuration pattern**:
- `pnpm-workspace.yaml`: lists `apps/*` and `packages/*`
- `tsconfig.base.json`: shared strict TypeScript settings
- Per-package `tsconfig.json` extends base; adds path mappings
- Changesets manages independent versioning per package
- Turborepo or pnpm's built-in `--filter` for build orchestration

**Package dependency graph** (simplified):
```text
domain (no deps)
  ← compiler ← planner ← executor
  ← capability-sdk
  ← schema-package
  ← graphql (+ pothos)
  ← esi-adapter (+ esi.ts)
  ← sde-adapter (+ esi.ts)
  ← cache
  ← persistence (+ drizzle)
  ← test-support

apps/gateway ← executor, graphql, persistence, cache
apps/designer ← domain, compiler (via API)
```

**Alternatives considered**:
- npm workspaces: weaker isolation, no content-addressed store.
- Nx: heavier; pnpm workspaces sufficient for this scale.
- Yarn Berry: comparable but pnpm has better Windows support and
  stricter isolation defaults.

## R5: React Flow Port System

**Decision**: Custom React Flow nodes with typed handles where each
handle carries a semantic type ID. Connection validation via
`isValidConnection` callback delegates to the compiler.

**Rationale**: React Flow's handle system maps naturally to capability
ports. Each capability node renders input handles (top/left) and
output handles (bottom/right). Handle data carries the semantic type
ID. When the user drags a connection, `isValidConnection` calls the
compiler's semantic type checker. Invalid connections are blocked
before creation; the designer shows a diagnostic tooltip.

Constitution XVI (Designer Independence) requires the designer to
use the same compiler. This is achieved by importing `packages/compiler`
and calling its validation functions directly from the React app (or
via API if the compiler runs server-side).

**Visual pattern**:
- Handles are color-coded by semantic type category (universe types,
  market types, routing types).
- Compatible handles glow when a drag starts.
- Incompatible connections show a diagnostic overlay suggesting
  intermediate capabilities.

**Alternatives considered**:
- Custom graph library: unnecessary; React Flow is mature and
  well-maintained for this exact use case.
- Rete.js: similar capability but smaller community and weaker
  TypeScript support.

## R6: Persistence Strategy

**Decision**: SQLite with Drizzle ORM behind a repository port in
the domain layer.

**Rationale**: SQLite provides zero-config local persistence suitable
for the single-user initial deployment. Drizzle ORM offers a
TypeScript-first query builder that aligns with strict TypeScript
requirements. The persistence layer is behind a domain port
(`SchemaRepository`, `CapabilityRepository`, `PipelineRepository`)
so the storage implementation can be swapped to PostgreSQL later
without affecting domain or application code (Constitution IV).

**What is persisted**:
- Capability registrations (including composite)
- Pipeline definitions
- Schema packages (metadata + references)
- Version history
- Execution metadata (optional, for diagnostics)

Source data (ESI responses, SDE lookups) is NOT persisted in the
gateway database — it belongs to ESI.ts and cache (Constitution XXV).

**Alternatives considered**:
- Prisma: heavier, schema-first approach conflicts with domain-first
  design.
- Kysely: excellent query builder but less ORM convenience for
  migrations.
- File-based (JSON/YAML): insufficient for querying; no migration
  story.

## R7: Error Model Implementation

**Decision**: Domain error hierarchy with 9 discriminated categories,
mapped to GraphQL errors at the interface boundary.

**Rationale**: Constitution XXIII requires 9 distinct error categories.
These are modeled as a discriminated union in the domain layer:

```typescript
type GatewayError =
  | SchemaError
  | SemanticCompositionError
  | MissingCapabilityError
  | MissingAuthScopeError
  | SourceUnavailableError
  | SourceRateLimitedError
  | InvalidSourceResponseError
  | DerivedComputationError
  | PolicyRejectionError;
```

Each variant carries structured context (which capability, which
types, which source). The GraphQL layer maps these to user-facing
error extensions without leaking infrastructure details
(Constitution XXIII).

Compiler errors (categories 1-4) are detected before execution.
Runtime errors (categories 5-9) occur during plan execution. This
aligns with the compiler's fail-before-runtime guarantee
(Constitution X).

## R8: Observability Instrumentation

**Decision**: OpenTelemetry SDK with custom spans at each
architectural boundary.

**Rationale**: Constitution XXII requires trace correlation from
GraphQL request through source. OpenTelemetry provides the standard
API. Each layer creates a child span:

```text
graphql.request (gateway)
  └─ schema.resolve (graphql package)
      └─ plan.execute (executor)
          ├─ capability.run: market.orders (executor)
          │   └─ esi.call: /markets/{region}/orders (esi-adapter)
          └─ capability.run: universe.resolveType (executor)
              └─ sde.lookup: invTypes (sde-adapter)
```

Spans carry capability ID, source type, cache hit/miss, and
provenance metadata. User tokens and secrets are explicitly excluded
from span attributes (Constitution XXII).
