import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, Radio } from 'lucide-react';
import Switch from '@/shared/components/Switch';
import { PresenceState, usePresence } from '@shared/hooks/usePresence.tsx';
import { getErrorMessage } from '@shared/lib/utils';
import { useSettings } from '../hooks/useSettings';

export default function DiscordSettings() {
  const { settings, updateSingleSetting } = useSettings();
  const { updatePresence } = usePresence();
  const [isToggling, setIsToggling] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!settings) return null;

  const handleToggle = async (nextValue: boolean) => {
    try {
      setIsToggling(true);
      setSaveError(null);
      await updateSingleSetting({ discord_rich_presence: nextValue });

      if (!nextValue) {
        await updatePresence(PresenceState.None, { force: true });
      } else {
        const running = await invoke<boolean>('is_timer_running');
        await updatePresence(running ? PresenceState.Working : PresenceState.Idle, {
          force: true,
        });
      }
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Failed to update Discord Rich Presence.'));
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="surface-card rounded-2xl p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
            <Radio className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-[#F4F5F7]">Discord Rich Presence</span>
            <p className="mt-0.5 text-xs text-[#9CA3B0]">
              Share your live focus or idle status in your Discord profile.
            </p>
          </div>
        </div>

        <Switch
          isOn={settings.discord_rich_presence}
          setIsOn={handleToggle}
          disabled={isToggling}
          ariaLabel="Discord Rich Presence"
        />
      </div>

      {saveError && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-rose-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}
