import { useEffect, useCallback } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useFlowContext } from '../../hooks/useFlowContext.js';
import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';
import type { DiscoverySuggestion } from '../../services/discovery-service.js';
import { IntentSearch } from './IntentSearch.js';
import { colors, fontSize as fs, spacing, borderRadius } from '../../tokens.js';

interface RecommendedPanelProps {
  onAddToFlow: (capability: CatalogCapability) => void;
}

const READINESS_COLORS: Record<string, string> = {
  ready: colors.status.successLight,
  partial: colors.source.CACHE,
  unreachable: colors.text.dim,
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
    (suggestion: DiscoverySuggestion): CatalogCapability | null => {
      const capabilities = useCatalogStore.getState().capabilities;
      return capabilities.find((c) => c.id === suggestion.capabilityId) ?? null;
    },
    [],
  );

  if (flowContext.existingCapabilityIds.length === 0) {
    return <IntentSearch onAddToFlow={onAddToFlow} />;
  }

  return (
    <div style={{ padding: `${spacing.md}px 10px` }}>
      <h3
        style={{
          color: colors.text.primary,
          fontSize: '13px',
          fontWeight: 600,
          margin: `0 0 ${spacing.sm}px`,
        }}
      >
        Recommended Next
      </h3>

      {isLoading && (
        <div
          style={{
            color: colors.text.dim,
            fontSize: fs.sm,
            textAlign: 'center',
            padding: spacing.md,
          }}
        >
          Loading recommendations...
        </div>
      )}

      {!isLoading && suggestions.length === 0 && (
        <div
          style={{
            color: colors.text.dim,
            fontSize: fs.sm,
            textAlign: 'center',
            padding: spacing.md,
          }}
        >
          No recommendations for current flow.
        </div>
      )}

      {suggestions.map((suggestion) => (
        <div
          key={suggestion.capabilityId}
          onClick={() => {
            const cap = suggestionToCapability(suggestion);
            if (cap) onAddToFlow(cap);
          }}
          style={{
            background: colors.surface.overlay,
            border: `1px solid ${colors.surface.border}`,
            borderRadius: borderRadius.lg,
            padding: `${spacing.sm}px 10px`,
            marginBottom: spacing.sm - 2,
            cursor: 'pointer',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = colors.accent;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = colors.surface.border;
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: colors.text.primary, fontWeight: 600, fontSize: fs.md }}>
              {suggestion.capabilityName}
            </span>
            <span
              style={{
                color: READINESS_COLORS[suggestion.readiness] ?? colors.text.dim,
                fontSize: '9px',
                fontWeight: 600,
              }}
            >
              {suggestion.readiness.toUpperCase()}
            </span>
          </div>
          <div style={{ color: colors.text.muted, fontSize: fs.xs, marginTop: 3 }}>
            {suggestion.explanation[0]?.description ?? ''}
          </div>
        </div>
      ))}
    </div>
  );
}
