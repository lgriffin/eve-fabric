# Implementation Plan: EVE Schema Gateway MVP

**Branch**: `001-schema-gateway-mvp` | **Date**: 2026-08-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-schema-gateway-mvp/spec.md`

## Summary

Build a TypeScript-first EVE Online data gateway that composes ESI,
SDE, and derived capabilities into reusable GraphQL schemas through a
semantic pipeline composition model. The system provides a capability
catalog, a semantic compiler that validates type-safe wiring, an
execution planner that optimizes source requests, and a visual
designer for drag-and-drop pipeline construction. The first release
proves the composition model with a 10-capability vertical slice and
a TradeOpportunity reference schema.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20 LTS
**Primary Dependencies**: ESI.ts (@lgriffin/esi.ts@9.4.0), Fastify,
GraphQL.js, GraphQL Yoga, Pothos GraphQL, Zod, React 18, React Flow,
Zustand, TanStack Query, Drizzle ORM
**Storage**: SQLite (initial), PostgreSQL (later adapter)
**Testing**: Vitest, Cucumber.js, Stryker, Testcontainers
**Target Platform**: Node.js server (gateway) + desktop web browser
(designer)
**Project Type**: pnpm monorepo — 2 apps (gateway, designer) +
12 packages (domain, capability-sdk, compiler, planner, executor,
graphql, esi-adapter, sde-adapter, cache, persistence,
schema-package, test-support)
**Performance Goals**: Correctness first; selection-set pruning and
request coalescing to minimize ESI calls; SDE data aggressively cached
**Constraints**: ESI.ts is the sole source integration layer; no
reimplementation; single-user local deployment; 10 initial capabilities
**Scale/Scope**: Single developer; 10 capabilities; 1 reference schema
(TradeOpportunity); 6 milestones

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1
design._

| #     | Principle             | Status | Notes                                                                  |
| ----- | --------------------- | ------ | ---------------------------------------------------------------------- |
| I     | Purpose               | PASS   | Gateway composes ESI/SDE/derived into GraphQL; does not replace ESI.ts |
| II    | Core Architecture     | PASS   | GraphQL as public contract, not ESI reflection; 4 concerns separated   |
| III   | TypeScript-First      | PASS   | All TypeScript strict; Zod validation; no `any`                        |
| IV    | Clean Architecture    | PASS   | domain/application/infrastructure/interfaces layers in monorepo        |
| V     | Capability-First      | PASS   | Capability model is central; full metadata contract defined            |
| VI    | Semantic Types        | PASS   | Branded types + Zod; compiler rejects structural-only matches          |
| VII   | Pipeline Composition  | PASS   | DAG-based pipelines; publishable as capabilities; deterministic        |
| VIII  | GraphQL Contract      | PASS   | Domain-oriented schemas; selection-set-aware planning                  |
| IX    | Custom Schema         | PASS   | Schema packages with full metadata; export/import                      |
| X     | Schema Compiler       | PASS   | 12-step compilation pipeline; fail-before-runtime                      |
| XI    | Execution Planner     | PASS   | Dependency ordering, parallelism, batching, caching, provenance        |
| XII   | Source Authority      | PASS   | Source classification per capability; no silent substitution           |
| XIII  | Provenance            | PASS   | Full provenance model on every result; survives composition            |
| XIV   | Caching               | PASS   | Capability-aware; behind application port; policy per capability       |
| XV    | Auth                  | PASS   | Scopes per capability; separated from domain; no embedded secrets      |
| XVI   | Designer Independence | PASS   | Same compiler/catalog for visual and non-visual clients                |
| XVII  | AI Assistance         | PASS   | Deferred; architecture accommodates it                                 |
| XVIII | Testing               | PASS   | TDD (Vitest), BDD (Cucumber.js), mutation (Stryker)                    |
| XIX   | Specification Style   | PASS   | EARS-style requirements in spec                                        |
| XX    | Documentation         | PASS   | Self-describing capabilities; TypeDoc; GraphQL descriptions            |
| XXI   | Backward Compat       | PASS   | Semantic versioning for packages and capabilities                      |
| XXII  | Observability         | PASS   | OpenTelemetry; trace correlation across full stack                     |
| XXIII | Error Model           | PASS   | 9 error categories; no infrastructure leak                             |
| XXIV  | Performance           | PASS   | Correctness first; measurable before optimized                         |
| XXV   | Repo Boundary         | PASS   | ESI.ts dependency; no reimplementation                                 |
| XXVI  | Definition of Done    | PASS   | All criteria addressable by plan                                       |

**Result**: All 26 gates pass. No violations to justify.

## Project Structure

### Documentation (this feature)

```text
specs/001-schema-gateway-mvp/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── capability-manifest.md
│   ├── pipeline-format.md
│   ├── schema-package-format.md
│   ├── compiler-diagnostics.md
│   └── graphql-conventions.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
apps/
├── gateway/                   # Fastify server exposing GraphQL
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   └── middleware/
│   ├── tests/
│   ├── package.json
│   └── tsconfig.json
└── designer/                  # React + React Flow visual designer
    ├── src/
    │   ├── components/
    │   │   ├── canvas/        # React Flow workspace
    │   │   ├── palette/       # Capability palette + search
    │   │   ├── preview/       # GraphQL / plan / diagnostics panels
    │   │   └── shared/
    │   ├── stores/            # Zustand state
    │   ├── hooks/
    │   ├── App.tsx
    │   └── main.tsx
    ├── tests/
    ├── package.json
    ├── tsconfig.json
    └── vite.config.ts

packages/
├── domain/                    # Core domain model (no external deps)
│   ├── src/
│   │   ├── capability/        # CapabilityDefinition, CapabilityId
│   │   ├── semantic-type/     # SemanticType, type registry
│   │   ├── pipeline/          # PipelineDefinition, Node, Edge
│   │   ├── execution-plan/    # ExecutionPlan, ExecutionNode
│   │   ├── provenance/        # ProvenanceRecord
│   │   ├── error/             # Domain error types (9 categories)
│   │   └── ports/             # SourceAdapter, CachePort, etc.
│   └── tests/
├── capability-sdk/            # Helpers for defining capabilities
│   ├── src/
│   └── tests/
├── compiler/                  # Semantic compiler (12-step pipeline)
│   ├── src/
│   │   ├── parse.ts
│   │   ├── validate-structure.ts
│   │   ├── resolve-capabilities.ts
│   │   ├── validate-semantic-wiring.ts
│   │   ├── resolve-dependencies.ts
│   │   ├── build-capability-graph.ts
│   │   ├── detect-cycles.ts
│   │   ├── determine-sources.ts
│   │   ├── determine-auth.ts
│   │   ├── determine-cache.ts
│   │   ├── estimate-cost.ts
│   │   ├── produce-plan.ts
│   │   └── diagnostics.ts
│   └── tests/
├── planner/                   # Execution plan optimization
│   ├── src/
│   └── tests/
├── executor/                  # Plan execution engine
│   ├── src/
│   └── tests/
├── graphql/                   # GraphQL schema generation (Pothos)
│   ├── src/
│   └── tests/
├── esi-adapter/               # ESI.ts infrastructure adapter
│   ├── src/
│   └── tests/
├── sde-adapter/               # SDE infrastructure adapter
│   ├── src/
│   └── tests/
├── cache/                     # Cache abstraction + in-memory impl
│   ├── src/
│   └── tests/
├── persistence/               # SQLite + Drizzle ORM
│   ├── src/
│   │   ├── schema.ts          # Drizzle schema
│   │   └── repositories/
│   └── tests/
├── schema-package/            # Schema package export/import
│   ├── src/
│   └── tests/
└── test-support/              # Shared test utilities
    ├── src/
    └── package.json

examples/
├── market-schema/
├── route-schema/
└── trade-opportunity/         # Reference end-to-end schema
```

**Structure Decision**: pnpm monorepo with Clean Architecture mapping:
domain layer = `packages/domain/`; application layer =
`packages/compiler/`, `packages/planner/`, `packages/executor/`,
`packages/capability-sdk/`, `packages/schema-package/`;
infrastructure layer = `packages/esi-adapter/`, `packages/sde-adapter/`,
`packages/cache/`, `packages/persistence/`, `packages/graphql/`;
interfaces layer = `apps/gateway/`, `apps/designer/`.

## Complexity Tracking

> No violations to justify — all constitution gates pass.
