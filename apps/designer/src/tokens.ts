export const colors = {
  surface: {
    base: '#13131d',
    raised: '#1e1e2e',
    overlay: '#2a2a3a',
    border: '#333',
    borderLight: '#444',
  },
  text: {
    primary: '#e0e0e0',
    secondary: '#ccc',
    muted: '#888',
    disabled: '#555',
    dim: '#666',
  },
  accent: '#7c4dff',
  source: {
    ESI: '#4fc3f7',
    SDE: '#81c784',
    DERIVED: '#ba68c8',
    CACHE: '#ffd54f',
    COMPOSITE: '#ff8a65',
    fallback: '#9e9e9e',
  },
  status: {
    error: '#ef5350',
    errorLight: '#ff8a80',
    warning: '#ff9800',
    warningLight: '#ffa726',
    success: '#43a047',
    successLight: '#81c784',
    info: '#42a5f5',
    infoLight: '#90caf9',
  },
} as const;

export const SOURCE_BADGES: Record<string, { color: string; label: string }> = {
  ESI: { color: colors.source.ESI, label: 'ESI' },
  SDE: { color: colors.source.SDE, label: 'SDE' },
  DERIVED: { color: colors.source.DERIVED, label: 'DERIVED' },
  CACHE: { color: colors.source.CACHE, label: 'CACHE' },
  COMPOSITE: { color: colors.source.COMPOSITE, label: 'COMPOSITE' },
};

export const fontSize = {
  xs: '10px',
  sm: '11px',
  md: '12px',
  lg: '14px',
  xl: '16px',
} as const;

export const borderRadius = {
  sm: 3,
  md: 4,
  lg: 6,
  xl: 8,
} as const;

export const fontFamily = 'Inter, system-ui, sans-serif';
