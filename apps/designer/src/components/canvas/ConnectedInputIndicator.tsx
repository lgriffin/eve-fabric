import { colors } from '../../tokens.js';

interface ConnectedInputIndicatorProps {
  sourceName: string;
  sourcePort?: string;
}

export function ConnectedInputIndicator({ sourceName, sourcePort }: ConnectedInputIndicatorProps) {
  return (
    <div
      className="connected-input-indicator nopan"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 6px',
        background: 'rgba(124, 77, 255, 0.1)',
        borderRadius: 4,
        fontSize: '10px',
        color: colors.source.DERIVED,
      }}
    >
      <span style={{ fontSize: '8px' }}>◀</span>
      <span>{sourceName}</span>
      {sourcePort && <span style={{ color: colors.text.dim }}>.{sourcePort}</span>}
    </div>
  );
}
