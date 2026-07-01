import { invoke } from '@tauri-apps/api/core';

export enum WorkingState {
  IDLE = 'Idle',
  WORKING = 'Working',
}

export async function updatePresence(state: WorkingState, projectName?: string) {
  try {
    await invoke('set_discord_presence', {
      status: state,
      details: state !== WorkingState.IDLE ? `Working on ${projectName}` : "Idling",
    });
  } catch (error) {
    console.error('Failed to update Discord presence:', error);
  }
}
