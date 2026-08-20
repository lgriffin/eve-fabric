import { createPortal } from 'react-dom';
import { useToastStore } from '../../stores/toast-store.js';
import type { ToastSeverity } from '../../stores/types.js';
import { colors } from '../../tokens.js';

const SEVERITY_COLORS: Record<ToastSeverity, { bg: string; border: string; text: string }> = {
  error: { bg: '#3d1a1a', border: '#d32f2f', text: '#ff8a80' },
  warning: { bg: '#3d3a1a', border: '#f9a825', text: '#ffe082' },
  success: { bg: '#1a3d1a', border: '#388e3c', text: '#a5d6a7' },
  info: { bg: '#1a2a3d', border: '#1976d2', text: '#90caf9' },
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const dismissToast = useToastStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 360,
      }}
    >
      {toasts.map((toast) => {
        const sevColors = SEVERITY_COLORS[toast.severity];
        return (
          <div
            key={toast.id}
            role="alert"
            style={{
              background: sevColors.bg,
              border: `1px solid ${sevColors.border}`,
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: '12px',
              color: sevColors.text,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{toast.title}</div>
              {toast.dismissible && (
                <button
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Dismiss"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: sevColors.text,
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '0 0 0 8px',
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div style={{ color: colors.text.secondary, fontSize: '11px' }}>{toast.message}</div>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
