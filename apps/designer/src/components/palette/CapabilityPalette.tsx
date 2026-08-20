import { useMemo, useState, useCallback } from 'react';
import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';
import { usePipelineStore, type CapabilityFlowNode } from '../../stores/pipeline-store.js';
import type { PaletteMode } from '../../stores/types.js';
import { CapabilityCard } from './CapabilityCard.js';
import { IntentSearch } from './IntentSearch.js';
import { RecommendedPanel } from './RecommendedPanel.js';

const SOURCE_COLORS: Record<string, string> = {
  ESI: '#4fc3f7',
  SDE: '#81c784',
  DERIVED: '#ba68c8',
  CACHE: '#ffd54f',
  COMPOSITE: '#ff8a65',
};

const PALETTE_MODES: Array<{ key: PaletteMode; label: string }> = [
  { key: 'discover', label: 'Discover' },
  { key: 'recommended', label: 'Recommended' },
  { key: 'all', label: 'All' },
];

export function CapabilityPalette() {
  const paletteMode = useCatalogStore((s) => s.paletteMode);
  const setPaletteMode = useCatalogStore((s) => s.setPaletteMode);
  const searchQuery = useCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useCatalogStore((s) => s.setSearchQuery);
  const selectedSource = useCatalogStore((s) => s.selectedSource);
  const setSelectedSource = useCatalogStore((s) => s.setSelectedSource);
  const filteredCapabilities = useCatalogStore((s) => s.filteredCapabilities);
  const allCapabilities = useCatalogStore((s) => s.capabilities);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const [showCompatibleOnly, setShowCompatibleOnly] = useState(false);

  const selectedNodeId = usePipelineStore((s) => s.selectedNodeId);
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const addNode = usePipelineStore((s) => s.addNode);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const handleAddToFlow = useCallback(
    (capability: CatalogCapability) => {
      const id = `${capability.id}-${Date.now()}`;
      const newNode: CapabilityFlowNode = {
        id,
        type: 'capability',
        // eslint-disable-next-line sonarjs/pseudo-random -- random offset for non-overlapping node placement
        position: { x: 250 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: {
          capabilityId: capability.id,
          capabilityVersion: capability.version,
          label: capability.name,
          source: capability.source,
          inputs: capability.inputs,
          outputs: capability.outputs,
        },
      };
      addNode(newNode);
    },
    [addNode],
  );

  const { compatibleIds, highlightedIds } = useMemo(() => {
    if (!selectedNode)
      return { compatibleIds: new Set<string>(), highlightedIds: new Set<string>() };

    const unconnectedInputTypes = selectedNode.data.inputs
      .filter(
        (input) =>
          input.required &&
          !edges.some((e) => e.target === selectedNode.id && e.targetHandle === input.name),
      )
      .map((input) => input.semanticType);

    const outputTypes = selectedNode.data.outputs.map((o) => o.semanticType);

    const highlighted = new Set<string>();
    const compatible = new Set<string>();

    for (const cap of allCapabilities) {
      const matchesInput = cap.outputs.some((o) => unconnectedInputTypes.includes(o.semanticType));
      if (matchesInput) highlighted.add(cap.id);

      const matchesOutput = cap.inputs.some((i) => outputTypes.includes(i.semanticType));
      if (matchesOutput) compatible.add(cap.id);
    }

    return { compatibleIds: compatible, highlightedIds: highlighted };
  }, [selectedNode, edges, allCapabilities]);

  let capabilities = filteredCapabilities();
  if (showCompatibleOnly && selectedNode) {
    capabilities = capabilities.filter((c) => compatibleIds.has(c.id) || highlightedIds.has(c.id));
  }
  const sources = ['ESI', 'SDE', 'DERIVED', 'CACHE', 'COMPOSITE'];

  const grouped = new Map<string, CatalogCapability[]>();
  for (const cap of capabilities) {
    const group = grouped.get(cap.category) ?? [];
    group.push(cap);
    grouped.set(cap.category, group);
  }

  return (
    <div
      style={{
        width: 260,
        height: '100%',
        background: '#1e1e2e',
        borderRight: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Palette modes"
        style={{
          display: 'flex',
          borderBottom: '1px solid #333',
          flexShrink: 0,
        }}
      >
        {PALETTE_MODES.map((mode) => (
          <button
            key={mode.key}
            role="tab"
            aria-selected={paletteMode === mode.key}
            aria-controls={`palette-panel-${mode.key}`}
            onClick={() => setPaletteMode(mode.key)}
            onKeyDown={(e) => {
              const idx = PALETTE_MODES.findIndex((m) => m.key === mode.key);
              if (e.key === 'ArrowRight') {
                const next = PALETTE_MODES[(idx + 1) % PALETTE_MODES.length]!;
                setPaletteMode(next.key);
                (e.target as HTMLElement).parentElement
                  ?.querySelectorAll<HTMLElement>('[role="tab"]')
                  [(idx + 1) % PALETTE_MODES.length]?.focus();
              } else if (e.key === 'ArrowLeft') {
                const prev =
                  PALETTE_MODES[(idx - 1 + PALETTE_MODES.length) % PALETTE_MODES.length]!;
                setPaletteMode(prev.key);
                (e.target as HTMLElement).parentElement
                  ?.querySelectorAll<HTMLElement>('[role="tab"]')
                  [(idx - 1 + PALETTE_MODES.length) % PALETTE_MODES.length]?.focus();
              }
            }}
            tabIndex={paletteMode === mode.key ? 0 : -1}
            style={{
              flex: 1,
              padding: '8px 4px',
              fontSize: '10px',
              fontWeight: 600,
              border: 'none',
              borderBottom:
                paletteMode === mode.key ? '2px solid #7c4dff' : '2px solid transparent',
              background: 'transparent',
              color: paletteMode === mode.key ? '#e0e0e0' : '#666',
              cursor: 'pointer',
              letterSpacing: '0.3px',
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      {/* Mode description */}
      <div
        style={{
          padding: '4px 10px',
          fontSize: '9px',
          color: '#555',
          borderBottom: '1px solid #2a2a2a',
          flexShrink: 0,
        }}
      >
        {paletteMode === 'discover' && 'Search by intent or keyword'}
        {paletteMode === 'recommended' && 'Based on your current flow'}
        {paletteMode === 'all' && 'Browse the full capability registry'}
      </div>

      {/* Discover mode */}
      {paletteMode === 'discover' && (
        <div
          id="palette-panel-discover"
          role="tabpanel"
          aria-label="Discover"
          style={{ flex: 1, overflowY: 'auto' }}
        >
          <IntentSearch onAddToFlow={handleAddToFlow} />
        </div>
      )}

      {/* Recommended mode */}
      {paletteMode === 'recommended' && (
        <div
          id="palette-panel-recommended"
          role="tabpanel"
          aria-label="Recommended"
          style={{ flex: 1, overflowY: 'auto' }}
        >
          <RecommendedPanel onAddToFlow={handleAddToFlow} />
        </div>
      )}

      {/* All Capabilities mode */}
      {paletteMode === 'all' && (
        <>
          <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid #333', flexShrink: 0 }}>
            <div
              style={{
                color: '#aaa',
                fontSize: '11px',
                fontWeight: 700,
                marginBottom: 6,
                letterSpacing: '0.5px',
              }}
            >
              CAPABILITIES
            </div>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {sources.map((source) => (
                <button
                  key={source}
                  onClick={() => setSelectedSource(selectedSource === source ? null : source)}
                  style={{
                    padding: '2px 6px',
                    fontSize: '9px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 3,
                    cursor: 'pointer',
                    background:
                      selectedSource === source ? (SOURCE_COLORS[source] ?? '#9e9e9e') : '#333',
                    color: selectedSource === source ? '#1e1e2e' : '#888',
                  }}
                >
                  {source}
                </button>
              ))}
            </div>
            {selectedNode && (
              <button
                onClick={() => setShowCompatibleOnly((v) => !v)}
                style={{
                  marginTop: 6,
                  width: '100%',
                  padding: '4px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 3,
                  cursor: 'pointer',
                  background: showCompatibleOnly ? '#7c4dff' : '#333',
                  color: showCompatibleOnly ? '#fff' : '#888',
                }}
              >
                {showCompatibleOnly ? 'Show all' : 'Show compatible'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {isLoading && (
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: 20 }}>
                Loading...
              </div>
            )}
            {!isLoading && capabilities.length === 0 && (
              <div style={{ color: '#666', fontSize: '12px', textAlign: 'center', padding: 20 }}>
                No capabilities found. Connect to a gateway or drag capabilities will appear here.
              </div>
            )}
            {[...grouped.entries()].map(([category, caps]) => (
              <div key={category} style={{ marginBottom: 12 }}>
                <div
                  style={{
                    color: '#777',
                    fontSize: '10px',
                    fontWeight: 600,
                    marginBottom: 4,
                    letterSpacing: '0.3px',
                  }}
                >
                  {category.toUpperCase()}
                </div>
                {caps.map((cap) => (
                  <CapabilityCard
                    key={`${cap.id}@${cap.version}`}
                    capability={cap}
                    onAddToFlow={handleAddToFlow}
                    highlighted={highlightedIds.has(cap.id)}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
