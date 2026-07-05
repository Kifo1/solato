use crate::api::api_client::ApiState;
use crate::services::api::auth_service::{AuthService, LoginRequest, RegisterRequest};
use serde::Serialize;
use tauri::State;

#[derive(Serialize)]
pub struct CommandResponse {
    pub success: bool,
    pub message: String,
}

#[tauri::command]
pub async fn register_user(
    payload: RegisterRequest,
    api_state: State<'_, ApiState>,
) -> Result<CommandResponse, String> {
    match AuthService::register(&api_state, payload).await {
        Ok(msg) => Ok(CommandResponse {
            success: true,
            message: msg,
        }),
        Err(err) => Ok(CommandResponse {
            success: false,
            message: err,
        }),
    }
}

#[tauri::command]
pub async fn login_user(
    payload: LoginRequest,
    api_state: State<'_, ApiState>,
) -> Result<CommandResponse, String> {
    match AuthService::login(&api_state, payload).await {
        Ok(msg) => Ok(CommandResponse {
            success: true,
            message: msg,
        }),
        Err(err) => Ok(CommandResponse {
            success: false,
            message: err,
        }),
    }
}
