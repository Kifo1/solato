use crate::{api::api_client::ApiState, log};
use keyring::Entry;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize)]
pub struct RefreshRequest {
    pub old_refresh_token: String,
}

#[derive(Deserialize)]
pub struct AuthResponse {
    pub message: String,
    pub success: bool,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

pub struct AuthService;

impl AuthService {
    pub async fn register(api_state: &ApiState, req: RegisterRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/register", &req).await?;
        Self::handle_response(api_state, res).await
    }

    pub async fn login(api_state: &ApiState, req: LoginRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/login", &req).await?;
        Self::handle_response(api_state, res).await
    }

    pub async fn logout(api_state: &ApiState) -> Result<String, String> {
        Self::delete_stored_refresh_token()
            .await
            .expect("Unable to delete stored refresh token for logout");
        let mut access_token_guard = api_state.access_token.lock().unwrap();
        *access_token_guard = None;
        Ok("Successfully logged out".to_string())
    }

    pub async fn refresh(api_state: &ApiState, req: RefreshRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/refresh", &req).await?;
        Self::handle_response(api_state, res).await
    }

    async fn handle_response(api_state: &ApiState, res: AuthResponse) -> Result<String, String> {
        if res.success {
            if let Some(access_token) = res.access_token {
                let mut access_token_guard = api_state.access_token.lock().unwrap();
                *access_token_guard = Some(access_token);
            }

            if let Some(refresh_token) = res.refresh_token {
                tokio::task::spawn_blocking(move || {
                    match Entry::new("de.kifo.solato", "refresh_token") {
                        Ok(entry) => {
                            if let Err(e) = entry.set_password(&refresh_token) {
                                log!("ERROR", format!("Keyring writing error: {}", e));
                            }
                        }
                        Err(e) => log!("ERROR", format!("Keyring could not be initialized: {}", e)),
                    }
                })
                .await
                .map_err(|_| {
                    "Internal thread error during refresh token persistence".to_string()
                })?;
            }

            Ok(res.message)
        } else {
            Err(res.message)
        }
    }

    pub async fn get_stored_refresh_token() -> Option<String> {
        tokio::task::spawn_blocking(|| {
            if let Ok(entry) = Entry::new("de.kifo.solato", "refresh_token") {
                if let Ok(token) = entry.get_password() {
                    return Some(token);
                }
            }
            None
        })
        .await
        .unwrap_or(None)
    }

    pub async fn delete_stored_refresh_token() -> Result<(), String> {
        tokio::task::spawn_blocking(|| {
            if let Ok(entry) = Entry::new("de.kifo.solato", "refresh_token") {
                if let Err(e) = entry.delete_credential() {
                    if !matches!(e, keyring::Error::NoEntry) {
                        return Err(format!("Error during refresh token deletion: {}", e));
                    }
                }
            }
            Ok(())
        })
        .await
        .map_err(|_| "Internal thread error during refresh token deletion".to_string())?
    }
}
