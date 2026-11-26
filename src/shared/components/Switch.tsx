import { cn } from '@shared/lib/utils';

interface ToggleSwitchProps {
  isOn: boolean;
  setIsOn: (val: boolean) => void;
  scale?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

const TRACK_SIZES = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
  lg: 'h-7 w-13',
} as const;

const KNOB_SIZES = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4.5 w-4.5',
  lg: 'h-5.5 w-5.5',
} as const;

const KNOB_TRANSLATE = {
  sm: 'translate-x-4',
  md: 'translate-x-5',
  lg: 'translate-x-6',
} as const;

export default function Switch({
  isOn,
  setIsOn,
  scale = 'md',
  disabled = false,
  ariaLabel,
  className,
}: Readonly<ToggleSwitchProps>) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOn}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => setIsOn(!isOn)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border p-[2px] transition-all duration-200 focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#14171D] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45',
        TRACK_SIZES[scale],
        isOn
          ? 'border-amber-400/50 bg-amber-500 shadow-[0_0_16px_-4px_rgba(245,158,11,0.65)]'
          : 'border-white/[0.10] bg-[#1F242E] hover:border-white/[0.16]',
        className,
      )}
    >
      <span
        className={cn(
          'pointer-events-none block rounded-full shadow-sm transition-transform duration-200 ease-out',
          KNOB_SIZES[scale],
          isOn ? cn(KNOB_TRANSLATE[scale], 'bg-[#0A0B0E]') : 'translate-x-0 bg-[#D0D5DE]',
        )}
      />
    </button>
  );
}
