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

### Semantic Types

Every port on a capability has a semantic type, and a type is one of three
things. A **value** has a schema (`eve.currency.isk`). A **reference** is an id
that names a record held elsewhere, and it names the capability that resolves
it (`eve.location.reference` is followed by `universe.location`). A **record**
is an object whose fields are themselves semantic types, which is what lets an
ESI order be followed from its `location_id` to the station and on to the
system:

```typescript
import { defineType, listOf } from '@eve-fabric/kit';

export const EveLocationRef = defineType({
  kind: 'reference',
  id: 'eve.location.reference',
  description: 'An NPC station, a solar system or a player structure',
  entity: 'eve.location',
  resolver: { capability: 'universe.location', input: 'id', output: 'location' },
});

export const EveMarketOrder = defineType({
  kind: 'record',
  id: 'eve.market.order',
  description: 'A market order, as ESI sends it',
  fields: {
    order_id: EveId,
    type_id: EveTypeRef,
    location_id: EveLocationRef,
    price: EveCurrencyIsk /* … */,
  },
});

export const EveMarketOrders = listOf(EveMarketOrder); // eve.market.order.collection
```

Two values that are both integers at runtime are still different types, so the
compiler refuses to wire a region into a type port. A fabric refuses a
capability that emits a reference no installed capability can follow
(FAB-TYPE-01), checks every port value against its type when a step runs, and
refuses to compile a configured value of the wrong type (FAB-TYPE-02). The
`eve.*` types live in `@eve-fabric/pack-core`, which owns that namespace.

### Drafts

A question is built as a draft: a subject, then moves the fabric offers, then holes filled. The compiler is the oracle. A move is offered only when applying it gives a pipeline that compiles once its holes are filled. A draft with holes cannot be planned, run or exported.

```ts
const draft = fabric
  .draft({ type: 'Tritanium' })
  .apply('orders') // market.orders, attached to eve.type
  .fill('region', 'The Forge') // a hole, typed eve.region.reference
  .apply('cheapest')
  .apply('location') // follow the order's location_id
  .apply('system');

draft.plan(); // 6 steps, 1 ESI call, no scopes
const { answer } = await fabric.query(draft); // Perimeter, security 0.9549
```

`draft.moves()` lists what can come next and `draft.holes` what is still needed. A reference hole lists its choices from the SDE through `hole.choices(text)`. Every draft is immutable, so undo means keeping the previous one.

#### Lists and joins

A move on a list runs a step once per item. The fabric runs equal items once and refuses more distinct items than the step's cap (100 by default). The plan reports the cap and the calls per item before anything is sent:

```ts
const draft = fabric
  .draft({ type: 'Rifter' })
  .apply('blueprint')
  .apply('materials') // eve.material.collection
  .apply('cheapest price each') // one market lookup per material
  .fill('region', 'The Forge')
  .apply('total cost');

draft.plan().steps.find((s) => s.each); // { over: 'material', cap: 100, esiCallsPerItem: 1, … }
await fabric.query(draft, { perItemCap: 250 }); // raise the cap for this query only
```

A capability that takes a list of records is offered on a list of their references, and each reference is resolved first. That is how `route` and then `lowest security` work.

A join is a weave: a pipeline that a pack publishes as a capability. The core pack's `trade profit after tax` looks up orders in two regions side by side and joins them.

#### Asking as a character

A capability that reads a character's own data declares its ESI scope in `uses`. A draft asked as an identity offers such a move only when the identity's token holds the scope. Otherwise the move is still listed, marked unavailable with the scope it needs, and applying it throws. `fabric.query` runs as the draft's identity through `esi.as(identity)`, so one fabric serves many characters, and a fabric-cached step that sees one character's data is keyed by that character.

```ts
import { identityFromToken } from '@lgriffin/esi.ts/client';

const me = {
  characterId: 2112000001,
  scopes: ['esi-wallet.read_character_wallet.v1'],
  esi: identityFromToken(accessToken),
};
const draft = fabric
  .draft({ character: me.characterId }, { as: me })
  .apply('wallet journal') // needs esi-wallet.read_character_wallet.v1
  .apply('biggest spend this week');

draft.plan().scopes; // ['esi-wallet.read_character_wallet.v1']
await fabric.query(draft); // 2000000, spent on market_transaction
```

`my orders` then `undercut` checks each open order against its own region's market, one lookup per order.

### Capabilities

A capability is a versioned, typed data operation. Its contract and the code
that implements it live in one module; what it `uses` decides its source, its
scopes and the context its `run` receives:

```typescript
import { defineCapability, definePack } from '@eve-fabric/kit';

export const orders = defineCapability({
  id: 'my.market.orders',
  version: '2.0.0',
  name: 'Market Orders',
  description: 'Live market orders for an item in a region',
  inputs: {
    region: { type: 'eve.region.reference' },
    item: { type: 'eve.type.reference' },
  },
  outputs: { orders: { type: 'eve.market.order.collection' } },
  uses: ['esi.public'],
  // A field on eve.type: a type's orders are one move away.
  attach: { on: 'eve.type', as: 'myOrders', subject: 'item' },
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
