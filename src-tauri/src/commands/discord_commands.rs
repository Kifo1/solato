use std::sync::Mutex;
use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use tauri::State;

pub struct DiscordState {
    pub client: Mutex<Option<DiscordIpcClient>>
}

#[tauri::command]
pub async fn set_discord_presence(state: State<'_, DiscordState>, status: String, details: String) -> Result<(), String> {
    let mut client_lock = state.client.lock().map_err(|_| "Mutex lock failed")?;

    if client_lock.is_none() {
        let mut client = DiscordIpcClient::new("1521951733704687768");

        client.connect().map_err(|e| format!("Verbindung zu Discord fehlgeschlagen: {}", e))?;
        *client_lock = Some(client);
    }

    if let Some(ref mut client) = *client_lock {
        let payload = activity::Activity::new()
            .state(&status)
            .details(&details)
            .assets(
                activity::Assets::new()
                    //.large_image("/") //TODO Add image
                    .large_text("Solato"),
            );

        client.set_activity(payload)
            .map_err(|e| format!("Failed to set presence: {}", e))?;
    }

    Ok(())
}
