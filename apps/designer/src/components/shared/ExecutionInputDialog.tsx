import { useState, useEffect, useCallback } from 'react';
import { colors, fontSize, borderRadius } from '../../tokens.js';

export interface PipelineInput {
  nodeId: string;
  nodeName: string;
  inputName: string;
  semanticType: string;
}

interface ExecutionInputDialogProps {
  open: boolean;
  inputs: PipelineInput[];
  pipelineId: string;
  onSubmit: (values: Record<string, Record<string, string>>) => void;
  onCancel: () => void;
}

function storageKey(pipelineId: string): string {
  return `eve-fabric:exec-inputs:${pipelineId}`;
}

export function loadSavedInputs(pipelineId: string): Record<string, Record<string, string>> {
  try {
    const raw = localStorage.getItem(storageKey(pipelineId));
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Record<string, string>>;
  } catch {
    return {};
  }
}

export function saveInputs(
  pipelineId: string,
  values: Record<string, Record<string, string>>,
): void {
  localStorage.setItem(storageKey(pipelineId), JSON.stringify(values));
}

export function collectUnconnectedInputs(
  nodes: Array<{
    id: string;
    data: {
      label: string;
      inputs: Array<{ name: string; semanticType: string; required: boolean }>;
    };
  }>,
  edges: Array<{ target: string; targetHandle?: string | null }>,
  configuredValues?: Record<string, Record<string, unknown>>,
): PipelineInput[] {
  const result: PipelineInput[] = [];
  for (const node of nodes) {
    for (const input of node.data.inputs) {
      if (!input.required) continue;
      const isConnected = edges.some((e) => e.target === node.id && e.targetHandle === input.name);
      const isConfigured = configuredValues?.[node.id]?.[input.name] != null;
      if (!isConnected && !isConfigured) {
        result.push({
          nodeId: node.id,
          nodeName: node.data.label,
          inputName: input.name,
          semanticType: input.semanticType,
        });
      }
    }
  }
  return result;
}

export function ExecutionInputDialog({
  open,
  inputs,
  pipelineId,
  onSubmit,
  onCancel,
}: ExecutionInputDialogProps) {
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    if (open) {
      setValues(loadSavedInputs(pipelineId));
    }
  }, [open, pipelineId]);

  const handleChange = useCallback((nodeId: string, inputName: string, value: string) => {
    setValues((prev) => ({
      ...prev,
      [nodeId]: { ...prev[nodeId], [inputName]: value },
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    saveInputs(pipelineId, values);
    onSubmit(values);
  }, [pipelineId, values, onSubmit]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: colors.surface.raised,
          border: `1px solid ${colors.surface.borderLight}`,
          borderRadius: borderRadius.xl,
          padding: 20,
          minWidth: 380,
          maxWidth: 500,
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: fontSize.lg,
            fontWeight: 700,
            color: colors.text.primary,
            marginBottom: 16,
          }}
        >
          Execution Inputs
        </div>

        {inputs.map((input) => (
          <div key={`${input.nodeId}:${input.inputName}`} style={{ marginBottom: 12 }}>
            <label
              style={{
                display: 'block',
                fontSize: '11px',
                fontWeight: 600,
                color: colors.text.secondary,
                marginBottom: 4,
              }}
            >
              {input.nodeName} — {input.inputName}
              <span style={{ color: colors.text.dim, marginLeft: 6, fontWeight: 400 }}>
                {input.semanticType}
              </span>
            </label>
            <input
              type="text"
              value={values[input.nodeId]?.[input.inputName] ?? ''}
              onChange={(e) => handleChange(input.nodeId, input.inputName, e.target.value)}
              placeholder={`Enter ${input.inputName}...`}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: colors.surface.base,
                border: `1px solid ${colors.surface.border}`,
                borderRadius: borderRadius.md,
                color: colors.text.primary,
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button
            onClick={onCancel}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: `1px solid ${colors.text.disabled}`,
              borderRadius: borderRadius.md,
              background: 'transparent',
              color: colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              border: 'none',
              borderRadius: borderRadius.md,
              background: colors.status.success,
              color: colors.text.primary,
              cursor: 'pointer',
            }}
          >
            Run
          </button>
        </div>
      </div>
    </div>
  );
}
