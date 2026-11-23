export type SessionType = 'FOCUS' | 'SHORT_BREAK' | 'LONG_BREAK';
export type TimerMode = 'STOPWATCH' | 'POMODORO';

export interface SessionEntry {
  id: string;
  project_id: string;
  project_name: string;
  project_color: string;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  session_type: SessionType;
  mode: TimerMode;
}

export interface UpdateSessionInput {
  id: string;
  project_id: string;
  start_time: string;
  end_time: string;
  session_type: SessionType;
  mode: TimerMode;
}

export interface SessionSyncEvent {
  status: 'syncing' | 'synced' | 'local_only' | 'error';
  message?: string | null;
}
