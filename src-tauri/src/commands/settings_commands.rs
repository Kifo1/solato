use tauri::{AppHandle};

use crate::{
    database::models::settings::AppSettings,
};

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    let settings = crate::services::settings_service::get_settings(app)
        .await
        .expect("Unable to get settings");
    Ok(settings)
}

#[tauri::command]
pub async fn update_settings(
    app: AppHandle,
    new_settings: AppSettings,
) -> Result<(), String> {
    crate::services::settings_service::update_settings(app.clone(), new_settings)
        .await
        .map_err(|e| e.to_string())?;
    
    crate::services::timer_service::sync_timer_with_settings(app.clone())
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
