import { Handle, Position } from '@xyflow/react';

const TYPE_COLORS: Record<string, string> = {
  'eve.type': '#4fc3f7',
  'eve.region': '#81c784',
  'eve.system': '#ffb74d',
  'eve.location': '#ff8a65',
  'eve.route': '#ba68c8',
  'eve.market': '#f06292',
  'eve.currency': '#ffd54f',
  'eve.security': '#66bb6a',
  'eve.timestamp': '#78909c',
  'eve.percentage': '#26a69a',
  'eve.quantity': '#7986cb',
};

function colorForType(semanticType: string): string {
  for (const [prefix, color] of Object.entries(TYPE_COLORS)) {
    if (semanticType.startsWith(prefix)) return color;
  }
  return '#9e9e9e';
}

interface SemanticHandleProps {
  type: 'source' | 'target';
  id: string;
  semanticType: string;
  label: string;
  required?: boolean;
}

export function SemanticHandle({ type, id, semanticType, label, required }: SemanticHandleProps) {
  const color = colorForType(semanticType);
  const position = type === 'source' ? Position.Right : Position.Left;
  const isSource = type === 'source';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isSource ? 'flex-end' : 'flex-start',
        padding: '2px 0',
        position: 'relative',
        fontSize: '11px',
      }}
    >
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          width: 10,
          height: 10,
          background: color,
          border: `2px solid ${color}`,
          borderRadius: '50%',
        }}
        title={`${label} (${semanticType})${required ? ' *' : ''}`}
      />
      <span
        style={{
          padding: isSource ? '0 14px 0 4px' : '0 4px 0 14px',
          color: '#ccc',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
        {required && <span style={{ color: '#ef5350' }}> *</span>}
      </span>
    </div>
  );
}
