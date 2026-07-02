use chrono::Utc;
use discord_rich_presence::{
    activity::{self, Timestamps},
    DiscordIpc, DiscordIpcClient,
};
use serde::Deserialize;
use std::sync::Mutex;
use tauri::State;

use crate::{
    database::models::session::SessionType,
    models::timer::{ActiveMode, TimerState},
};

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum PresenceState {
    Idle,
    Working,
}

#[tauri::command]
pub async fn set_discord_presence(
    state: State<'_, DiscordState>,
    timer: State<'_, TimerState>,
    presence_state: PresenceState,
) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|_| "Mutex lock failed")?;

    if client_lock.is_none() {
        let mut client = DiscordIpcClient::new("1521951733704687768");

        client
            .connect()
            .map_err(|e| format!("Error while connecting to Discord: {}", e))?;
        *client_lock = Some(client);
    }

    let (details, status) = match presence_state {
        PresenceState::Idle => ("Looking for motivation".to_string(), "Idle".to_string()),
        PresenceState::Working => {
            let project_name = timer
                .selected_project
                .as_ref()
                .map(|p| p.name.clone())
                .unwrap_or_else(|| "No Project".to_string());

            let mode_text = match timer.active_mode {
                ActiveMode::Stopwatch => "Stopwatch",
                ActiveMode::Pomodoro => "Pomodoro",
            };

            (
                format!("Working on {}", project_name),
                format!("Mode: {}", mode_text),
            )
        }
    };

    let mut timestamps = Timestamps::new();
    if timer.is_running {
        match timer.active_mode {
            ActiveMode::Stopwatch => {
                let elapsed_secs = (timer.stopwatch.elapsed_millis / 1000) as i64;
                let start_unix = Utc::now().timestamp() - elapsed_secs;

                timestamps = timestamps.start(start_unix);
            }
            ActiveMode::Pomodoro => {
                let elapsed_secs = (timer.pomodoro.elapsed_millis / 1000) as i64;
                let start_unix = Utc::now().timestamp() - elapsed_secs;

                let phase_minutes = match SessionType::from(timer.pomodoro.phase) {
                    SessionType::Focus => timer.pomodoro.focus_minutes,
                    SessionType::ShortBreak => timer.pomodoro.short_break_minutes,
                    SessionType::LongBreak => timer.pomodoro.long_break_minutes,
                };

                let end_unix = start_unix + (phase_minutes * 60);

                timestamps = timestamps.start(start_unix).end(end_unix);
            }
        }
    }

    if let Some(ref mut client) = *client_lock {
        let payload = activity::Activity::new()
            .state(&status)
            .details(&details)
            .timestamps(timestamps)
            .assets(
                activity::Assets::new()
                    //.large_image("/") //TODO Add image
                    .large_text("Solato"),
            );

        client
            .set_activity(payload)
            .map_err(|e| format!("Failed to set presence: {}", e))?;
    }

    Ok(())
}
