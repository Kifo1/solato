use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use std::collections::HashSet;
use uuid::Uuid;

use crate::api::api_client::RefreshError;
use crate::database::models::session::{SessionType, TimerMode};
use crate::models::sync::folder_sync::FolderSync;
use crate::models::sync::project_sync::ProjectSync;
use crate::models::sync::session_sync::SessionSync;
use crate::models::sync::sync_request::SyncRequest;
use crate::models::sync::sync_response::SyncResponse;
use crate::ApiState;

fn parse_datetime(s: &str) -> DateTime<Utc> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return dt.with_timezone(&Utc);
    }
    if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc);
    }
    Utc::now()
}

/// Orders folders topologically so parent folders are always upserted before their children.
fn order_folders_parents_first(folders: Vec<FolderSync>) -> Vec<FolderSync> {
    let mut remaining = folders;
    let mut ordered = Vec::with_capacity(remaining.len());
    let mut placed_ids: HashSet<Uuid> = HashSet::new();

    while !remaining.is_empty() {
        let remaining_ids: HashSet<Uuid> = remaining.iter().map(|f| f.id).collect();
        let mut next_remaining = Vec::new();
        let mut progressed = false;

        for folder in remaining {
            let parent_ready = match folder.parent_id.flatten() {
                None => true,
                Some(pid) => placed_ids.contains(&pid) || !remaining_ids.contains(&pid),
            };
            if parent_ready {
                placed_ids.insert(folder.id);
                ordered.push(folder);
                progressed = true;
            } else {
                next_remaining.push(folder);
            }
        }

        if !progressed {
            // Break any cycle defensively by appending remaining entries.
            ordered.extend(next_remaining);
            break;
        }
        remaining = next_remaining;
    }

    ordered
}

#[derive(Debug, PartialEq, Eq)]
pub enum SyncOutcome {
    Synced,
    NotLoggedIn,
}

pub struct SyncService;

impl SyncService {
    async fn get_last_synced_at(pool: &SqlitePool) -> Option<DateTime<Utc>> {
        let row: Option<(String,)> =
            sqlx::query_as("SELECT value FROM sync_meta WHERE key = 'last_synced_at'")
                .fetch_optional(pool)
                .await
                .unwrap_or(None);

        row.and_then(|(val,)| {
            DateTime::parse_from_rfc3339(&val)
                .map(|dt| dt.with_timezone(&Utc))
                .ok()
        })
    }

    async fn set_last_synced_at(
        pool: &SqlitePool,
        timestamp: DateTime<Utc>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO sync_meta (key, value) VALUES ('last_synced_at', ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        )
        .bind(timestamp.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
        .execute(pool)
        .await?;
        Ok(())
    }

    pub async fn execute_sync(api_state: &ApiState, pool: &SqlitePool) -> Result<(), String> {
        Self::execute_sync_with_status(api_state, pool)
            .await
            .map(|_| ())
    }

    pub async fn execute_sync_with_status(
        api_state: &ApiState,
        pool: &SqlitePool,
    ) -> Result<SyncOutcome, String> {
        let _sync_guard = api_state.lock_sync().await;

        match api_state.ensure_authenticated().await {
            Ok(true) => {}
            Ok(false) | Err(RefreshError::NoRefreshToken) => {
                log::debug!("Skipping cloud sync: user is not logged in.");
                return Ok(SyncOutcome::NotLoggedIn);
            }
            Err(RefreshError::SessionExpired(msg)) => {
                log::warn!("Skipping cloud sync: session expired ({})", msg);
                return Err(format!("Sync cancelled: Session expired ({})", msg));
            }
            Err(RefreshError::Transient(msg)) => {
                log::warn!(
                    "Skipping cloud sync: authentication refresh temporarily failed ({})",
                    msg
                );
                return Err(format!("Sync cancelled: {}", msg));
            }
        }

        log::info!("Starting cloud synchronization via SyncService...");

        let last_synced_at = Self::get_last_synced_at(pool).await;

        let filter_time = last_synced_at
            .map(|t| t.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_else(|| "1970-01-01 00:00:00".to_string());

        let rfc3339_filter_time = last_synced_at
            .map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, true))
            .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string());

        log::debug!("Filtering local changes since: {}", filter_time);

        let local_folders = sqlx::query!(
            r#"
            SELECT id as "id!", name, color, parent_id, created_at as "created_at!", updated_at as "updated_at!", is_deleted
            FROM folders
            WHERE updated_at > ?
            "#,
            rfc3339_filter_time
        )
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch local folders: {}", e))?
        .into_iter()
        .map(|row| FolderSync {
            id: Uuid::parse_str(&row.id).unwrap_or_default(),
            name: row.name,
            color: row.color,
            parent_id: Some(
                row.parent_id
                    .as_deref()
                    .and_then(|id| Uuid::parse_str(id).ok()),
            ),
            created_at: parse_datetime(&row.created_at),
            updated_at: parse_datetime(&row.updated_at),
            is_deleted: row.is_deleted != 0,
        })
        .collect::<Vec<_>>();

        let local_projects = sqlx::query!(
            r#"
            SELECT id as "id!", name, description, color, folder_id, created_at as "created_at!", updated_at as "updated_at!", is_deleted
            FROM projects
            WHERE updated_at > ?
            "#,
            filter_time
        )
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch local projects: {}", e))?
            .into_iter()
            .map(|row| ProjectSync {
                id: Uuid::parse_str(&row.id).unwrap_or_default(),
                name: row.name,
                description: row.description,
                color: row.color,
                folder_id: Some(
                    row.folder_id
                        .as_deref()
                        .and_then(|id| Uuid::parse_str(id).ok()),
                ),
                created_at: parse_datetime(&row.created_at),
                updated_at: parse_datetime(&row.updated_at),
                is_deleted: row.is_deleted != 0,
            })
            .collect::<Vec<_>>();

        let local_sessions = sqlx::query!(
            r#"
                SELECT id as "id!", project_id as "project_id!", start_time as "start_time!", end_time, session_type as "session_type!", mode as "mode!", updated_at as "updated_at!", is_deleted
                FROM sessions
                WHERE updated_at > ?
            "#,
            filter_time
        )
            .fetch_all(pool)
            .await
            .map_err(|e| format!("Failed to fetch local sessions: {}", e))?
            .into_iter()
            .map(|row| {
                let session_type = serde_json::from_value(serde_json::Value::String(row.session_type))
                    .unwrap_or(SessionType::Focus);
                let mode = serde_json::from_value(serde_json::Value::String(row.mode))
                    .unwrap_or(TimerMode::Stopwatch);

                SessionSync {
                    id: Uuid::parse_str(&row.id).unwrap_or_default(),
                    project_id: Uuid::parse_str(&row.project_id).unwrap_or_default(),
                    start_time: parse_datetime(&row.start_time),
                    end_time: row.end_time.as_deref().map(parse_datetime),
                    session_type,
                    mode,
                    updated_at: parse_datetime(&row.updated_at),
                    is_deleted: row.is_deleted != 0,
                }
            })
            .collect::<Vec<_>>();

        let request_payload = SyncRequest {
            last_synced_at,
            folders: local_folders,
            projects: local_projects,
            sessions: local_sessions,
        };

        let response: SyncResponse = match api_state.post("/sync", &request_payload).await {
            Ok(res) => res,
            Err(e) => {
                log::error!("API sync request failed: {}", e);
                return Err(format!("Sync cancelled: {}", e));
            }
        };
        log::info!("Sync payload successfully transmitted. Applying cloud updates...");

        log::debug!(
            "Received {} folders, {} projects and {} sessions from cloud",
            response.folders.len(),
            response.projects.len(),
            response.sessions.len()
        );

        // Upsert folders topologically (parents before children) before projects so all foreign keys are satisfied.
        for cloud_folder in order_folders_parents_first(response.folders) {
            let f_id = cloud_folder.id.to_string();
            log::debug!("Upserting folder: {}", f_id);
            let f_created = cloud_folder
                .created_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let f_updated = cloud_folder
                .updated_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let f_deleted = if cloud_folder.is_deleted { 1 } else { 0 };

            let upsert_result = match cloud_folder.parent_id {
                Some(opt_parent_id) => {
                    let f_parent_id = opt_parent_id.map(|id| id.to_string());
                    sqlx::query!(
                        r#"
                            INSERT INTO folders (id, name, color, parent_id, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                color = excluded.color,
                                parent_id = excluded.parent_id,
                                updated_at = excluded.updated_at,
                                is_deleted = excluded.is_deleted
                            WHERE excluded.updated_at > folders.updated_at
                        "#,
                        f_id,
                        cloud_folder.name,
                        cloud_folder.color,
                        f_parent_id,
                        f_created,
                        f_updated,
                        f_deleted
                    )
                    .execute(pool)
                    .await
                }
                // Server omitted parentId -> preserve local parent_id on conflict.
                None => {
                    sqlx::query!(
                        r#"
                            INSERT INTO folders (id, name, color, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                color = excluded.color,
                                updated_at = excluded.updated_at,
                                is_deleted = excluded.is_deleted
                            WHERE excluded.updated_at > folders.updated_at
                        "#,
                        f_id,
                        cloud_folder.name,
                        cloud_folder.color,
                        f_created,
                        f_updated,
                        f_deleted
                    )
                    .execute(pool)
                    .await
                }
            };

            if let Err(e) = upsert_result {
                log::error!("Database error on folder upsert (id={}): {}", f_id, e);
                continue;
            }
        }

        for cloud_project in response.projects {
            let p_id = cloud_project.id.to_string();
            log::debug!("Upserting project: {}", p_id);
            let p_created = cloud_project
                .created_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let p_updated = cloud_project
                .updated_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let p_deleted = if cloud_project.is_deleted { 1 } else { 0 };

            let upsert_result = match cloud_project.folder_id {
                Some(opt_folder_id) => {
                    let p_folder_id = opt_folder_id.map(|id| id.to_string());
                    sqlx::query!(
                        r#"
                            INSERT INTO projects (id, name, description, color, folder_id, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                description = excluded.description,
                                color = excluded.color,
                                folder_id = excluded.folder_id,
                                updated_at = excluded.updated_at,
                                is_deleted = excluded.is_deleted
                            WHERE excluded.updated_at > projects.updated_at
                        "#,
                        p_id,
                        cloud_project.name,
                        cloud_project.description,
                        cloud_project.color,
                        p_folder_id,
                        p_created,
                        p_updated,
                        p_deleted
                    )
                    .execute(pool)
                    .await
                }
                // Server omitted folderId (legacy API without folder support) -> preserve local folder_id on conflict.
                None => {
                    sqlx::query!(
                        r#"
                            INSERT INTO projects (id, name, description, color, created_at, updated_at, is_deleted)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                name = excluded.name,
                                description = excluded.description,
                                color = excluded.color,
                                updated_at = excluded.updated_at,
                                is_deleted = excluded.is_deleted
                            WHERE excluded.updated_at > projects.updated_at
                        "#,
                        p_id,
                        cloud_project.name,
                        cloud_project.description,
                        cloud_project.color,
                        p_created,
                        p_updated,
                        p_deleted
                    )
                    .execute(pool)
                    .await
                }
            };

            if let Err(e) = upsert_result {
                log::error!("Database error on project upsert (id={}): {}", p_id, e);
                continue;
            }
        }

        for cloud_session in response.sessions {
            let s_id = cloud_session.id.to_string();
            log::debug!("Upserting session: {}", s_id);
            let s_project_id = cloud_session.project_id.to_string();
            let s_start = cloud_session
                .start_time
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let s_end = cloud_session
                .end_time
                .map(|t| t.to_rfc3339_opts(chrono::SecondsFormat::Secs, true));

            let s_type = serde_json::to_value(&cloud_session.session_type)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| "Focus".to_string());

            let s_mode = serde_json::to_value(&cloud_session.mode)
                .ok()
                .and_then(|v| v.as_str().map(String::from))
                .unwrap_or_else(|| "Stopwatch".to_string());

            let s_updated = cloud_session
                .updated_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let s_deleted = if cloud_session.is_deleted { 1 } else { 0 };

            if let Err(e) = sqlx::query!(
        r#"
            INSERT INTO sessions (id, project_id, start_time, end_time, session_type, mode, updated_at, is_deleted)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                project_id = excluded.project_id,
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                session_type = excluded.session_type,
                mode = excluded.mode,
                updated_at = excluded.updated_at,
                is_deleted = excluded.is_deleted
            WHERE sessions.updated_at IS NULL OR excluded.updated_at > sessions.updated_at
        "#,
        s_id,
        s_project_id,
        s_start,
        s_end,
        s_type,
        s_mode,
        s_updated,
        s_deleted
    )
                .execute(pool)
                .await
            {
                log::error!("Database error on session upsert (id={}, project_id={}): {}", s_id, s_project_id, e);
                continue;
            }
        }

        Self::set_last_synced_at(pool, response.sync_timestamp)
            .await
            .map_err(|e| format!("Failed to update local sync timestamp: {}", e))?;

        log::info!("Cloud sync completed successfully.");
        Ok(SyncOutcome::Synced)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::token_store::TokenStore;
    use crate::services::folder_service::{create_folder_in_pool, get_folders_in_pool};
    use crate::services::project_service::{create_project_in_pool, get_projects_in_pool};
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;
    use std::sync::{Arc, Mutex};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    struct DummyTokenStore;

    impl TokenStore for DummyTokenStore {
        fn get_refresh_token(&self) -> Result<Option<String>, String> {
            Ok(None)
        }
        fn set_refresh_token(&self, _token: &str) -> Result<(), String> {
            Ok(())
        }
        fn delete_refresh_token(&self) -> Result<(), String> {
            Ok(())
        }
    }

    async fn setup_test_pool() -> SqlitePool {
        let options = SqliteConnectOptions::from_str("sqlite::memory:")
            .unwrap()
            .pragma("foreign_keys", "ON");
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await
            .unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    async fn spawn_sync_mock(
        response_body: String,
    ) -> (
        String,
        Arc<Mutex<Option<String>>>,
        tokio::task::JoinHandle<()>,
    ) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let base_url = format!("http://{}/api/v1", addr);
        let captured = Arc::new(Mutex::new(None));
        let captured_clone = Arc::clone(&captured);

        let handle = tokio::spawn(async move {
            let Ok((mut socket, _)) = listener.accept().await else {
                return;
            };
            let mut buf = Vec::new();
            let mut tmp = [0u8; 1024];
            let header_end;
            loop {
                let n = socket.read(&mut tmp).await.unwrap_or(0);
                if n == 0 {
                    return;
                }
                buf.extend_from_slice(&tmp[..n]);
                if let Some(pos) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
                    header_end = pos + 4;
                    break;
                }
            }

            let header_text = String::from_utf8_lossy(&buf[..header_end - 4]);
            let mut content_length = 0usize;
            for line in header_text.split("\r\n").skip(1) {
                if let Some((k, v)) = line.split_once(':') {
                    if k.trim().eq_ignore_ascii_case("content-length") {
                        content_length = v.trim().parse().unwrap_or(0);
                    }
                }
            }
            while buf.len() < header_end + content_length {
                let n = socket.read(&mut tmp).await.unwrap_or(0);
                if n == 0 {
                    break;
                }
                buf.extend_from_slice(&tmp[..n]);
            }
            let body =
                String::from_utf8_lossy(&buf[header_end..header_end + content_length]).to_string();
            *captured_clone.lock().unwrap() = Some(body);

            let resp = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                response_body.len(),
                response_body
            );
            let _ = socket.write_all(resp.as_bytes()).await;
            let _ = socket.flush().await;
            let _ = socket.shutdown().await;
        });

        (base_url, captured, handle)
    }

    #[tokio::test]
    async fn execute_sync_uploads_local_folders_and_upserts_nested_cloud_folders_topologically() {
        let pool = setup_test_pool().await;

        let local_root_id =
            create_folder_in_pool(&pool, "Local Root".into(), "#10B981".into(), None)
                .await
                .unwrap();
        let local_sub_id = create_folder_in_pool(
            &pool,
            "Local Sub".into(),
            "#06B6D4".into(),
            Some(local_root_id.clone()),
        )
        .await
        .unwrap();
        let local_project_id = create_project_in_pool(
            &pool,
            "Local Project".into(),
            "Desc".into(),
            "#3B82F6".into(),
            Some(local_sub_id.clone()),
        )
        .await
        .unwrap();

        let cloud_root_id = Uuid::new_v4();
        let cloud_child_id = Uuid::new_v4();
        let cloud_grandchild_id = Uuid::new_v4();
        let cloud_project_id = Uuid::new_v4();

        // Intentionally return folders in reverse hierarchy order (grandchild -> child -> root)
        let response_json = serde_json::json!({
            "syncTimestamp": "2026-11-21T13:00:00Z",
            "folders": [
                {
                    "id": cloud_grandchild_id,
                    "name": "Cloud Grandchild",
                    "color": "#EC4899",
                    "parentId": cloud_child_id,
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                },
                {
                    "id": cloud_child_id,
                    "name": "Cloud Child",
                    "color": "#8B5CF6",
                    "parentId": cloud_root_id,
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                },
                {
                    "id": cloud_root_id,
                    "name": "Cloud Root",
                    "color": "#F59E0B",
                    "parentId": null,
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                }
            ],
            "projects": [{
                "id": cloud_project_id,
                "name": "Cloud Project",
                "description": "From other device",
                "color": "#8B5CF6",
                "folderId": cloud_grandchild_id,
                "createdAt": "2026-11-21T12:00:00Z",
                "updatedAt": "2026-11-21T12:30:00Z",
                "isDeleted": false
            }],
            "sessions": []
        })
        .to_string();

        let (base_url, captured, server) = spawn_sync_mock(response_json).await;
        let api = ApiState::new_with_store(base_url, Arc::new(DummyTokenStore));
        *api.access_token.lock().unwrap() = Some("valid_jwt".to_string());

        SyncService::execute_sync(&api, &pool).await.unwrap();

        // Verify uploaded SyncRequest contains both local folders with parentId and project's folderId
        let sent_body = captured.lock().unwrap().clone().unwrap();
        let sent_json: serde_json::Value = serde_json::from_str(&sent_body).unwrap();
        let sent_folders = sent_json["folders"].as_array().unwrap();
        assert_eq!(sent_folders.len(), 2);
        let sent_sub = sent_folders
            .iter()
            .find(|f| f["id"] == local_sub_id)
            .unwrap();
        assert_eq!(sent_sub["parentId"], local_root_id);
        assert_eq!(sent_json["projects"][0]["id"], local_project_id);
        assert_eq!(sent_json["projects"][0]["folderId"], local_sub_id);

        // Verify all 3 cloud folders (despite reverse order) + cloud project with FK persisted locally
        let folders = get_folders_in_pool(&pool).await.unwrap();
        assert_eq!(folders.len(), 5);
        let grandchild = folders
            .iter()
            .find(|f| f.id == cloud_grandchild_id.to_string())
            .unwrap();
        assert_eq!(
            grandchild.parent_id.as_deref(),
            Some(cloud_child_id.to_string().as_str())
        );

        let projects = get_projects_in_pool(&pool).await.unwrap();
        let synced_proj = projects
            .iter()
            .find(|p| p.id == cloud_project_id.to_string())
            .unwrap();
        assert_eq!(
            synced_proj.folder_id.as_deref(),
            Some(cloud_grandchild_id.to_string().as_str())
        );

        server.abort();
    }

    #[test]
    fn sync_response_deserializes_tri_state_folder_id() {
        let folder_uuid = Uuid::new_v4();
        let json = serde_json::json!({
            "syncTimestamp": "2026-11-21T13:00:00Z",
            "projects": [
                {
                    "id": Uuid::new_v4(),
                    "name": "Omitted folderId",
                    "description": "Legacy server",
                    "color": "#3B82F6",
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                },
                {
                    "id": Uuid::new_v4(),
                    "name": "Explicit null folderId",
                    "description": "Unassigned on server",
                    "color": "#3B82F6",
                    "folderId": null,
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                },
                {
                    "id": Uuid::new_v4(),
                    "name": "Assigned folderId",
                    "description": "In folder on server",
                    "color": "#3B82F6",
                    "folderId": folder_uuid,
                    "createdAt": "2026-11-21T12:00:00Z",
                    "updatedAt": "2026-11-21T12:30:00Z",
                    "isDeleted": false
                }
            ],
            "sessions": []
        });

        let parsed: SyncResponse = serde_json::from_value(json).unwrap();
        assert!(parsed.folders.is_empty());
        assert_eq!(parsed.projects.len(), 3);
        assert_eq!(parsed.projects[0].folder_id, None);
        assert_eq!(parsed.projects[1].folder_id, Some(None));
        assert_eq!(parsed.projects[2].folder_id, Some(Some(folder_uuid)));
    }

    #[tokio::test]
    async fn legacy_server_omitting_folder_id_preserves_local_project_folder_assignment() {
        let pool = setup_test_pool().await;

        let folder_id = create_folder_in_pool(&pool, "DHBW".into(), "#3B82F6".into(), None)
            .await
            .unwrap();
        let project_id = create_project_in_pool(
            &pool,
            "Linux".into(),
            "OS Course".into(),
            "#10B981".into(),
            Some(folder_id.clone()),
        )
        .await
        .unwrap();

        // Simulate legacy Spring API returning a newer project WITHOUT a folderId field
        let response_json = serde_json::json!({
            "syncTimestamp": "2099-01-01T00:00:00Z",
            "projects": [{
                "id": project_id,
                "name": "Linux",
                "description": "OS Course",
                "color": "#10B981",
                "createdAt": "2026-11-21T12:00:00Z",
                "updatedAt": "2099-01-01T00:00:00Z",
                "isDeleted": false
            }],
            "sessions": []
        })
        .to_string();

        let (base_url, _captured, server) = spawn_sync_mock(response_json).await;
        let api = ApiState::new_with_store(base_url, Arc::new(DummyTokenStore));
        *api.access_token.lock().unwrap() = Some("valid_jwt".to_string());

        SyncService::execute_sync(&api, &pool).await.unwrap();

        let projects = get_projects_in_pool(&pool).await.unwrap();
        let proj = projects.iter().find(|p| p.id == project_id).unwrap();
        assert_eq!(proj.folder_id.as_deref(), Some(folder_id.as_str()));

        server.abort();
    }

    #[tokio::test]
    async fn explicit_null_folder_id_from_server_unassigns_local_project_folder() {
        let pool = setup_test_pool().await;

        let folder_id = create_folder_in_pool(&pool, "DHBW".into(), "#3B82F6".into(), None)
            .await
            .unwrap();
        let project_id = create_project_in_pool(
            &pool,
            "Linux".into(),
            "OS Course".into(),
            "#10B981".into(),
            Some(folder_id),
        )
        .await
        .unwrap();

        // Simulate updated Spring API explicitly clearing folderId to null
        let response_json = serde_json::json!({
            "syncTimestamp": "2099-01-01T00:00:00Z",
            "folders": [],
            "projects": [{
                "id": project_id,
                "name": "Linux",
                "description": "OS Course",
                "color": "#10B981",
                "folderId": null,
                "createdAt": "2026-11-21T12:00:00Z",
                "updatedAt": "2099-01-01T00:00:00Z",
                "isDeleted": false
            }],
            "sessions": []
        })
        .to_string();

        let (base_url, _captured, server) = spawn_sync_mock(response_json).await;
        let api = ApiState::new_with_store(base_url, Arc::new(DummyTokenStore));
        *api.access_token.lock().unwrap() = Some("valid_jwt".to_string());

        SyncService::execute_sync(&api, &pool).await.unwrap();

        let projects = get_projects_in_pool(&pool).await.unwrap();
        let proj = projects.iter().find(|p| p.id == project_id).unwrap();
        assert_eq!(proj.folder_id, None);

        server.abort();
    }

    #[tokio::test]
    async fn edited_and_deleted_sessions_upload_updated_state_to_api() {
        use crate::database::models::session::UpdateSessionInput;
        use crate::services::session_service::{
            delete_session_in_pool_at, update_session_in_pool_at,
        };

        let pool = setup_test_pool().await;

        let project_a = create_project_in_pool(
            &pool,
            "Project A".into(),
            "Desc".into(),
            "#3B82F6".into(),
            None,
        )
        .await
        .unwrap();
        let project_b = create_project_in_pool(
            &pool,
            "Project B".into(),
            "Desc".into(),
            "#10B981".into(),
            None,
        )
        .await
        .unwrap();

        let session_id = Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO sessions (id, project_id, start_time, end_time, session_type, mode, updated_at, is_deleted)
             VALUES (?, ?, ?, ?, 'FOCUS', 'STOPWATCH', ?, 0)",
        )
        .bind(&session_id)
        .bind(&project_a)
        .bind("2026-11-23T10:00:00Z")
        .bind("2026-11-23T18:00:00Z")
        .bind("2026-11-23T18:00:00Z")
        .execute(&pool)
        .await
        .unwrap();

        // Simulate a prior completed sync at 18:05:00Z
        SyncService::set_last_synced_at(
            &pool,
            DateTime::parse_from_rfc3339("2026-11-23T18:05:00Z")
                .unwrap()
                .with_timezone(&Utc),
        )
        .await
        .unwrap();

        // User edits the session right at 18:05:00Z (same second as last sync!) to trim forgotten timer
        let edit_now = DateTime::parse_from_rfc3339("2026-11-23T18:05:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let new_start = DateTime::parse_from_rfc3339("2026-11-23T10:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let new_end = DateTime::parse_from_rfc3339("2026-11-23T11:30:00Z")
            .unwrap()
            .with_timezone(&Utc);

        update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: project_b.clone(),
                start_time: new_start,
                end_time: new_end,
                session_type: SessionType::ShortBreak,
                mode: TimerMode::Pomodoro,
            },
            None,
            edit_now,
        )
        .await
        .unwrap();

        // 1) Sync after edit
        let edit_response = serde_json::json!({
            "syncTimestamp": "2026-11-23T18:05:05Z",
            "folders": [],
            "projects": [],
            "sessions": []
        })
        .to_string();
        let (base_url, captured_edit, server_edit) = spawn_sync_mock(edit_response).await;
        let api = ApiState::new_with_store(base_url, Arc::new(DummyTokenStore));
        *api.access_token.lock().unwrap() = Some("valid_jwt".to_string());

        let outcome = SyncService::execute_sync_with_status(&api, &pool)
            .await
            .unwrap();
        assert_eq!(outcome, SyncOutcome::Synced);

        let sent_edit_body = captured_edit.lock().unwrap().clone().unwrap();
        let sent_edit_json: serde_json::Value = serde_json::from_str(&sent_edit_body).unwrap();
        let sent_sessions = sent_edit_json["sessions"].as_array().unwrap();
        assert_eq!(sent_sessions.len(), 1);
        assert_eq!(sent_sessions[0]["id"], session_id);
        assert_eq!(sent_sessions[0]["projectId"], project_b);
        assert_eq!(sent_sessions[0]["startTime"], "2026-11-23T10:00:00Z");
        assert_eq!(sent_sessions[0]["endTime"], "2026-11-23T11:30:00Z");
        assert_eq!(sent_sessions[0]["sessionType"], "SHORT_BREAK");
        assert_eq!(sent_sessions[0]["mode"], "POMODORO");
        assert_eq!(sent_sessions[0]["isDeleted"], false);
        assert_eq!(sent_sessions[0]["updatedAt"], "2026-11-23T18:05:01Z");
        server_edit.abort();

        // 2) Soft-delete the session and verify deletion syncs with newer updatedAt
        let delete_now = DateTime::parse_from_rfc3339("2026-11-23T18:05:05Z")
            .unwrap()
            .with_timezone(&Utc);
        delete_session_in_pool_at(&pool, session_id.clone(), None, delete_now)
            .await
            .unwrap();

        let delete_response = serde_json::json!({
            "syncTimestamp": "2026-11-23T18:05:10Z",
            "folders": [],
            "projects": [],
            "sessions": []
        })
        .to_string();
        let (base_url_del, captured_del, server_del) = spawn_sync_mock(delete_response).await;
        let api_del = ApiState::new_with_store(base_url_del, Arc::new(DummyTokenStore));
        *api_del.access_token.lock().unwrap() = Some("valid_jwt".to_string());

        let del_outcome = SyncService::execute_sync_with_status(&api_del, &pool)
            .await
            .unwrap();
        assert_eq!(del_outcome, SyncOutcome::Synced);

        let sent_del_body = captured_del.lock().unwrap().clone().unwrap();
        let sent_del_json: serde_json::Value = serde_json::from_str(&sent_del_body).unwrap();
        let sent_del_sessions = sent_del_json["sessions"].as_array().unwrap();
        assert_eq!(sent_del_sessions.len(), 1);
        assert_eq!(sent_del_sessions[0]["id"], session_id);
        assert_eq!(sent_del_sessions[0]["isDeleted"], true);
        assert_eq!(sent_del_sessions[0]["updatedAt"], "2026-11-23T18:05:06Z");
        server_del.abort();
    }
}
