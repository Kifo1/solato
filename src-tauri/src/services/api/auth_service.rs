use serde::{Deserialize, Serialize};
use crate::api::api_client::ApiState;

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

#[derive(Deserialize)]
pub struct AuthResponse {
    pub message: String,
    pub success: bool,
    pub token: Option<String>,
}

pub struct AuthService;

impl AuthService {
    pub async fn register(api_state: &ApiState, req: RegisterRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/register", &req).await?;
        Self::handle_response(api_state, res)
    }

    pub async fn login(api_state: &ApiState, req: LoginRequest) -> Result<String, String> {
        let res: AuthResponse = api_state.post("/auth/public/login", &req).await?;
        Self::handle_response(api_state, res)
    }

    fn handle_response(api_state: &ApiState, res: AuthResponse) -> Result<String, String> {
        if res.success {
            if let Some(token) = res.token {
                let mut token_guard = api_state.jwt_token.lock().unwrap();
                *token_guard = Some(token);
            }
            Ok(res.message)
        } else {
            Err(res.message)
        }
    }
}