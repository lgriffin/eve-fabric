import { z } from 'zod';
import { createSemanticType, type SemanticTypeDefinition } from './semantic-type.js';
import type { SemanticTypeRegistry } from './registry.js';

export const EveTypeReference = createSemanticType({
  id: 'eve.type.reference',
  description: 'Reference to an EVE item type',
  schema: z.number().int().positive(),
  category: 'universe',
});

export const EveRegionReference = createSemanticType({
  id: 'eve.region.reference',
  description: 'Reference to an EVE region',
  schema: z.number().int().positive(),
  category: 'universe',
});

export const EveSystemReference = createSemanticType({
  id: 'eve.system.reference',
  description: 'Reference to an EVE solar system',
  schema: z.number().int().positive(),
  category: 'universe',
});

export const EveLocationReference = createSemanticType({
  id: 'eve.location.reference',
  description: 'Reference to an EVE location (station, structure, or system)',
  schema: z.number().int().positive(),
  category: 'universe',
});

const marketOrderSchema = z.object({
  orderId: z.number().int().positive(),
  typeId: z.number().int().positive(),
  locationId: z.number().int().positive(),
  price: z.number().nonnegative(),
  volumeRemaining: z.number().int().nonnegative(),
  volumeTotal: z.number().int().positive(),
  isBuyOrder: z.boolean(),
  issued: z.string().datetime(),
  duration: z.number().int().positive(),
  range: z.string(),
  minVolume: z.number().int().positive(),
});

export const EveMarketOrder = createSemanticType({
  id: 'eve.market.order',
  description: 'A single market order',
  schema: marketOrderSchema,
  category: 'market',
});

export const EveMarketOrderCollection = createSemanticType({
  id: 'eve.market.order.collection',
  description: 'A collection of market orders',
  schema: z.array(marketOrderSchema),
  category: 'market',
});

export const EveCurrencyIsk = createSemanticType({
  id: 'eve.currency.isk',
  description: 'An ISK currency amount',
  schema: z.number(),
  category: 'market',
});

export const EveRouteDistance = createSemanticType({
  id: 'eve.route.distance',
  description: 'Distance in jumps between two systems',
  schema: z.number().int().nonnegative(),
  category: 'routing',
});

export const EveSecurityStatus = createSemanticType({
  id: 'eve.security.status',
  description: 'Solar system security status (-1.0 to 1.0)',
  schema: z.number().min(-1).max(1),
  category: 'universe',
});

export const EveTimestamp = createSemanticType({
  id: 'eve.timestamp',
  description: 'ISO 8601 timestamp',
  schema: z.string().datetime(),
  category: 'common',
});

export const EVE_SEMANTIC_TYPES: ReadonlyArray<SemanticTypeDefinition> = [
  EveTypeReference,
  EveRegionReference,
  EveSystemReference,
  EveLocationReference,
  EveMarketOrder,
  EveMarketOrderCollection,
  EveCurrencyIsk,
  EveRouteDistance,
  EveSecurityStatus,
  EveTimestamp,
];

export function registerEveTypes(registry: SemanticTypeRegistry): void {
  for (const type of EVE_SEMANTIC_TYPES) {
    registry.register(type);
  }
}
