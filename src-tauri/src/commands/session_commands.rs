use crate::api::api_client::ApiState;
use crate::database::models::session::{SessionEntry, UpdateSessionInput};
use crate::models::dbstate::DbState;
use crate::models::timer::SharedTimerState;
use crate::services::api::sync_service::{SyncOutcome, SyncService};
use crate::services::session_service;
use serde::Serialize;
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSyncEvent {
    pub status: String,
    pub message: Option<String>,
}

fn current_active_session_id(timer: &SharedTimerState) -> Option<String> {
    timer
        .lock()
        .ok()
        .and_then(|state| state.current_session_id.clone())
}

fn spawn_immediate_sync(app: AppHandle, pool: SqlitePool) {
    tauri::async_runtime::spawn(async move {
        let Some(api_state) = app.try_state::<ApiState>() else {
            return;
        };

        let _ = app.emit(
            "session-sync-status",
            SessionSyncEvent {
                status: "syncing".to_string(),
                message: None,
            },
        );

        match SyncService::execute_sync_with_status(&api_state, &pool).await {
            Ok(SyncOutcome::Synced) => {
                let _ = app.emit(
                    "session-sync-status",
                    SessionSyncEvent {
                        status: "synced".to_string(),
                        message: None,
                    },
                );
            }
            Ok(SyncOutcome::NotLoggedIn) => {
                let _ = app.emit(
                    "session-sync-status",
                    SessionSyncEvent {
                        status: "local_only".to_string(),
                        message: None,
                    },
                );
            }
            Err(err) => {
                log::warn!(
                    "Post-session-edit cloud sync failed (saved locally, will retry): {}",
                    err
                );
                let _ = app.emit(
                    "session-sync-status",
                    SessionSyncEvent {
                        status: "error".to_string(),
                        message: Some(err),
                    },
                );
            }
        }
    });
}

#[tauri::command]
pub async fn get_sessions(
    db: State<'_, DbState>,
    timer: State<'_, SharedTimerState>,
) -> Result<Vec<SessionEntry>, String> {
    let active_id = current_active_session_id(timer.inner());
    session_service::get_sessions_in_pool(&db.pool, active_id.as_deref()).await
}

#[tauri::command]
pub async fn update_session(
    app: AppHandle,
    input: UpdateSessionInput,
    db: State<'_, DbState>,
    timer: State<'_, SharedTimerState>,
) -> Result<SessionEntry, String> {
    let active_id = current_active_session_id(timer.inner());
    let updated =
        session_service::update_session_in_pool(&db.pool, input, active_id.as_deref()).await?;

    spawn_immediate_sync(app, db.pool.clone());

    Ok(updated)
}

#[tauri::command]
pub async fn delete_session(
    app: AppHandle,
    id: String,
    db: State<'_, DbState>,
    timer: State<'_, SharedTimerState>,
) -> Result<(), String> {
    let active_id = current_active_session_id(timer.inner());
    session_service::delete_session_in_pool(&db.pool, id, active_id.as_deref()).await?;

    spawn_immediate_sync(app, db.pool.clone());

    Ok(())
}
