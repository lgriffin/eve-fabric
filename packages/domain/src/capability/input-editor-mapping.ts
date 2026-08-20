import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export type EditorType =
  'searchable-selector' | 'enum' | 'numeric' | 'boolean' | 'text' | 'collection';

const EDITOR_TYPE_MAP: ReadonlyMap<string, EditorType> = new Map([
  ['eve.type.reference', 'searchable-selector'],
  ['eve.region.reference', 'searchable-selector'],
  ['eve.system.reference', 'searchable-selector'],
  ['eve.location.reference', 'searchable-selector'],
  ['eve.market.order.collection', 'collection'],
  ['eve.currency.isk', 'numeric'],
  ['eve.route.distance', 'numeric'],
  ['eve.security.status', 'numeric'],
  ['eve.timestamp', 'text'],
]);

export function getEditorType(semanticType: SemanticTypeId): EditorType {
  return EDITOR_TYPE_MAP.get(semanticType) ?? 'text';
}
