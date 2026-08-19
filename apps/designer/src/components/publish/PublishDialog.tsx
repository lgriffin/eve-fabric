import { useState, useCallback } from 'react';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { useCatalogStore } from '../../stores/catalog-store.js';
import { ContractEditor } from './ContractEditor.js';

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
          background: '#1e1e2e',
          border: '1px solid #444',
          borderRadius: 8,
          padding: 24,
          width: 520,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: '#e0e0e0', margin: '0 0 16px' }}>Publish as Capability</h3>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#aaa', fontSize: '11px', display: 'block', marginBottom: 4 }}>
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
              background: '#13131d',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#e0e0e0',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
          {name && (
            <div style={{ color: '#666', fontSize: '10px', marginTop: 2 }}>
              ID: {generateId(name)}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#aaa', fontSize: '11px', display: 'block', marginBottom: 4 }}>
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
              background: '#13131d',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#e0e0e0',
              fontSize: '12px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ color: '#aaa', fontSize: '11px', display: 'block', marginBottom: 4 }}>
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
              background: '#13131d',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#e0e0e0',
              fontSize: '12px',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ color: '#aaa', fontSize: '11px', display: 'block', marginBottom: 4 }}>
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
              background: '#3e1111',
              border: '1px solid #8b0000',
              borderRadius: 4,
              padding: '8px 10px',
              color: '#ff6b6b',
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
              background: '#113e11',
              border: '1px solid #008b00',
              borderRadius: 4,
              padding: '8px 10px',
              color: '#6bff6b',
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
              background: '#333',
              border: 'none',
              borderRadius: 4,
              color: '#aaa',
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
              background: isPublishing ? '#444' : '#7c4dff',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
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
