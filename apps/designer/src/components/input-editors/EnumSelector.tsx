interface EnumSelectorProps {
  options: Array<{ value: string; label: string }>;
  value: unknown;
  onChange: (value: string, displayLabel: string) => void;
}

export function EnumSelector({ options, value, onChange }: EnumSelectorProps) {
  return (
    <div
      className="enum-selector nopan nodrag"
      style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
    >
      {options.map((option) => (
        <label
          key={option.value}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            cursor: 'pointer',
            fontSize: '11px',
            color: value === option.value ? '#e0e0e0' : '#888',
          }}
        >
          <input
            type="radio"
            name={`enum-${options.map((o) => o.value).join('-')}`}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value, option.label)}
            style={{ accentColor: '#7c4dff' }}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}
