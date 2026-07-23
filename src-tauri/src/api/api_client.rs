use keyring::Entry;
use reqwest::header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use serde::Serialize;
use std::sync::Mutex;
use tauri::http::HeaderValue;

pub struct ApiState {
    pub base_url: String,
    pub access_token: Mutex<Option<String>>,
    pub client: Client,
}

impl ApiState {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url,
            access_token: Mutex::new(None),
            client: Client::builder().build().unwrap_or_default(),
        }
    }

    fn build_headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Ok(token_guard) = self.access_token.lock() {
            if let Some(ref token) = *token_guard {
                if let Ok(auth_val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                    headers.insert(AUTHORIZATION, auth_val);
                }
            }
        }
        headers
    }

    pub async fn post<Req, Res>(&self, endpoint: &str, body: &Req) -> Result<Res, String>
    where
        Req: Serialize,
        Res: DeserializeOwned,
    {
        let url = format!("{}{}", self.base_url, endpoint);
        let mut refresh_attempted = false;

        loop {
            let response = self
                .client
                .post(&url)
                .headers(self.build_headers())
                .json(body)
                .send()
                .await
                .map_err(|e| format!("API request error: {:?}", e))?;

            let status = response.status();

            if status == StatusCode::UNAUTHORIZED
                && !endpoint.contains("/auth/public/")
                && !refresh_attempted
            {
                log::error!("Access Token invalid. Try to refetch access token...");
                refresh_attempted = true;

                if let Some(refresh_token) = self.get_stored_refresh_token_internal().await {
                    #[derive(Serialize)]
                    #[serde(rename_all = "camelCase")]
                    struct RefreshRequest {
                        old_refresh_token: String,
                    }

                    #[derive(serde::Deserialize)]
                    struct AuthResponse {
                        success: bool,
                        access_token: Option<String>,
                        refresh_token: Option<String>,
                    }

                    let refresh_url = format!("{}{}", self.base_url, "/auth/public/refresh");
                    let refresh_req = RefreshRequest {
                        old_refresh_token: refresh_token,
                    };

                    let refresh_res = self
                        .client
                        .post(&refresh_url)
                        .json(&refresh_req)
                        .send()
                        .await;

                    match &refresh_res {
                        Ok(res) => log::debug!("Refresh response status: {}", res.status()),
                        Err(e) => log::error!("Refresh request send error: {:?}", e),
                    }

                    if let Ok(res) = refresh_res {
                        if res.status().is_success() {
                            if let Ok(auth_data) = res.json::<AuthResponse>().await {
                                if auth_data.success {
                                    if let Some(new_at) = auth_data.access_token {
                                        let mut token_guard = self.access_token.lock().unwrap();
                                        *token_guard = Some(new_at);
                                    }
                                    if let Some(new_rt) = auth_data.refresh_token {
                                        let _ =
                                            self.set_stored_refresh_token_internal(new_rt).await;
                                    }

                                    log::info!("Refresh successful. Retry API request");
                                    continue;
                                }
                            }
                        }
                    }
                }
                log::error!("Refresh failed or no available token");
                {
                    let mut token_guard = self.access_token.lock().unwrap();
                    *token_guard = None;
                }
                let _ = self.delete_stored_refresh_token_internal().await;

                return Err("Session expired. Please log in again.".to_string());
            }

            if !status.is_success() {
                #[derive(serde::Deserialize)]
                struct ErrorBody {
                    message: String,
                }
                if let Ok(err_json) = response.json::<ErrorBody>().await {
                    return Err(err_json.message);
                }
                return Err(format!("Server responded with status: {}", status));
            }

            return response.json::<Res>().await.map_err(|e| e.to_string());
        }
    }

    async fn get_stored_refresh_token_internal(&self) -> Option<String> {
        tokio::task::spawn_blocking(|| {
            Entry::new("de.kifo.solato", "refresh_token")
                .ok()
                .and_then(|entry| entry.get_password().ok())
        })
        .await
        .unwrap_or(None)
    }

    async fn set_stored_refresh_token_internal(&self, token: String) -> Result<(), ()> {
        tokio::task::spawn_blocking(move || {
            if let Ok(entry) = Entry::new("de.kifo.solato", "refresh_token") {
                if entry.set_password(&token).is_ok() {
                    return Ok(());
                }
            }
            Err(())
        })
        .await
        .unwrap_or(Err(()))
    }

    async fn delete_stored_refresh_token_internal(&self) -> Result<(), ()> {
        tokio::task::spawn_blocking(|| {
            if let Ok(entry) = Entry::new("de.kifo.solato", "refresh_token") {
                let _ = entry.delete_credential();
            }
            Ok(())
        })
        .await
        .unwrap_or(Err(()))
    }
}
