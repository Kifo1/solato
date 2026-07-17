mod api;
mod commands;
mod database;
mod logging;
mod models;
mod services;
mod window;

use crate::api::api_client::ApiState;
use crate::services::api::auth_service::{AuthService, RefreshRequest};
use crate::services::api::sync_service::SyncService;
use crate::services::discord_service;
use crate::services::discord_service::{DiscordState, PresenceState};
use crate::{
    models::timer::SharedTimerState, services::analytics_service::ActiveProjectFilterState,
};
use models::dbstate::DbState;
use models::timer::TimerState;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use std::{str::FromStr, sync::Arc, time::Duration};
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let base_url = std::env::var("API_BASE_URL")
        .unwrap_or_else(|_| "https://api.solato.app/api/v1".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // Window
            window::window_menu::build_window_menu(app)?;

            let db_url = if cfg!(debug_assertions) {
                let dev_db_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("dev.db");
                format!(
                    "sqlite:{}",
                    dev_db_path.to_str().expect("Path contains invalid UTF-8")
                )
            } else {
                let app_dir = handle
                    .path()
                    .app_data_dir()
                    .expect("Failed to get app directory");
                std::fs::create_dir_all(&app_dir).ok();

                let db_path = app_dir.join("database.sqlite");
                format!(
                    "sqlite:{}",
                    db_path.to_str().expect("Path contains invalid UTF-8")
                )
            };

            let connection_options = SqliteConnectOptions::from_str(&db_url)
                .expect("Invalid DB URL")
                .create_if_missing(true)
                .pragma("foreign_keys", "ON")
                .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal);

            tauri::async_runtime::block_on(async move {
                let pool = SqlitePoolOptions::new()
                    .connect_with(connection_options)
                    .await
                    .expect("Unable to open database file");

                sqlx::migrate!("./migrations")
                    .run(&pool)
                    .await
                    .expect("Unable to run database migrations");

                let db_state = DbState { pool: pool.clone() };

                let _ = services::session_service::delete_incomplete_sessions(&db_state).await;

                handle.manage(db_state.clone());
                let internal_state =
                    Arc::new(std::sync::Mutex::new(TimerState::new(handle.clone()).await));
                let timer_state = SharedTimerState::from(internal_state);
                handle.manage(timer_state);
                handle.manage(ActiveProjectFilterState::default());

                handle.manage(ApiState::new(base_url));

                handle.manage(DiscordState {
                    client: Mutex::new(None),
                });

                if let Err(e) =
                    discord_service::set_discord_presence(handle, PresenceState::Idle).await
                {
                    log!(
                        "ERROR",
                        format!("Failed to set initial Discord presence: {}", e)
                    );
                }

                let api_state = app.state::<ApiState>();

                if let Some(token) = AuthService::get_stored_refresh_token().await {
                    let _ = AuthService::refresh(
                        &api_state,
                        RefreshRequest {
                            old_refresh_token: token,
                        },
                    )
                    .await;
                }

                let app_handle_for_sync = app.handle().clone();
                let pool_for_sync = pool.clone();

                tauri::async_runtime::spawn(async move {
                    log!("INFO", "Background sync loop started.");
                    loop {
                        if let Some(api_state_guard) = app_handle_for_sync.try_state::<ApiState>() {
                            log!("DEBUG", "Triggering scheduled background sync...");
                            let _ =
                                SyncService::execute_sync(&api_state_guard, &pool_for_sync).await;
                        } else {
                            log!("WARN", "ApiState not available for background sync yet.");
                        }

                        tokio::time::sleep(Duration::from_secs(1 * 60)).await; // Automatic resync all 5 mins
                    }
                });
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app_handle = window.app_handle();

                if let (Some(state), Some(db), Some(api)) = (
                    app_handle.try_state::<SharedTimerState>(),
                    app_handle.try_state::<DbState>(),
                    app_handle.try_state::<ApiState>(),
                ) {
                    let state_handle = state.inner().clone();
                    let db_handle = db.inner().clone();
                    let api_handle = api.inner();

                    tauri::async_runtime::block_on(async {
                        let session_id = {
                            let mut state_lock = state_handle.lock().unwrap();
                            services::timer_service::stop_timer_inner(&mut state_lock)
                        };

                        if let Some(id) = session_id {
                            let _ = services::session_service::stop_session(id, &db_handle).await;
                        }

                        log!("INFO", "Executing final sync before exit...");
                        let _ = SyncService::execute_sync(api_handle, &db_handle.pool).await;
                    });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::timer_commands::start_timer,
            commands::timer_commands::stop_timer,
            commands::timer_commands::reset_timer,
            commands::timer_commands::switch_timer_mode,
            commands::timer_commands::get_pomodoro_millis,
            commands::timer_commands::get_stopwatch_millis,
            commands::timer_commands::is_timer_running,
            commands::timer_commands::get_timer_mode,
            commands::timer_commands::get_pomodoro_phase,
            commands::timer_commands::set_selected_project,
            commands::timer_commands::get_selected_project,
            commands::project_commands::create_project,
            commands::project_commands::update_project,
            commands::project_commands::get_projects,
            commands::project_commands::delete_project,
            commands::analytics_commands::get_overall_project_time,
            commands::analytics_commands::get_todays_overall_time,
            commands::analytics_commands::get_most_active_project_name,
            commands::analytics_commands::update_selected_projects,
            commands::analytics_commands::get_analytics_calendar,
            commands::analytics_commands::get_analytics_streak,
            commands::settings_commands::get_settings,
            commands::settings_commands::update_settings,
            commands::discord_commands::set_discord_presence,
            commands::api::auth_commands::is_logged_in,
            commands::api::auth_commands::register_user,
            commands::api::auth_commands::login_user,
            commands::api::auth_commands::logout,
            commands::api::auth_commands::verify_user,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
