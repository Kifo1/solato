import { useState } from 'react';
import { AlertCircle, Bell, ShieldCheck, Volume2, Zap } from 'lucide-react';
import Switch from '@/shared/components/Switch';
import { useToast } from '@shared/context/ToastContext';
import { cn, getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '../hooks/useSettings';

const RELIABILITY_BENEFITS = [
  {
    id: 'chimes',
    title: 'Phase Chimes',
    description: 'Break and focus transition sounds fire right on schedule without OS suspension.',
    Icon: Volume2,
  },
  {
    id: 'notifications',
    title: 'Desktop Notifications',
    description: 'System alerts and display wake-up trigger reliably as soon as a phase finishes.',
    Icon: Bell,
  },
  {
    id: 'accuracy',
    title: 'Session Accuracy',
    description: 'Keeps long Pomodoro blocks intact while still allowing your screen to dim naturally.',
    Icon: ShieldCheck,
  },
] as const;

export default function PowerSettings() {
  const { settings, updateSingleSetting } = useSettings();
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!settings) return null;

  const isEnabled = settings.keep_awake_pomodoro;

  const handleToggle = async (nextValue: boolean) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      await updateSingleSetting({ keep_awake_pomodoro: nextValue });
      if (nextValue) {
        toast.success(
          'System keep-awake enabled',
          'Idle sleep will be prevented during active Pomodoro intervals.',
        );
      } else {
        toast.info(
          'System keep-awake disabled',
          'Your device will follow its standard OS power schedule.',
        );
      }
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to update power preference.');
      setSaveError(message);
      toast.error('Power preference not saved', message);
    } finally {
      setIsSaving(false);
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
                ? 'border-amber-500/30 bg-amber-500/12 text-amber-400'
                : 'border-line bg-tint-subtle text-fg-muted',
            )}
          >
            <Zap className="h-4.5 w-4.5" />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight text-fg">
                Keep system awake during Pomodoro
              </h3>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  isEnabled
                    ? 'border-teal-400/25 bg-teal-400/10 text-teal-300'
                    : 'border-line bg-tint-subtle text-fg-muted',
                )}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isEnabled ? 'bg-teal-400' : 'bg-fg-muted',
                  )}
                />
                {isEnabled ? 'Protected' : 'Inactive'}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
              Prevents idle OS sleep while a Pomodoro timer is running, keeping audio cues and
              interval handoffs dependable.
            </p>
          </div>
        </div>

        <Switch
          isOn={isEnabled}
          setIsOn={(val) => void handleToggle(val)}
          disabled={isSaving}
          ariaLabel="Keep system awake during Pomodoro"
        />
      </div>

      {/* Inline 3-Item Reliability Grid */}
      <div className="mt-5 border-t border-line-subtle pt-5">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-fg-muted uppercase">
          What stays reliable while active
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RELIABILITY_BENEFITS.map(({ id, title, description, Icon }) => (
            <div
              key={id}
              className={cn(
                'surface-well flex flex-col gap-2 rounded-xl p-3.5 transition-opacity duration-200',
                isEnabled ? 'opacity-100' : 'opacity-60',
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg border transition-colors',
                    isEnabled
                      ? 'border-teal-400/25 bg-teal-400/10 text-teal-300'
                      : 'border-line-subtle bg-tint-subtle text-fg-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-fg">{title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-fg-secondary">{description}</p>
            </div>
          ))}
        </div>

        <p className="mt-3.5 text-[11px] leading-relaxed text-fg-muted">
          Manually sleeping your computer or closing the laptop lid still pauses the OS and opens
          Solato&apos;s sleep recovery prompt when you return.
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
