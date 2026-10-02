use tauri::State;

use crate::{
    database::models::project::Project,
    models::{
        analytics::{
            calendar_data::CalendarData, hourly_time_data::HourlyTimeData,
            project_time_share_data::ProjectTimeShareData, streak_data::StreakData,
            weekday_time_data::WeekdayTimeData,
        },
        dbstate::DbState,
    },
    services::{
        analytics_service::{self, ActiveProjectFilterState},
        project_service,
    },
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

#[tauri::command]
pub async fn get_selected_projects(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<Vec<Project>, String> {
    let ids: Vec<String> = {
        let guard = filter_state
            .selected_project_ids
            .lock()
            .map_err(|e| e.to_string())?;
        guard.clone()
    };

    let all_projects = project_service::get_projects(db)
        .await
        .map_err(|e| e.to_string())?;

    let projects: Vec<_> = all_projects
        .into_iter()
        .filter(|p| ids.contains(&p.id))
        .collect();

    Ok(projects)
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

#[tauri::command]
pub async fn get_analytics_project_time_share(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<ProjectTimeShareData, String> {
    let project_time_share_data =
        analytics_service::get_analytic_project_time_share_data(db, filter_state)
            .await
            .expect("Unable to receive project time share data from analytics service.");
    Ok(project_time_share_data)
}

#[tauri::command]
pub async fn get_analytics_weekday_time(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<WeekdayTimeData, String> {
    let weekday_time_data = analytics_service::get_analytic_weekday_time_data(db, filter_state)
        .await
        .expect("Unable to receive weekday time data from analytics service.");
    Ok(weekday_time_data)
}

#[tauri::command]
pub async fn get_analytics_hourly_time(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<HourlyTimeData, String> {
    let hourly_time_data = analytics_service::get_analytic_hourly_time_data(db, filter_state)
        .await
        .expect("Unable to receive hourly time data from analytics service.");
    Ok(hourly_time_data)
}
