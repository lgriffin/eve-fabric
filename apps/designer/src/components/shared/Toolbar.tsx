import { usePipelineStore } from '../../stores/pipeline-store.js';

interface ToolbarProps {
  onValidate: () => void;
  onExecute: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function Toolbar({ onValidate, onExecute, onSave, onExport, onImport }: ToolbarProps) {
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const isDirty = usePipelineStore((s) => s.isDirty);
  const nodeCount = usePipelineStore((s) => s.nodes.length);
  const edgeCount = usePipelineStore((s) => s.edges.length);
  const diagnostics = usePipelineStore((s) => s.diagnostics);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const isExecuting = executionSession?.status === 'running';
  const canExecute = errorCount === 0 && nodeCount > 0 && !isExecuting;

  const buttonStyle: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: 600,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

  return (
    <div
      style={{
        height: 44,
        background: '#1e1e2e',
        borderBottom: '1px solid #333',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span style={{ color: '#e0e0e0', fontWeight: 700, fontSize: '14px', marginRight: 8 }}>
        {pipelineName}
        {isDirty && <span style={{ color: '#ffa726', marginLeft: 4 }}>*</span>}
      </span>

      <div style={{ flex: 1 }} />

      <span style={{ color: '#666', fontSize: '11px', marginRight: 8 }}>
        {nodeCount} nodes, {edgeCount} edges
        {errorCount > 0 && (
          <span style={{ color: '#ef5350', marginLeft: 6 }}>{errorCount} errors</span>
        )}
      </span>

      <button onClick={onValidate} style={{ ...buttonStyle, background: '#7c4dff', color: '#fff' }}>
        Validate
      </button>
      <button
        onClick={onExecute}
        disabled={!canExecute}
        style={{
          ...buttonStyle,
          background: canExecute ? '#43a047' : '#2a2a3a',
          color: canExecute ? '#fff' : '#555',
          cursor: canExecute ? 'pointer' : 'not-allowed',
        }}
      >
        {isExecuting ? 'Executing...' : 'Execute'}
      </button>
      <button onClick={onSave} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Save
      </button>
      <button onClick={onExport} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Export
      </button>
      <button onClick={onImport} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Import
      </button>
    </div>
  );
}
