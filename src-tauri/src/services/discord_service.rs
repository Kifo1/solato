use crate::database::models::session::SessionType;
use crate::log;
use crate::models::timer::{ActiveMode, SharedTimerState};
use crate::services::settings_service::get_settings;
use chrono::Utc;
use discord_rich_presence::activity::Timestamps;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::Deserialize;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex;

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>,
}

#[derive(Deserialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum PresenceState {
    None,
    Idle,
    Working,
}

pub async fn set_discord_presence(
    app: AppHandle,
    presence_state: PresenceState,
) -> Result<(), String> {
    let dc = app.state::<DiscordState>();
    let timer = app.state::<SharedTimerState>();
    let settings = get_settings(app.clone())
        .await
        .map_err(|e| format!("Failed to get settings: {}", e))?;

    if presence_state == PresenceState::None || !settings.discord_rich_presence {
        let mut client_lock = dc.client.lock().await;
        if let Some(ref mut client) = *client_lock {
            let _ = client.clear_activity();
        }
        return Ok(());
    }

    let (details, status, timestamps) = {
        let timer_state = timer.lock().unwrap();

        let (details, status) = match presence_state {
            PresenceState::Idle => ("Looking for motivation".to_string(), "Idle".to_string()),
            PresenceState::Working => {
                let project_name = timer_state
                    .selected_project
                    .as_ref()
                    .map(|p| p.name.clone())
                    .unwrap_or_else(|| "No Project".to_string());

                let mode_text = match timer_state.active_mode {
                    ActiveMode::Stopwatch => "Stopwatch",
                    ActiveMode::Pomodoro => match SessionType::from(timer_state.pomodoro.phase) {
                        SessionType::Focus => "Pomodoro (Focus)",
                        SessionType::ShortBreak => "Pomodoro (Short Break)",
                        SessionType::LongBreak => "Pomodoro (Long Break)",
                    },
                };

                (
                    format!("Working on {}", project_name),
                    format!("Mode: {}", mode_text),
                )
            }
            PresenceState::None => ("".to_string(), "".to_string()),
        };

        let mut timestamps = Timestamps::new();
        if timer_state.is_running {
            match timer_state.active_mode {
                ActiveMode::Stopwatch => {
                    let elapsed_secs = (timer_state.stopwatch.elapsed_millis / 1000) as i64;
                    let start_unix = Utc::now().timestamp() - elapsed_secs;
                    timestamps = timestamps.start(start_unix);
                }
                ActiveMode::Pomodoro => {
                    let elapsed_secs = (timer_state.pomodoro.elapsed_millis / 1000) as i64;
                    let start_unix = Utc::now().timestamp() - elapsed_secs;

                    let phase_minutes = match SessionType::from(timer_state.pomodoro.phase) {
                        SessionType::Focus => timer_state.pomodoro.focus_minutes,
                        SessionType::ShortBreak => timer_state.pomodoro.short_break_minutes,
                        SessionType::LongBreak => timer_state.pomodoro.long_break_minutes,
                    };

                    let end_unix = start_unix + (phase_minutes * 60);
                    timestamps = timestamps.start(start_unix).end(end_unix);
                }
            }
        }

        (details, status, timestamps)
    };

    let mut client_lock = dc.client.lock().await;

    if client_lock.is_none() {
        let mut client = DiscordIpcClient::new("1521951733704687768");

        match client.connect() {
            Ok(_) => {
                *client_lock = Some(client);
            }
            Err(_) => {
                log!("ERROR", "Discord IPC socket not available");
                return Ok(());
            }
        }
    }

    if let Some(ref mut client) = *client_lock {
        let payload = activity::Activity::new()
            .state(&status)
            .details(&details)
            .timestamps(timestamps)
            .assets(activity::Assets::new().large_text("Solato"));

        if client.set_activity(payload).is_err() {
            log!("ERROR", "Lost connection to Discord. Resetting client...");
            *client_lock = None;
        }
    }

    Ok(())
}
