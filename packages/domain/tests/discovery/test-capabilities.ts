import { CapabilityCatalog } from '../../src/capability/catalog.js';

export function resolveLocationDef() {
  return {
    id: 'universe.resolve.location',
    version: 1,
    name: 'Resolve Location',
    description: 'Resolves a location reference to a solar system reference',
    inputs: {
      location: {
        name: 'location',
        semanticType: 'eve.location.reference',
        required: true,
      },
    },
    outputs: {
      system: {
        name: 'system',
        semanticType: 'eve.system.reference',
        required: true,
      },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 3600, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 50, esiCallCount: 0 },
  };
}

export function marketOrdersDef() {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders for a region and type',
    inputs: {
      regionId: {
        name: 'regionId',
        semanticType: 'eve.region.reference',
        required: true,
      },
      typeId: {
        name: 'typeId',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    outputs: {
      orders: {
        name: 'orders',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
      location: {
        name: 'location',
        semanticType: 'eve.location.reference',
        required: true,
      },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
  };
}

export function routeDistanceDef() {
  return {
    id: 'routing.distance',
    version: 1,
    name: 'Route Distance',
    description: 'Calculate jump distance between two solar systems',
    inputs: {
      origin: {
        name: 'origin',
        semanticType: 'eve.system.reference',
        required: true,
      },
      destination: {
        name: 'destination',
        semanticType: 'eve.system.reference',
        required: true,
      },
    },
    outputs: {
      distance: {
        name: 'distance',
        semanticType: 'eve.route.distance',
        required: true,
      },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 600, stalePermitted: true, identityInKey: false },
    cost: { estimatedLatencyMs: 150, esiCallCount: 1 },
  };
}

export function securityStatusDef() {
  return {
    id: 'universe.security',
    version: 1,
    name: 'Security Status',
    description: 'Get the security status of a solar system',
    inputs: {
      system: {
        name: 'system',
        semanticType: 'eve.system.reference',
        required: true,
      },
    },
    outputs: {
      securityStatus: {
        name: 'securityStatus',
        semanticType: 'eve.security.status',
        required: true,
      },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
  };
}

export function characterLocationDef() {
  return {
    id: 'character.location',
    version: 1,
    name: 'Character Location',
    description: 'Get the current location of a character',
    inputs: {
      characterId: {
        name: 'characterId',
        semanticType: 'eve.character.reference',
        required: true,
      },
    },
    outputs: {
      location: {
        name: 'location',
        semanticType: 'eve.location.reference',
        required: true,
      },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: true, scopes: ['esi-location.read_location.v1'] },
    cache: { cacheable: true, defaultTtlSeconds: 30, stalePermitted: false, identityInKey: true },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

export function resolveTypeDef() {
  return {
    id: 'universe.resolve.type',
    version: 1,
    name: 'Resolve Type',
    description: 'Resolve a type name to a type reference',
    inputs: {
      typeName: {
        name: 'typeName',
        semanticType: 'eve.type.name',
        required: true,
      },
    },
    outputs: {
      typeId: {
        name: 'typeId',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  };
}

export function marketAggregationDef() {
  return {
    id: 'market.aggregation',
    version: 1,
    name: 'Market Aggregation',
    description: 'Aggregate market orders by location',
    inputs: {
      orders: {
        name: 'orders',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
      location: {
        name: 'location',
        semanticType: 'eve.location.reference',
        required: false,
      },
    },
    outputs: {
      averagePrice: {
        name: 'averagePrice',
        semanticType: 'eve.currency.isk',
        required: true,
      },
    },
    source: 'DERIVED' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 30, esiCallCount: 0 },
  };
}

export function buildTestCatalog(...defs: Array<() => Record<string, unknown>>): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  for (const defFactory of defs) {
    catalog.register(defFactory());
  }
  return catalog;
}
