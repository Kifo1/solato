use chrono::{DateTime, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

use crate::database::models::session::{SessionType, TimerMode};
use crate::log;
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
        log!("INFO", "Starting cloud synchronization via SyncService...");

        let last_synced_at = Self::get_last_synced_at(pool).await;

        let filter_time = last_synced_at
            .map(|t| t.format("%Y-%m-%d %H:%M:%S").to_string())
            .unwrap_or_else(|| "1970-01-01 00:00:00".to_string());

        log!(
            "DEBUG",
            &format!("Filtering local changes since: {}", filter_time)
        );

        let local_projects = sqlx::query!(
            r#"
            SELECT id as "id!", name, description, color, created_at as "created_at!", updated_at as "updated_at!", is_deleted
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
            projects: local_projects,
            sessions: local_sessions,
        };

        let response: SyncResponse = match api_state.post("/sync", &request_payload).await {
            Ok(res) => res,
            Err(e) => {
                log!("ERROR", &format!("API sync request failed: {}", e));
                return Err(format!("Sync cancelled: {}", e));
            }
        };
        log!(
            "INFO",
            "Sync payload successfully transmitted. Applying cloud updates..."
        );

        log!(
            "DEBUG",
            &format!(
                "Received {} projects and {} sessions from cloud",
                response.projects.len(),
                response.sessions.len()
            )
        );

        for cloud_project in response.projects {
            let p_id = cloud_project.id.to_string();
            log!("DEBUG", &format!("Upserting project: {}", p_id));
            let p_created = cloud_project
                .created_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let p_updated = cloud_project
                .updated_at
                .to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
            let p_deleted = if cloud_project.is_deleted { 1 } else { 0 };

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
                .map_err(|e| format!("Database error on project upsert: {}", e))?;
        }

        for cloud_session in response.sessions {
            let s_id = cloud_session.id.to_string();
            log!("DEBUG", &format!("Upserting session: {}", s_id));
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

            sqlx::query!(
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
                WHERE excluded.updated_at > sessions.updated_at
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
                .map_err(|e| format!("Database error on session upsert: {}", e))?;
        }

        Self::set_last_synced_at(pool, response.sync_timestamp)
            .await
            .map_err(|e| format!("Failed to update local sync timestamp: {}", e))?;

        log!("INFO", "Cloud sync completed successfully.");
        Ok(())
    }
}