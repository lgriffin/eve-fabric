import { useCallback, useRef, useState } from 'react';
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

  const searchRequestIdRef = useRef(0);

  const search = useCallback(async (query: string, flowContext?: FlowContextInput) => {
    const requestId = ++searchRequestIdRef.current;
    setState((s) => ({ ...s, isLoading: true }));
    const result = await searchCapabilities(query, flowContext);
    if (requestId !== searchRequestIdRef.current) return [];
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

  const clearResults = useCallback(() => {
    setState((s) => ({ ...s, searchResults: [] }));
  }, []);

  return {
    ...state,
    search,
    recommend,
    getConsumers,
    clearResults,
  };
}
