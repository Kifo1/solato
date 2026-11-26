import { HelpCircle } from 'lucide-react';
import Switch from '@/shared/components/Switch';
import { useSettings } from '../hooks/useSettings';

export default function PowerSettings() {
  const { settings, isLoading, updateSingleSetting } = useSettings();

  if (isLoading || !settings) return null;

  return (
    <div className="flex w-full items-center justify-center p-4">
      <div className="flex w-full max-w-2xl flex-col divide-y divide-slate-200/10 rounded-3xl border border-slate-200/10 bg-slate-200/5 p-6">
        <div className="flex items-center justify-between gap-4 py-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white">Keep system awake during Pomodoro</span>
              <span className="group relative inline-flex items-center">
                <button
                  type="button"
                  aria-label="More information about Keep system awake during Pomodoro"
                  className="text-slate-400 transition-colors hover:text-blue-300 focus:text-blue-300 focus:outline-none"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-72 -translate-x-1/2 rounded-xl border border-blue-300/30 bg-slate-900/95 p-3 text-left text-xs leading-relaxed text-slate-200 opacity-0 shadow-xl transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                >
                  Prevents your Mac or PC from entering idle sleep while a Pomodoro timer is
                  running, while still allowing the display to turn off. When a phase ends, Solato
                  plays the sound, wakes the display, and sends a notification. Closing your laptop
                  lid or manually sleeping your device will still pause the OS and ask how to handle
                  the sleep time when you return.
                </span>
              </span>
            </div>
            <span className="text-sm text-slate-400">
              Allow break sounds, notifications, and display wake-up when phases finish
            </span>
          </div>
          <Switch
            isOn={settings.keep_awake_pomodoro}
            setIsOn={async (val) => await updateSingleSetting({ keep_awake_pomodoro: val })}
          />
        </div>
      </div>
    </div>
  );
}
