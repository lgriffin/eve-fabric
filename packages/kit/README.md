# @eve-fabric/kit

The authoring surface for fabric capabilities: `defineCapability` (a contract
and its `run` in one module), `defineType` and `definePack`. A pack written
with it installs into any fabric, and the fabric offers each capability as a
move wherever its `attach` says.

```ts
import { defineCapability, definePack } from '@eve-fabric/kit';

export const costToBuy = defineCapability({
  id: 'quickstart.cost.to.buy',
  version: '1.0.0',
  name: 'Cost to Buy',
  description: 'What buying a quantity costs, taking the cheapest sell orders first',
  inputs: {
    orders: { type: 'eve.market.order.collection', description: 'Orders for one item' },
    quantity: { type: 'eve.quantity', description: 'How many units to buy' },
  },
  outputs: {
    cost: { type: 'eve.currency.isk', description: 'Total ISK, or null if the market runs dry' },
  },
  attach: { on: 'eve.market.order.collection', as: 'cost to buy', subject: 'orders' },
  run({ orders, quantity }) {
    /* … */
  },
});

export const quickstartPack = definePack({ id: '@example/quickstart', capabilities: [costToBuy] });
```

Install it with `fabric.install(quickstartPack)`, or from the command line with
`eve-fabric --pack ./pack.ts …`. The types a capability names (`eve.quantity`,
`eve.market.order.collection`) come from
[`@eve-fabric/pack-core`](https://www.npmjs.com/package/@eve-fabric/pack-core);
`defineType` adds your own.

Part of [EVE Fabric](https://github.com/lgriffin/eve-fabric); the full example
is `examples/quickstart/pack.ts` there.
