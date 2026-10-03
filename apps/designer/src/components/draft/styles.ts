import type { CSSProperties } from 'react';
import { colors, fontSize } from '../../tokens.js';

export const panel: CSSProperties = {
  width: 300,
  flexShrink: 0,
  overflowY: 'auto',
  background: colors.surface.raised,
  borderRight: `1px solid ${colors.surface.border}`,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  fontSize: fontSize.sm,
};

export const heading: CSSProperties = {
  color: colors.text.muted,
  fontSize: '11px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  margin: 0,
};

export const input: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '5px 8px',
  background: colors.surface.base,
  border: `1px solid ${colors.surface.borderLight}`,
  borderRadius: 4,
  color: colors.text.primary,
};

export function button(enabled: boolean, primary = false): CSSProperties {
  return {
    padding: '5px 10px',
    border: 'none',
    borderRadius: 4,
    background: primary ? colors.accent : colors.surface.overlay,
    color: enabled ? colors.text.primary : colors.text.disabled,
    cursor: enabled ? 'pointer' : 'not-allowed',
    textAlign: 'left',
  };
}
