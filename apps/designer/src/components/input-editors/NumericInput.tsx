interface NumericInputProps {
  value: unknown;
  onChange: (value: number, displayLabel: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumericInput({ value, onChange, min, max, step, placeholder }: NumericInputProps) {
  return (
    <input
      type="number"
      className="numeric-input nopan nodrag"
      value={value != null ? String(value) : ''}
      onChange={(e) => {
        const num = Number(e.target.value);
        if (!Number.isNaN(num)) {
          onChange(num, String(num));
        }
      }}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder ?? 'Enter a number...'}
      style={{
        width: '100%',
        padding: '4px 8px',
        background: '#13131d',
        border: '1px solid #444',
        borderRadius: 4,
        color: '#e0e0e0',
        fontSize: '11px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}
