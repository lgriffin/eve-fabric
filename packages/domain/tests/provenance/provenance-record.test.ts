import { describe, it, expect } from 'vitest';
import type { ProvenanceRecord, DataSource } from '../../src/provenance/provenance-record.js';
import { capabilityId } from '../../src/capability/capability-id.js';

describe('ProvenanceRecord', () => {
  it('represents an ESI provenance record', () => {
    const record: ProvenanceRecord = {
      source: 'ESI',
      sourceVersion: 'v1',
      capability: { id: capabilityId('market.orders') },
      capabilityVersion: 1,
      retrievedAt: new Date('2026-01-01T00:00:00Z'),
      cached: false,
      upstream: [],
    };

    expect(record.source).toBe('ESI');
    expect(record.sourceVersion).toBe('v1');
    expect(record.retrievedAt).toBeInstanceOf(Date);
    expect(record.cached).toBe(false);
    expect(record.upstream).toHaveLength(0);
  });

  it('represents an SDE provenance record', () => {
    const record: ProvenanceRecord = {
      source: 'SDE',
      sourceVersion: '2024-03-01',
      capability: { id: capabilityId('universe.types') },
      capabilityVersion: 1,
      retrievedAt: new Date('2026-01-01T12:00:00Z'),
      cached: true,
      upstream: [],
    };

    expect(record.source).toBe('SDE');
    expect(record.cached).toBe(true);
  });

  it('represents a DERIVED provenance record with upstream', () => {
    const esiRecord: ProvenanceRecord = {
      source: 'ESI',
      sourceVersion: 'v1',
      capability: { id: capabilityId('market.orders') },
      capabilityVersion: 1,
      retrievedAt: new Date('2026-01-01T00:00:00Z'),
      cached: false,
      upstream: [],
    };

    const derived: ProvenanceRecord = {
      source: 'DERIVED',
      capability: { id: capabilityId('market.analytics') },
      capabilityVersion: 1,
      calculatedAt: new Date('2026-01-01T00:01:00Z'),
      cached: false,
      upstream: [esiRecord],
    };

    expect(derived.source).toBe('DERIVED');
    expect(derived.calculatedAt).toBeInstanceOf(Date);
    expect(derived.retrievedAt).toBeUndefined();
    expect(derived.upstream).toHaveLength(1);
    expect(derived.upstream[0]!.source).toBe('ESI');
  });

  it('represents a CACHE provenance record', () => {
    const record: ProvenanceRecord = {
      source: 'CACHE',
      capability: { id: capabilityId('market.orders') },
      capabilityVersion: 1,
      cached: true,
      upstream: [],
    };

    expect(record.source).toBe('CACHE');
    expect(record.cached).toBe(true);
    expect(record.sourceVersion).toBeUndefined();
  });

  it('allows all DataSource values', () => {
    const sources: DataSource[] = ['ESI', 'SDE', 'DERIVED', 'CACHE'];
    expect(sources).toHaveLength(4);
  });
});
