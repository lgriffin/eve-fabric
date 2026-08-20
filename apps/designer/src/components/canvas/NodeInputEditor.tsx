import { useCallback } from 'react';
import { getEditorType } from '@eve-fabric/domain';
import type { SemanticTypeId } from '@eve-fabric/domain';
import { usePipelineStore } from '../../stores/pipeline-store.js';
import { SearchableSelector } from '../input-editors/SearchableSelector.js';
import { EnumSelector } from '../input-editors/EnumSelector.js';
import { NumericInput } from '../input-editors/NumericInput.js';
import { BooleanToggle } from '../input-editors/BooleanToggle.js';
import { CollectionInput } from '../input-editors/CollectionInput.js';
import { ConnectedInputIndicator } from './ConnectedInputIndicator.js';
import { colors } from '../../tokens.js';

interface NodeInputEditorProps {
  nodeId: string;
  portName: string;
  semanticType: string;
  required: boolean;
  isConnected: boolean;
  sourceName?: string;
}

export function NodeInputEditor(props: NodeInputEditorProps) {
  const { nodeId, portName, semanticType, isConnected, sourceName } = props;

  const configuredValues = usePipelineStore((s) => s.nodeConfiguredValues);
  const setNodeInputValue = usePipelineStore((s) => s.setNodeInputValue);

  const configured = configuredValues[nodeId]?.[portName];
  const editorType = getEditorType(semanticType as SemanticTypeId);

  const handleChange = useCallback(
    (value: unknown, displayLabel: string) => {
      setNodeInputValue(nodeId, portName, { value, displayLabel });
    },
    [nodeId, portName, setNodeInputValue],
  );

  if (isConnected) {
    return <ConnectedInputIndicator sourceName={sourceName ?? 'Connected'} />;
  }

  switch (editorType) {
    case 'searchable-selector':
      return (
        <SearchableSelector
          semanticType={semanticType}
          value={configured?.value ?? null}
          displayLabel={configured?.displayLabel ?? ''}
          onChange={handleChange}
          placeholder={`Select ${portName}...`}
        />
      );
    case 'enum':
      return (
        <EnumSelector
          options={[
            { value: 'sell', label: 'Sell' },
            { value: 'buy', label: 'Buy' },
            { value: 'both', label: 'Both' },
          ]}
          value={configured?.value ?? null}
          onChange={handleChange}
        />
      );
    case 'numeric':
      return <NumericInput value={configured?.value ?? null} onChange={handleChange} />;
    case 'boolean':
      return <BooleanToggle value={configured?.value ?? false} onChange={handleChange} />;
    case 'collection':
      return <CollectionInput portName={portName} isConnected={false} />;
    case 'text':
    default:
      return (
        <input
          type="text"
          className="text-input nopan nodrag"
          value={configured?.value != null ? String(configured.value) : ''}
          onChange={(e) => handleChange(e.target.value, e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          placeholder={`Enter ${portName}...`}
          style={{
            width: '100%',
            padding: '4px 8px',
            background: colors.surface.base,
            border: `1px solid ${colors.surface.borderLight}`,
            borderRadius: 4,
            color: colors.text.primary,
            fontSize: '11px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      );
  }
}
