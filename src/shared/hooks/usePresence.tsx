import { useCallback } from 'react';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { invoke } from '@tauri-apps/api/core';

export enum PresenceState {
  // Use camelCase
  None = 'none',
  Idle = 'idle',
  Working = 'working',
}

export function usePresence() {
  const { settings } = useSettings();

  const updatePresence = useCallback(
    async (state: PresenceState, options?: { force?: boolean }) => {
      if (!options?.force && !settings?.discord_rich_presence && state !== PresenceState.None) {
        // State None should still work to reset
        return;
      }

      try {
        await invoke('set_discord_presence', {
          presenceState: state,
        });
      } catch (error) {
        console.error('Failed to update Discord presence:', error);
      }
    },
    [settings?.discord_rich_presence],
  );

  return { updatePresence };
}
