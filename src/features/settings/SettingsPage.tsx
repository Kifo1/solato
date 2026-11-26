import { AlertCircle } from 'lucide-react';
import DiscordSettings from '@features/settings/components/DiscordSettings.tsx';
import PhaseDurationSliders from '@features/settings/components/PhaseDurationSliders.tsx';
import PowerSettings from '@features/settings/components/PowerSettings.tsx';
import { useSettings } from '@features/settings/hooks/useSettings.ts';
import { Skeleton } from '@shared/components/Skeleton.tsx';
import { getErrorMessage } from '@shared/lib/utils.ts';

function SettingsLoadingSkeleton() {
  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <Skeleton className="h-3.5 w-36" />
        <div className="surface-card divide-y divide-white/[0.06] rounded-2xl">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-4 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <Skeleton className="h-10 w-10 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
                <Skeleton className="h-6 w-16 rounded-lg" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-28" />
        <div className="surface-card flex items-center justify-between gap-4 rounded-2xl p-5">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-52" />
              <Skeleton className="h-3 w-72" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-3.5 w-24" />
        <div className="surface-card flex items-center justify-between gap-4 rounded-2xl p-5">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
          <Skeleton className="h-6 w-11 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { isLoading, error } = useSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-7 sm:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#F4F5F7] sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-[#9CA3B0]">
          Personalize your focus rhythm, power behavior, and integrations.
        </p>
      </header>

      {isLoading ? (
        <SettingsLoadingSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3.5 text-sm text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <p className="font-medium text-rose-200">Unable to load settings</p>
            <p className="mt-0.5 text-xs text-rose-300/80">
              {getErrorMessage(error, 'Failed to read your local preferences.')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          <section aria-labelledby="settings-pomodoro-heading" className="space-y-3">
            <h2
              id="settings-pomodoro-heading"
              className="px-1 text-xs font-semibold tracking-wider text-[#646C7A] uppercase"
            >
              Pomodoro Intervals
            </h2>
            <PhaseDurationSliders />
          </section>

          <section aria-labelledby="settings-power-heading" className="space-y-3">
            <h2
              id="settings-power-heading"
              className="px-1 text-xs font-semibold tracking-wider text-[#646C7A] uppercase"
            >
              System &amp; Power
            </h2>
            <PowerSettings />
          </section>

          <section aria-labelledby="settings-integrations-heading" className="space-y-3">
            <h2
              id="settings-integrations-heading"
              className="px-1 text-xs font-semibold tracking-wider text-[#646C7A] uppercase"
            >
              Integrations
            </h2>
            <DiscordSettings />
          </section>
        </div>
      )}
    </div>
  );
}
