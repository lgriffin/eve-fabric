import { memo, useMemo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { usePipelineStore, type CapabilityFlowNode } from '../../stores/pipeline-store.js';
import { SemanticHandle } from './SemanticHandle.js';

const SOURCE_BADGES: Record<string, { color: string; label: string }> = {
  ESI: { color: '#4fc3f7', label: 'ESI' },
  SDE: { color: '#81c784', label: 'SDE' },
  DERIVED: { color: '#ba68c8', label: 'DRV' },
  CACHE: { color: '#ffd54f', label: 'CCH' },
  COMPOSITE: { color: '#ff8a65', label: 'CMP' },
};

const pulseKeyframes = `
@keyframes unconnected-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 167, 38, 0.4); }
  50% { box-shadow: 0 0 6px 2px rgba(255, 167, 38, 0.6); }
}
@keyframes queued-pulse {
  0%, 100% { border-color: #666; }
  50% { border-color: #999; }
}
@keyframes executing-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(66, 165, 245, 0.4); }
  50% { box-shadow: 0 0 12px 4px rgba(66, 165, 245, 0.6); }
}
`;

const EXECUTION_STYLES: Record<string, { border: string; animation?: string; opacity?: number }> = {
  queued: { border: '#666', animation: 'queued-pulse 1.5s ease-in-out infinite' },
  executing: { border: '#42a5f5', animation: 'executing-pulse 1s ease-in-out infinite' },
  completed: { border: '#81c784' },
  failed: { border: '#ef5350' },
  skipped: { border: '#555', opacity: 0.5 },
};

let styleInjected = false;
function injectPulseStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = pulseKeyframes;
  document.head.appendChild(style);
}

export const CapabilityNode = memo(function CapabilityNode({
  id,
  data,
  selected,
}: NodeProps<CapabilityFlowNode>) {
  injectPulseStyle();

  const edges = usePipelineStore((s) => s.edges);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const openComposite = usePipelineStore((s) => s.openComposite);
  const executionState = executionSession?.stepStatuses[id];
  const execStyle = executionState ? EXECUTION_STYLES[executionState] : undefined;
  const stepError = executionSession?.stepMetrics[id]?.error;
  const isComposite = data.source === 'COMPOSITE';

  const unconnectedRequiredInputs = useMemo(() => {
    const set = new Set<string>();
    for (const input of data.inputs) {
      if (!input.required) continue;
      const hasEdge = edges.some((e) => e.target === id && e.targetHandle === input.name);
      if (!hasEdge) set.add(input.name);
    }
    return set;
  }, [data.inputs, edges, id]);

  const badge = SOURCE_BADGES[data.source] ?? { color: '#9e9e9e', label: data.source || '?' };

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#7c4dff' : (execStyle?.border ?? '#333')}`,
        borderRadius: 8,
        minWidth: 200,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: selected ? '0 0 12px rgba(124,77,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
        animation: execStyle?.animation,
        opacity: execStyle?.opacity ?? 1,
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
        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px' }}>{data.label}</span>
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
              <div
                key={input.name}
                style={
                  unconnectedRequiredInputs.has(input.name)
                    ? {
                        borderRadius: 4,
                        animation: 'unconnected-pulse 2s ease-in-out infinite',
                      }
                    : undefined
                }
              >
                <SemanticHandle
                  type="target"
                  id={input.name}
                  semanticType={input.semanticType}
                  label={input.name}
                  required={input.required}
                />
              </div>
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {data.capabilityId}@{data.capabilityVersion}
        </span>
        {isComposite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openComposite({
                capabilityId: data.capabilityId,
                version: data.capabilityVersion,
                pipelineDef: null,
              });
            }}
            style={{
              background: '#ff8a65',
              color: '#1e1e2e',
              border: 'none',
              borderRadius: 3,
              padding: '1px 6px',
              fontSize: '9px',
              fontWeight: 700,
              cursor: 'pointer',
              marginLeft: 4,
              flexShrink: 0,
            }}
          >
            Open
          </button>
        )}
      </div>

      {stepError && (
        <div
          style={{
            padding: '4px 10px',
            borderTop: '1px solid rgba(239,83,80,0.3)',
            background: 'rgba(239,83,80,0.1)',
            borderRadius: '0 0 6px 6px',
            fontSize: '10px',
            color: '#ef5350',
          }}
        >
          {stepError}
        </div>
      )}
    </div>
  );
});
