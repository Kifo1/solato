use crate::api::api_client::ApiState;
pub use crate::api::api_client::{AuthResponse, RefreshError};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, Deserialize)]
pub struct VerifyRequest {
    pub email: String,
    pub code: String,
}

#[derive(Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

pub struct AuthService;

impl AuthService {
    pub async fn register(api_state: &ApiState, req: RegisterRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/register", &req).await?;
        Self::handle_response(api_state, res).await
    }

    pub async fn verify(api_state: &ApiState, req: VerifyRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/verify", &req).await?;
        Self::handle_response(api_state, res).await
    }

    pub async fn login(api_state: &ApiState, req: LoginRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/login", &req).await?;
        Self::handle_response(api_state, res).await
    }

    pub async fn logout(api_state: &ApiState) -> Result<String, String> {
        api_state.clear_session().await?;
        Ok("Successfully logged out".to_string())
    }

    pub async fn restore_session(api_state: &ApiState) -> Result<String, RefreshError> {
        api_state.refresh_session(None).await
    }

    async fn handle_response(api_state: &ApiState, res: AuthResponse) -> Result<String, String> {
        if res.success {
            api_state
                .apply_auth_tokens(res.access_token, res.refresh_token)
                .await?;
            Ok(res.message)
        } else {
            Err(res.message)
        }
    }
}
