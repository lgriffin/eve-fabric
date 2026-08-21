import { describe, it, expect, beforeEach } from 'vitest';
import {
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
  EVE_SEMANTIC_TYPES,
  registerEveTypes,
} from '../../src/semantic-type/eve-types.js';
import { SemanticTypeRegistry } from '../../src/semantic-type/registry.js';

function validMarketOrder() {
  return {
    orderId: 12345,
    typeId: 34,
    locationId: 60003760,
    price: 100.5,
    volumeRemaining: 50,
    volumeTotal: 100,
    isBuyOrder: true,
    issued: '2024-01-15T12:00:00Z',
    duration: 90,
    range: 'region',
    minVolume: 1,
  };
}

describe('EVE semantic types', () => {
  describe('type metadata', () => {
    it.each([
      { constant: EveTypeReference, id: 'eve.type.reference', category: 'universe' },
      { constant: EveRegionReference, id: 'eve.region.reference', category: 'universe' },
      { constant: EveSystemReference, id: 'eve.system.reference', category: 'universe' },
      { constant: EveLocationReference, id: 'eve.location.reference', category: 'universe' },
      { constant: EveMarketOrder, id: 'eve.market.order', category: 'market' },
      { constant: EveMarketOrderCollection, id: 'eve.market.order.collection', category: 'market' },
      { constant: EveCurrencyIsk, id: 'eve.currency.isk', category: 'market' },
      { constant: EveRouteDistance, id: 'eve.route.distance', category: 'routing' },
      { constant: EveSecurityStatus, id: 'eve.security.status', category: 'universe' },
      { constant: EveTimestamp, id: 'eve.timestamp', category: 'common' },
    ])('$id has correct id, category, and non-empty description', ({ constant, id, category }) => {
      expect(constant.id as string).toBe(id);
      expect(constant.category).toBe(category);
      expect(constant.description).toBeTruthy();
    });
  });

  describe('EveTypeReference schema', () => {
    it('accepts a positive integer', () => {
      expect(EveTypeReference.schema.safeParse(34).success).toBe(true);
    });

    it('rejects zero', () => {
      expect(EveTypeReference.schema.safeParse(0).success).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(EveTypeReference.schema.safeParse(-1).success).toBe(false);
    });

    it('rejects strings', () => {
      expect(EveTypeReference.schema.safeParse('hello').success).toBe(false);
    });
  });

  describe('EveSecurityStatus schema', () => {
    it.each([-1, 0, 1, 0.5])('accepts %d', (value) => {
      expect(EveSecurityStatus.schema.safeParse(value).success).toBe(true);
    });

    it('rejects values below -1', () => {
      expect(EveSecurityStatus.schema.safeParse(-1.1).success).toBe(false);
    });

    it('rejects values above 1', () => {
      expect(EveSecurityStatus.schema.safeParse(1.1).success).toBe(false);
    });
  });

  describe('EveTimestamp schema', () => {
    it('accepts an ISO 8601 datetime string', () => {
      expect(EveTimestamp.schema.safeParse('2024-01-15T12:00:00Z').success).toBe(true);
    });

    it('rejects a random string', () => {
      expect(EveTimestamp.schema.safeParse('not-a-date').success).toBe(false);
    });
  });

  describe('EveMarketOrder schema', () => {
    it('accepts a valid market order', () => {
      expect(EveMarketOrder.schema.safeParse(validMarketOrder()).success).toBe(true);
    });

    it('rejects a market order with missing fields', () => {
      const order = validMarketOrder() as Record<string, unknown>;
      delete order['orderId'];
      expect(EveMarketOrder.schema.safeParse(order).success).toBe(false);
    });
  });

  describe('EVE_SEMANTIC_TYPES array', () => {
    it('contains exactly 12 types', () => {
      expect(EVE_SEMANTIC_TYPES).toHaveLength(12);
    });
  });

  describe('registerEveTypes', () => {
    let registry: SemanticTypeRegistry;

    beforeEach(() => {
      registry = new SemanticTypeRegistry();
    });

    it('registers all 12 types into the registry', () => {
      registerEveTypes(registry);

      expect(registry.list()).toHaveLength(12);
    });

    it('makes every EVE type findable by id', () => {
      registerEveTypes(registry);

      for (const type of EVE_SEMANTIC_TYPES) {
        expect(registry.has(type.id)).toBe(true);
      }
    });
  });
});
