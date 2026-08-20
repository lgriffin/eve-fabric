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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        fontSize: '11px',
        color: '#e0e0e0',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked, e.target.checked ? 'Yes' : 'No')}
        style={{ accentColor: '#7c4dff' }}
      />
      <span>{label ?? (checked ? 'Yes' : 'No')}</span>
    </label>
  );
}
