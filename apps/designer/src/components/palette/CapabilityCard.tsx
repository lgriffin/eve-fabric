import type { CatalogCapability } from '../../stores/catalog-store.js';

interface CapabilityCardProps {
  capability: CatalogCapability;
  onAddToFlow: (capability: CatalogCapability) => void;
  highlighted?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  ESI: '#4fc3f7',
  SDE: '#81c784',
  DERIVED: '#ba68c8',
  CACHE: '#ffd54f',
  COMPOSITE: '#ff8a65',
};

const SOURCE_LABELS: Record<string, string> = {
  ESI: 'LIVE',
  SDE: 'STATIC',
  DERIVED: 'DERIVED',
  CACHE: 'CACHED',
  COMPOSITE: 'COMPOSITE',
};

export function CapabilityCard({ capability, onAddToFlow, highlighted }: CapabilityCardProps) {
  const sourceColor = SOURCE_COLORS[capability.source] ?? '#9e9e9e';
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
        background: highlighted ? '#2a2a45' : '#252535',
        border: `1px solid ${highlighted ? '#7c4dff' : '#333'}`,
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 6,
        cursor: 'grab',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#7c4dff';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = highlighted ? '#7c4dff' : '#333';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px' }}>
          {capability.name}
        </span>
        <span
          style={{
            background: sourceColor,
            color: '#1e1e2e',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: '9px',
            fontWeight: 700,
          }}
        >
          {sourceLabel}
        </span>
      </div>
      <div style={{ color: '#999', fontSize: '10px', marginTop: 3 }}>
        {capability.description.length > 80
          ? capability.description.substring(0, 80) + '...'
          : capability.description}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 4,
        }}
      >
        <span style={{ color: '#666', fontSize: '9px' }}>{capability.category}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddToFlow(capability);
          }}
          style={{
            background: '#7c4dff',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '2px 8px',
            fontSize: '10px',
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
