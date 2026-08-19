import { useCatalogStore, type CatalogCapability } from '../../stores/catalog-store.js';

const SOURCE_COLORS: Record<string, string> = {
  ESI: '#4fc3f7',
  SDE: '#81c784',
  DERIVED: '#ba68c8',
  CACHE: '#ffd54f',
  COMPOSITE: '#ff8a65',
};

function CapabilityCard({ capability }: { capability: CatalogCapability }) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/capability-id', capability.id);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={{
        background: '#252535',
        border: '1px solid #333',
        borderRadius: 6,
        padding: '8px 10px',
        marginBottom: 6,
        cursor: 'grab',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#7c4dff'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#333'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px' }}>
          {capability.name}
        </span>
        <span
          style={{
            background: SOURCE_COLORS[capability.source] ?? '#9e9e9e',
            color: '#1e1e2e',
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: '9px',
            fontWeight: 700,
          }}
        >
          {capability.source}
        </span>
      </div>
      <div style={{ color: '#888', fontSize: '10px', marginTop: 3 }}>
        {capability.id}
      </div>
      <div style={{ color: '#666', fontSize: '10px', marginTop: 2 }}>
        {capability.description.length > 60
          ? capability.description.substring(0, 60) + '...'
          : capability.description}
      </div>
    </div>
  );
}

export function CapabilityPalette() {
  const searchQuery = useCatalogStore((s) => s.searchQuery);
  const setSearchQuery = useCatalogStore((s) => s.setSearchQuery);
  const selectedSource = useCatalogStore((s) => s.selectedSource);
  const setSelectedSource = useCatalogStore((s) => s.setSelectedSource);
  const filteredCapabilities = useCatalogStore((s) => s.filteredCapabilities);
  const isLoading = useCatalogStore((s) => s.isLoading);

  const capabilities = filteredCapabilities();
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
      <div style={{ padding: '12px 10px 8px', borderBottom: '1px solid #333' }}>
        <div style={{ color: '#aaa', fontSize: '11px', fontWeight: 700, marginBottom: 6, letterSpacing: '0.5px' }}>
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
                background: selectedSource === source ? (SOURCE_COLORS[source] ?? '#9e9e9e') : '#333',
                color: selectedSource === source ? '#1e1e2e' : '#888',
              }}
            >
              {source}
            </button>
          ))}
        </div>
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
            <div style={{ color: '#777', fontSize: '10px', fontWeight: 600, marginBottom: 4, letterSpacing: '0.3px' }}>
              {category.toUpperCase()}
            </div>
            {caps.map((cap) => (
              <CapabilityCard key={`${cap.id}@${cap.version}`} capability={cap} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
