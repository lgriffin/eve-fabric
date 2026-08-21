const SEMANTIC_TYPE_MAP: Record<string, string> = {
  'eve.type.reference': 'number',
  'eve.region.reference': 'number',
  'eve.system.reference': 'number',
  'eve.location.reference': 'number',
  'eve.market.order': 'Record<string, unknown>',
  'eve.market.order.collection': 'Record<string, unknown>[]',
  'eve.currency.isk': 'number',
  'eve.route.distance': 'number',
  'eve.security.status': 'number',
  'eve.timestamp': 'string',
  'eve.percentage': 'number',
  'eve.quantity': 'number',
};

export function semanticTypeToTs(semanticTypeId: string): string {
  return SEMANTIC_TYPE_MAP[semanticTypeId] ?? 'unknown';
}
