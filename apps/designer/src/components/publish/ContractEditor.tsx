import { useState } from 'react';
import { colors } from '../../tokens.js';

interface Port {
  name: string;
  semanticType: string;
  required?: boolean;
}

interface ContractEditorProps {
  inputs: Port[];
  outputs: Port[];
  onSelectionChange: (selectedInputs: string[], selectedOutputs: string[]) => void;
}

export function ContractEditor({ inputs, outputs, onSelectionChange }: ContractEditorProps) {
  const [selectedInputs, setSelectedInputs] = useState<Set<string>>(
    new Set(inputs.map((i) => i.name)),
  );
  const [selectedOutputs, setSelectedOutputs] = useState<Set<string>>(
    new Set(outputs.map((o) => o.name)),
  );

  const toggleInput = (name: string) => {
    const next = new Set(selectedInputs);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedInputs(next);
    onSelectionChange([...next], [...selectedOutputs]);
  };

  const toggleOutput = (name: string) => {
    const next = new Set(selectedOutputs);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    setSelectedOutputs(next);
    onSelectionChange([...selectedInputs], [...next]);
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: colors.text.secondary,
            fontSize: '11px',
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          INPUTS
        </div>
        {inputs.map((port) => (
          <label
            key={port.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
              color: colors.text.secondary,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedInputs.has(port.name)}
              onChange={() => toggleInput(port.name)}
            />
            <span>{port.name}</span>
            <span style={{ color: colors.text.dim, fontSize: '10px' }}>{port.semanticType}</span>
          </label>
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            color: colors.text.secondary,
            fontSize: '11px',
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          OUTPUTS
        </div>
        {outputs.map((port) => (
          <label
            key={port.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 0',
              color: colors.text.secondary,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={selectedOutputs.has(port.name)}
              onChange={() => toggleOutput(port.name)}
            />
            <span>{port.name}</span>
            <span style={{ color: colors.text.dim, fontSize: '10px' }}>{port.semanticType}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
