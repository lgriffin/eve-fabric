import { useState } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';

interface ResultInspectorProps {
  nodeId: string;
}

type InspectorTab = 'config' | 'input' | 'output' | 'execution' | 'preview';

const TABS: Array<{ key: InspectorTab; label: string }> = [
  { key: 'config', label: 'Config' },
  { key: 'input', label: 'Input' },
  { key: 'output', label: 'Output' },
  { key: 'execution', label: 'Execution' },
  { key: 'preview', label: 'Preview' },
];

const STATUS_COLORS: Record<string, string> = {
  success: '#81c784',
  error: '#ef5350',
  running: '#42a5f5',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#888';
}

export function ResultInspector({ nodeId }: ResultInspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('config');
  const node = usePipelineStore((s) => s.nodes.find((n) => n.id === nodeId));
  const configuredValues = usePipelineStore((s) => s.nodeConfiguredValues[nodeId] ?? {});
  const execState = usePipelineStore((s) => s.nodeExecutionStates[nodeId]);
  const session = usePipelineStore((s) => s.executionSession);
  const stepMetrics = session?.stepMetrics[nodeId];
  const stepResult = session?.stepResults[nodeId];

  if (!node) return null;

  return (
    <div style={{ fontSize: '11px', color: '#ccc' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #333', marginBottom: 8 }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '4px 2px',
              fontSize: '9px',
              fontWeight: 600,
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #7c4dff' : '2px solid transparent',
              background: 'transparent',
              color: activeTab === tab.key ? '#e0e0e0' : '#666',
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#aaa' }}>Configuration</div>
          {Object.entries(configuredValues).map(([name, val]) => (
            <div key={name} style={{ marginBottom: 2 }}>
              <span style={{ color: '#888' }}>{name}: </span>
              <span>{val.displayLabel}</span>
            </div>
          ))}
          {Object.keys(configuredValues).length === 0 && (
            <div style={{ color: '#666' }}>No values configured</div>
          )}
        </div>
      )}

      {activeTab === 'input' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#aaa' }}>Inputs</div>
          {node.data.inputs.map((input) => (
            <div key={input.name} style={{ marginBottom: 2 }}>
              <span style={{ color: '#888' }}>{input.name}</span>
              <span style={{ color: '#555', fontSize: '9px', marginLeft: 4 }}>
                ({input.semanticType})
              </span>
              {input.required && <span style={{ color: '#ef5350', marginLeft: 2 }}>*</span>}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'output' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#aaa' }}>Outputs</div>
          {node.data.outputs.map((output) => (
            <div key={output.name} style={{ marginBottom: 2 }}>
              <span style={{ color: '#888' }}>{output.name}</span>
              <span style={{ color: '#555', fontSize: '9px', marginLeft: 4 }}>
                ({output.semanticType})
              </span>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'execution' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#aaa' }}>Execution</div>
          {execState && (
            <>
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: '#888' }}>Status: </span>
                <span
                  style={{
                    color: statusColor(execState.status),
                  }}
                >
                  {execState.status}
                </span>
              </div>
              {execState.durationMs != null && (
                <div style={{ marginBottom: 2 }}>
                  <span style={{ color: '#888' }}>Duration: </span>
                  {execState.durationMs}ms
                </div>
              )}
              {execState.source && (
                <div style={{ marginBottom: 2 }}>
                  <span style={{ color: '#888' }}>Source: </span>
                  {execState.source}
                </div>
              )}
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: '#888' }}>Cached: </span>
                {execState.cached ? 'Yes' : 'No'}
              </div>
              {execState.resultCount != null && (
                <div style={{ marginBottom: 2 }}>
                  <span style={{ color: '#888' }}>Results: </span>
                  {execState.resultCount}
                </div>
              )}
              {execState.error && (
                <div style={{ color: '#ef5350', marginTop: 4 }}>{execState.error}</div>
              )}
            </>
          )}
          {stepMetrics && (
            <>
              <div style={{ fontWeight: 600, marginTop: 8, marginBottom: 4, color: '#aaa' }}>
                Flow Execution
              </div>
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: '#888' }}>Duration: </span>
                {stepMetrics.durationMs}ms
              </div>
              <div style={{ marginBottom: 2 }}>
                <span style={{ color: '#888' }}>Cached: </span>
                {stepMetrics.cached ? 'Yes' : 'No'}
              </div>
              {stepMetrics.source && (
                <div style={{ marginBottom: 2 }}>
                  <span style={{ color: '#888' }}>Source: </span>
                  {stepMetrics.source}
                </div>
              )}
            </>
          )}
          {!execState && !stepMetrics && <div style={{ color: '#666' }}>Not yet executed</div>}
        </div>
      )}

      {activeTab === 'preview' && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#aaa' }}>Data Preview</div>
          {(() => {
            const previewData = execState?.preview ?? stepResult;
            if (previewData != null) {
              return (
                <pre
                  style={{
                    background: '#13131d',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: '9px',
                    overflow: 'auto',
                    maxHeight: 200,
                    color: '#b0b0b0',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {JSON.stringify(previewData, null, 2)}
                </pre>
              );
            }
            return <div style={{ color: '#666' }}>Execute to see data preview</div>;
          })()}
        </div>
      )}
    </div>
  );
}
