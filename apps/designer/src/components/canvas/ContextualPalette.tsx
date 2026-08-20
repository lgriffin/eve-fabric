import { useEffect, useRef } from 'react';
import { useDiscovery } from '../../hooks/useDiscovery.js';
import type { ConsumerInfo } from '../../services/discovery-service.js';
import { colors, fontFamily } from '../../tokens.js';

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
        background: colors.surface.raised,
        border: `1px solid ${colors.surface.borderLight}`,
        borderRadius: 8,
        minWidth: 220,
        maxWidth: 280,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        fontFamily,
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${colors.surface.border}`,
          fontSize: '11px',
          fontWeight: 600,
          color: colors.text.secondary,
        }}
      >
        Connect to...
      </div>

      {isLoading && (
        <div
          style={{ padding: '12px', fontSize: '11px', color: colors.text.dim, textAlign: 'center' }}
        >
          Loading...
        </div>
      )}

      {!isLoading && consumers.length === 0 && (
        <div
          style={{ padding: '12px', fontSize: '11px', color: colors.text.dim, textAlign: 'center' }}
        >
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
              borderBottom: `1px solid ${colors.surface.overlay}`,
              cursor: 'pointer',
              textAlign: 'left',
              color: colors.text.primary,
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = colors.surface.overlay;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = 'transparent';
            }}
          >
            <div style={{ fontWeight: 600 }}>{consumer.name}</div>
            <div style={{ fontSize: '10px', color: colors.text.muted, marginTop: 2 }}>
              {consumer.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
