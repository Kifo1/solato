use crate::database::models::folder::Folder;
use crate::{models::dbstate::DbState, services::folder_service};
use tauri::State;

#[tauri::command]
pub async fn create_folder(
    name: String,
    color: String,
    parent_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<String, String> {
    folder_service::create_folder(name, color, parent_id, db).await
}

#[tauri::command]
pub async fn update_folder(
    id: String,
    name: String,
    color: String,
    parent_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    folder_service::update_folder(id, name, color, parent_id, db).await
}

#[tauri::command]
pub async fn get_folders(db: State<'_, DbState>) -> Result<Vec<Folder>, String> {
    folder_service::get_folders(db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_folder(id: String, db: State<'_, DbState>) -> Result<(), String> {
    folder_service::delete_folder(id, db).await
}
