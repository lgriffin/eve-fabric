import { colors } from '../../tokens.js';

interface BooleanToggleProps {
  value: unknown;
  label?: string;
  onChange: (value: boolean, displayLabel: string) => void;
}

export function BooleanToggle({ value, label, onChange }: BooleanToggleProps) {
  const checked = value === true;
  return (
    <label
      className="boolean-toggle nopan nodrag"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        fontSize: '11px',
        color: colors.text.primary,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked, e.target.checked ? 'Yes' : 'No')}
        style={{ accentColor: colors.accent }}
      />
      <span>{label ?? (checked ? 'Yes' : 'No')}</span>
    </label>
  );
}
