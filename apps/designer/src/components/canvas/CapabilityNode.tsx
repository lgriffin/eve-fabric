import { memo, useMemo, useCallback, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { usePipelineStore, type CapabilityFlowNode } from '../../stores/pipeline-store.js';
import { SemanticHandle } from './SemanticHandle.js';
import { NodeInputEditor } from './NodeInputEditor.js';
import { useNodeExecution } from '../../hooks/useNodeExecution.js';

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
  const nodeExecState = usePipelineStore((s) => s.nodeExecutionStates[id]);
  const { executeNode } = useNodeExecution();
  const executionState = executionSession?.stepStatuses[id];
  const execStyle = executionState ? EXECUTION_STYLES[executionState] : undefined;
  const stepError = executionSession?.stepMetrics[id]?.error;
  const isComposite = data.source === 'COMPOSITE';

  let nodeExecBorder: string | undefined;
  if (nodeExecState?.status === 'running') nodeExecBorder = '#42a5f5';
  else if (nodeExecState?.status === 'success') nodeExecBorder = '#81c784';
  else if (nodeExecState?.status === 'error') nodeExecBorder = '#ef5350';

  const handleTest = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      void executeNode(id);
    },
    [executeNode, id],
  );

  const connectedInputs = useMemo(() => {
    const map = new Map<string, string>();
    for (const edge of edges) {
      if (edge.target === id && edge.targetHandle) {
        map.set(edge.targetHandle, edge.source);
      }
    }
    return map;
  }, [edges, id]);

  const unconnectedRequiredInputs = useMemo(() => {
    const set = new Set<string>();
    for (const input of data.inputs) {
      if (!input.required) continue;
      if (!connectedInputs.has(input.name)) set.add(input.name);
    }
    return set;
  }, [data.inputs, connectedInputs]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const badge = SOURCE_BADGES[data.source] ?? { color: '#9e9e9e', label: data.source || '?' };

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: `2px solid ${selected ? '#7c4dff' : (execStyle?.border ?? nodeExecBorder ?? '#333')}`,
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
          gap: 4,
        }}
      >
        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '12px', flex: 1 }}>
          {data.label}
        </span>
        <button
          className="nopan nodrag"
          onClick={(e) => {
            e.stopPropagation();
            setShowAdvanced((v) => !v);
          }}
          style={{
            background: 'transparent',
            color: '#666',
            border: 'none',
            cursor: 'pointer',
            fontSize: '9px',
            padding: '0 2px',
            flexShrink: 0,
          }}
          title={showAdvanced ? 'Hide details' : 'Show details'}
        >
          {showAdvanced ? '▴' : '⋯'}
        </button>
        <span
          style={{
            background: badge.color,
            color: '#1e1e2e',
            padding: '1px 6px',
            borderRadius: 4,
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
      </div>

      <div style={{ padding: '4px 0' }}>
        {data.inputs.length > 0 && (
          <div style={{ padding: '2px 10px 4px' }}>
            {data.inputs.map((input) => {
              const isConnected = connectedInputs.has(input.name);
              return (
                <div
                  key={input.name}
                  style={{
                    marginBottom: 4,
                    ...(unconnectedRequiredInputs.has(input.name)
                      ? {
                          borderRadius: 4,
                          animation: 'unconnected-pulse 2s ease-in-out infinite',
                        }
                      : {}),
                  }}
                >
                  <div style={{ position: 'relative' }}>
                    <SemanticHandle
                      type="target"
                      id={input.name}
                      semanticType={input.semanticType}
                      label={input.name}
                      required={input.required}
                    />
                  </div>
                  <div style={{ paddingLeft: 12, paddingRight: 4, marginTop: 2 }}>
                    <NodeInputEditor
                      nodeId={id}
                      portName={input.name}
                      semanticType={input.semanticType}
                      required={input.required}
                      isConnected={isConnected}
                      sourceName={isConnected ? connectedInputs.get(input.name) : undefined}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {data.outputs.length > 0 && (
          <div
            style={{
              borderTop: data.inputs.length > 0 ? '1px solid #333' : undefined,
              padding: '2px 0',
            }}
          >
            {data.outputs.map((output) => (
              <div key={output.name} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <SemanticHandle
                    type="source"
                    id={output.name}
                    semanticType={output.semanticType}
                    label={output.name}
                  />
                </div>
                <button
                  className="nopan nodrag"
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    window.dispatchEvent(
                      new CustomEvent('fabric:show-contextual-palette', {
                        detail: {
                          semanticType: output.semanticType,
                          sourceNodeId: id,
                          sourcePort: output.name,
                          position: { x: rect.right + 10, y: rect.top },
                        },
                      }),
                    );
                  }}
                  style={{
                    background: '#333',
                    color: '#aaa',
                    border: '1px solid #444',
                    borderRadius: '50%',
                    width: 18,
                    height: 18,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    padding: 0,
                    lineHeight: 1,
                    marginRight: 6,
                  }}
                  title="What can I do with this?"
                >
                  +
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdvanced && (
        <div
          style={{
            padding: '4px 10px 6px',
            borderTop: '1px solid #333',
            fontSize: '9px',
            color: '#666',
            background: '#191928',
          }}
        >
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: '#555' }}>ID: </span>
            <span>
              {data.capabilityId}@{data.capabilityVersion}
            </span>
          </div>
          <div style={{ marginBottom: 2 }}>
            <span style={{ color: '#555' }}>Source: </span>
            <span>{data.source}</span>
          </div>
          {data.inputs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: '#555', fontWeight: 600, marginBottom: 1 }}>Input Types</div>
              {data.inputs.map((input) => (
                <div key={input.name} style={{ paddingLeft: 6, marginBottom: 1 }}>
                  <span style={{ color: '#777' }}>{input.name}</span>
                  <span style={{ color: '#555' }}>{' → '}</span>
                  <span style={{ color: '#7c4dff' }}>{input.semanticType}</span>
                </div>
              ))}
            </div>
          )}
          {data.outputs.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <div style={{ color: '#555', fontWeight: 600, marginBottom: 1 }}>Output Types</div>
              {data.outputs.map((output) => (
                <div key={output.name} style={{ paddingLeft: 6, marginBottom: 1 }}>
                  <span style={{ color: '#777' }}>{output.name}</span>
                  <span style={{ color: '#555' }}>{' → '}</span>
                  <span style={{ color: '#81c784' }}>{output.semanticType}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
        <button
          className="nopan nodrag"
          onClick={handleTest}
          disabled={nodeExecState?.status === 'running'}
          style={{
            background: nodeExecState?.status === 'running' ? '#555' : '#7c4dff',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            padding: '1px 8px',
            fontSize: '9px',
            fontWeight: 700,
            cursor: nodeExecState?.status === 'running' ? 'wait' : 'pointer',
            marginLeft: 4,
            flexShrink: 0,
          }}
        >
          {nodeExecState?.status === 'running' ? 'Testing...' : '▶ Test'}
        </button>
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

      {nodeExecState?.status === 'success' && (
        <div
          style={{
            padding: '4px 10px',
            borderTop: '1px solid rgba(129,199,132,0.3)',
            background: 'rgba(129,199,132,0.08)',
            borderRadius: '0 0 6px 6px',
            fontSize: '10px',
            color: '#81c784',
            display: 'flex',
            gap: 8,
          }}
        >
          {nodeExecState.resultCount != null && (
            <span>
              {'✓'} {nodeExecState.resultCount} results
            </span>
          )}
          {nodeExecState.durationMs != null && <span>{nodeExecState.durationMs}ms</span>}
          {nodeExecState.source && <span>{nodeExecState.source}</span>}
        </div>
      )}

      {nodeExecState?.status === 'error' && !stepError && (
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
          {nodeExecState.error ?? 'Execution failed'}
        </div>
      )}
    </div>
  );
});
