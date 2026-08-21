import type { CapabilityDefinition } from '@eve-fabric/domain';
import { resolveType, resolveRegion, resolveSolarSystem, resolveLocation } from './universe.js';
import { orders, aggregate } from './market.js';
import { distance } from './routing.js';
import { filter, sort, limit } from './collection.js';
import { marketSnapshot, routeAnalysis, haulingCost } from './demos/index.js';
import {
  marketSpread,
  marketVolumeTotal,
  marketCheapest,
  marketHighestBuyer,
  marketOrderCount,
} from './market-analysis.js';
import {
  manufacturingCost,
  manufacturingProfit,
  blueprintLookup,
  reprocessingYield,
} from './industry.js';
import {
  priceCompare,
  tradeProfit,
  returnOnInvestment,
  marketTax,
  iskPerUnit,
} from './analysis.js';
import { freightEstimate, haulingProfit, cargoValue } from './logistics.js';

export * from './universe.js';
export * from './market.js';
export * from './routing.js';
export * from './collection.js';
export * from './demos/index.js';
export * from './market-analysis.js';
export * from './industry.js';
export * from './analysis.js';
export * from './logistics.js';

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
  marketSnapshot,
  routeAnalysis,
  haulingCost,
  marketSpread,
  marketVolumeTotal,
  marketCheapest,
  marketHighestBuyer,
  marketOrderCount,
  manufacturingCost,
  manufacturingProfit,
  blueprintLookup,
  reprocessingYield,
  priceCompare,
  tradeProfit,
  returnOnInvestment,
  marketTax,
  iskPerUnit,
  freightEstimate,
  haulingProfit,
  cargoValue,
];
