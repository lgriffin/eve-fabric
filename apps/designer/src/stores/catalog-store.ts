import { create } from 'zustand';

export interface CatalogCapability {
  id: string;
  version: number;
  name: string;
  description: string;
  source: string;
  inputs: Array<{ name: string; semanticType: string; required: boolean }>;
  outputs: Array<{ name: string; semanticType: string }>;
  category: string;
}

export interface CatalogState {
  capabilities: CatalogCapability[];
  searchQuery: string;
  selectedSource: string | null;
  isLoading: boolean;
}

export interface CatalogActions {
  setCapabilities: (capabilities: CatalogCapability[]) => void;
  setSearchQuery: (query: string) => void;
  setSelectedSource: (source: string | null) => void;
  setLoading: (loading: boolean) => void;
  filteredCapabilities: () => CatalogCapability[];
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
  return { ...cap, category: deriveCategory(cap.id) };
}

export const useCatalogStore = create<CatalogState & CatalogActions>()((set, get) => ({
  capabilities: [],
  searchQuery: '',
  selectedSource: null,
  isLoading: false,

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
}));
