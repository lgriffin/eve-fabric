# Quickstart

```bash
pnpm install && pnpm run build
pnpm quickstart          # offline, over the Tranquility fixture
pnpm quickstart --live   # Tranquility's ESI
```

Two files:

- [`pack.ts`](pack.ts) is a pack of your own with one capability, `cost to buy`.
- [`quickstart.ts`](quickstart.ts) uses it, in the nine steps it prints.

## 1. Write a capability

A capability is a contract (typed inputs and outputs) and the `run` that
fulfils it, in one module:

```ts
export const costToBuy = defineCapability({
  id: 'quickstart.cost.to.buy',
  version: '1.0.0',
  name: 'Cost to Buy',
  description: 'What buying a quantity costs, taking the cheapest sell orders first',
  inputs: {
    orders: { type: 'eve.market.order.collection' },
    quantity: { type: 'eve.quantity' },
  },
  outputs: { cost: { type: 'eve.currency.isk' } },
  attach: { on: 'eve.market.order.collection', as: 'cost to buy', subject: 'orders' },
  run({ orders, quantity }) {
    /* … */
  },
});
export const quickstartPack = definePack({ id: '@example/quickstart', capabilities: [costToBuy] });
```

`attach` puts the capability on a type, so a draft offers it as a move on any
list of orders. `quantity` is not the input it attaches on, so applying the
move opens a hole named `quantity`. A capability that calls ESI says so in
`uses: ['esi.public']` (or a scope) and receives `esi` in its context; see
[`../incursions-pack`](../incursions-pack/pack.ts).

## 2. Install it and ask a question

```ts
const fabric = createFabric({ esi, sde, packs: [corePack, quickstartPack] });

const draft = fabric
  .draft({ type: 'Tritanium' })
  .apply('orders') // opens the hole `region`
  .fill('region', 'The Forge')
  .apply('cost to buy') // your move; opens `quantity`
  .fill('quantity', 2_000_000);

draft.plan(); // 4 steps, 1 ESI call, no scopes
const { answer } = await fabric.query(draft); // 8,100,000 ISK
```

`draft.moves()` lists what can come next, `draft.holes` what is still needed,
and `hole.choices('Forge')` looks up names in the SDE.

## 3. Save it and reopen it

A question's saved form is a GraphQL document:

```ts
const saved = draft.toGraphQL();
// { type(name: "Tritanium") { orders(region: "The Forge") { costToBuy(quantity: 2000000) } } }
const same = fabric.fromGraphQL(saved);
```

## 4. Share it as a weave

```ts
const yaml = weaveToYaml(
  fabric.export(
    fabric.weave(draft, {
      id: 'quickstart.cost.to.buy.in',
      version: '1.0.0',
      as: 'cost to buy in',
    }),
  ),
);
await other.add(yaml);
other.draft({ type: 'Pyerite' }).apply('cost to buy in'); // a move on any item now
```

A weave carries no code. It names the capability versions it needs, so a
fabric without `@example/quickstart` refuses it and says which one is missing.

## Where the files go

The saved question and the weave are written to `examples/quickstart/out/`
(git-ignored). The gateway adds a weave with `POST /api/weaves`, and the
designer opens a saved question from its draft panel.
