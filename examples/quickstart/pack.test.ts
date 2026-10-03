import { describe, expect, it } from 'vitest';
import { costToBuy } from './pack.js';

const sell = (price: number, volume_remain?: number) => ({ price, volume_remain });

function cost(orders: readonly object[], quantity: number): unknown {
  return (costToBuy.run!({ orders, quantity }, {} as never) as { cost: unknown }).cost;
}

describe('cost to buy', () => {
  it('takes the cheapest sell orders first, ignoring buy orders', () => {
    const orders = [sell(5, 10), { price: 9, volume_remain: 100, is_buy_order: true }, sell(4, 10)];
    expect(cost(orders, 15)).toBe(4 * 10 + 5 * 5);
  });

  it('is null when the market runs dry', () => {
    expect(cost([sell(4, 10)], 11)).toBeNull();
  });

  it('treats an order that does not say how many remain as having none', () => {
    expect(cost([sell(3), sell(4, 10)], 5)).toBe(20);
  });

  it('costs nothing to buy nothing, even with no sell orders', () => {
    expect(cost([], 0)).toBe(0);
  });
});
