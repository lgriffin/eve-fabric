import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCatalogStore } from '../../src/stores/catalog-store.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('catalog-store fetchCapabilities', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    useCatalogStore.setState({
      capabilities: [],
      searchQuery: '',
      selectedSource: null,
      isLoading: false,
      error: null,
    });
  });

  it('loads and enriches capabilities from gateway client', async () => {
    mockFetch.mockReturnValue(
      jsonResponse({
        capabilities: [
          {
            id: 'market.orders',
            version: '1.0.0',
            name: 'Market Orders',
            description: 'Fetch orders',
            source: 'ESI',
            inputs: [],
            outputs: [],
            isComposite: false,
          },
          {
            id: 'universe.resolveType',
            version: '1.0.0',
            name: 'Resolve Type',
            description: 'Resolve type',
            source: 'SDE',
            inputs: [],
            outputs: [],
            isComposite: false,
          },
        ],
      }),
    );

    await useCatalogStore.getState().fetchCapabilities();

    const state = useCatalogStore.getState();
    expect(state.capabilities).toHaveLength(2);
    expect(state.capabilities[0]!.category).toBe('Market');
    expect(state.capabilities[1]!.category).toBe('Universe');
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('sets error state on network failure', async () => {
    mockFetch.mockRejectedValue(new Error('Failed to fetch'));

    await useCatalogStore.getState().fetchCapabilities();

    const state = useCatalogStore.getState();
    expect(state.capabilities).toHaveLength(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toContain('Cannot connect to gateway');
  });

  it('sets error state on non-200 response', async () => {
    mockFetch.mockReturnValue(jsonResponse({ error: { message: 'Registry unavailable' } }, 503));

    await useCatalogStore.getState().fetchCapabilities();

    const state = useCatalogStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Registry unavailable');
  });

  it('clears error on successful retry', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'));
    await useCatalogStore.getState().fetchCapabilities();
    expect(useCatalogStore.getState().error).not.toBeNull();

    mockFetch.mockReturnValue(
      jsonResponse({
        capabilities: [
          {
            id: 'market.orders',
            version: '1.0.0',
            name: 'M',
            description: '',
            source: 'ESI',
            inputs: [],
            outputs: [],
            isComposite: false,
          },
        ],
      }),
    );
    await useCatalogStore.getState().fetchCapabilities();

    const state = useCatalogStore.getState();
    expect(state.error).toBeNull();
    expect(state.capabilities).toHaveLength(1);
  });
});
