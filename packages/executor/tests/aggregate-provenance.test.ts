import { describe, it, expect } from 'vitest';
import { aggregateProvenance } from '../src/aggregate-provenance.js';
import { capabilityId } from '@eve-fabric/core';
import type { ProvenanceRecord } from '@eve-fabric/core';

function record(
  id: string,
  source: 'ESI' | 'SDE' | 'DERIVED' | 'CACHE',
  upstream: ProvenanceRecord[] = [],
): ProvenanceRecord {
  return {
    source,
    capability: { id: capabilityId(id) },
    capabilityVersion: '1.0.0',
    cached: source === 'CACHE',
    upstream,
  };
}

describe('aggregateProvenance', () => {
  it('returns empty array for empty input', () => {
    expect(aggregateProvenance([])).toEqual([]);
  });

  it('returns flat leaf records unchanged', () => {
    const esi = record('market.orders', 'ESI');
    const sde = record('sde.types', 'SDE');
    const result = aggregateProvenance([esi, sde]);
    expect(result).toHaveLength(2);
    expect(result[0]!.source).toBe('ESI');
    expect(result[1]!.source).toBe('SDE');
  });

  it('flattens nested upstream chains to leaf sources', () => {
    const esi = record('market.orders', 'ESI');
    const derived = record('market.aggregate', 'DERIVED', [esi]);
    const result = aggregateProvenance([derived]);
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('ESI');
    expect(result[0]!.capability.id).toBe('market.orders');
  });

  it('traverses through CACHE records to original sources', () => {
    const esi = record('market.orders', 'ESI');
    const cached = record('market.orders', 'CACHE', [esi]);
    const result = aggregateProvenance([cached]);
    expect(result).toHaveLength(1);
    expect(result[0]!.source).toBe('ESI');
  });

  it('deduplicates identical provenance records', () => {
    const esi = record('market.orders', 'ESI');
    const derived1 = record('market.aggregate', 'DERIVED', [esi]);
    const derived2 = record('market.filter', 'DERIVED', [esi]);
    const result = aggregateProvenance([derived1, derived2]);
    expect(result).toHaveLength(1);
    expect(result[0]!.capability.id).toBe('market.orders');
  });

  it('preserves multiple distinct leaf sources', () => {
    const esi = record('market.orders', 'ESI');
    const sde = record('sde.types', 'SDE');
    const derived = record('market.snapshot', 'DERIVED', [esi, sde]);
    const result = aggregateProvenance([derived]);
    expect(result).toHaveLength(2);
    const sources = result.map((r) => r.source);
    expect(sources).toContain('ESI');
    expect(sources).toContain('SDE');
  });

  it('handles deeply nested composite provenance', () => {
    const esi = record('market.orders', 'ESI');
    const sde = record('sde.types', 'SDE');
    const level1 = record('market.snapshot', 'DERIVED', [esi, sde]);
    const level2 = record('trade.opportunity', 'DERIVED', [level1]);
    const result = aggregateProvenance([level2]);
    expect(result).toHaveLength(2);
  });

  it('handles mixed leaf and upstream records', () => {
    const esi = record('market.orders', 'ESI');
    const sde = record('sde.types', 'SDE');
    const derived = record('market.snapshot', 'DERIVED', [esi]);
    const result = aggregateProvenance([derived, sde]);
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.capability.id as string);
    expect(ids).toContain('market.orders');
    expect(ids).toContain('sde.types');
  });
});
