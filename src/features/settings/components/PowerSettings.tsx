import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, HelpCircle, Zap } from 'lucide-react';
import Switch from '@/shared/components/Switch';
import { getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '../hooks/useSettings';

interface PopoverCoords {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

const POPOVER_WIDTH = 304;

export default function PowerSettings() {
  const { settings, updateSingleSetting } = useSettings();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePopoverPosition = () => {
    const btn = infoButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const clampedLeft = Math.min(
      Math.max(12, centerX - POPOVER_WIDTH / 2),
      Math.max(12, window.innerWidth - POPOVER_WIDTH - 12),
    );
    const showAbove = rect.top > 190;
    setCoords({
      top: showAbove ? rect.top - 10 : rect.bottom + 10,
      left: clampedLeft,
      placement: showAbove ? 'above' : 'below',
    });
  };

  useLayoutEffect(() => {
    if (!isInfoOpen) return;
    updatePopoverPosition();
  }, [isInfoOpen]);

  useEffect(() => {
    if (!isInfoOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsInfoOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        infoButtonRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setIsInfoOpen(false);
    };

    const handleReposition = () => updatePopoverPosition();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isInfoOpen]);

  if (!settings) return null;

  const handleToggle = async (nextValue: boolean) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateSingleSetting({ keep_awake_pomodoro: nextValue });
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to update power preference.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400">
            <Zap className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-[#F4F5F7]">
                Keep system awake during Pomodoro
              </span>
              <button
                ref={infoButtonRef}
                type="button"
                aria-label="More information about keeping system awake during Pomodoro"
                aria-expanded={isInfoOpen}
                onClick={() => setIsInfoOpen((prev) => !prev)}
                className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-[#646C7A] transition-colors hover:bg-white/[0.06] hover:text-[#F4F5F7] focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-xs text-[#9CA3B0]">
              Allow break sounds, notifications, and display wake-up when phases finish.
            </p>
          </div>
        </div>

        <Switch
          isOn={settings.keep_awake_pomodoro}
          setIsOn={handleToggle}
          disabled={isSaving}
          ariaLabel="Keep system awake during Pomodoro"
        />
      </div>

      {saveError && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {isInfoOpen &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="Keep system awake details"
            style={{
              top: coords.top,
              left: coords.left,
              width: POPOVER_WIDTH,
              transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
            }}
            className="surface-elevated animate-popover fixed z-[1200] rounded-xl p-3.5 text-left text-xs leading-relaxed text-[#9CA3B0]"
          >
            <p className="font-medium text-[#F4F5F7]">How idle sleep prevention works</p>
            <p className="mt-1.5">
              Prevents your Mac or PC from entering idle sleep while a Pomodoro timer is running,
              while still allowing the display to turn off. When a phase ends, Solato plays the
              sound, wakes the display, and sends a notification.
            </p>
            <p className="mt-1.5 text-[#646C7A]">
              Closing your laptop lid or manually sleeping your device still pauses the OS and asks
              how to handle the sleep time when you return.
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}
