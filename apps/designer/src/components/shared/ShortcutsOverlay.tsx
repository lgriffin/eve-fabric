import { colors, fontSize, borderRadius } from '../../tokens.js';

interface ShortcutsOverlayProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { category: 'File', items: [{ key: 'Ctrl+S', action: 'Save the question as GraphQL' }] },
  {
    category: 'Question',
    items: [
      { key: 'Ctrl+Z', action: 'Undo the last change' },
      { key: 'Ctrl+A', action: 'Select all nodes' },
    ],
  },
  {
    category: 'Navigation',
    items: [
      { key: 'Escape', action: 'Clear selection / close dialog' },
      { key: '?', action: 'Toggle this help overlay' },
    ],
  },
];

export function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10001,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: colors.surface.raised,
          border: `1px solid ${colors.surface.borderLight}`,
          borderRadius: 8,
          padding: '20px 24px',
          minWidth: 340,
          maxWidth: 440,
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: fontSize.xl,
              fontWeight: 700,
              color: colors.text.primary,
            }}
          >
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: colors.text.muted,
              cursor: 'pointer',
              fontSize: '18px',
              padding: '0 4px',
            }}
          >
            ×
          </button>
        </div>

        {SHORTCUTS.map((group) => (
          <div key={group.category} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: colors.accent,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {group.category}
            </div>
            {group.items.map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '4px 0',
                  fontSize: '12px',
                }}
              >
                <span style={{ color: colors.text.secondary }}>{item.action}</span>
                <kbd
                  style={{
                    background: colors.surface.overlay,
                    border: `1px solid ${colors.surface.borderLight}`,
                    borderRadius: borderRadius.sm,
                    padding: '1px 6px',
                    fontSize: fontSize.sm,
                    color: colors.text.primary,
                    fontFamily: 'monospace',
                  }}
                >
                  {item.key}
                </kbd>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
