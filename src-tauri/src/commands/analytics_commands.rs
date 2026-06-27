use tauri::State;

use crate::{
    models::{
        analytics::{calendar_data::CalendarData, streak_data::StreakData},
        dbstate::DbState,
    },
    services::analytics_service::{self, ActiveProjectFilterState},
};

// Projects Page

#[tauri::command]
pub async fn get_overall_project_time(
    project_id: String,
    db: State<'_, DbState>,
) -> Result<u64, String> {
    let overall_time = analytics_service::get_overall_project_time(project_id, db)
        .await
        .expect("Unable to calculate overall project time.");
    Ok(overall_time)
}

#[tauri::command]
pub async fn get_todays_overall_time(db: State<'_, DbState>) -> Result<u64, String> {
    let todays_overall_time = analytics_service::get_todays_overall_time(db)
        .await
        .expect("Couldn't calculate todays overall time.");
    Ok(todays_overall_time)
}

#[tauri::command]
pub async fn get_most_active_project_name(db: State<'_, DbState>) -> Result<String, String> {
    let most_active_project_name = analytics_service::get_most_active_project_name(db)
        .await
        .expect("Couldn't receive most active project name.");
    Ok(most_active_project_name)
}

#[tauri::command]
pub async fn update_selected_projects(
    project_ids: Vec<String>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<(), String> {
    let mut ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?;
    *ids = project_ids.clone();
    Ok(())
}

// Analytics Page

#[tauri::command]
pub async fn get_analytics_streak(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<StreakData, String> {
    let streak_data = analytics_service::get_analytic_streak_data(db, filter_state)
        .await
        .expect("Couldn't receive streak data.");
    Ok(streak_data)
}

#[tauri::command]
pub async fn get_analytics_calendar(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<CalendarData, String> {
    let calendar_data = analytics_service::get_analytic_calendar_data(db, filter_state)
        .await
        .expect("Unable to receive calendar data from analytics service.");
    Ok(calendar_data)
}
