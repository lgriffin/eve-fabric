import { useState } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import type { ValidationError } from '../../hooks/useExecutor.js';

interface ToolbarProps {
  onValidate: () => void;
  onExecute: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onPublish: () => void;
  validationErrors?: ValidationError[];
}

function executeButtonBg(errorCount: number, canExecute: boolean): string {
  if (errorCount > 0) return '#ff9800';
  if (canExecute) return '#43a047';
  return '#2a2a3a';
}

function executeButtonFg(errorCount: number, canExecute: boolean): string {
  if (errorCount > 0) return '#1e1e2e';
  if (canExecute) return '#fff';
  return '#555';
}

function executeButtonLabel(isExecuting: boolean, errorCount: number): string {
  if (isExecuting) return 'Executing...';
  if (errorCount > 0) return `Execute (${errorCount} issues)`;
  return 'Execute';
}

export function Toolbar({
  onValidate,
  onExecute,
  onSave,
  onExport,
  onImport,
  onPublish,
  validationErrors = [],
}: ToolbarProps) {
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const isDirty = usePipelineStore((s) => s.isDirty);
  const nodeCount = usePipelineStore((s) => s.nodes.length);
  const edgeCount = usePipelineStore((s) => s.edges.length);
  const diagnostics = usePipelineStore((s) => s.diagnostics);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const isExecuting = executionSession?.status === 'running';
  const canExecute = errorCount === 0 && nodeCount > 0 && !isExecuting;
  const [showValidationSummary, setShowValidationSummary] = useState(false);

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
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => {
            if (validationErrors.length > 0) {
              setShowValidationSummary(!showValidationSummary);
            } else {
              setShowValidationSummary(false);
              onExecute();
            }
          }}
          disabled={!canExecute}
          style={{
            ...buttonStyle,
            background: executeButtonBg(validationErrors.length, canExecute),
            color: executeButtonFg(validationErrors.length, canExecute),
            cursor: canExecute ? 'pointer' : 'not-allowed',
          }}
        >
          {executeButtonLabel(isExecuting, validationErrors.length)}
        </button>
        {showValidationSummary && validationErrors.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              background: '#1e1e2e',
              border: '1px solid #444',
              borderRadius: 6,
              padding: 8,
              minWidth: 240,
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#ff9800', marginBottom: 6 }}>
              Pre-execution Validation
            </div>
            {validationErrors.map((err, i) => (
              <div
                key={`${err.nodeId}-${String(i)}`}
                style={{
                  fontSize: '10px',
                  color: '#ccc',
                  padding: '3px 0',
                  borderBottom: i < validationErrors.length - 1 ? '1px solid #2a2a3a' : undefined,
                }}
              >
                <span style={{ color: '#ff9800' }}>{err.nodeName}</span>
                <span style={{ color: '#888' }}> — {err.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button onClick={onSave} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Save
      </button>
      <button onClick={onExport} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Export
      </button>
      <button onClick={onImport} style={{ ...buttonStyle, background: '#333', color: '#e0e0e0' }}>
        Import
      </button>
      <button
        onClick={onPublish}
        disabled={errorCount > 0 || nodeCount === 0}
        style={{
          ...buttonStyle,
          background: errorCount === 0 && nodeCount > 0 ? '#ff8a65' : '#2a2a3a',
          color: errorCount === 0 && nodeCount > 0 ? '#1e1e2e' : '#555',
          cursor: errorCount === 0 && nodeCount > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        Publish as Capability
      </button>
    </div>
  );
}
