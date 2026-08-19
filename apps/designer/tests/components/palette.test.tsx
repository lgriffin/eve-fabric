import { describe, it, expect, beforeEach } from 'vitest';
import { useCatalogStore, enrichWithCategory, type CatalogCapability } from '../../src/stores/catalog-store.js';

function makeCap(overrides: Partial<CatalogCapability> = {}): Omit<CatalogCapability, 'category'> {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders for a type in a region',
    source: 'ESI',
    inputs: [
      { name: 'item', semanticType: 'eve.type.reference', required: true },
      { name: 'region', semanticType: 'eve.region.reference', required: true },
    ],
    outputs: [
      { name: 'orders', semanticType: 'eve.market.orders' },
    ],
    ...overrides,
  };
}

describe('CatalogStore', () => {
  beforeEach(() => {
    useCatalogStore.setState({
      capabilities: [],
      searchQuery: '',
      selectedSource: null,
      isLoading: false,
    });
  });

  it('enriches capabilities with category', () => {
    const cap = enrichWithCategory(makeCap());
    expect(cap.category).toBe('Market');
  });

  it('derives category from capability id prefix', () => {
    expect(enrichWithCategory(makeCap({ id: 'universe.resolveType' })).category).toBe('Universe');
    expect(enrichWithCategory(makeCap({ id: 'route.distance' })).category).toBe('Navigation');
    expect(enrichWithCategory(makeCap({ id: 'collection.filter' })).category).toBe('Collection');
    expect(enrichWithCategory(makeCap({ id: 'custom.something' })).category).toBe('Other');
  });

  it('sets and filters capabilities', () => {
    const store = useCatalogStore.getState();
    store.setCapabilities([
      makeCap({ id: 'market.orders', name: 'Market Orders' }) as CatalogCapability,
      makeCap({ id: 'universe.resolveType', name: 'Resolve Type', source: 'SDE' }) as CatalogCapability,
    ]);

    const all = useCatalogStore.getState().filteredCapabilities();
    expect(all).toHaveLength(2);
  });

  it('filters by search query', () => {
    const store = useCatalogStore.getState();
    store.setCapabilities([
      makeCap({ id: 'market.orders', name: 'Market Orders' }) as CatalogCapability,
      makeCap({ id: 'universe.resolveType', name: 'Resolve Type', description: 'Resolve a type ID to its name' }) as CatalogCapability,
    ]);
    store.setSearchQuery('market');

    const filtered = useCatalogStore.getState().filteredCapabilities();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe('market.orders');
  });

  it('filters by source', () => {
    const store = useCatalogStore.getState();
    store.setCapabilities([
      makeCap({ id: 'market.orders', source: 'ESI' }) as CatalogCapability,
      makeCap({ id: 'universe.resolveType', source: 'SDE' }) as CatalogCapability,
    ]);
    store.setSelectedSource('SDE');

    const filtered = useCatalogStore.getState().filteredCapabilities();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.source).toBe('SDE');
  });

  it('combines search and source filters', () => {
    const store = useCatalogStore.getState();
    store.setCapabilities([
      makeCap({ id: 'market.orders', source: 'ESI', name: 'Market Orders' }) as CatalogCapability,
      makeCap({ id: 'market.aggregate', source: 'DERIVED', name: 'Market Aggregate' }) as CatalogCapability,
      makeCap({ id: 'universe.resolveType', source: 'SDE', name: 'Resolve Type' }) as CatalogCapability,
    ]);
    store.setSearchQuery('market');
    store.setSelectedSource('ESI');

    const filtered = useCatalogStore.getState().filteredCapabilities();
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe('market.orders');
  });
});
