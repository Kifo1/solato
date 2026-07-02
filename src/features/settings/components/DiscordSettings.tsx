import Switch from '@/shared/components/Switch';
import { useSettings } from '../hooks/useSettings';

export default function DiscordSettings() {
  const { settings, isLoading, updateSingleSetting } = useSettings();

  if (isLoading) {
    return <div className="p-10 text-center text-white">Settings loading...</div>;
  }

  if (!settings) return null;

  return (
    <div className="flex w-full items-center justify-center p-4">
      <div className="flex w-full max-w-2xl flex-col divide-y divide-slate-200/10 overflow-hidden rounded-3xl border border-slate-200/10 bg-slate-200/5 p-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium text-white">Discord Rich Presence</span>
            <span className="text-sm text-slate-400">
              Show your current working status in Discord
            </span>
          </div>
          <Switch
            isOn={settings.discord_rich_presence}
            setIsOn={(val) => updateSingleSetting({ discord_rich_presence: val })}
          />
        </div>
      </div>
    </div>
  );
}
