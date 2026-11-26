import { useRef, useState, useCallback } from 'react';
import { cn } from '@shared/lib/utils';

export interface SliderMark {
  value: number;
  label: string;
}

interface CustomSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  marks?: SliderMark[];
  onChange?: (value: number) => void;
  onChangeCommitted?: (value: number) => void;
  valueLabelFormat?: (value: number) => string;
  accentColor?: 'amber' | 'teal' | 'sky';
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const ACCENT_STYLES = {
  amber: {
    fill: 'bg-amber-500',
    thumbBorder: 'border-amber-400',
    ring: 'focus-visible:ring-amber-400/40',
    tooltip: 'bg-amber-500 text-on-accent',
  },
  teal: {
    fill: 'bg-teal-400',
    thumbBorder: 'border-teal-400',
    ring: 'focus-visible:ring-teal-400/40',
    tooltip: 'bg-teal-400 text-on-accent',
  },
  sky: {
    fill: 'bg-sky-400',
    thumbBorder: 'border-sky-400',
    ring: 'focus-visible:ring-sky-400/40',
    tooltip: 'bg-sky-400 text-on-accent',
  },
} as const;

export function CustomSlider({
  value,
  min,
  max,
  step,
  marks,
  onChange,
  onChangeCommitted,
  valueLabelFormat,
  accentColor = 'amber',
  disabled = false,
  ariaLabel,
  className,
}: Readonly<CustomSliderProps>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const range = max - min;
  const percentage = range > 0 ? Math.min(100, Math.max(0, ((value - min) / range) * 100)) : 0;
  const accent = ACCENT_STYLES[accentColor];

  const clampToStep = useCallback(
    (raw: number) => {
      const stepped = Math.round((raw - min) / step) * step + min;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step],
  );

  const valueFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current || range <= 0) return value;
      const rect = trackRef.current.getBoundingClientRect();
      if (rect.width <= 0) return value;
      const ratio = (clientX - rect.left) / rect.width;
      return clampToStep(min + ratio * range);
    },
    [min, range, clampToStep, value],
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const nextVal = valueFromClientX(e.clientX);
    onChange?.(nextVal);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    onChange?.(valueFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onChangeCommitted?.(valueFromClientX(e.clientX));
  };

  const handlePointerCancel = () => {
    if (!isDragging) return;
    setIsDragging(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    let next = value;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, value + step);
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(min, value - step);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    else return;
    e.preventDefault();
    onChange?.(next);
    onChangeCommitted?.(next);
  };

  const showLabel = isDragging || isHovering;
  const thumbScale = isDragging ? 1.2 : isHovering ? 1.1 : 1;

  return (
    <div className={cn('px-1 pt-3', marks && marks.length > 0 ? 'pb-7' : 'pb-3', className)}>
      <div
        ref={trackRef}
        className={cn(
          'relative flex h-5 w-full touch-none items-center select-none',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Background track */}
        <div className="absolute h-1.5 w-full rounded-full bg-tint-strong" />

        {/* Active fill track */}
        <div
          className={cn('absolute h-1.5 rounded-full transition-[width] duration-75 ease-out', accent.fill)}
          style={{ width: `${percentage}%` }}
        />

        {/* Marks */}
        {marks?.map((mark) => {
          const markPercentage = range > 0 ? ((mark.value - min) / range) * 100 : 0;
          const isReached = mark.value <= value;
          return (
            <div
              key={mark.value}
              className="pointer-events-none absolute top-1/2 flex flex-col items-center"
              style={{ left: `${markPercentage}%`, transform: 'translateX(-50%)' }}
            >
              <span
                className={cn(
                  'mt-4 font-mono text-[11px] tabular-nums transition-colors',
                  isReached ? 'text-fg-secondary' : 'text-fg-muted',
                )}
              >
                {mark.label}
              </span>
            </div>
          );
        })}

        {/* Thumb */}
        <div
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-disabled={disabled}
          onKeyDown={handleKeyDown}
          className={cn(
            'absolute top-1/2 h-4.5 w-4.5 rounded-full border-2 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-transform duration-100 ease-out focus-visible:ring-4 focus-visible:outline-none',
            accent.thumbBorder,
            accent.ring,
          )}
          style={{
            left: `${percentage}%`,
            transform: `translate(-50%, -50%) scale(${thumbScale})`,
          }}
        >
          {showLabel && (
            <div
              className={cn(
                'pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-lg px-2 py-0.5 font-mono text-[11px] font-semibold whitespace-nowrap tabular-nums shadow-lg',
                accent.tooltip,
              )}
            >
              {valueLabelFormat ? valueLabelFormat(value) : value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
