# EVE Fabric

A TypeScript-first fabric for asking questions of EVE Online data. Start from a subject, follow the moves the fabric offers, fill the holes it names, and the question compiles, plans and runs; its saved form is GraphQL, and it can be shared as a weave another fabric adds.

New here? [TESTING.md](TESTING.md) takes you from an empty directory to an
answered question and names five things to try. The command line is documented
in [docs/cli.md](docs/cli.md), the gateway's HTTP API in
[docs/gateway-api.md](docs/gateway-api.md), and what each pull request changed
in [CHANGELOG.md](CHANGELOG.md).

## Quickstart

```bash
git clone https://github.com/lgriffin/eve-fabric.git && cd eve-fabric
pnpm install && pnpm run build
pnpm quickstart
```

`pnpm quickstart` runs offline over a small recorded slice of Tranquility, so
it needs no ESI access or SDE download. In nine printed steps it creates a
fabric, installs a capability you wrote, asks a question, saves it as GraphQL
and reopens it, then shares it as a weave and asks it from a second fabric.
Add `--live` to ask Tranquility's ESI. The code is
[`examples/quickstart`](examples/quickstart/README.md), and it is the place to
start a pack of your own. `pnpm demo` does the same through the gateway's HTTP
API.

### From the terminal

`pnpm fabric` is the `eve-fabric` CLI; outside this repository it is
`npx @eve-fabric/cli` once published. It asks saved questions, explores
moves, and moves weaves in and out of a fabric. `--offline` uses the fixture,
`--pack <module>` installs a pack you wrote, and `--db <file>` keeps added
weaves across runs:

```bash
pnpm fabric moves type=Tritanium orders --offline              # what can come next
pnpm fabric moves type=Tritanium orders "region=The Forge" prices --offline
pnpm fabric ask question.graphql --offline                     # run a saved question
pnpm fabric weave export question.graphql --id me.prices --version 1.0.0 --as "forge prices" --out prices.weave.yaml --offline
pnpm fabric weave add prices.weave.yaml --db fabric.db --offline
pnpm fabric weave list --db fabric.db --offline
pnpm fabric codegen prices.weave.yaml --out prices --offline        # a runnable package from a weave
```

`codegen` writes a package holding the weave, an `index.ts` that builds a
fabric, adds the weave and asks its question (typed by port, ids in and values
out), and a `package.json` naming the published packages it depends on. The
module carries no capability code: the fabric checks the weave's digest and
requirements when it is first asked.

## What It Does

EVE Fabric treats every EVE Online data operation as a **capability** — a typed, versioned unit with semantic inputs and outputs. A **question** is built as a draft: a subject, then the moves the fabric offers on it, then the holes those moves open. Each move is a capability, and a move is offered only when the pipeline it produces compiles. A complete question has a saved form, GraphQL against the schema the fabric derives from what is installed:

```graphql
{
  type(name: "Tritanium") {
    orders(region: "The Forge") {
      prices {
        lowestSell
      }
    }
  }
}
```

Under the question is a pipeline (a directed acyclic graph of capabilities), and the compiler is the oracle: it validates semantic wiring (a `RegionReference` cannot be wired into a `TypeReference`), detects cycles, and produces an execution plan that respects dependencies, runs steps in parallel where it can, and tracks provenance — all before a single API call is made. A pipeline is never written by hand; a pack publishes one as a composite capability, and a question's pipeline is read off its moves.

## Architecture

```
┌──────────────────┬──────────────────┬───────────────────┐
│     apps/cli     │  apps/designer   │   apps/gateway    │
│   pnpm fabric    │ moves and holes, │ drafts, weaves,   │
│                  │ scaffold drawn   │ derived GraphQL   │
├──────────────────┴──────────────────┴───────────────────┤
│              fabric (createFabric), the one             │
│  composition root: draft · fromGraphQL · compile · run  │
│                 · weave · add · restore                 │
├──────────┬──────────┬───────────┬──────────┬────────────┤
│ compiler │ planner  │ executor  │ graphql  │   weave    │
│ 12-step  │ Dep order│ Parallel  │ Type     │ format v2  │
│ semantic │ Parallel │ executor  │ builder  │ digest     │
│ compiler │ groups   │ Proven-   │ Scalars  │ git index  │
│ DAG      │ Coalesce │ ance      │ Pruning  │ secrets    │
├──────────┴──────────┴───────────┴──────────┴────────────┤
│  kit (defineCapability, definePack)  ·  pack-core       │
├──────────┬──────────┬───────────┬──────────┬────────────┤
│   core   │source-esi│source-sde │  cache   │persistence │
│ Branded  │ ESI.ts   │ Static    │ In-mem   │ the Store  │
│ types    │ views    │ data      │ TTL      │ (SQLite)   │
│ Zod only │          │           │          │            │
└──────────┴──────────┴───────────┴──────────┴────────────┘
```

Every surface talks to the fabric, and only the fabric talks to the sources:
the engine row never imports a source, and `core` imports nothing but zod
(`pnpm run lint:layers` enforces both).

### Package Overview

| Package                   | Purpose                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@eve-fabric/core`        | Branded types, capability model, pipeline model, error hierarchy, ports                                                      |
| `@eve-fabric/compiler`    | 12-step semantic compiler: parse, validate, resolve, build graph, detect cycles, determine sources/auth/cache, estimate cost |
| `@eve-fabric/planner`     | Dependency ordering, parallel group detection, request coalescing                                                            |
| `@eve-fabric/executor`    | Concurrent execution engine with provenance tracking                                                                         |
| `@eve-fabric/graphql`     | GraphQL type/query/input generation, custom scalars, selection-set pruning                                                   |
| `@eve-fabric/kit`         | `defineCapability` (contract and `run` in one module), `definePack`, `defineContract`, YAML manifest parser                  |
| `@eve-fabric/pack-core`   | The built-in capabilities as a pack: universe resolvers, market, routing, analysis, logistics, industry                      |
| `@eve-fabric/fabric`      | `createFabric`: ESI.ts runtime, SDE and packs in; compile, publish composites and run                                        |
| `@eve-fabric/source-esi`  | Hands capabilities ESI.ts's public view and records the compatibility date                                                   |
| `@eve-fabric/source-sde`  | Wraps ESI.ts's static data provider; a configured export that will not load is an error                                      |
| `@eve-fabric/cache`       | In-memory cache with TTL and stale-while-revalidate                                                                          |
| `@eve-fabric/weave`       | Package format v2: a weave as data, its digest, version ranges, secret scanning, and a git index to find weaves in           |
| `@eve-fabric/persistence` | The `Store` port over SQLite (`node:sqlite`), through Drizzle                                                                |
| `@eve-fabric/fixture`     | The Tranquility fixture: a slice of New Eden over ESI.ts's mock transport and in-memory SDE, for tests and `--offline`       |

### Apps

| App             | Purpose                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------- |
| `apps/cli`      | `pnpm fabric`: ask saved questions, explore moves, move weaves in and out of a fabric              |
| `apps/gateway`  | Fastify server: drafts and weaves over HTTP, the derived schema at `/graphql`                      |
| `apps/designer` | React + React Flow question builder: offered moves and named holes, the scaffold drawn on a canvas |

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

#### Saved as GraphQL

A draft's saved, shareable form is a GraphQL document. Each field is a move, and its arguments fill the holes that move opened. A move onto a step with several outputs selects one of them:

```ts
draft.toGraphQL();
// { type(name: "Tritanium") { orders(region: "The Forge") { prices { highestBuy } } } }

const same = fabric.fromGraphQL(document); // replays the moves and fills it names
fabric.schema(); // the derived schema, for introspection and tooling
```

`fromGraphQL` checks a document against the derived schema, then rebuilds it through `apply` and `fill`, so a document either becomes a draft the fabric offered or is refused with the reason. A subject is named by `type(name: "Tritanium")` or by `typeById(id: 34)`. Fields of the record where the path ends may be selected, and the answer then carries only those fields. Only a complete draft has a saved form; while a hole is open, `toGraphQL` throws. The derived schema is read from the moves the draft engine offers on each type, so a document valid against it always plans. The designer builds questions the same way: its panel shows the moves and holes the fabric offers, and its canvas shows the steps that result.

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

### Sharing a Question as a Weave

A weave is a question someone else can add to their fabric: a pipeline, the
capability versions it requires, the scopes it needs, what it was checked
against, and a digest over all of it. It carries no code, so adding one runs
nothing the operator did not already install. Code travels as a pack, by npm.

```typescript
const q3 = fabric
  .draft({ type: 'Tritanium' })
  .apply('trade profit after tax')
  .fill('from', 'The Forge')
  .fill('to', 'Domain');

// The names typed into the draft become inputs: a move on any item.
const file = fabric.export(
  fabric.weave(q3, { id: 'lgriffin.trade.opportunity', version: '1.0.0', as: 'trade opportunity' }),
);

// In another fabric: refused whole, adding nothing, unless the digest
// matches, every requirement is here in a version its range accepts, it
// compiles, and its scopes and ports are the ones it compiles to (FAB-VAL-08).
await other.add(weaveToYaml(file));
other.draft({ type: 'Pyerite' }).apply('trade opportunity');
```

`weaves/` is a git index: one directory per weave and a generated
`index.json`. `pnpm run weaves` exports this repository's weaves into it;
`pnpm run weaves:check` fails when a fresh export differs by a byte. A fabric
given an index adds a weave by name, `await fabric.add('lgriffin.trade.opportunity@^1')`,
and `gitIndex(url)` reads a remote repository the same way. Given a `store`,
a fabric keeps what it adds and `restore()` brings it back after a restart,
skipping (and naming) any that no longer add; `remove(id, version)` takes one
back unless another is built on it. A changed weave needs a new version. The
gateway uses SQLite at `FABRIC_DB` and an index at `FABRIC_WEAVE_INDEX`, logs
the weaves a restart skipped, and serves `/api/weaves` to add, list, export
and remove them (`DELETE /api/weaves/:id?version=x.y.z`).

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

- Node.js 22.12+
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
pnpm test               # unit tests, from source: no build needed
pnpm run test:bdd       # BDD scenarios
pnpm run test:bank      # the question bank (--live asks Tranquility's ESI)
pnpm run validate       # the full gate CI runs
```

`pnpm test` resolves `@eve-fabric/*` to each package's source, so it runs on a
fresh checkout. Everything that runs through `tsx` (the BDD suite, the bank,
the examples, the CLI) imports the built packages, so run `pnpm run build`
first.

### Start the Gateway

```bash
pnpm --filter @eve-fabric/gateway run dev
```

The gateway serves GraphQL at `http://localhost:3456/graphql` with a health check at `/health`. A saved question POSTed there runs as `pnpm fabric ask` would, and the answer comes back in the shape the document asked; the schema is the one `pnpm fabric schema` prints. It is the workbench the designer and HTTP clients build questions through; a saved question or a pack runs without it.
Set `FABRIC_DB` to a file to keep added weaves across restarts.

### Published Packages

The packages listed in `scripts/published.json` are versioned 0.1.0 and set
up for npm: `core`, `kit` and `pack-core`, so a pack can be written outside
this repository, and `fabric` with the sources, engine, `weave`, `persistence`,
`fixture` and `codegen` it needs, so the CLI (`@eve-fabric/cli`, the
`eve-fabric` bin) runs with `npx @eve-fabric/cli --offline ask question.graphql`.
`pnpm run packages:check` packs them all, installs them into an empty project
with nothing from this workspace, asks a question through the fabric and
through the installed bin, then exports that question as a weave, generates a
package from it with `eve-fabric codegen` and runs the generated module
offline, checking its answer against the bank's; pushing a `v*` tag publishes
them (the Release workflow needs an `NPM_TOKEN` secret). The gateway and
designer stay in the repository.

### Start the Designer

```bash
pnpm workbench          # the gateway over the offline fixture, and the designer against it
```

The designer runs at `http://localhost:5173` and the gateway at
`http://localhost:3456`. `pnpm workbench` needs no ESI access or SDE export.
Use `--live` for Tranquility's ESI and `--no-designer` for the gateway alone.
To run the designer against a gateway of your own, use
`pnpm --filter @eve-fabric/designer run dev`.

The designer has three modes, three layouts over the same question, each a
URL: **Explore** (`#explore`) shows the subjects and the moves they offer with
no canvas; **Build** (`#build`) puts the question beside the scaffold it
becomes; **Review** (`#review`) is where a saved question opens, read-only,
with Run. Start from a subject, apply the moves it offers, and fill the holes
it names. Once a question is complete you can **Save as GraphQL**, or **Share
as weave** to download a `.weave.yaml` another fabric can add. **Open…** (or
dropping a file anywhere) opens a saved `.graphql` question in Review, or adds
a `.weave.yaml` to the gateway's fabric so it is offered as a move. The canvas
draws the question's steps; it is not edited by hand.

`pnpm run test:e2e` drives both journeys (build and run a question; open a
saved one) in a browser over `pnpm workbench`.

To ask about your own character, paste an EVE SSO token. Before trusting the
character and scopes a token names, the gateway checks its signature against
EVE SSO's published keys, along with its issuer, audience and expiry. A token
that fails any check gets a 401.

## Examples

| Example                                       | Run                 | What it shows                                                    |
| --------------------------------------------- | ------------------- | ---------------------------------------------------------------- |
| [`quickstart`](examples/quickstart/README.md) | `pnpm quickstart`   | Your own capability, a question, its GraphQL form and a weave    |
| [`e2e-demo`](examples/e2e-demo/README.md)     | `pnpm demo`         | The same flow over the gateway's HTTP API, with curl equivalents |
| [`incursions-pack`](examples/incursions-pack) | (question bank Q5)  | A third-party pack with its own types                            |
| [`esi-live.ts`](examples/esi-live.ts)         | `pnpm run demo:esi` | A pipeline against live ESI (the nightly smoke test)             |
| [`questions`](examples/questions/README.md)   | `pnpm fabric ask`   | Saved questions against the core pack, one `.graphql` file each  |

The quickstart and the demo run offline by default; both take `--live`.

## Tooling

| Tool        | Command                                       | Purpose                               |
| ----------- | --------------------------------------------- | ------------------------------------- |
| Vitest      | `pnpm -r run test`                            | Unit and integration tests            |
| Cucumber.js | `pnpm --filter @eve-fabric/core run test:bdd` | Behavior-driven scenarios             |
| Playwright  | `pnpm run test:e2e`                           | The designer's journeys in a browser  |
| Stryker     | `pnpm run mutate`                             | Mutation testing (compiler + planner) |
| TypeDoc     | `pnpm run docs`                               | API documentation generation          |
| ESLint      | `pnpm run lint`                               | Linting with TypeScript rules         |
| Prettier    | `pnpm run format`                             | Code formatting                       |
| Changesets  | `pnpm changeset`                              | Version management                    |
| Husky       | automatic                                     | Pre-commit secret scanning            |

## Project Constitution

This project follows a [constitution](.specify/memory/constitution.md) with 26 principles covering:

- **Clean Architecture** — core has zero infrastructure dependencies
- **Branded types** — semantic safety at the type level
- **TDD + BDD** — tests before implementation, behavior specifications
- **Gateway boundary** — never reimplement what ESI.ts already provides
- **Provenance** — every data point traceable to its source
- **No secrets in packages** — exported weaves are scanned

## Tech Stack

| Layer         | Technology                                     |
| ------------- | ---------------------------------------------- |
| Language      | TypeScript 5.x (strict mode)                   |
| Runtime       | Node.js 22.12+                                 |
| Server        | Fastify + GraphQL Yoga                         |
| Schema        | graphql-js type construction                   |
| Validation    | Zod                                            |
| EVE Data      | @lgriffin/esi.ts 11.1.1                        |
| Frontend      | React 18 + React Flow + Zustand                |
| Persistence   | Drizzle ORM + SQLite                           |
| Testing       | Vitest + Cucumber.js + Stryker                 |
| Observability | Structured request/response tracing middleware |

## License

ISC
