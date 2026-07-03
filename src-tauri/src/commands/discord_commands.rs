use tauri::{AppHandle};

use crate::services::discord_service;
use crate::services::discord_service::{PresenceState};

#[tauri::command]
pub async fn set_discord_presence(
    app: AppHandle,
    presence_state: PresenceState,
) -> Result<(), String> {
    discord_service::set_discord_presence(&app, presence_state)
        .await
        .map_err(|e| format!("Failed to set Discord presence: {}", e))?;

    Ok(())
}
