import type { CSSProperties, ReactNode } from 'react';

/** Shared track, thumb, labels and keyboard behavior for every analysis parameter. */
export function RangeControl({
  label,
  ariaLabel = label,
  value,
  min,
  max,
  step,
  onChange,
  valueLabel,
  disabled = false,
  valueText,
}: {
  label: string;
  ariaLabel?: string;
  value: number;
  min: number;
  max: number;
  step: number | 'any';
  onChange: (value: number) => void;
  valueLabel?: ReactNode;
  disabled?: boolean;
  valueText?: string;
}) {
  const progress = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
  return (
    <div className="range-control">
      <div className="range-heading">
        <span>{label}</span>
        {valueLabel}
      </div>
      <input
        className="parameter-range"
        type="range"
        aria-label={ariaLabel}
        aria-valuetext={valueText}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ '--range-progress': `${progress}%` } as CSSProperties}
      />
    </div>
  );
}
