import { cn } from '@shared/lib/utils';
import { Check, ChevronDown } from 'lucide-react';
import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = options[selectedIndex] ?? options[0];

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const minMenuWidth = variant === 'filter' ? 172 : rect.width;
    const width = Math.max(rect.width, minMenuWidth);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const estimatedHeight = Math.min(248, options.length * 38 + 16);

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
  }, [variant, options.length]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      setHighlightedIndex(-1);
      return;
    }

    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [isOpen, selectedIndex]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
        return;
      }

      if (options.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + options.length) % options.length);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setHighlightedIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setHighlightedIndex(options.length - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const target = options[highlightedIndex];
        if (target) {
          onChange(target.value);
          setIsOpen(false);
          triggerRef.current?.focus();
        }
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
  }, [isOpen, options, highlightedIndex, onChange, updatePosition]);

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) return;
    const item = listRef.current?.children[highlightedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, highlightedIndex]);

  const triggerClasses =
    variant === 'filter'
      ? cn(
          'inline-flex h-8.5 min-w-36 items-center justify-between gap-2 rounded-xl border px-3 text-left text-xs font-medium transition-all duration-150 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
          isOpen
            ? 'border-amber-500/60 bg-[#14171F] text-[#F4F5F7] ring-2 ring-amber-500/15'
            : 'border-white/[0.09] bg-[#0E1015] text-[#F4F5F7] hover:border-white/[0.16] hover:bg-[#14171F]',
        )
      : cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-left text-sm transition-all duration-150 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50',
          isOpen
            ? 'border-amber-500/60 bg-[#0E1015] text-[#F4F5F7] ring-2 ring-amber-500/20'
            : 'border-white/[0.09] bg-[#0E1015] text-[#F4F5F7] hover:border-white/[0.16]',
        );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        className={cn(triggerClasses, className)}
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
          className={cn(
            variant === 'filter' ? 'h-3.5 w-3.5' : 'h-4 w-4',
            'shrink-0 text-[#646C7A] transition-transform duration-150',
            isOpen && 'rotate-180 text-[#9CA3B0]',
          )}
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
              ref={listRef}
              role="listbox"
              aria-label={ariaLabel}
              onClick={(e) => e.stopPropagation()}
              style={{
                top: coords.top,
                bottom: coords.bottom,
                left: coords.left,
                width: coords.width,
              }}
              className="surface-elevated animate-popover fixed z-[1201] max-h-60 overflow-y-auto rounded-xl p-1"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:cursor-pointer',
                      isSelected
                        ? 'bg-amber-500/12 font-medium text-[#F4F5F7]'
                        : isHighlighted
                          ? 'bg-white/[0.06] text-[#F4F5F7]'
                          : 'text-[#D0D5DE] hover:bg-white/[0.05]',
                    )}
                  >
                    {option.dotColor && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: option.dotColor }}
                      />
                    )}
                    {option.icon}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
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
