import { useState, useCallback } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { useCatalogStore } from '../../stores/catalog-store.js';
import { ContractEditor } from './ContractEditor.js';
import { colors, fontSize, borderRadius } from '../../tokens.js';

interface PublishDialogProps {
  open: boolean;
  onClose: () => void;
}

function trimDots(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '.') start++;
  while (end > start && s[end - 1] === '.') end--;
  return s.slice(start, end);
}

function generateId(name: string): string {
  const slug = trimDots(name.toLowerCase().replace(/[^a-z0-9]+/g, '.'));
  return 'custom.' + slug;
}

export function PublishDialog({ open, onClose }: PublishDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [selectedInputs, setSelectedInputs] = useState<string[]>([]);
  const [selectedOutputs, setSelectedOutputs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const nodes = usePipelineStore((s) => s.nodes);
  const isPublishing = usePipelineStore((s) => s.isPublishing);
  const publishAsCapability = usePipelineStore((s) => s.publishAsCapability);
  const fetchCapabilities = useCatalogStore((s) => s.fetchCapabilities);

  const pipelineInputs = nodes.flatMap((n) =>
    n.data.inputs.map((i) => ({ name: i.name, semanticType: i.semanticType })),
  );
  const pipelineOutputs = nodes.flatMap((n) =>
    n.data.outputs.map((o) => ({ name: o.name, semanticType: o.semanticType })),
  );

  const handleSelectionChange = useCallback((inputs: string[], outputs: string[]) => {
    setSelectedInputs(inputs);
    setSelectedOutputs(outputs);
  }, []);

  const handlePublish = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    if (!description.trim()) {
      setError('Description is required');
      return;
    }
    if (selectedInputs.length === 0) {
      setError('Select at least one input');
      return;
    }
    if (selectedOutputs.length === 0) {
      setError('Select at least one output');
      return;
    }

    const result = await publishAsCapability({
      capabilityId: generateId(name),
      version,
      name: name.trim(),
      description: description.trim(),
      selectedInputs,
      selectedOutputs,
    });

    if (result.success) {
      setSuccess(true);
      void fetchCapabilities();
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setName('');
        setDescription('');
        setVersion('1.0.0');
      }, 1500);
    } else {
      setError(result.diagnostics.map((d) => d.message).join('; '));
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: colors.surface.raised,
          border: `1px solid ${colors.surface.borderLight}`,
          borderRadius: borderRadius.xl,
          padding: 24,
          width: 520,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: colors.text.primary, margin: '0 0 16px' }}>Publish as Capability</h3>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.sm,
              display: 'block',
              marginBottom: 4,
            }}
          >
            NAME
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nearby Market Search"
            style={{
              width: '100%',
              padding: '6px 8px',
              background: colors.surface.base,
              border: `1px solid ${colors.surface.border}`,
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
          {name && (
            <div style={{ color: colors.text.dim, fontSize: fontSize.xs, marginTop: 2 }}>
              ID: {generateId(name)}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.sm,
              display: 'block',
              marginBottom: 4,
            }}
          >
            VERSION
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            style={{
              width: '100%',
              padding: '6px 8px',
              background: colors.surface.base,
              border: `1px solid ${colors.surface.border}`,
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.sm,
              display: 'block',
              marginBottom: 4,
            }}
          >
            DESCRIPTION
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this capability do?"
            rows={3}
            style={{
              width: '100%',
              padding: '6px 8px',
              background: colors.surface.base,
              border: `1px solid ${colors.surface.border}`,
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              fontSize: '12px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              color: colors.text.secondary,
              fontSize: fontSize.sm,
              display: 'block',
              marginBottom: 4,
            }}
          >
            PUBLIC CONTRACT
          </label>
          <ContractEditor
            inputs={pipelineInputs}
            outputs={pipelineOutputs}
            onSelectionChange={handleSelectionChange}
          />
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,83,80,0.1)',
              border: `1px solid ${colors.status.error}`,
              borderRadius: borderRadius.md,
              padding: '8px 10px',
              color: colors.status.errorLight,
              fontSize: '12px',
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        {success && (
          <div
            style={{
              background: 'rgba(67,160,71,0.1)',
              border: `1px solid ${colors.status.success}`,
              borderRadius: borderRadius.md,
              padding: '8px 10px',
              color: colors.status.successLight,
              fontSize: '12px',
              marginBottom: 12,
            }}
          >
            Published successfully!
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              background: colors.surface.border,
              border: 'none',
              borderRadius: borderRadius.md,
              color: colors.text.secondary,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => void handlePublish()}
            disabled={isPublishing}
            style={{
              padding: '6px 16px',
              background: isPublishing ? colors.surface.borderLight : colors.accent,
              border: 'none',
              borderRadius: borderRadius.md,
              color: colors.text.primary,
              cursor: isPublishing ? 'not-allowed' : 'pointer',
              fontWeight: 600,
            }}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
