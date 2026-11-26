import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Radio } from 'lucide-react';
import { SolatoLogo } from '@shared/components/SolatoLogo';
import Switch from '@/shared/components/Switch';
import { useToast } from '@shared/context/ToastContext';
import { PresenceState, usePresence } from '@shared/hooks/usePresence.tsx';
import { cn, getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '../hooks/useSettings';

export default function DiscordSettings() {
  const { settings, updateSingleSetting } = useSettings();
  const { updatePresence } = usePresence();
  const toast = useToast();
  const [isToggling, setIsToggling] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!settings) return null;

  const isEnabled = settings.discord_rich_presence;

  const handleToggle = async (nextValue: boolean) => {
    try {
      setIsToggling(true);
      setSaveError(null);
      await updateSingleSetting({ discord_rich_presence: nextValue });

      if (!nextValue) {
        await updatePresence(PresenceState.None, { force: true });
        toast.info('Discord Rich Presence hidden', 'Your activity is no longer shared on Discord.');
      } else {
        const running = await invoke<boolean>('is_timer_running');
        await updatePresence(running ? PresenceState.Working : PresenceState.Idle, {
          force: true,
        });
        toast.success(
          'Discord Rich Presence enabled',
          running
            ? 'Broadcasting your active focus session to Discord.'
            : 'Ready to share your live focus status on Discord.',
        );
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to update Discord Rich Presence.');
      setSaveError(message);
      toast.error('Discord status update failed', message);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="surface-card rounded-2xl p-5 sm:p-6">
      {/* Primary Toggle Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200',
              isEnabled
                ? 'border-sky-400/30 bg-sky-400/12 text-sky-300'
                : 'border-white/[0.08] bg-white/[0.03] text-[#646C7A]',
            )}
          >
            <Radio className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-[#F4F5F7]">
                Discord Rich Presence
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  isEnabled
                    ? 'border-sky-400/25 bg-sky-400/10 text-sky-300'
                    : 'border-white/[0.08] bg-white/[0.03] text-[#646C7A]',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isEnabled ? 'bg-sky-400' : 'bg-[#646C7A]',
                  )}
                />
                {isEnabled ? 'Live' : 'Hidden'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#9CA3B0]">
              Share your active focus or idle state directly on your Discord profile while Solato is
              open.
            </p>
          </div>
        </div>

        <Switch
          isOn={isEnabled}
          setIsOn={(val) => void handleToggle(val)}
          disabled={isToggling}
          ariaLabel="Discord Rich Presence"
        />
      </div>

      {/* Live Discord Rich Presence Preview Card */}
      <div className="mt-5 border-t border-white/[0.06] pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-[#646C7A] uppercase">
            Live Profile Preview
          </span>
          {!isEnabled && (
            <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-medium text-[#9CA3B0]">
              Presence hidden
            </span>
          )}
        </div>

        <div
          className={cn(
            'relative overflow-hidden rounded-xl border bg-[#0B0D12] p-4 transition-all duration-300',
            isEnabled
              ? 'border-white/[0.09] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_12px_28px_-16px_rgba(0,0,0,0.85)]'
              : 'border-white/[0.05] opacity-45 grayscale-[30%]',
          )}
        >
          {/* Subtle ambient glow when enabled */}
          {isEnabled && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-amber-500/[0.07] blur-2xl"
            />
          )}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold tracking-[0.09em] text-[#9CA3B0] uppercase">
              Playing on Discord
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#9CA3B0]">
              <span className="relative flex h-2 w-2">
                {isEnabled && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-65" />
                )}
                <span
                  className={cn(
                    'relative inline-flex h-2 w-2 rounded-full',
                    isEnabled ? 'bg-teal-400' : 'bg-[#646C7A]',
                  )}
                />
              </span>
              <span className="font-mono text-[10px]">{isEnabled ? 'Online' : 'Offline'}</span>
            </span>
          </div>

          <div className="mt-3.5 flex items-center gap-3.5">
            <div className="relative shrink-0">
              <SolatoLogo size={42} isActive={isEnabled} />
              <span
                aria-hidden="true"
                className={cn(
                  'absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-[#0B0D12]',
                  isEnabled ? 'bg-teal-400' : 'bg-[#646C7A]',
                )}
              />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight text-[#F4F5F7]">Solato</p>
              <p className="mt-0.5 truncate text-xs text-[#9CA3B0]">Focusing · Solato Desktop</p>
              <p className="mt-1 font-mono text-[11px] tabular-nums text-amber-400/90">
                24:10 elapsed
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[#646C7A]">
          Requires the Discord desktop app running locally. Status syncs automatically when you
          start, pause, or complete focus sessions.
        </p>
      </div>

      {saveError && (
        <div
          role="alert"
          className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}
