import { describe, it, expect } from 'vitest';
import { getEditorType } from '../../src/capability/input-editor-mapping.js';
import { semanticTypeId } from '../../src/semantic-type/semantic-type.js';

describe('getEditorType', () => {
  it('maps eve.type.reference to searchable-selector', () => {
    expect(getEditorType(semanticTypeId('eve.type.reference'))).toBe('searchable-selector');
  });

  it('maps eve.region.reference to searchable-selector', () => {
    expect(getEditorType(semanticTypeId('eve.region.reference'))).toBe('searchable-selector');
  });

  it('maps eve.system.reference to searchable-selector', () => {
    expect(getEditorType(semanticTypeId('eve.system.reference'))).toBe('searchable-selector');
  });

  it('maps eve.location.reference to searchable-selector', () => {
    expect(getEditorType(semanticTypeId('eve.location.reference'))).toBe('searchable-selector');
  });

  it('maps eve.market.order.collection to collection', () => {
    expect(getEditorType(semanticTypeId('eve.market.order.collection'))).toBe('collection');
  });

  it('maps eve.currency.isk to numeric', () => {
    expect(getEditorType(semanticTypeId('eve.currency.isk'))).toBe('numeric');
  });

  it('maps eve.route.distance to numeric', () => {
    expect(getEditorType(semanticTypeId('eve.route.distance'))).toBe('numeric');
  });

  it('maps eve.security.status to numeric', () => {
    expect(getEditorType(semanticTypeId('eve.security.status'))).toBe('numeric');
  });

  it('maps eve.timestamp to text', () => {
    expect(getEditorType(semanticTypeId('eve.timestamp'))).toBe('text');
  });

  it('falls back to text for unknown semantic types', () => {
    expect(getEditorType(semanticTypeId('eve.unknown.type'))).toBe('text');
  });
});
