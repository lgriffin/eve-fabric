import { useEffect, useRef } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import type { ConsumerInfo } from '../../services/discovery-service.js';

interface ContextualPaletteProps {
  semanticType: string;
  position: { x: number; y: number };
  onSelect: (capabilityId: string, capabilityName: string) => void;
  onClose: () => void;
}

export function ContextualPalette({
  semanticType,
  position,
  onSelect,
  onClose,
}: ContextualPaletteProps) {
  const { consumers, isLoading, getConsumers } = useDiscovery();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getConsumers(semanticType);
  }, [semanticType, getConsumers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
        background: '#1e1e2e',
        border: '1px solid #444',
        borderRadius: 8,
        minWidth: 220,
        maxWidth: 280,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #333',
          fontSize: '11px',
          fontWeight: 600,
          color: '#aaa',
        }}
      >
        Connect to...
      </div>

      {isLoading && (
        <div style={{ padding: '12px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
          Loading...
        </div>
      )}

      {!isLoading && consumers.length === 0 && (
        <div style={{ padding: '12px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
          No compatible capabilities found
        </div>
      )}

      <div style={{ maxHeight: 240, overflowY: 'auto' }}>
        {consumers.map((consumer: ConsumerInfo) => (
          <button
            key={consumer.id}
            onClick={() => onSelect(consumer.id, consumer.name)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 12px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid #2a2a3a',
              cursor: 'pointer',
              textAlign: 'left',
              color: '#e0e0e0',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = '#252535';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{ fontWeight: 600 }}>{consumer.name}</div>
            <div style={{ fontSize: '10px', color: '#888', marginTop: 2 }}>
              {consumer.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
