import { GraphQLScalarType, Kind } from 'graphql';

function intScalar(name: string, description: string): GraphQLScalarType {
  return new GraphQLScalarType({
    name,
    description,
    serialize: (value) => {
      if (typeof value === 'number') return Math.trunc(value);
      if (typeof value === 'string') return parseInt(value, 10);
      return null;
    },
    parseValue: (value) => {
      if (typeof value === 'number') return Math.trunc(value);
      if (typeof value === 'string') return parseInt(value, 10);
      throw new TypeError(`${name} must be an integer`);
    },
    parseLiteral: (ast) => {
      if (ast.kind === Kind.INT) return parseInt(ast.value, 10);
      return null;
    },
  });
}

export const ISKScalar = new GraphQLScalarType({
  name: 'ISK',
  description: 'EVE Online ISK currency amount',
  serialize: (value) => (typeof value === 'number' ? value : null),
  parseValue: (value) => {
    if (typeof value === 'number') return value;
    throw new TypeError('ISK must be a number');
  },
  parseLiteral: (ast) => {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) return parseFloat(ast.value);
    return null;
  },
});

export const TypeReferenceScalar = intScalar('TypeReference', 'Reference to an EVE item type');
export const RegionReferenceScalar = intScalar('RegionReference', 'Reference to an EVE region');
export const SystemReferenceScalar = intScalar('SystemReference', 'Reference to an EVE solar system');
export const LocationReferenceScalar = intScalar('LocationReference', 'Reference to an EVE location');
export const RouteDistanceScalar = intScalar('RouteDistance', 'Distance in jumps between systems');

export const SecurityStatusScalar = new GraphQLScalarType({
  name: 'SecurityStatus',
  description: 'Solar system security status (-1.0 to 1.0)',
  serialize: (value) => (typeof value === 'number' ? value : null),
  parseValue: (value) => {
    if (typeof value === 'number') return value;
    throw new TypeError('SecurityStatus must be a number');
  },
  parseLiteral: (ast) => {
    if (ast.kind === Kind.FLOAT || ast.kind === Kind.INT) return parseFloat(ast.value);
    return null;
  },
});

export const DateTimeScalar = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO 8601 date-time string',
  serialize: (value) => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
  },
  parseValue: (value) => {
    if (typeof value === 'string') return value;
    throw new TypeError('DateTime must be an ISO 8601 string');
  },
  parseLiteral: (ast) => {
    if (ast.kind === Kind.STRING) return ast.value;
    return null;
  },
});

const SEMANTIC_SCALAR_MAP = new Map<string, GraphQLScalarType>([
  ['eve.currency.isk', ISKScalar],
  ['eve.type.reference', TypeReferenceScalar],
  ['eve.region.reference', RegionReferenceScalar],
  ['eve.system.reference', SystemReferenceScalar],
  ['eve.location.reference', LocationReferenceScalar],
  ['eve.route.distance', RouteDistanceScalar],
  ['eve.security.status', SecurityStatusScalar],
  ['eve.timestamp', DateTimeScalar],
]);

export const SEMANTIC_SCALARS: ReadonlyMap<string, GraphQLScalarType> = SEMANTIC_SCALAR_MAP;

export function getScalarForSemanticType(semanticTypeId: string): GraphQLScalarType | undefined {
  return SEMANTIC_SCALAR_MAP.get(semanticTypeId);
}
