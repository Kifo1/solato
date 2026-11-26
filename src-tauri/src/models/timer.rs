use crate::database::models::project::Project;
use crate::services::settings_service;

use super::{pomodoro::PomodoroState, stopwatch::StopwatchState};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum ActiveMode {
    Stopwatch,
    Pomodoro,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SleepRecoveryInfo {
    pub slept_at: DateTime<Utc>,
    pub woke_at: DateTime<Utc>,
    pub sleep_duration_seconds: i64,
    pub elapsed_at_sleep_millis: u64,
    pub mode: String,
    pub phase_ended_during_sleep: bool,
    pub scheduled_phase_end: Option<DateTime<Utc>>,
    pub pomodoro_phase: Option<u8>,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SleepRecoveryAction {
    EndAtSleep,
    KeepFullTime,
}

pub struct TimerState {
    pub active_mode: ActiveMode,
    pub is_running: bool,
    pub selected_project: Option<Project>,
    pub current_session_id: Option<String>,
    pub keep_awake_pomodoro: bool,
    pub pending_sleep_recovery: Option<SleepRecoveryInfo>,
    pub timer_run_id: u64,

    pub stopwatch: StopwatchState,
    pub pomodoro: PomodoroState,
}

impl TimerState {
    pub async fn new(app: AppHandle) -> Self {
        let keep_awake_pomodoro = settings_service::get_settings(app.clone())
            .await
            .map(|s| s.keep_awake_pomodoro)
            .unwrap_or(true);

        Self {
            active_mode: ActiveMode::Stopwatch,
            is_running: false,
            selected_project: None,
            current_session_id: None,
            keep_awake_pomodoro,
            pending_sleep_recovery: None,
            timer_run_id: 0,
            stopwatch: StopwatchState::new(),
            pomodoro: PomodoroState::new(app).await,
        }
    }

    pub fn should_keep_awake(&self) -> bool {
        self.is_running
            && self.active_mode == ActiveMode::Pomodoro
            && self.keep_awake_pomodoro
            && self.pending_sleep_recovery.is_none()
    }
}

pub type SharedTimerState = Arc<Mutex<TimerState>>;
