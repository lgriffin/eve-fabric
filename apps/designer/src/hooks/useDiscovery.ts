import { useCallback, useState } from 'react';
import {
  searchCapabilities,
  suggestNext,
  findConsumers,
  type SearchResultItem,
  type DiscoverySuggestion,
  type ConsumerInfo,
  type FlowContextInput,
} from '../services/discovery-service.js';

interface DiscoveryState {
  searchResults: SearchResultItem[];
  suggestions: DiscoverySuggestion[];
  consumers: ConsumerInfo[];
  isLoading: boolean;
}

export function useDiscovery() {
  const [state, setState] = useState<DiscoveryState>({
    searchResults: [],
    suggestions: [],
    consumers: [],
    isLoading: false,
  });

  const search = useCallback(async (query: string, flowContext?: FlowContextInput) => {
    setState((s) => ({ ...s, isLoading: true }));
    const result = await searchCapabilities(query, flowContext);
    setState((s) => ({ ...s, searchResults: result.results, isLoading: false }));
    return result.results;
  }, []);

  const recommend = useCallback(async (flowContext: FlowContextInput) => {
    setState((s) => ({ ...s, isLoading: true }));
    const suggestions = await suggestNext(flowContext);
    setState((s) => ({ ...s, suggestions, isLoading: false }));
    return suggestions;
  }, []);

  const getConsumers = useCallback(async (semanticType: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    const consumers = await findConsumers(semanticType);
    setState((s) => ({ ...s, consumers, isLoading: false }));
    return consumers;
  }, []);

  return {
    ...state,
    search,
    recommend,
    getConsumers,
  };
}
