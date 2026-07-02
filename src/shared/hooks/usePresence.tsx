import { useSettings } from '@/features/settings/hooks/useSettings';
import { invoke } from '@tauri-apps/api/core';

export enum PresenceState { // Use camelCase
  None = 'none',
  Idle = 'idle',
  Working = 'working',
}

export function usePresence() {
  const { settings } = useSettings();

  const updatePresence = async (state: PresenceState) => {
    if (!settings?.discord_rich_presence && state !== PresenceState.None) { // State None should still work to reset
      console.log(!settings?.discord_rich_presence);
      return;
    }

    try {
      await invoke('set_discord_presence', {
        presenceState: state,
      });
    } catch (error) {
      console.error('Failed to update Discord presence:', error);
    }
  };

  return { updatePresence };
}
