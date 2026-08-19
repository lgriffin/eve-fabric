import type { DrilldownEntry } from '../../stores/pipeline-store.js';

interface BreadcrumbNavProps {
  pipelineName: string;
  stack: DrilldownEntry[];
  onNavigate: (depth: number) => void;
}

export function BreadcrumbNav({ pipelineName, stack, onNavigate }: BreadcrumbNavProps) {
  if (stack.length === 0) return null;

  return (
    <div
      style={{
        background: '#1a1a2e',
        borderBottom: '1px solid #333',
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '12px',
      }}
    >
      <button
        onClick={() => onNavigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: '#7c4dff',
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '12px',
        }}
      >
        {pipelineName}
      </button>
      {stack.map((entry, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: '#555' }}>&gt;</span>
          {i < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(i)}
              style={{
                background: 'none',
                border: 'none',
                color: '#7c4dff',
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '12px',
              }}
            >
              {entry.capabilityId}
            </button>
          ) : (
            <span style={{ color: '#e0e0e0', padding: '2px 4px' }}>
              {entry.capabilityId} v{entry.version}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
