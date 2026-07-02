import { invoke } from '@tauri-apps/api/core';

// Values have to match lowercase/camelCase
export enum PresenceState {
  Idle = 'idle',
  Working = 'working',
}

export async function updatePresence(state: PresenceState) {
  try {
    await invoke('set_discord_presence', {
      presenceState: state,
    });
  } catch (error) {
    console.error('Failed to update Discord presence:', error);
  }
}
