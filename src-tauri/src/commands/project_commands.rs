use crate::database::models::project::Project;
use crate::services::project_service::TimerProjectsResponse;
use crate::{models::dbstate::DbState, services::project_service};
use tauri::State;

#[tauri::command]
pub async fn create_project(
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    project_service::create_project(name, description, color, folder_id, db).await?;
    Ok(())
}

#[tauri::command]
pub async fn update_project(
    uuid: String,
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    project_service::update_project(uuid, name, description, color, folder_id, db).await
}

#[tauri::command]
pub async fn update_project_folder(
    project_id: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    project_service::update_project_folder(project_id, folder_id, db).await
}

#[tauri::command]
pub async fn get_projects(db: State<'_, DbState>) -> Result<Vec<Project>, String> {
    project_service::get_projects(db)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_timer_projects(db: State<'_, DbState>) -> Result<TimerProjectsResponse, String> {
    project_service::get_timer_projects(db).await
}

#[tauri::command]
pub async fn delete_project(id: String, db: State<'_, DbState>) -> Result<(), String> {
    project_service::delete_project(id, db).await
}
