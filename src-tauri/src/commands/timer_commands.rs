use crate::database::models::project::Project;
use crate::models::dbstate::DbState;
use crate::models::timer::{ActiveMode, SharedTimerState};
use crate::services::{discord_service, timer_service};
use tauri::{AppHandle, State};
use crate::services::discord_service::{PresenceState};

#[tauri::command]
pub async fn start_timer(
    app: AppHandle,
    state: State<'_, SharedTimerState>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    timer_service::start_timer(app, state.inner().clone(), db).await
}

#[tauri::command]
pub async fn stop_timer(
    state: State<'_, SharedTimerState>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    timer_service::stop_timer(state.inner().clone(), db).await
}

#[tauri::command]
pub async fn reset_timer(
    app: AppHandle,
    timer_state: State<'_, SharedTimerState>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let timer_arc = timer_state.inner().clone();
    let db_clone = db.clone();

    let running = timer_arc.lock().unwrap().is_running;
    let presence_state = if running { PresenceState::Working } else { PresenceState::Idle };

    discord_service::set_discord_presence(&app, presence_state)
        .await
        .map_err(|e| format!("Failed to set Discord presence: {}", e))?;

    timer_service::reset_timer(app, timer_arc, db_clone).await
}

#[tauri::command]
pub fn switch_timer_mode(
    timer_mode: String,
    state: State<'_, SharedTimerState>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|_| "Mutex Error")?;

    if timer_mode == "stopwatch" {
        state.active_mode = ActiveMode::Stopwatch;
    } else if timer_mode == "pomodoro" {
        state.active_mode = ActiveMode::Pomodoro;
    }

    Ok(())
}

#[tauri::command]
pub fn get_pomodoro_millis(state: State<'_, SharedTimerState>) -> u64 {
    state.lock().unwrap().pomodoro.current_phase_millis_left()
}

#[tauri::command]
pub fn get_stopwatch_millis(state: State<'_, SharedTimerState>) -> u64 {
    state.lock().unwrap().stopwatch.elapsed_millis
}

#[tauri::command]
pub fn is_timer_running(state: State<'_, SharedTimerState>) -> bool {
    state.lock().unwrap().is_running
}

#[tauri::command]
pub fn get_timer_mode(state: State<'_, SharedTimerState>) -> String {
    let state = state.lock().unwrap();
    match state.active_mode {
        ActiveMode::Stopwatch => "stopwatch".into(),
        ActiveMode::Pomodoro => "pomodoro".into(),
    }
}

#[tauri::command]
pub fn get_pomodoro_phase(state: State<'_, SharedTimerState>) -> u8 {
    state.lock().unwrap().pomodoro.phase as u8
}

#[tauri::command]
pub async fn set_selected_project(
    project: Option<Project>,
    state: State<'_, SharedTimerState>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    timer_service::update_project_session(project, state.inner().clone(), &db).await
}

#[tauri::command]
pub fn get_selected_project(state: State<'_, SharedTimerState>) -> Result<Option<Project>, String> {
    let timer = state.lock().map_err(|_| "Failed to lock state")?;
    Ok(timer.selected_project.clone())
}
