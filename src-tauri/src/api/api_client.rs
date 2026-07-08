use reqwest::header::{HeaderMap, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
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

        let response = self
            .client
            .post(&url)
            .headers(self.build_headers())
            .json(body)
            .send()
            .await
            .map_err(|e| format!("API request error: {}", e))?;

        let status = response.status();
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

        response.json::<Res>().await.map_err(|e| e.to_string())
    }
}
