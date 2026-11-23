use crate::api::token_store::{KeyringTokenStore, TokenStore};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::{Client, StatusCode};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshRequest {
    pub old_refresh_token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    #[serde(default)]
    pub message: String,
    pub success: bool,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct ErrorBody {
    message: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum RefreshError {
    NoRefreshToken,
    SessionExpired(String),
    Transient(String),
}

impl fmt::Display for RefreshError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            RefreshError::NoRefreshToken => write!(f, "No stored refresh token available"),
            RefreshError::SessionExpired(msg) => write!(f, "{}", msg),
            RefreshError::Transient(msg) => write!(f, "{}", msg),
        }
    }
}

pub struct ApiState {
    pub base_url: String,
    pub access_token: Mutex<Option<String>>,
    pub client: Client,
    token_store: Arc<dyn TokenStore>,
    refresh_lock: tokio::sync::Mutex<()>,
    sync_lock: tokio::sync::Mutex<()>,
    has_stored_session: AtomicBool,
    auth_epoch: AtomicU64,
    on_auth_state_changed: Option<Arc<dyn Fn() + Send + Sync>>,
}

impl ApiState {
    pub fn new(base_url: String) -> Self {
        Self::new_with_store(base_url, Arc::new(KeyringTokenStore::default_solato()))
    }

    pub fn new_with_store(base_url: String, token_store: Arc<dyn TokenStore>) -> Self {
        let client = Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .timeout(Duration::from_secs(30))
            .build()
            .unwrap_or_default();

        Self {
            base_url,
            access_token: Mutex::new(None),
            client,
            token_store,
            refresh_lock: tokio::sync::Mutex::new(()),
            sync_lock: tokio::sync::Mutex::new(()),
            // Start optimistic so the first startup/sync check inspects the OS keyring once.
            has_stored_session: AtomicBool::new(true),
            auth_epoch: AtomicU64::new(0),
            on_auth_state_changed: None,
        }
    }

    pub async fn lock_sync(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.sync_lock.lock().await
    }

    pub fn with_auth_change_listener<F>(mut self, listener: F) -> Self
    where
        F: Fn() + Send + Sync + 'static,
    {
        self.on_auth_state_changed = Some(Arc::new(listener));
        self
    }

    fn lock_access_token(&self) -> MutexGuard<'_, Option<String>> {
        self.access_token
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn notify_auth_state_changed(&self) {
        if let Some(ref listener) = self.on_auth_state_changed {
            listener();
        }
    }

    pub fn is_logged_in(&self) -> bool {
        self.lock_access_token().is_some()
    }

    fn get_access_token(&self) -> Option<String> {
        self.lock_access_token().clone()
    }

    fn build_headers(&self, access_token: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        if let Some(token) = access_token {
            if let Ok(auth_val) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(AUTHORIZATION, auth_val);
            }
        }
        headers
    }

    async fn read_refresh_token(&self) -> Result<Option<String>, String> {
        let store = Arc::clone(&self.token_store);
        tokio::task::spawn_blocking(move || store.get_refresh_token())
            .await
            .map_err(|_| "Internal thread error during refresh token read".to_string())?
    }

    async fn write_refresh_token(&self, token: String) -> Result<(), String> {
        let store = Arc::clone(&self.token_store);
        tokio::task::spawn_blocking(move || store.set_refresh_token(&token))
            .await
            .map_err(|_| "Internal thread error during refresh token write".to_string())?
    }

    async fn remove_refresh_token(&self) -> Result<(), String> {
        let store = Arc::clone(&self.token_store);
        tokio::task::spawn_blocking(move || store.delete_refresh_token())
            .await
            .map_err(|_| "Internal thread error during refresh token deletion".to_string())?
    }

    async fn expire_session_for_epoch(&self, epoch: u64) {
        if self.auth_epoch.load(Ordering::SeqCst) != epoch {
            return;
        }

        let was_logged_in = {
            let mut token_guard = self.lock_access_token();
            token_guard.take().is_some()
        };

        if let Err(e) = self.remove_refresh_token().await {
            log::error!("Failed to delete refresh token from OS keyring: {}", e);
        }

        self.has_stored_session.store(false, Ordering::SeqCst);

        if was_logged_in {
            self.notify_auth_state_changed();
        }
    }

    pub async fn apply_auth_tokens(
        &self,
        access_token: Option<String>,
        refresh_token: Option<String>,
    ) -> Result<(), String> {
        let _refresh_guard = self.refresh_lock.lock().await;

        let access_token = access_token.filter(|t| !t.trim().is_empty());
        let refresh_token = refresh_token.filter(|t| !t.trim().is_empty());

        if access_token.is_none() && refresh_token.is_none() {
            return Ok(());
        }

        self.auth_epoch.fetch_add(1, Ordering::SeqCst);

        let had_refresh_token = refresh_token.is_some();
        if let Some(rt) = refresh_token {
            match self.write_refresh_token(rt).await {
                Ok(()) => {
                    self.has_stored_session.store(true, Ordering::SeqCst);
                    log::info!("Refresh token stored in OS keyring.");
                }
                Err(e) => {
                    self.has_stored_session.store(false, Ordering::SeqCst);
                    log::error!("Failed to store refresh token in OS keyring: {}", e);
                }
            }
        }

        if let Some(at) = access_token {
            if !had_refresh_token {
                log::warn!(
                    "Auth response included accessToken but no refreshToken; session may not persist across restarts."
                );
            }
            {
                let mut token_guard = self.lock_access_token();
                *token_guard = Some(at);
            }
            self.notify_auth_state_changed();
        }

        Ok(())
    }

    pub async fn clear_session(&self) -> Result<(), String> {
        // Bump epoch and clear RAM token immediately so any in-flight refresh discards its result.
        self.auth_epoch.fetch_add(1, Ordering::SeqCst);
        let mut was_logged_in = {
            let mut token_guard = self.lock_access_token();
            token_guard.take().is_some()
        };

        let _refresh_guard = self.refresh_lock.lock().await;

        {
            let mut token_guard = self.lock_access_token();
            if token_guard.take().is_some() {
                was_logged_in = true;
            }
        }

        self.has_stored_session.store(false, Ordering::SeqCst);
        let delete_result = self.remove_refresh_token().await;

        if was_logged_in {
            self.notify_auth_state_changed();
        }

        delete_result.map_err(|e| format!("Error during refresh token deletion: {}", e))
    }

    pub async fn ensure_authenticated(&self) -> Result<bool, RefreshError> {
        if self.is_logged_in() {
            return Ok(true);
        }

        if !self.has_stored_session.load(Ordering::SeqCst) {
            return Ok(false);
        }

        match self.refresh_session(None).await {
            Ok(_) => Ok(true),
            Err(RefreshError::NoRefreshToken) => Ok(false),
            Err(e) => Err(e),
        }
    }

    pub async fn refresh_session(
        &self,
        failed_access_token: Option<&str>,
    ) -> Result<String, RefreshError> {
        let _refresh_guard = self.refresh_lock.lock().await;

        let current_token = self.get_access_token();
        if current_token.is_some() && failed_access_token != current_token.as_deref() {
            return Ok("Access token already refreshed".to_string());
        }

        let epoch = self.auth_epoch.load(Ordering::SeqCst);

        let refresh_token = match self.read_refresh_token().await {
            Ok(Some(token)) if !token.trim().is_empty() => token,
            Ok(_) => {
                self.has_stored_session.store(false, Ordering::SeqCst);
                return Err(RefreshError::NoRefreshToken);
            }
            Err(e) => {
                log::error!("Failed to read refresh token from OS keyring: {}", e);
                return Err(RefreshError::Transient(format!(
                    "Keyring read error: {}",
                    e
                )));
            }
        };

        let refresh_url = format!("{}{}", self.base_url, "/auth/public/refresh");
        let refresh_req = RefreshRequest {
            old_refresh_token: refresh_token,
        };

        let refresh_res = self
            .client
            .post(&refresh_url)
            .headers(self.build_headers(None))
            .json(&refresh_req)
            .send()
            .await;

        // Drop the request (and the refresh token inside it) immediately after sending.
        drop(refresh_req);

        let res = match refresh_res {
            Ok(res) => res,
            Err(e) => {
                log::warn!("Refresh request transport error: {:?}", e);
                return Err(RefreshError::Transient(format!(
                    "API request error: {:?}",
                    e
                )));
            }
        };

        let status = res.status();
        log::debug!("Refresh response status: {}", status);

        if status.is_server_error()
            || status == StatusCode::REQUEST_TIMEOUT
            || status == StatusCode::TOO_MANY_REQUESTS
        {
            log::warn!(
                "Refresh endpoint returned transient HTTP status: {}",
                status
            );
            return Err(RefreshError::Transient(format!(
                "Server responded with status: {}",
                status
            )));
        }

        if status.is_client_error() {
            let msg = extract_error_message(res, status).await;
            log::warn!("Refresh token rejected by server ({}): {}", status, msg);
            self.expire_session_for_epoch(epoch).await;
            return Err(RefreshError::SessionExpired(msg));
        }

        let auth_data = match res.json::<AuthResponse>().await {
            Ok(data) => data,
            Err(e) => {
                log::error!("Failed to deserialize refresh AuthResponse: {}", e);
                return Err(RefreshError::Transient(format!(
                    "Invalid refresh response: {}",
                    e
                )));
            }
        };

        if !auth_data.success {
            let msg = if auth_data.message.is_empty() {
                "Refresh rejected by server".to_string()
            } else {
                auth_data.message
            };
            log::warn!("Refresh rejected by server (success=false): {}", msg);
            self.expire_session_for_epoch(epoch).await;
            return Err(RefreshError::SessionExpired(msg));
        }

        let Some(new_at) = auth_data.access_token.filter(|t| !t.trim().is_empty()) else {
            log::error!("Refresh response succeeded without accessToken");
            return Err(RefreshError::Transient(
                "Refresh response missing accessToken".to_string(),
            ));
        };

        if self.auth_epoch.load(Ordering::SeqCst) != epoch {
            log::info!("Auth state changed during refresh; discarding refresh result.");
            return Err(RefreshError::NoRefreshToken);
        }

        if let Some(new_rt) = auth_data.refresh_token.filter(|t| !t.trim().is_empty()) {
            match self.write_refresh_token(new_rt).await {
                Ok(()) => log::debug!("Rotated refresh token stored in OS keyring."),
                Err(e) => log::error!("Failed to store rotated refresh token in OS keyring: {}", e),
            }
        }

        let was_logged_in = {
            let mut token_guard = self.lock_access_token();
            let prev = token_guard.is_some();
            *token_guard = Some(new_at);
            prev
        };

        self.has_stored_session.store(true, Ordering::SeqCst);

        if !was_logged_in {
            self.notify_auth_state_changed();
        }

        log::info!("Access token refreshed successfully.");
        Ok(auth_data.message)
    }

    pub async fn post<Req, Res>(&self, endpoint: &str, body: &Req) -> Result<Res, String>
    where
        Req: Serialize,
        Res: DeserializeOwned,
    {
        let is_public_auth = endpoint.contains("/auth/public/");

        if !is_public_auth && !self.is_logged_in() {
            match self.refresh_session(None).await {
                Ok(_) => {}
                Err(RefreshError::NoRefreshToken) => return Err("Not logged in.".to_string()),
                Err(RefreshError::SessionExpired(_)) => {
                    return Err("Session expired. Please log in again.".to_string());
                }
                Err(RefreshError::Transient(msg)) => return Err(msg),
            }
        }

        let url = format!("{}{}", self.base_url, endpoint);
        let mut refresh_attempted = false;

        loop {
            let sent_token = if is_public_auth {
                None
            } else {
                self.get_access_token()
            };

            let response = self
                .client
                .post(&url)
                .headers(self.build_headers(sent_token.as_deref()))
                .json(body)
                .send()
                .await
                .map_err(|e| format!("API request error: {:?}", e))?;

            let status = response.status();

            if status == StatusCode::UNAUTHORIZED && !is_public_auth && !refresh_attempted {
                refresh_attempted = true;
                log::info!("Access token invalid (401). Attempting token refresh...");

                match self.refresh_session(sent_token.as_deref()).await {
                    Ok(_) => {
                        log::info!("Refresh successful. Retrying API request.");
                        continue;
                    }
                    Err(RefreshError::NoRefreshToken) => {
                        let cleared = {
                            let mut token_guard = self.lock_access_token();
                            if *token_guard == sent_token && token_guard.is_some() {
                                *token_guard = None;
                                true
                            } else {
                                false
                            }
                        };
                        if cleared {
                            self.notify_auth_state_changed();
                        }
                        return Err("Session expired. Please log in again.".to_string());
                    }
                    Err(RefreshError::SessionExpired(_)) => {
                        return Err("Session expired. Please log in again.".to_string());
                    }
                    Err(RefreshError::Transient(msg)) => {
                        return Err(format!("Unable to refresh access token: {}", msg));
                    }
                }
            }

            if !status.is_success() {
                return Err(extract_error_message(response, status).await);
            }

            return response.json::<Res>().await.map_err(|e| e.to_string());
        }
    }
}

async fn extract_error_message(response: reqwest::Response, status: StatusCode) -> String {
    if let Ok(err_json) = response.json::<ErrorBody>().await {
        if !err_json.message.trim().is_empty() {
            return err_json.message;
        }
    }
    format!("Server responded with status: {}", status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::api::auth_service::{AuthService, LoginRequest};
    use std::collections::HashMap;
    use std::future::Future;
    use std::pin::Pin;
    use std::sync::atomic::AtomicUsize;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;
    use tokio::sync::Barrier;

    struct MockTokenStore {
        token: Mutex<Option<String>>,
        get_calls: AtomicUsize,
        set_calls: AtomicUsize,
        delete_calls: AtomicUsize,
        get_error: Mutex<Option<String>>,
        set_error: Mutex<Option<String>>,
        delete_error: Mutex<Option<String>>,
    }

    impl MockTokenStore {
        fn with_token(token: Option<&str>) -> Arc<Self> {
            Arc::new(Self {
                token: Mutex::new(token.map(String::from)),
                get_calls: AtomicUsize::new(0),
                set_calls: AtomicUsize::new(0),
                delete_calls: AtomicUsize::new(0),
                get_error: Mutex::new(None),
                set_error: Mutex::new(None),
                delete_error: Mutex::new(None),
            })
        }

        fn current(&self) -> Option<String> {
            self.token.lock().unwrap().clone()
        }
    }

    impl TokenStore for MockTokenStore {
        fn get_refresh_token(&self) -> Result<Option<String>, String> {
            self.get_calls.fetch_add(1, Ordering::SeqCst);
            if let Some(err) = self.get_error.lock().unwrap().clone() {
                return Err(err);
            }
            Ok(self.token.lock().unwrap().clone())
        }

        fn set_refresh_token(&self, token: &str) -> Result<(), String> {
            self.set_calls.fetch_add(1, Ordering::SeqCst);
            if let Some(err) = self.set_error.lock().unwrap().clone() {
                return Err(err);
            }
            *self.token.lock().unwrap() = Some(token.to_string());
            Ok(())
        }

        fn delete_refresh_token(&self) -> Result<(), String> {
            self.delete_calls.fetch_add(1, Ordering::SeqCst);
            if let Some(err) = self.delete_error.lock().unwrap().clone() {
                return Err(err);
            }
            *self.token.lock().unwrap() = None;
            Ok(())
        }
    }

    #[derive(Clone, Debug)]
    struct RecordedRequest {
        method: String,
        path: String,
        headers: HashMap<String, String>,
        body: String,
    }

    struct MockResponse {
        status_line: &'static str,
        body: String,
    }

    type AsyncHandler = Arc<
        dyn Fn(RecordedRequest) -> Pin<Box<dyn Future<Output = MockResponse> + Send>> + Send + Sync,
    >;

    async fn spawn_mock_server(handler: AsyncHandler) -> (String, tokio::task::JoinHandle<()>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let base_url = format!("http://{}/api/v1", addr);

        let handle = tokio::spawn(async move {
            loop {
                let Ok((mut socket, _)) = listener.accept().await else {
                    break;
                };
                let handler = Arc::clone(&handler);
                tokio::spawn(async move {
                    let mut buf = Vec::new();
                    let mut tmp = [0u8; 1024];
                    let header_end;

                    loop {
                        let n = match socket.read(&mut tmp).await {
                            Ok(0) | Err(_) => return,
                            Ok(n) => n,
                        };
                        buf.extend_from_slice(&tmp[..n]);
                        if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                            header_end = pos + 4;
                            break;
                        }
                    }

                    let header_text = String::from_utf8_lossy(&buf[..header_end - 4]);
                    let mut lines = header_text.split("\r\n");
                    let request_line = lines.next().unwrap_or_default();
                    let mut req_parts = request_line.split_whitespace();
                    let method = req_parts.next().unwrap_or_default().to_string();
                    let path = req_parts.next().unwrap_or_default().to_string();

                    let mut headers = HashMap::new();
                    let mut content_length = 0usize;
                    for line in lines {
                        if let Some((k, v)) = line.split_once(':') {
                            let key = k.trim().to_ascii_lowercase();
                            let val = v.trim().to_string();
                            if key == "content-length" {
                                content_length = val.parse().unwrap_or(0);
                            }
                            headers.insert(key, val);
                        }
                    }

                    while buf.len() < header_end + content_length {
                        let n = match socket.read(&mut tmp).await {
                            Ok(0) | Err(_) => break,
                            Ok(n) => n,
                        };
                        buf.extend_from_slice(&tmp[..n]);
                    }

                    let body_end = (header_end + content_length).min(buf.len());
                    let body = String::from_utf8_lossy(&buf[header_end..body_end]).to_string();

                    let req = RecordedRequest {
                        method,
                        path,
                        headers,
                        body,
                    };
                    let resp = handler(req).await;

                    let raw_resp = format!(
                        "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                        resp.status_line,
                        resp.body.len(),
                        resp.body
                    );
                    let _ = socket.write_all(raw_resp.as_bytes()).await;
                    let _ = socket.flush().await;
                    let _ = socket.shutdown().await;
                });
            }
        });

        (base_url, handle)
    }

    #[derive(Serialize)]
    struct DummyReq {
        ping: &'static str,
    }

    #[derive(Deserialize, Debug, PartialEq)]
    struct DummyRes {
        ok: bool,
    }

    #[test]
    fn auth_response_deserializes_camel_case_tokens() {
        let json = r#"{
            "success": true,
            "accessToken": "jwt-123",
            "refreshToken": "rt-456"
        }"#;
        let parsed: AuthResponse = serde_json::from_str(json).unwrap();
        assert!(parsed.success);
        assert_eq!(parsed.message, "");
        assert_eq!(parsed.access_token.as_deref(), Some("jwt-123"));
        assert_eq!(parsed.refresh_token.as_deref(), Some("rt-456"));
    }

    #[tokio::test]
    async fn post_401_refreshes_jwt_rotates_refresh_token_and_retries() {
        let recorded = Arc::new(Mutex::new(Vec::<RecordedRequest>::new()));
        let recorded_clone = Arc::clone(&recorded);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |req| {
            let recorded = Arc::clone(&recorded_clone);
            Box::pin(async move {
                recorded.lock().unwrap().push(req.clone());
                match req.path.as_str() {
                    "/api/v1/sync" => {
                        let auth = req.headers.get("authorization").cloned().unwrap_or_default();
                        if auth == "Bearer expired_jwt" {
                            MockResponse {
                                status_line: "401 Unauthorized",
                                body: r#"{"message":"JWT expired"}"#.to_string(),
                            }
                        } else if auth == "Bearer fresh_jwt" {
                            MockResponse {
                                status_line: "200 OK",
                                body: r#"{"ok":true}"#.to_string(),
                            }
                        } else {
                            MockResponse {
                                status_line: "401 Unauthorized",
                                body: r#"{"message":"Unexpected token"}"#.to_string(),
                            }
                        }
                    }
                    "/api/v1/auth/public/refresh" => {
                        assert!(!req.headers.contains_key("authorization"));
                        let body_json: serde_json::Value =
                            serde_json::from_str(&req.body).unwrap();
                        assert_eq!(body_json["oldRefreshToken"], "rt_1");
                        MockResponse {
                            status_line: "200 OK",
                            body: r#"{"message":"Refreshed","success":true,"accessToken":"fresh_jwt","refreshToken":"rt_2"}"#.to_string(),
                        }
                    }
                    _ => MockResponse {
                        status_line: "404 Not Found",
                        body: "{}".to_string(),
                    },
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_1"));
        let api = ApiState::new_with_store(base_url, store.clone());
        *api.access_token.lock().unwrap() = Some("expired_jwt".to_string());

        let res: DummyRes = api.post("/sync", &DummyReq { ping: "hi" }).await.unwrap();
        assert_eq!(res, DummyRes { ok: true });
        assert_eq!(api.get_access_token().as_deref(), Some("fresh_jwt"));
        assert_eq!(store.current().as_deref(), Some("rt_2"));

        let reqs = recorded.lock().unwrap();
        assert_eq!(reqs.len(), 3);
        assert_eq!(reqs[0].method, "POST");
        assert_eq!(reqs[0].path, "/api/v1/sync");
        assert_eq!(reqs[1].method, "POST");
        assert_eq!(reqs[1].path, "/api/v1/auth/public/refresh");
        assert_eq!(reqs[2].method, "POST");
        assert_eq!(reqs[2].path, "/api/v1/sync");

        server_handle.abort();
    }

    #[tokio::test]
    async fn startup_restore_session_refreshes_and_rotates_token() {
        let auth_events = Arc::new(AtomicUsize::new(0));
        let auth_events_clone = Arc::clone(&auth_events);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |req| {
            Box::pin(async move {
                assert_eq!(req.path, "/api/v1/auth/public/refresh");
                assert!(!req.headers.contains_key("authorization"));
                let body_json: serde_json::Value = serde_json::from_str(&req.body).unwrap();
                assert_eq!(body_json["oldRefreshToken"], "rt_startup");
                MockResponse {
                    status_line: "200 OK",
                    body: r#"{"message":"Welcome back","success":true,"accessToken":"jwt_new","refreshToken":"rt_rotated"}"#.to_string(),
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_startup"));
        let api = ApiState::new_with_store(base_url, store.clone()).with_auth_change_listener(
            move || {
                auth_events_clone.fetch_add(1, Ordering::SeqCst);
            },
        );

        assert!(!api.is_logged_in());
        let msg = AuthService::restore_session(&api).await.unwrap();
        assert_eq!(msg, "Welcome back");
        assert!(api.is_logged_in());
        assert_eq!(api.get_access_token().as_deref(), Some("jwt_new"));
        assert_eq!(store.current().as_deref(), Some("rt_rotated"));
        assert_eq!(auth_events.load(Ordering::SeqCst), 1);

        server_handle.abort();
    }

    #[tokio::test]
    async fn transient_5xx_and_network_errors_preserve_stored_refresh_token() {
        // Case 1: 503 Service Unavailable
        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |_req| {
            Box::pin(async move {
                MockResponse {
                    status_line: "503 Service Unavailable",
                    body: r#"{"message":"Maintenance"}"#.to_string(),
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_valid"));
        let api = ApiState::new_with_store(base_url, store.clone());
        let err = api.refresh_session(None).await.unwrap_err();
        assert!(matches!(err, RefreshError::Transient(_)));
        assert_eq!(store.current().as_deref(), Some("rt_valid"));
        assert_eq!(store.delete_calls.load(Ordering::SeqCst), 0);
        server_handle.abort();

        // Case 2: Connection refused (bind and immediately drop listener)
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let dead_addr = listener.local_addr().unwrap();
        drop(listener);

        let api_offline =
            ApiState::new_with_store(format!("http://{}/api/v1", dead_addr), store.clone());
        let err = api_offline.refresh_session(None).await.unwrap_err();
        assert!(matches!(err, RefreshError::Transient(_)));
        assert_eq!(store.current().as_deref(), Some("rt_valid"));
        assert_eq!(store.delete_calls.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn definitive_401_and_success_false_clear_session_and_delete_token() {
        // Case 1: HTTP 401 from /auth/public/refresh
        let auth_events = Arc::new(AtomicUsize::new(0));
        let auth_events_clone = Arc::clone(&auth_events);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |_req| {
            Box::pin(async move {
                MockResponse {
                    status_line: "401 Unauthorized",
                    body: r#"{"message":"Refresh token expired"}"#.to_string(),
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_expired"));
        let api = ApiState::new_with_store(base_url, store.clone()).with_auth_change_listener(
            move || {
                auth_events_clone.fetch_add(1, Ordering::SeqCst);
            },
        );
        *api.access_token.lock().unwrap() = Some("old_jwt".to_string());

        let err = api.refresh_session(Some("old_jwt")).await.unwrap_err();
        assert_eq!(
            err,
            RefreshError::SessionExpired("Refresh token expired".to_string())
        );
        assert!(!api.is_logged_in());
        assert_eq!(store.current(), None);
        assert_eq!(auth_events.load(Ordering::SeqCst), 1);
        server_handle.abort();

        // Case 2: HTTP 200 with success=false
        let auth_events_2 = Arc::new(AtomicUsize::new(0));
        let auth_events_2_clone = Arc::clone(&auth_events_2);

        let (base_url_2, server_handle_2) = spawn_mock_server(Arc::new(move |_req| {
            Box::pin(async move {
                MockResponse {
                    status_line: "200 OK",
                    body: r#"{"message":"Token revoked","success":false}"#.to_string(),
                }
            })
        }))
        .await;

        let store_2 = MockTokenStore::with_token(Some("rt_revoked"));
        let api_2 = ApiState::new_with_store(base_url_2, store_2.clone())
            .with_auth_change_listener(move || {
                auth_events_2_clone.fetch_add(1, Ordering::SeqCst);
            });
        *api_2.access_token.lock().unwrap() = Some("old_jwt".to_string());

        let err_2 = api_2.refresh_session(Some("old_jwt")).await.unwrap_err();
        assert_eq!(
            err_2,
            RefreshError::SessionExpired("Token revoked".to_string())
        );
        assert!(!api_2.is_logged_in());
        assert_eq!(store_2.current(), None);
        assert_eq!(auth_events_2.load(Ordering::SeqCst), 1);
        server_handle_2.abort();
    }

    #[tokio::test]
    async fn success_true_without_access_token_fails_without_deleting_refresh_token() {
        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |_req| {
            Box::pin(async move {
                MockResponse {
                    status_line: "200 OK",
                    body: r#"{"message":"Malformed","success":true,"refreshToken":"rt_2"}"#
                        .to_string(),
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_1"));
        let api = ApiState::new_with_store(base_url, store.clone());

        let err = api.refresh_session(None).await.unwrap_err();
        assert!(matches!(err, RefreshError::Transient(_)));
        assert_eq!(store.current().as_deref(), Some("rt_1"));
        assert_eq!(store.delete_calls.load(Ordering::SeqCst), 0);
        assert!(!api.is_logged_in());

        server_handle.abort();
    }

    #[tokio::test]
    async fn concurrent_401_requests_trigger_only_single_refresh() {
        let barrier = Arc::new(Barrier::new(2));
        let refresh_calls = Arc::new(AtomicUsize::new(0));
        let barrier_clone = Arc::clone(&barrier);
        let refresh_calls_clone = Arc::clone(&refresh_calls);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |req| {
            let barrier = Arc::clone(&barrier_clone);
            let refresh_calls = Arc::clone(&refresh_calls_clone);
            Box::pin(async move {
                match req.path.as_str() {
                    "/api/v1/sync" => {
                        let auth = req.headers.get("authorization").cloned().unwrap_or_default();
                        if auth == "Bearer expired_jwt" {
                            barrier.wait().await;
                            MockResponse {
                                status_line: "401 Unauthorized",
                                body: r#"{"message":"Expired"}"#.to_string(),
                            }
                        } else if auth == "Bearer fresh_jwt" {
                            MockResponse {
                                status_line: "200 OK",
                                body: r#"{"ok":true}"#.to_string(),
                            }
                        } else {
                            MockResponse {
                                status_line: "401 Unauthorized",
                                body: r#"{"message":"Bad token"}"#.to_string(),
                            }
                        }
                    }
                    "/api/v1/auth/public/refresh" => {
                        let call_idx = refresh_calls.fetch_add(1, Ordering::SeqCst);
                        if call_idx > 0 {
                            return MockResponse {
                                status_line: "401 Unauthorized",
                                body: r#"{"message":"Refresh token already used"}"#.to_string(),
                            };
                        }
                        tokio::time::sleep(Duration::from_millis(30)).await;
                        MockResponse {
                            status_line: "200 OK",
                            body: r#"{"message":"OK","success":true,"accessToken":"fresh_jwt","refreshToken":"rt_2"}"#.to_string(),
                        }
                    }
                    _ => MockResponse {
                        status_line: "404 Not Found",
                        body: "{}".to_string(),
                    },
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_1"));
        let api = Arc::new(ApiState::new_with_store(base_url, store.clone()));
        *api.access_token.lock().unwrap() = Some("expired_jwt".to_string());

        let (res1, res2) = tokio::join!(
            api.post::<DummyReq, DummyRes>("/sync", &DummyReq { ping: "1" }),
            api.post::<DummyReq, DummyRes>("/sync", &DummyReq { ping: "2" })
        );

        assert_eq!(res1.unwrap(), DummyRes { ok: true });
        assert_eq!(res2.unwrap(), DummyRes { ok: true });
        assert_eq!(refresh_calls.load(Ordering::SeqCst), 1);
        assert_eq!(api.get_access_token().as_deref(), Some("fresh_jwt"));
        assert_eq!(store.current().as_deref(), Some("rt_2"));

        server_handle.abort();
    }

    #[tokio::test]
    async fn logout_clears_ram_and_token_store_without_panicking_on_store_error() {
        let auth_events = Arc::new(AtomicUsize::new(0));
        let auth_events_clone = Arc::clone(&auth_events);

        // Normal logout
        let store = MockTokenStore::with_token(Some("rt_1"));
        let api = ApiState::new_with_store("http://127.0.0.1:1/api/v1".to_string(), store.clone())
            .with_auth_change_listener(move || {
                auth_events_clone.fetch_add(1, Ordering::SeqCst);
            });
        *api.access_token.lock().unwrap() = Some("jwt_1".to_string());

        let msg = AuthService::logout(&api).await.unwrap();
        assert_eq!(msg, "Successfully logged out");
        assert!(!api.is_logged_in());
        assert_eq!(store.current(), None);
        assert_eq!(auth_events.load(Ordering::SeqCst), 1);

        // Failing token store deletion must return Err instead of panicking, and still clear RAM JWT
        let failing_store = MockTokenStore::with_token(Some("rt_2"));
        *failing_store.delete_error.lock().unwrap() = Some("Keyring locked".to_string());
        let api_failing =
            ApiState::new_with_store("http://127.0.0.1:1/api/v1".to_string(), failing_store);
        *api_failing.access_token.lock().unwrap() = Some("jwt_2".to_string());

        let err = AuthService::logout(&api_failing).await.unwrap_err();
        assert!(err.contains("Keyring locked"));
        assert!(!api_failing.is_logged_in());
    }

    #[tokio::test]
    async fn public_auth_endpoints_do_not_send_stale_authorization_header() {
        let saw_auth_header = Arc::new(AtomicBool::new(false));
        let saw_auth_header_clone = Arc::clone(&saw_auth_header);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |req| {
            let saw_auth_header = Arc::clone(&saw_auth_header_clone);
            Box::pin(async move {
                assert_eq!(req.path, "/api/v1/auth/public/login");
                if req.headers.contains_key("authorization") {
                    saw_auth_header.store(true, Ordering::SeqCst);
                }
                MockResponse {
                    status_line: "200 OK",
                    body: r#"{"message":"Logged in","success":true,"accessToken":"login_jwt","refreshToken":"login_rt"}"#.to_string(),
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(None);
        let api = ApiState::new_with_store(base_url, store.clone());
        *api.access_token.lock().unwrap() = Some("stale_jwt".to_string());

        let msg = AuthService::login(
            &api,
            LoginRequest {
                email: "user@example.com".to_string(),
                password: "secret".to_string(),
            },
        )
        .await
        .unwrap();

        assert_eq!(msg, "Logged in");
        assert!(!saw_auth_header.load(Ordering::SeqCst));
        assert_eq!(api.get_access_token().as_deref(), Some("login_jwt"));
        assert_eq!(store.current().as_deref(), Some("login_rt"));

        server_handle.abort();
    }

    #[tokio::test]
    async fn ensure_authenticated_skips_when_logged_out_and_recovers_after_offline_startup() {
        // Subcase 1: Empty store inspects store once and then skips without re-reading
        let empty_store = MockTokenStore::with_token(None);
        let api_logged_out =
            ApiState::new_with_store("http://127.0.0.1:1/api/v1".to_string(), empty_store.clone());
        assert!(!api_logged_out.ensure_authenticated().await.unwrap());
        assert_eq!(empty_store.get_calls.load(Ordering::SeqCst), 1);
        assert!(!api_logged_out.ensure_authenticated().await.unwrap());
        assert_eq!(empty_store.get_calls.load(Ordering::SeqCst), 1);

        // Subcase 2: Offline startup (503) preserves token and recovers once server returns 200
        let attempt = Arc::new(AtomicUsize::new(0));
        let attempt_clone = Arc::clone(&attempt);
        let auth_events = Arc::new(AtomicUsize::new(0));
        let auth_events_clone = Arc::clone(&auth_events);

        let (base_url, server_handle) = spawn_mock_server(Arc::new(move |_req| {
            let attempt = Arc::clone(&attempt_clone);
            Box::pin(async move {
                if attempt.fetch_add(1, Ordering::SeqCst) == 0 {
                    MockResponse {
                        status_line: "503 Service Unavailable",
                        body: r#"{"message":"Temporarily offline"}"#.to_string(),
                    }
                } else {
                    MockResponse {
                        status_line: "200 OK",
                        body: r#"{"message":"Recovered","success":true,"accessToken":"recovered_jwt","refreshToken":"rt_recovered"}"#.to_string(),
                    }
                }
            })
        }))
        .await;

        let store = MockTokenStore::with_token(Some("rt_initial"));
        let api = ApiState::new_with_store(base_url, store.clone()).with_auth_change_listener(
            move || {
                auth_events_clone.fetch_add(1, Ordering::SeqCst);
            },
        );

        let first = api.ensure_authenticated().await;
        assert!(matches!(first, Err(RefreshError::Transient(_))));
        assert!(!api.is_logged_in());
        assert_eq!(store.current().as_deref(), Some("rt_initial"));

        let second = api.ensure_authenticated().await.unwrap();
        assert!(second);
        assert!(api.is_logged_in());
        assert_eq!(api.get_access_token().as_deref(), Some("recovered_jwt"));
        assert_eq!(store.current().as_deref(), Some("rt_recovered"));
        assert_eq!(auth_events.load(Ordering::SeqCst), 1);

        server_handle.abort();
    }
}
