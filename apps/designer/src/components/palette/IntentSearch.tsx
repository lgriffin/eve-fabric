import { useState, useCallback } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useFlowContext } from '../../hooks/useFlowContext.js';
import { CapabilityCard } from './CapabilityCard.js';
import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';
import type { SearchResultItem } from '../../services/discovery-service.js';
import { colors, fontSize as fs, spacing, borderRadius } from '../../tokens.js';

interface IntentSearchProps {
  onAddToFlow: (capability: CatalogCapability) => void;
}

const EXAMPLE_QUERIES = [
  'Market prices',
  'Find item type',
  'Route between systems',
  'Manufacturing cost profit',
  'Trade profit margin',
  'Hauling freight shipping',
];

export function IntentSearch({ onAddToFlow }: IntentSearchProps) {
  const [query, setQuery] = useState('');
  const { searchResults, isLoading, search, clearResults } = useDiscovery();
  const flowContext = useFlowContext();

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      setQuery(searchQuery);
      if (searchQuery.trim().length >= 2) {
        await search(searchQuery, flowContext);
      } else {
        clearResults();
      }
    },
    [search, clearResults, flowContext],
  );

  const handleExampleClick = useCallback(
    (example: string) => {
      void handleSearch(example);
    },
    [handleSearch],
  );

  const resultToCapability = (result: SearchResultItem): CatalogCapability | null => {
    const capabilities = useCatalogStore.getState().capabilities;
    return capabilities.find((c) => c.id === result.capabilityId) ?? null;
  };

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
        What are you trying to do?
      </h3>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          placeholder="Search capabilities or describe your goal..."
          value={query}
          onChange={(e) => void handleSearch(e.target.value)}
          style={{
            width: '100%',
            padding: `${spacing.sm - 2}px ${spacing.sm}px`,
            background: colors.surface.base,
            border: `1px solid ${colors.surface.border}`,
            borderRadius: borderRadius.md,
            color: colors.text.primary,
            fontSize: fs.md,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {isLoading && (
          <span
            style={{
              position: 'absolute',
              right: spacing.sm,
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.text.dim,
              fontSize: fs.xs,
            }}
          >
            ...
          </span>
        )}
      </div>

      {!query && (
        <div style={{ marginTop: spacing.md }}>
          <p style={{ color: colors.text.muted, fontSize: fs.xs, marginBottom: spacing.sm - 2 }}>
            Try:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.xs }}>
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                style={{
                  background: '#252535',
                  border: `1px solid ${colors.surface.border}`,
                  borderRadius: borderRadius.md,
                  padding: `5px ${spacing.sm}px`,
                  color: '#aaa',
                  fontSize: fs.sm,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = colors.accent;
                  (e.currentTarget as HTMLButtonElement).style.color = colors.text.primary;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = colors.surface.border;
                  (e.currentTarget as HTMLButtonElement).style.color = '#aaa';
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {searchResults.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <p style={{ color: colors.text.muted, fontSize: fs.xs, marginBottom: spacing.sm - 2 }}>
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </p>
          {searchResults.map((result) => {
            const cap = resultToCapability(result);
            if (!cap) return null;
            return (
              <CapabilityCard
                key={result.capabilityId}
                capability={cap}
                onAddToFlow={onAddToFlow}
              />
            );
          })}
        </div>
      )}

      {query && !isLoading && searchResults.length === 0 && (
        <div
          style={{
            marginTop: spacing.md,
            color: colors.text.dim,
            fontSize: fs.sm,
            textAlign: 'center',
          }}
        >
          No capabilities found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
