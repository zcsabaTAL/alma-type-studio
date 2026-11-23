import React, { useId } from 'react';

interface RangeSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
}

export const RangeSlider: React.FC<RangeSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  formatValue,
  onChange,
}) => {
  const id = useId();
  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`;

  // Sync --attr-min, --attr-max, and --control-value in JS as Safari fallback for typed attr()
  const sliderStyle = {
    '--attr-min': String(min),
    '--attr-max': String(max),
    '--control-value': String(value),
  } as React.CSSProperties;

  return (
    <div className="slider-row">
      <div className="slider-header">
        <label htmlFor={id} className="slider-label">
          {label}
        </label>
        <output htmlFor={id} className="slider-value">
          {displayValue}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="studio-range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={displayValue}
        style={sliderStyle}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};
