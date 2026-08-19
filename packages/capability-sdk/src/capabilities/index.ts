import type { CapabilityDefinition } from '@eve-fabric/domain';
import { resolveType, resolveRegion, resolveSolarSystem, resolveLocation } from './universe.js';
import { orders, aggregate } from './market.js';
import { distance } from './routing.js';
import { filter, sort, limit } from './collection.js';

export * from './universe.js';
export * from './market.js';
export * from './routing.js';
export * from './collection.js';

export const allCapabilities: readonly CapabilityDefinition[] = [
  resolveType,
  resolveRegion,
  resolveSolarSystem,
  resolveLocation,
  orders,
  aggregate,
  distance,
  filter,
  sort,
  limit,
];
