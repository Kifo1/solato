use crate::{database::models::settings::AppSettings, models::dbstate::DbState};
use tauri::{AppHandle, Manager};

pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let pool = &app.state::<DbState>().pool;

    let settings = sqlx::query_as!(
        AppSettings,
        "SELECT focus_duration, short_break, long_break, discord_rich_presence FROM settings WHERE id = 1"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(settings)
}

pub async fn update_settings(app: AppHandle, new_settings: AppSettings) -> Result<(), String> {
    let db = app.state::<DbState>();

    sqlx::query!(
        "UPDATE settings SET focus_duration = ?, short_break = ?, long_break = ?, discord_rich_presence = ? WHERE id = 1",
        new_settings.focus_duration,
        new_settings.short_break,
        new_settings.long_break,
        new_settings.discord_rich_presence
    )
    .execute(&db.pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
