import { useState, useEffect } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { colors, fontSize } from '../../tokens.js';
import type { ValidationError } from '../../hooks/useExecutor.js';

interface ToolbarProps {
  onValidate: () => void;
  onExecute: () => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onPublish: () => void;
  onRelayout?: () => void;
  validationErrors?: ValidationError[];
}

function executeButtonBg(errorCount: number, canExecute: boolean): string {
  if (errorCount > 0) return colors.status.warning;
  if (canExecute) return colors.status.success;
  return colors.surface.overlay;
}

function executeButtonFg(errorCount: number, canExecute: boolean): string {
  if (errorCount > 0) return colors.surface.raised;
  if (canExecute) return colors.text.primary;
  return colors.text.disabled;
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
  onRelayout,
  validationErrors = [],
}: ToolbarProps) {
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const isDirty = usePipelineStore((s) => s.isDirty);
  const nodeCount = usePipelineStore((s) => s.nodes.length);
  const edgeCount = usePipelineStore((s) => s.edges.length);
  const diagnostics = usePipelineStore((s) => s.diagnostics);
  const executionSession = usePipelineStore((s) => s.executionSession);
  const canUndo = usePipelineStore((s) => s.canUndo);
  const canRedo = usePipelineStore((s) => s.canRedo);
  const undo = usePipelineStore((s) => s.undo);
  const redo = usePipelineStore((s) => s.redo);
  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const isExecuting = executionSession?.status === 'running';
  const canExecute = errorCount === 0 && nodeCount > 0 && !isExecuting;
  const [showValidationSummary, setShowValidationSummary] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const buttonStyle: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: fontSize.md,
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
        background: colors.surface.raised,
        borderBottom: `1px solid ${colors.surface.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: colors.text.primary,
          fontWeight: 700,
          fontSize: fontSize.lg,
          marginRight: 8,
        }}
      >
        {pipelineName}
        {isDirty && <span style={{ color: colors.status.warningLight, marginLeft: 4 }}>*</span>}
      </span>

      <div style={{ flex: 1 }} />

      <span style={{ color: colors.text.dim, fontSize: fontSize.sm, marginRight: 8 }}>
        {nodeCount} nodes, {edgeCount} edges
        {errorCount > 0 && (
          <span style={{ color: colors.status.error, marginLeft: 6 }}>{errorCount} errors</span>
        )}
      </span>

      <button
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
        style={{
          ...buttonStyle,
          background: canUndo ? colors.surface.border : colors.surface.overlay,
          color: canUndo ? colors.text.primary : colors.text.disabled,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        Undo
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
        style={{
          ...buttonStyle,
          background: canRedo ? colors.surface.border : colors.surface.overlay,
          color: canRedo ? colors.text.primary : colors.text.disabled,
          cursor: canRedo ? 'pointer' : 'not-allowed',
        }}
      >
        Redo
      </button>

      <button
        onClick={onValidate}
        style={{ ...buttonStyle, background: colors.accent, color: colors.text.primary }}
      >
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
              background: colors.surface.raised,
              border: `1px solid ${colors.surface.borderLight}`,
              borderRadius: 6,
              padding: 8,
              minWidth: 240,
              maxHeight: 200,
              overflowY: 'auto',
              zIndex: 100,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <div
              style={{
                fontSize: fontSize.xs,
                fontWeight: 600,
                color: colors.status.warning,
                marginBottom: 6,
              }}
            >
              Pre-execution Validation
            </div>
            {validationErrors.map((err, i) => (
              <div
                key={`${err.nodeId}-${String(i)}`}
                style={{
                  fontSize: fontSize.xs,
                  color: colors.text.secondary,
                  padding: '3px 0',
                  borderBottom:
                    i < validationErrors.length - 1
                      ? `1px solid ${colors.surface.overlay}`
                      : undefined,
                }}
              >
                <span style={{ color: colors.status.warning }}>{err.nodeName}</span>
                <span style={{ color: colors.text.muted }}> — {err.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <button
        onClick={onSave}
        style={{ ...buttonStyle, background: colors.surface.border, color: colors.text.primary }}
      >
        Save
      </button>
      <button
        onClick={onExport}
        style={{ ...buttonStyle, background: colors.surface.border, color: colors.text.primary }}
      >
        Export
      </button>
      <button
        onClick={onImport}
        title="Open a saved question (.graphql), add a weave (.weave.yaml), or import a pipeline (.yaml). You can also drop a file anywhere."
        style={{ ...buttonStyle, background: colors.surface.border, color: colors.text.primary }}
      >
        Open…
      </button>
      {onRelayout && (
        <button
          onClick={onRelayout}
          disabled={nodeCount === 0}
          style={{
            ...buttonStyle,
            background: nodeCount > 0 ? colors.surface.border : colors.surface.overlay,
            color: nodeCount > 0 ? colors.text.primary : colors.text.disabled,
            cursor: nodeCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Re-layout
        </button>
      )}
      <button
        onClick={onPublish}
        disabled={errorCount > 0 || nodeCount === 0}
        style={{
          ...buttonStyle,
          background:
            errorCount === 0 && nodeCount > 0 ? colors.source.COMPOSITE : colors.surface.overlay,
          color: errorCount === 0 && nodeCount > 0 ? colors.surface.raised : colors.text.disabled,
          cursor: errorCount === 0 && nodeCount > 0 ? 'pointer' : 'not-allowed',
        }}
      >
        Publish as Capability
      </button>
    </div>
  );
}
