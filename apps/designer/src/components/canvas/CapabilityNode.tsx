import type { NodeProps } from '@xyflow/react';
import type { CapabilityFlowNode } from '../../stores/pipeline-store.js';
import { SemanticHandle } from './SemanticHandle.js';

const SOURCE_BADGES: Record<string, { color: string; label: string }> = {
  ESI: { color: '#4fc3f7', label: 'ESI' },
  SDE: { color: '#81c784', label: 'SDE' },
  DERIVED: { color: '#ba68c8', label: 'DRV' },
  CACHE: { color: '#ffd54f', label: 'CCH' },
  COMPOSITE: { color: '#ff8a65', label: 'CMP' },
};

export function CapabilityNode({ data, selected }: NodeProps<CapabilityFlowNode>) {
  const badge = SOURCE_BADGES[data.source] ?? { color: '#9e9e9e', label: data.source || '?' };

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#7c4dff' : '#333'}`,
        borderRadius: 8,
        minWidth: 200,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: selected ? '0 0 12px rgba(124,77,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid #333',
          background: '#252535',
          borderRadius: '6px 6px 0 0',
        }}
      >
        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px' }}>
          {data.label}
        </span>
        <span
          style={{
            background: badge.color,
            color: '#1e1e2e',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.5px',
          }}
        >
          {badge.label}
        </span>
      </div>

      <div style={{ padding: '4px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1 }}>
            {data.inputs.map((input) => (
              <SemanticHandle
                key={input.name}
                type="target"
                id={input.name}
                semanticType={input.semanticType}
                label={input.name}
                required={input.required}
              />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            {data.outputs.map((output) => (
              <SemanticHandle
                key={output.name}
                type="source"
                id={output.name}
                semanticType={output.semanticType}
                label={output.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '3px 10px',
          borderTop: '1px solid #333',
          fontSize: '10px',
          color: '#777',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        {data.capabilityId}@{data.capabilityVersion}
      </div>
    </div>
  );
}
