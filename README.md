# EVE Fabric

A TypeScript-first gateway for composing EVE Online data capabilities into reusable GraphQL schemas. Define what data you need, wire it together as a pipeline, and let the gateway handle compilation, optimization, and execution.

## What It Does

EVE Fabric treats every EVE Online data operation as a **capability** — a typed, versioned unit with semantic inputs and outputs. You compose capabilities into **pipelines** (directed acyclic graphs), and the gateway compiles them into optimized execution plans that respect dependencies, parallelize where possible, and track data provenance.

```yaml
# Define a Trade Opportunity pipeline
id: trade.opportunity
version: 1
name: Trade Opportunity

inputs:
  - name: sourceRegion
    semanticType: eve.region.reference
  - name: typeId
    semanticType: eve.type.reference

nodes:
  - id: sellOrders
    capability: { id: market.orders, version: 1 }
  - id: aggregate
    capability: { id: market.aggregate, version: 1 }

edges:
  - from: input.sourceRegion
    to: sellOrders.regionId
  - from: sellOrders.orders
    to: aggregate.orders

outputs:
  - name: lowestSell
    source: aggregate.lowestSell
```

The compiler validates semantic wiring (you can't connect a `RegionReference` to a `TypeReference`), detects cycles, suggests intermediate capabilities when types don't match, and produces a fully optimized execution plan — all before a single API call is made.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    apps/designer                        │
│              React Flow Visual Designer                 │
├─────────────────────────────────────────────────────────┤
│                    apps/gateway                         │
│                Fastify + GraphQL Yoga                   │
├──────────┬──────────┬───────────┬──────────┬────────────┤
│ graphql  │ executor │  planner  │ compiler │schema-pack │
│          │          │           │          │            │
│ Type     │ Parallel │ Dep order │ 12-step  │ Export/    │
│ builder  │ executor │ Parallel  │ semantic │ Import     │
│ Scalars  │ Proven-  │ groups    │ compiler │ Secret     │
│ Pruning  │ ance     │ Coalesce  │ DAG      │ scanner    │
├──────────┴──────────┴───────────┴──────────┴────────────┤
│        fabric (createFabric)  ·  kit  ·  pack-core      │
│   composition root · defineCapability · capabilities    │
├──────────┬──────────┬───────────┬──────────┬────────────┤
│  domain  │source-esi│source-sde │  cache   │persistence │
│          │          │           │          │            │
│ Branded  │ ESI.ts   │ Static    │ In-mem   │ Drizzle    │
│ types    │ views    │ data      │ TTL      │ ORM        │
│ Zod      │          │           │          │            │
└──────────┴──────────┴───────────┴──────────┴────────────┘
```

### Package Overview

| Package                      | Purpose                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@eve-fabric/domain`         | Branded types, capability model, pipeline model, error hierarchy, ports                                                      |
| `@eve-fabric/compiler`       | 12-step semantic compiler: parse, validate, resolve, build graph, detect cycles, determine sources/auth/cache, estimate cost |
| `@eve-fabric/planner`        | Dependency ordering, parallel group detection, request coalescing                                                            |
| `@eve-fabric/executor`       | Concurrent execution engine with provenance tracking                                                                         |
| `@eve-fabric/graphql`        | GraphQL type/query/input generation, custom scalars, selection-set pruning                                                   |
| `@eve-fabric/kit`            | `defineCapability` (contract and `run` in one module), `definePack`, `defineContract`, YAML manifest parser                  |
| `@eve-fabric/pack-core`      | The built-in capabilities as a pack: universe resolvers, market, routing, analysis, logistics, industry                      |
| `@eve-fabric/fabric`         | `createFabric`: ESI.ts runtime, SDE and packs in; compile, publish composites and run                                        |
| `@eve-fabric/source-esi`     | Hands capabilities ESI.ts's public view and records the compatibility date                                                   |
| `@eve-fabric/source-sde`     | Wraps ESI.ts's static data provider; a configured export that will not load is an error                                      |
| `@eve-fabric/cache`          | In-memory cache with TTL and stale-while-revalidate                                                                          |
| `@eve-fabric/schema-package` | Schema export/import with secret scanning                                                                                    |
| `@eve-fabric/persistence`    | Drizzle ORM schema and repository implementations                                                                            |
| `@eve-fabric/test-support`   | BDD world class and shared test helpers                                                                                      |

### Apps

| App             | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `apps/gateway`  | Fastify server with GraphQL Yoga, serves compiled pipeline schemas         |
| `apps/designer` | React + React Flow visual pipeline designer with drag-and-drop composition |

## Key Concepts

### Semantic Types (Branded)

Every port on a capability has a semantic type. TypeScript branded types prevent mixing up values that share a runtime representation:

```typescript
type RegionReference = number & { readonly __brand: 'eve.region.reference' };
type TypeReference = number & { readonly __brand: 'eve.type.reference' };

// These are both numbers at runtime, but the compiler prevents:
// connecting a RegionReference output to a TypeReference input
```

### Capabilities

A capability is a versioned, typed data operation. Its contract and the code
that implements it live in one module; what it `uses` decides its source, its
scopes and the context its `run` receives:

```typescript
import { defineCapability, definePack } from '@eve-fabric/kit';

export const orders = defineCapability({
  id: 'market.orders',
  version: '2.0.0',
  name: 'Market Orders',
  description: 'Live market orders for an item in a region',
  inputs: {
    region: { type: 'eve.region.reference' },
    item: { type: 'eve.type.reference' },
  },
  outputs: { orders: { type: 'eve.market.order.collection' } },
  uses: ['esi.public'],
  async run({ region, item }, { esi }) {
    const found = [];
    for await (const order of esi.market(Number(region)).orders.get({
      order_type: 'all',
      type_id: Number(item),
    })) {
      found.push(order);
    }
    return { orders: found };
  },
});

export const myPack = definePack({ id: 'my-pack', capabilities: [orders] });
```

A fabric only accepts capabilities that can run (FAB-VAL-01):

```typescript
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { createEsi } from '@lgriffin/esi.ts/client';

const fabric = createFabric({
  esi: createEsi({ userAgent: 'my-app/1.0 (me@example.com)' }),
  sde: provider, // ESI.ts's IStaticDataProvider
  packs: [corePack, myPack],
});
const result = await fabric.run(pipeline, { item: 'Tritanium', region: 'The Forge' });
```

### 12-Step Compiler

The compiler validates and optimizes pipelines through a deterministic sequence:

1. **Parse** — validate pipeline structure with Zod
2. **Validate** — structural completeness checks
3. **Resolve capabilities** — look up each node's capability in the catalog
4. **Validate wiring** — semantic type compatibility on every edge
5. **Resolve dependencies** — transitive dependency inclusion
6. **Build graph** — construct the capability DAG
7. **Detect cycles** — topological sort with cycle reporting
8. **Determine sources** — classify each step (ESI, SDE, DERIVED, COMPOSITE)
9. **Determine auth** — aggregate required OAuth scopes
10. **Determine cache** — compute per-step and pipeline-level cache policies
11. **Estimate cost** — weight-based execution cost estimation
12. **Produce plan** — emit an immutable `ExecutionPlan` or diagnostics

### Composite Capabilities

Publish a validated pipeline as a reusable capability:

```typescript
const composite = fabric.publishComposite(marketSnapshotPipeline, {
  id: 'market.snapshot',
  version: '1.0.0',
  name: 'Market Snapshot',
  description: 'Aggregated market view',
});
// Now "market.snapshot" can be used as a node in other pipelines
```

Only a pipeline that compiles is published. The fabric expands composite nodes,
however deeply nested, into the steps that run.

### Provenance Tracking

Every result carries provenance metadata:

```typescript
interface ProvenanceRecord {
  source: 'ESI' | 'SDE' | 'DERIVED' | 'CACHE';
  capability: string;
  version: number;
  retrievedAt?: Date;
  cached: boolean;
}
```

GraphQL consumers can opt into provenance via the `_provenance` field — it adds zero cost when not requested.

## Getting Started

### Prerequisites

- Node.js 20 LTS
- pnpm 9+

### Setup

```bash
git clone https://github.com/lgriffin/eve-fabric.git
cd eve-fabric
pnpm install
pnpm -r run build
```

### Run Tests

```bash
# All tests (461 unit + 21 BDD scenarios)
pnpm -r run test

# Specific package
pnpm --filter @eve-fabric/compiler run test

# BDD scenarios only
pnpm --filter @eve-fabric/domain run test:bdd
```

### Start the Gateway

```bash
pnpm --filter @eve-fabric/gateway run dev
```

The gateway serves GraphQL at `http://localhost:3000/graphql` with a health check at `/health`.

### Start the Designer

```bash
pnpm --filter @eve-fabric/designer run dev
```

The visual designer runs at `http://localhost:5173` with drag-and-drop pipeline composition.

## Examples

Three example pipelines are included in `examples/`:

| Example             | Description                                               |
| ------------------- | --------------------------------------------------------- |
| `trade-opportunity` | Multi-region trade profit calculation with route distance |
| `market-schema`     | Simple market price lookup for an item in a region        |
| `route-schema`      | Jump distance calculation between solar systems           |

## Tooling

| Tool        | Command                                         | Purpose                               |
| ----------- | ----------------------------------------------- | ------------------------------------- |
| Vitest      | `pnpm -r run test`                              | Unit and integration tests            |
| Cucumber.js | `pnpm --filter @eve-fabric/domain run test:bdd` | Behavior-driven scenarios             |
| Stryker     | `pnpm run mutate`                               | Mutation testing (compiler + planner) |
| TypeDoc     | `pnpm run docs`                                 | API documentation generation          |
| ESLint      | `pnpm run lint`                                 | Linting with TypeScript rules         |
| Prettier    | `pnpm run format`                               | Code formatting                       |
| Changesets  | `pnpm changeset`                                | Version management                    |
| Husky       | automatic                                       | Pre-commit secret scanning            |

## Project Constitution

This project follows a [constitution](.specify/memory/constitution.md) with 26 principles covering:

- **Clean Architecture** — domain has zero infrastructure dependencies
- **Branded types** — semantic safety at the type level
- **TDD + BDD** — tests before implementation, behavior specifications
- **Gateway boundary** — never reimplement what ESI.ts already provides
- **Provenance** — every data point traceable to its source
- **No secrets in packages** — exported schema packages are scanned

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Language      | TypeScript 5.x (strict mode)                   |
| Runtime       | Node.js 20 LTS                                 |
| Server        | Fastify + GraphQL Yoga                         |
| Schema        | graphql-js type construction                   |
| Validation    | Zod                                            |
| EVE Data      | @lgriffin/esi.ts 9.4.0                         |
| Frontend      | React 18 + React Flow + Zustand                |
| Persistence   | Drizzle ORM + SQLite                           |
| Testing       | Vitest + Cucumber.js + Stryker                 |
| Observability | Structured request/response tracing middleware |

## License

ISC
