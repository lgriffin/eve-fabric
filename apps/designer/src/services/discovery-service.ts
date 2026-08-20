const DEFAULT_GATEWAY_URL = 'http://localhost:3456';

function gatewayUrl(): string {
  if (typeof window !== 'undefined') {
    const url = (window as unknown as Record<string, unknown>)['__GATEWAY_URL__'];
    if (typeof url === 'string') return url;
  }
  return DEFAULT_GATEWAY_URL;
}

export interface DiscoverySuggestion {
  capabilityId: string;
  capabilityName: string;
  readiness: 'ready' | 'partial' | 'unreachable';
  satisfiedInputs: string[];
  unsatisfiedInputs: string[];
  relevance?: number;
  matchReason: string;
  explanation: string[];
}

export interface SearchResultItem {
  capabilityId: string;
  capabilityName: string;
  description: string;
  readiness: 'ready' | 'partial' | 'unreachable';
  satisfiedInputs: string[];
  unsatisfiedInputs: string[];
  matchReason: string;
  explanation: string[];
}

interface SearchResult {
  query: string;
  results: SearchResultItem[];
  count: number;
}

export interface FlowContextInput {
  availableOutputTypes: string[];
  existingCapabilityIds: string[];
}

export interface ConsumerInfo {
  id: string;
  version: string;
  name: string;
  description: string;
  source: string;
  explanation: string[];
}

export async function searchCapabilities(
  query: string,
  flowContext?: FlowContextInput,
): Promise<SearchResult> {
  try {
    const body: Record<string, unknown> = { query };
    if (flowContext) {
      body.availableOutputTypes = flowContext.availableOutputTypes;
    }

    const res = await fetch(`${gatewayUrl()}/api/discovery/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return { query, results: [], count: 0 };
    return (await res.json()) as SearchResult;
  } catch {
    return { query, results: [], count: 0 };
  }
}

export async function suggestNext(
  flowContext: FlowContextInput,
  maxResults = 20,
): Promise<DiscoverySuggestion[]> {
  try {
    const res = await fetch(`${gatewayUrl()}/api/discovery/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        availableOutputTypes: flowContext.availableOutputTypes,
        existingCapabilityIds: flowContext.existingCapabilityIds,
        maxResults,
      }),
    });

    if (!res.ok) return [];
    const json = (await res.json()) as { suggestions: DiscoverySuggestion[] };
    return json.suggestions;
  } catch {
    return [];
  }
}

export async function findConsumers(semanticType: string): Promise<ConsumerInfo[]> {
  try {
    const res = await fetch(
      `${gatewayUrl()}/api/discovery/consumers/${encodeURIComponent(semanticType)}`,
    );

    if (!res.ok) return [];
    const json = (await res.json()) as { consumers: ConsumerInfo[] };
    return json.consumers;
  } catch {
    return [];
  }
}
