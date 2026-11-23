import { Check, ChevronDown } from 'lucide-react';
import { ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
  dotColor?: string;
  icon?: ReactNode;
}

interface CustomSelectProps<T extends string> {
  options: SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'filter' | 'form';
  ariaLabel?: string;
  className?: string;
}

interface MenuCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function CustomSelect<T extends string>({
  options,
  value,
  onChange,
  variant = 'form',
  ariaLabel,
  className = '',
}: Readonly<CustomSelectProps<T>>) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) ?? options[0];

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minMenuWidth = variant === 'filter' ? 168 : rect.width;
    const width = Math.max(rect.width, minMenuWidth);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(220, options.length * 36 + 16);

    if (spaceBelow < estimatedHeight && rect.top > spaceBelow) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
      });
    }
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, variant, options.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        setIsOpen(false);
      }
    };

    const handleResizeOrScroll = () => updatePosition();

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleResizeOrScroll);
    window.addEventListener('scroll', handleResizeOrScroll, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleResizeOrScroll);
      window.removeEventListener('scroll', handleResizeOrScroll, true);
    };
  }, [isOpen]);

  const triggerClasses =
    variant === 'filter'
      ? `inline-flex min-w-34 items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-left text-xs font-medium transition-all hover:cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-slate-800 text-white ring-2 ring-blue-500/20'
            : 'border-slate-700 bg-slate-900 text-white hover:border-blue-400/70 hover:bg-slate-800/80'
        }`
      : `flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all hover:cursor-pointer ${
          isOpen
            ? 'border-blue-500 bg-slate-900 text-white ring-2 ring-blue-500/25'
            : 'border-slate-600 bg-slate-900 text-white hover:border-blue-400/80'
        }`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={`${triggerClasses} ${className}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          {selectedOption?.dotColor && (
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selectedOption.dotColor }}
            />
          )}
          {selectedOption?.icon}
          <span className="truncate">{selectedOption?.label}</span>
        </span>
        <ChevronDown
          className={`${variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4'} shrink-0 text-slate-300 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen &&
        coords &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[1200]"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="fixed z-[1201] overflow-hidden rounded-xl border border-slate-600/80 bg-slate-800/95 py-1 shadow-2xl shadow-black/50 backdrop-blur-md"
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:cursor-pointer hover:bg-slate-700/60 ${
                      isSelected ? 'bg-blue-500/15 font-medium text-white' : 'text-slate-200'
                    }`}
                  >
                    {option.dotColor && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option.dotColor }}
                      />
                    )}
                    {option.icon}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-blue-400" />}
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
