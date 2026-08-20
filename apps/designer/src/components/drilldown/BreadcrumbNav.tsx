import type { DrilldownEntry } from '../../stores/pipeline-store.js';
import { colors } from '../../tokens.js';

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
        background: colors.surface.base,
        borderBottom: `1px solid ${colors.surface.border}`,
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
          color: colors.accent,
          cursor: 'pointer',
          padding: '2px 4px',
          fontSize: '12px',
        }}
      >
        {pipelineName}
      </button>
      {stack.map((entry, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: colors.text.disabled }}>&gt;</span>
          {i < stack.length - 1 ? (
            <button
              onClick={() => onNavigate(i)}
              style={{
                background: 'none',
                border: 'none',
                color: colors.accent,
                cursor: 'pointer',
                padding: '2px 4px',
                fontSize: '12px',
              }}
            >
              {entry.capabilityId}
            </button>
          ) : (
            <span style={{ color: colors.text.primary, padding: '2px 4px' }}>
              {entry.capabilityId} v{entry.version}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
