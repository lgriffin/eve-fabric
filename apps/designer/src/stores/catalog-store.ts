import { create } from 'zustand';
import type { PaletteMode } from './types.js';
import { getCapabilities } from '../services/gateway-client.js';
import { useToastStore } from './toast-store.js';

export interface CatalogCapability {
  id: string;
  version: string;
  name: string;
  description: string;
  source: string;
  inputs: Array<{ name: string; semanticType: string; required: boolean }>;
  outputs: Array<{ name: string; semanticType: string }>;
  category: string;
  isComposite: boolean;
}

interface DiscoverySuggestion {
  capabilityId: string;
  name: string;
  description: string;
  source: string;
  readiness: 'ready' | 'partial' | 'unreachable';
  satisfactionRatio: number;
  matchReasons: string[];
}

interface CatalogState {
  capabilities: CatalogCapability[];
  searchQuery: string;
  selectedSource: string | null;
  isLoading: boolean;
  error: string | null;
  paletteMode: PaletteMode;
  recommendedCapabilities: DiscoverySuggestion[];
}

interface CatalogActions {
  setCapabilities: (capabilities: CatalogCapability[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedSource: (source: string | null) => void;
  setLoading: (loading: boolean) => void;
  fetchCapabilities: () => Promise<void>;
  filteredCapabilities: () => CatalogCapability[];
  setPaletteMode: (mode: PaletteMode) => void;
  setRecommendedCapabilities: (capabilities: DiscoverySuggestion[]) => void;
}

function deriveCategory(id: string): string {
  const parts = id.split('.');
  const prefix = parts[0] ?? '';
  const categories: Record<string, string> = {
    universe: 'Universe',
    market: 'Market',
    route: 'Navigation',
    collection: 'Collection',
  };
  return categories[prefix] ?? 'Other';
}

export function enrichWithCategory(cap: Omit<CatalogCapability, 'category'>): CatalogCapability {
  return { ...cap, category: cap.isComposite ? 'Composite' : deriveCategory(cap.id) };
}

export const useCatalogStore = create<CatalogState & CatalogActions>()((set, get) => ({
  capabilities: [],
  searchQuery: '',
  selectedSource: null,
  isLoading: false,
  error: null,
  paletteMode: 'discover',
  recommendedCapabilities: [],

  setCapabilities: (capabilities) => {
    set({ capabilities: capabilities.map(enrichWithCategory) });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setSelectedSource: (source) => {
    set({ selectedSource: source });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  fetchCapabilities: async () => {
    set({ isLoading: true, error: null });
    const result = await getCapabilities();
    if (result.ok) {
      set({
        capabilities: result.data.capabilities.map(enrichWithCategory),
        isLoading: false,
        error: null,
      });
    } else {
      const errorMsg = result.error.isNetworkError
        ? 'Cannot connect to gateway. Start it with: pnpm --filter @eve-fabric/gateway dev'
        : result.error.message;
      set({ isLoading: false, error: errorMsg });
      useToastStore.getState().addToast('error', 'Failed to load capabilities', errorMsg);
    }
  },

  filteredCapabilities: () => {
    const { capabilities, searchQuery, selectedSource } = get();
    let filtered = capabilities;

    if (selectedSource) {
      filtered = filtered.filter((c) => c.source === selectedSource);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      );
    }

    return filtered;
  },

  setPaletteMode: (mode) => {
    set({ paletteMode: mode });
  },

  setRecommendedCapabilities: (capabilities) => {
    set({ recommendedCapabilities: capabilities });
  },
}));
