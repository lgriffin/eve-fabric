import { useMemo, useState, useCallback } from 'react';
import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';
import { usePipelineStore, type CapabilityFlowNode } from '../../stores/pipeline-store.js';
import type { PaletteMode } from '../../stores/types.js';
import { CapabilityCard } from './CapabilityCard.js';
import { IntentSearch } from './IntentSearch.js';
import { RecommendedPanel } from './RecommendedPanel.js';
import { colors, fontSize as fs, spacing, borderRadius, SOURCE_COLORS } from '../../tokens.js';

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
  const error = useCatalogStore((s) => s.error);
  const fetchCapabilities = useCatalogStore((s) => s.fetchCapabilities);
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
        background: colors.surface.raised,
        borderRight: `1px solid ${colors.surface.border}`,
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
          borderBottom: `1px solid ${colors.surface.border}`,
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
              padding: `${spacing.sm}px ${spacing.xs}px`,
              fontSize: fs.xs,
              fontWeight: 600,
              border: 'none',
              borderBottom:
                paletteMode === mode.key ? `2px solid ${colors.accent}` : '2px solid transparent',
              background: 'transparent',
              color: paletteMode === mode.key ? colors.text.primary : colors.text.dim,
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
          padding: `${spacing.xs}px 10px`,
          fontSize: '9px',
          color: colors.text.disabled,
          borderBottom: `1px solid ${colors.surface.overlay}`,
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
          <div
            style={{
              padding: `${spacing.md}px 10px ${spacing.sm}px`,
              borderBottom: `1px solid ${colors.surface.border}`,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                color: '#aaa',
                fontSize: fs.sm,
                fontWeight: 700,
                marginBottom: spacing.sm - 2,
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
            <div
              style={{
                display: 'flex',
                gap: spacing.xs,
                marginTop: spacing.sm - 2,
                flexWrap: 'wrap',
              }}
            >
              {sources.map((source) => (
                <button
                  key={source}
                  onClick={() => setSelectedSource(selectedSource === source ? null : source)}
                  style={{
                    padding: `2px ${spacing.sm - 2}px`,
                    fontSize: '9px',
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: borderRadius.sm,
                    cursor: 'pointer',
                    background:
                      selectedSource === source
                        ? (SOURCE_COLORS[source] ?? colors.source.fallback)
                        : colors.surface.border,
                    color: selectedSource === source ? colors.surface.raised : colors.text.muted,
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
                  marginTop: spacing.sm - 2,
                  width: '100%',
                  padding: `${spacing.xs}px ${spacing.sm}px`,
                  fontSize: fs.xs,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: borderRadius.sm,
                  cursor: 'pointer',
                  background: showCompatibleOnly ? colors.accent : colors.surface.border,
                  color: showCompatibleOnly ? '#fff' : colors.text.muted,
                }}
              >
                {showCompatibleOnly ? 'Show all' : 'Show compatible'}
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: `${spacing.sm}px 10px` }}>
            {error && (
              <div
                style={{
                  background: '#3d1a1a',
                  border: `1px solid ${colors.status.error}`,
                  borderRadius: borderRadius.lg,
                  padding: `${spacing.md}px 10px`,
                  marginBottom: spacing.sm,
                  fontSize: fs.sm,
                  color: colors.status.errorLight,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: spacing.xs }}>Gateway Error</div>
                <div style={{ color: colors.text.secondary, marginBottom: spacing.sm }}>
                  {error}
                </div>
                <button
                  onClick={() => void fetchCapabilities()}
                  style={{
                    padding: `${spacing.xs}px ${spacing.md}px`,
                    fontSize: fs.sm,
                    fontWeight: 600,
                    border: `1px solid ${colors.status.error}`,
                    borderRadius: borderRadius.md,
                    background: 'transparent',
                    color: colors.status.errorLight,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {isLoading && (
              <div
                style={{
                  color: colors.text.dim,
                  fontSize: fs.md,
                  textAlign: 'center',
                  padding: spacing.xl,
                }}
              >
                Loading...
              </div>
            )}
            {!isLoading && !error && capabilities.length === 0 && (
              <div
                style={{
                  color: colors.text.dim,
                  fontSize: fs.md,
                  textAlign: 'center',
                  padding: spacing.xl,
                }}
              >
                No capabilities found. Connect to a gateway or drag capabilities will appear here.
              </div>
            )}
            {[...grouped.entries()].map(([category, caps]) => (
              <div key={category} style={{ marginBottom: spacing.md }}>
                <div
                  style={{
                    color: '#777',
                    fontSize: fs.xs,
                    fontWeight: 600,
                    marginBottom: spacing.xs,
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
