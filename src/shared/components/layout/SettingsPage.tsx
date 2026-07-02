import DiscordSettings from '@/features/settings/components/DiscordSettings';
import PhaseDurationSliders from '@/features/settings/components/PhaseDurationSliders';

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-5xl font-bold text-white">Settings</h1>
      <p className="mb-15 pt-3 text-blue-200">
        Manage your settings and personalize your experience.
      </p>
      <div className="flex flex-col gap-5">
        <PhaseDurationSliders></PhaseDurationSliders>
        <DiscordSettings></DiscordSettings>
      </div>
    </div>
  );
}
