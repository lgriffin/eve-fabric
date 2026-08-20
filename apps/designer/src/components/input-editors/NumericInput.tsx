import { colors } from '../../tokens.js';

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
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
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
        background: colors.surface.base,
        border: `1px solid ${colors.surface.borderLight}`,
        borderRadius: 4,
        color: colors.text.primary,
        fontSize: '11px',
        outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}
