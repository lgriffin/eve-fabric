interface CollectionInputProps {
  portName: string;
  isConnected: boolean;
  sourceName?: string;
}

export function CollectionInput({ isConnected, sourceName }: CollectionInputProps) {
  if (isConnected) {
    return (
      <div
        className="collection-input connected nopan"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: 'rgba(124, 77, 255, 0.1)',
          border: '1px solid rgba(124, 77, 255, 0.3)',
          borderRadius: 4,
          fontSize: '11px',
          color: '#b39ddb',
        }}
      >
        <span>&#9664;</span>
        <span>{sourceName ?? 'Connected'}</span>
      </div>
    );
  }

  return (
    <div
      className="collection-input not-connected nopan"
      style={{
        padding: '3px 8px',
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px dashed #444',
        borderRadius: 4,
        fontSize: '10px',
        color: '#666',
      }}
    >
      Connect from upstream output
    </div>
  );
}
