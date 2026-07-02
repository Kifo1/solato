use crate::{database::models::settings::AppSettings, models::dbstate::DbState};

pub async fn get_settings(db: &DbState) -> Result<AppSettings, String> {
    let pool = &db.pool;

    let settings = sqlx::query_as!(
        AppSettings,
        "SELECT focus_duration, short_break, long_break, discord_rich_presence FROM settings WHERE id = 1"
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(settings)
}

pub async fn update_settings(db: &DbState, new_settings: AppSettings) -> Result<(), String> {
    let pool = &db.pool;

    sqlx::query!(
        "UPDATE settings SET focus_duration = ?, short_break = ?, long_break = ?, discord_rich_presence = ? WHERE id = 1",
        new_settings.focus_duration,
        new_settings.short_break,
        new_settings.long_break,
        new_settings.discord_rich_presence
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
