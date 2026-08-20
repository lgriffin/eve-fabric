import { useEffect, useCallback } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useFlowContext } from '../../hooks/useFlowContext.js';
import type { CatalogCapability } from '../../stores/catalog-store.js';
import type { DiscoverySuggestion } from '../../services/discovery-service.js';
import { IntentSearch } from './IntentSearch.js';

interface RecommendedPanelProps {
  onAddToFlow: (capability: CatalogCapability) => void;
}

const READINESS_COLORS: Record<string, string> = {
  ready: '#81c784',
  partial: '#ffd54f',
  unreachable: '#666',
};

export function RecommendedPanel({ onAddToFlow }: RecommendedPanelProps) {
  const flowContext = useFlowContext();
  const { suggestions, isLoading, recommend } = useDiscovery();

  const outputTypesKey = [...flowContext.availableOutputTypes].sort().join(',');
  const capIdsKey = [...flowContext.existingCapabilityIds].sort().join(',');

  useEffect(() => {
    if (flowContext.availableOutputTypes.length > 0) {
      void recommend(flowContext);
    }
  }, [outputTypesKey, capIdsKey]);

  const suggestionToCapability = useCallback(
    (suggestion: DiscoverySuggestion): CatalogCapability => ({
      id: suggestion.capabilityId,
      version: '1.0.0',
      name: suggestion.capabilityName,
      description: suggestion.explanation.join('. '),
      source: suggestion.matchReason.includes('ESI') ? 'ESI' : 'DERIVED',
      inputs: [],
      outputs: [],
      category: suggestion.capabilityId.split('.')[0] ?? 'Other',
      isComposite: false,
    }),
    [],
  );

  if (flowContext.existingCapabilityIds.length === 0) {
    return <IntentSearch onAddToFlow={onAddToFlow} />;
  }

  return (
    <div style={{ padding: '12px 10px' }}>
      <h3
        style={{
          color: '#e0e0e0',
          fontSize: '13px',
          fontWeight: 600,
          margin: '0 0 8px',
        }}
      >
        Recommended Next
      </h3>

      {isLoading && (
        <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: 12 }}>
          Loading recommendations...
        </div>
      )}

      {!isLoading && suggestions.length === 0 && (
        <div style={{ color: '#666', fontSize: '11px', textAlign: 'center', padding: 12 }}>
          No recommendations for current flow.
        </div>
      )}

      {suggestions.map((suggestion) => (
        <div
          key={suggestion.capabilityId}
          onClick={() => onAddToFlow(suggestionToCapability(suggestion))}
          style={{
            background: '#252535',
            border: '1px solid #333',
            borderRadius: 6,
            padding: '8px 10px',
            marginBottom: 6,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#7c4dff';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = '#333';
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px' }}>
              {suggestion.capabilityName}
            </span>
            <span
              style={{
                color: READINESS_COLORS[suggestion.readiness] ?? '#666',
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              {suggestion.readiness.toUpperCase()}
            </span>
          </div>
          <div style={{ color: '#999', fontSize: '10px', marginTop: 3 }}>
            {suggestion.explanation[0] ?? ''}
          </div>
        </div>
      ))}
    </div>
  );
}
