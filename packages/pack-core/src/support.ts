/**
 * Narrowing helpers for port values. Until semantic types validate values at
 * the port boundary (overhaul phase 3), each run narrows what it reads.
 */

/** A market order as ESI sends it (GET /markets/{region_id}/orders). */
export interface EsiMarketOrder {
  readonly order_id: number;
  readonly type_id: number;
  readonly location_id: number;
  readonly system_id?: number;
  readonly price: number;
  readonly volume_remain: number;
  readonly volume_total: number;
  readonly is_buy_order: boolean;
  readonly issued: string;
  readonly duration: number;
  readonly range: string;
  readonly min_volume: number;
}

export function asOrders(value: unknown): EsiMarketOrder[] {
  return Array.isArray(value) ? (value as EsiMarketOrder[]) : [];
}

export function sellOrders(orders: readonly EsiMarketOrder[]): EsiMarketOrder[] {
  return orders.filter((o) => !o.is_buy_order);
}

export function buyOrders(orders: readonly EsiMarketOrder[]): EsiMarketOrder[] {
  return orders.filter((o) => o.is_buy_order);
}

export function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A numeric id, accepting its decimal string form. Throws naming the port. */
export function requireId(value: unknown, port: string): number {
  const id = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) return id;
  throw new Error(`Input "${port}" must be a positive integer id, got ${JSON.stringify(value)}`);
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function collect<T>(items: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of items) out.push(item);
  return out;
}
