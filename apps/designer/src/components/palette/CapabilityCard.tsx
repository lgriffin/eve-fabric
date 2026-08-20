import type { CatalogCapability } from '../../stores/catalog-store.js';
import { colors, fontSize as fs, spacing, borderRadius, SOURCE_COLORS } from '../../tokens.js';

interface CapabilityCardProps {
  capability: CatalogCapability;
  onAddToFlow: (capability: CatalogCapability) => void;
  highlighted?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  ESI: 'LIVE',
  SDE: 'STATIC',
  DERIVED: 'DERIVED',
  CACHE: 'CACHED',
  COMPOSITE: 'COMPOSITE',
};

export function CapabilityCard({ capability, onAddToFlow, highlighted }: CapabilityCardProps) {
  const sourceColor = SOURCE_COLORS[capability.source] ?? colors.source.fallback;
  const sourceLabel = SOURCE_LABELS[capability.source] ?? capability.source;

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/capability-id', capability.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      tabIndex={0}
      role="button"
      aria-label={`${capability.name} — ${capability.description}. Press Enter to add to flow.`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onAddToFlow(capability);
        }
      }}
      style={{
        background: highlighted ? colors.surface.overlay : colors.surface.raised,
        border: `1px solid ${highlighted ? colors.accent : colors.surface.border}`,
        borderRadius: borderRadius.lg,
        padding: `${spacing.sm}px 10px`,
        marginBottom: spacing.sm - 2,
        cursor: 'grab',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = colors.accent;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = highlighted
          ? colors.accent
          : colors.surface.border;
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: colors.text.primary, fontWeight: 600, fontSize: fs.md }}>
          {capability.name}
        </span>
        <span
          style={{
            background: sourceColor,
            color: colors.surface.raised,
            padding: '1px 5px',
            borderRadius: borderRadius.sm,
            fontSize: '9px',
            fontWeight: 700,
          }}
        >
          {sourceLabel}
        </span>
      </div>
      <div style={{ color: colors.text.muted, fontSize: fs.xs, marginTop: 3 }}>
        {capability.description.length > 80
          ? capability.description.substring(0, 80) + '...'
          : capability.description}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: spacing.xs,
        }}
      >
        <span style={{ color: colors.text.dim, fontSize: '9px' }}>{capability.category}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToFlow(capability);
          }}
          style={{
            background: colors.accent,
            color: colors.text.primary,
            border: 'none',
            borderRadius: borderRadius.sm,
            padding: `2px ${spacing.sm}px`,
            fontSize: fs.xs,
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title="Add to Flow"
        >
          + Add
        </button>
      </div>
    </div>
  );
}
