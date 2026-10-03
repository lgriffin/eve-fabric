/**
 * Your own pack. A capability is its contract and its `run` in one module.
 * `attach` hangs it on a type, so a draft offers it as a move there, and any
 * input it does not attach on becomes a hole the person asking fills in.
 * This one needs no ESI call: it reads orders another step already fetched.
 */
import { defineCapability, definePack } from '@eve-fabric/kit';

interface Order {
  readonly price: number;
  readonly volume_remain?: number;
  readonly is_buy_order?: boolean;
}

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
  // On any list of orders, `cost to buy` is one move away, with a quantity hole.
  attach: { on: 'eve.market.order.collection', as: 'cost to buy', subject: 'orders' },
  cost: { estimatedLatencyMs: 1 },
  run({ orders, quantity }) {
    let wanted = Number(quantity);
    if (wanted === 0) return { cost: 0 };
    const sells = (orders as readonly Order[])
      .filter((o) => o.is_buy_order !== true)
      .sort((a, b) => a.price - b.price);
    let total = 0;
    for (const order of sells) {
      // An order that does not say how many remain has none to sell.
      const take = Math.min(wanted, order.volume_remain ?? 0);
      total += take * order.price;
      wanted -= take;
      if (wanted === 0) return { cost: Math.round(total * 100) / 100 };
    }
    return { cost: null };
  },
});

export const quickstartPack = definePack({ id: '@example/quickstart', capabilities: [costToBuy] });
