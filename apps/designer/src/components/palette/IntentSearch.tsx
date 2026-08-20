import { useState, useCallback } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import { useFlowContext } from '../../hooks/useFlowContext.js';
import { CapabilityCard } from './CapabilityCard.js';
import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';
import type { SearchResultItem } from '../../services/discovery-service.js';

interface IntentSearchProps {
  onAddToFlow: (capability: CatalogCapability) => void;
}

const EXAMPLE_QUERIES = [
  'Market prices',
  'Find an item',
  'Route between systems',
  'Manufacturing cost',
  'Find cheap Tritanium near Jita',
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
    <div style={{ padding: '12px 10px' }}>
      <h3
        style={{
          color: '#e0e0e0',
          fontSize: '13px',
          fontWeight: 600,
          margin: '0 0 8px',
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
            padding: '6px 8px',
            background: '#13131d',
            border: '1px solid #333',
            borderRadius: 4,
            color: '#e0e0e0',
            fontSize: '12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {isLoading && (
          <span
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#666',
              fontSize: '10px',
            }}
          >
            ...
          </span>
        )}
      </div>

      {!query && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: '#888', fontSize: '10px', marginBottom: 6 }}>Try:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                onClick={() => handleExampleClick(example)}
                style={{
                  background: '#252535',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '5px 8px',
                  color: '#aaa',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#7c4dff';
                  (e.currentTarget as HTMLButtonElement).style.color = '#e0e0e0';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#333';
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
          <p style={{ color: '#888', fontSize: '10px', marginBottom: 6 }}>
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
        <div style={{ marginTop: 12, color: '#666', fontSize: '11px', textAlign: 'center' }}>
          No capabilities found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
