use crate::{
    database::models::session::{SessionEntry, SessionType, TimerMode, UpdateSessionInput},
    models::dbstate::DbState,
};
use chrono::{DateTime, Duration, NaiveDateTime, SecondsFormat, Utc};
use sqlx::SqlitePool;
use uuid::Uuid;

const FUTURE_TOLERANCE_SECONDS: i64 = 60;

fn parse_timestamp(s: &str) -> Option<DateTime<Utc>> {
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(dt) = DateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f%:z") {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(dt) = DateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f%#z") {
        return Some(dt.with_timezone(&Utc));
    }
    if let Ok(naive) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S%.f") {
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }
    if let Ok(naive) = NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Some(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc));
    }
    None
}

fn truncate_to_seconds(dt: DateTime<Utc>) -> DateTime<Utc> {
    DateTime::from_timestamp(dt.timestamp(), 0).unwrap_or(dt)
}

fn parse_session_type(value: &str) -> SessionType {
    serde_json::from_value(serde_json::Value::String(value.to_string()))
        .unwrap_or(SessionType::Focus)
}

fn parse_timer_mode(value: &str) -> TimerMode {
    serde_json::from_value(serde_json::Value::String(value.to_string()))
        .unwrap_or(TimerMode::Stopwatch)
}

/// Computes an RFC3339 whole-second UTC timestamp strictly newer than both the
/// session's previous `updated_at` and `sync_meta.last_synced_at`, ensuring
/// Last-Write-Wins sync always picks up and transmits manual edits/deletions.
async fn compute_next_updated_at(
    pool: &SqlitePool,
    existing_updated_at: Option<&str>,
    now: DateTime<Utc>,
) -> DateTime<Utc> {
    let mut candidate = truncate_to_seconds(now);

    if let Some(prev_dt) = existing_updated_at.and_then(parse_timestamp) {
        let prev_sec = truncate_to_seconds(prev_dt);
        if candidate <= prev_sec {
            candidate = prev_sec + Duration::seconds(1);
        }
    }

    let last_synced_row: Option<(String,)> =
        sqlx::query_as("SELECT value FROM sync_meta WHERE key = 'last_synced_at'")
            .fetch_optional(pool)
            .await
            .unwrap_or(None);

    if let Some(last_synced_dt) = last_synced_row
        .as_ref()
        .and_then(|(val,)| parse_timestamp(val))
    {
        let last_synced_sec = truncate_to_seconds(last_synced_dt);
        if candidate <= last_synced_sec {
            candidate = last_synced_sec + Duration::seconds(1);
        }
    }

    candidate
}

pub async fn start_session(
    project_id: String,
    session_type: SessionType,
    mode: TimerMode,
    db: &DbState,
) -> Result<String, String> {
    let pool = &db.pool;
    let now = Utc::now();
    let uuid = Uuid::new_v4().to_string();

    sqlx::query!(
        r#"
        INSERT INTO sessions (id, project_id, session_type, mode, start_time)
        VALUES (?, ?, ?, ?, ?)
        "#,
        uuid,
        project_id,
        session_type,
        mode,
        now
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(uuid)
}

pub async fn stop_session(session_id: String, db: &DbState) -> Result<(), String> {
    stop_session_at(session_id, Utc::now(), db).await
}

pub async fn stop_session_at(
    session_id: String,
    end_time: DateTime<Utc>,
    db: &DbState,
) -> Result<(), String> {
    stop_session_at_in_pool(&db.pool, session_id, end_time).await
}

pub async fn stop_session_at_in_pool(
    pool: &SqlitePool,
    session_id: String,
    end_time: DateTime<Utc>,
) -> Result<(), String> {
    let updated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true);

    sqlx::query!(
        "UPDATE sessions SET end_time = ?, updated_at = ? WHERE id = ? AND is_deleted = 0",
        end_time,
        updated_at,
        session_id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn delete_incomplete_sessions(db: &DbState) -> Result<u64, String> {
    let result = sqlx::query!("DELETE FROM sessions WHERE end_time IS NULL")
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(result.rows_affected())
}

pub async fn get_sessions_in_pool(
    pool: &SqlitePool,
    active_session_id: Option<&str>,
) -> Result<Vec<SessionEntry>, String> {
    let rows = sqlx::query!(
        r#"
        SELECT
            s.id as "id!",
            s.project_id as "project_id!",
            p.name as "project_name!",
            p.color as "project_color!",
            s.start_time as "start_time!",
            s.end_time as "end_time!",
            s.session_type as "session_type!",
            s.mode as "mode!"
        FROM sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.is_deleted = 0
          AND p.is_deleted = 0
          AND s.end_time IS NOT NULL
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let mut sessions = Vec::with_capacity(rows.len());

    for row in rows {
        if active_session_id == Some(row.id.as_str()) {
            continue;
        }

        let Some(start_time) = parse_timestamp(&row.start_time) else {
            log::warn!("Skipping session {} with unparseable start_time", row.id);
            continue;
        };
        let Some(end_time) = parse_timestamp(&row.end_time) else {
            log::warn!("Skipping session {} with unparseable end_time", row.id);
            continue;
        };

        let duration_seconds = (end_time - start_time).num_seconds().max(0);

        sessions.push(SessionEntry {
            id: row.id,
            project_id: row.project_id,
            project_name: row.project_name,
            project_color: row.project_color,
            start_time,
            end_time,
            duration_seconds,
            session_type: parse_session_type(&row.session_type),
            mode: parse_timer_mode(&row.mode),
        });
    }

    sessions.sort_by(|a, b| {
        b.start_time
            .cmp(&a.start_time)
            .then_with(|| b.end_time.cmp(&a.end_time))
    });

    Ok(sessions)
}

pub async fn update_session_in_pool(
    pool: &SqlitePool,
    input: UpdateSessionInput,
    active_session_id: Option<&str>,
) -> Result<SessionEntry, String> {
    update_session_in_pool_at(pool, input, active_session_id, Utc::now()).await
}

pub async fn update_session_in_pool_at(
    pool: &SqlitePool,
    input: UpdateSessionInput,
    active_session_id: Option<&str>,
    now: DateTime<Utc>,
) -> Result<SessionEntry, String> {
    if active_session_id == Some(input.id.as_str()) {
        return Err(
            "Cannot edit a session while the timer is running. Stop the timer first.".to_string(),
        );
    }

    let start_time = truncate_to_seconds(input.start_time);
    let end_time = truncate_to_seconds(input.end_time);

    if end_time <= start_time {
        return Err("End time must be after start time.".to_string());
    }

    if end_time > now + Duration::seconds(FUTURE_TOLERANCE_SECONDS) {
        return Err("End time cannot be in the future.".to_string());
    }

    let existing_session = sqlx::query!(
        r#"
        SELECT id as "id!", updated_at
        FROM sessions
        WHERE id = ? AND is_deleted = 0 AND end_time IS NOT NULL
        "#,
        input.id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Session not found.".to_string())?;

    let project = sqlx::query!(
        r#"
        SELECT id as "id!", name, color
        FROM projects
        WHERE id = ? AND is_deleted = 0
        "#,
        input.project_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Selected project does not exist.".to_string())?;

    let next_updated_at =
        compute_next_updated_at(pool, existing_session.updated_at.as_deref(), now).await;

    let start_str = start_time.to_rfc3339_opts(SecondsFormat::Secs, true);
    let end_str = end_time.to_rfc3339_opts(SecondsFormat::Secs, true);
    let updated_at_str = next_updated_at.to_rfc3339_opts(SecondsFormat::Secs, true);

    let result = sqlx::query!(
        r#"
        UPDATE sessions
        SET project_id = ?,
            start_time = ?,
            end_time = ?,
            session_type = ?,
            mode = ?,
            updated_at = ?
        WHERE id = ? AND is_deleted = 0
        "#,
        input.project_id,
        start_str,
        end_str,
        input.session_type,
        input.mode,
        updated_at_str,
        input.id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Session not found.".to_string());
    }

    Ok(SessionEntry {
        id: input.id,
        project_id: project.id,
        project_name: project.name,
        project_color: project.color,
        start_time,
        end_time,
        duration_seconds: (end_time - start_time).num_seconds().max(0),
        session_type: input.session_type,
        mode: input.mode,
    })
}

pub async fn delete_session_in_pool(
    pool: &SqlitePool,
    session_id: String,
    active_session_id: Option<&str>,
) -> Result<(), String> {
    delete_session_in_pool_at(pool, session_id, active_session_id, Utc::now()).await
}

pub async fn delete_session_in_pool_at(
    pool: &SqlitePool,
    session_id: String,
    active_session_id: Option<&str>,
    now: DateTime<Utc>,
) -> Result<(), String> {
    if active_session_id == Some(session_id.as_str()) {
        return Err(
            "Cannot delete a session while the timer is running. Stop the timer first.".to_string(),
        );
    }

    let existing_session = sqlx::query!(
        r#"
        SELECT id as "id!", updated_at
        FROM sessions
        WHERE id = ? AND is_deleted = 0
        "#,
        session_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?
    .ok_or_else(|| "Session not found.".to_string())?;

    let next_updated_at =
        compute_next_updated_at(pool, existing_session.updated_at.as_deref(), now).await;
    let updated_at_str = next_updated_at.to_rfc3339_opts(SecondsFormat::Secs, true);

    let result = sqlx::query!(
        r#"
        UPDATE sessions
        SET is_deleted = 1,
            updated_at = ?
        WHERE id = ? AND is_deleted = 0
        "#,
        updated_at_str,
        session_id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Session not found.".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::project_service::{create_project_in_pool, delete_project_in_pool};
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::str::FromStr;

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

    async fn seed_session(
        pool: &SqlitePool,
        project_id: &str,
        start: DateTime<Utc>,
        end: Option<DateTime<Utc>>,
        session_type: &str,
        mode: &str,
        updated_at: Option<&str>,
        is_deleted: i64,
    ) -> String {
        let id = Uuid::new_v4().to_string();
        let start_str = start.to_rfc3339_opts(SecondsFormat::Secs, true);
        let end_str = end.map(|t| t.to_rfc3339_opts(SecondsFormat::Secs, true));

        sqlx::query(
            "INSERT INTO sessions (id, project_id, start_time, end_time, session_type, mode, updated_at, is_deleted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&id)
        .bind(project_id)
        .bind(start_str)
        .bind(end_str)
        .bind(session_type)
        .bind(mode)
        .bind(updated_at)
        .bind(is_deleted)
        .execute(pool)
        .await
        .unwrap();

        id
    }

    #[tokio::test]
    async fn get_sessions_excludes_deleted_incomplete_and_active_and_sorts_newest_first() {
        let pool = setup_test_pool().await;
        let now = DateTime::parse_from_rfc3339("2026-11-23T18:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let project_id = create_project_in_pool(
            &pool,
            "Rust".into(),
            "Systems".into(),
            "#3B82F6".into(),
            None,
        )
        .await
        .unwrap();

        let older_id = seed_session(
            &pool,
            &project_id,
            now - Duration::hours(5),
            Some(now - Duration::hours(4)),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T14:00:00Z"),
            0,
        )
        .await;
        let newer_id = seed_session(
            &pool,
            &project_id,
            now - Duration::hours(2),
            Some(now - Duration::minutes(90)),
            "SHORT_BREAK",
            "POMODORO",
            Some("2026-11-23T16:30:00Z"),
            0,
        )
        .await;
        let active_id = seed_session(
            &pool,
            &project_id,
            now - Duration::minutes(10),
            Some(now - Duration::minutes(1)),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T17:59:00Z"),
            0,
        )
        .await;
        // Incomplete session (no end_time)
        seed_session(
            &pool,
            &project_id,
            now - Duration::minutes(5),
            None,
            "FOCUS",
            "STOPWATCH",
            None,
            0,
        )
        .await;
        // Soft-deleted session
        seed_session(
            &pool,
            &project_id,
            now - Duration::hours(3),
            Some(now - Duration::hours(2)),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T16:00:00Z"),
            1,
        )
        .await;

        let sessions = get_sessions_in_pool(&pool, Some(&active_id)).await.unwrap();
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, newer_id);
        assert_eq!(sessions[0].duration_seconds, 1800);
        assert_eq!(sessions[0].session_type, SessionType::ShortBreak);
        assert_eq!(sessions[0].mode, TimerMode::Pomodoro);

        assert_eq!(sessions[1].id, older_id);
        assert_eq!(sessions[1].duration_seconds, 3600);
        assert_eq!(sessions[1].project_name, "Rust");
        assert_eq!(sessions[1].project_color, "#3B82F6");
    }

    #[tokio::test]
    async fn update_session_persists_changes_and_advances_updated_at_past_last_sync() {
        let pool = setup_test_pool().await;
        let now = DateTime::parse_from_rfc3339("2026-11-23T18:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

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

        let session_id = seed_session(
            &pool,
            &project_a,
            now - Duration::hours(6),
            Some(now),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T18:00:00Z"),
            0,
        )
        .await;

        // Simulate last_synced_at slightly ahead of local clock
        sqlx::query(
            "INSERT INTO sync_meta (key, value) VALUES ('last_synced_at', '2026-11-23T18:00:02Z')",
        )
        .execute(&pool)
        .await
        .unwrap();

        let corrected_start = now - Duration::hours(6);
        let corrected_end = now - Duration::hours(5);

        let updated = update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: project_b.clone(),
                start_time: corrected_start,
                end_time: corrected_end,
                session_type: SessionType::LongBreak,
                mode: TimerMode::Pomodoro,
            },
            None,
            now,
        )
        .await
        .unwrap();

        assert_eq!(updated.project_id, project_b);
        assert_eq!(updated.project_name, "Project B");
        assert_eq!(updated.duration_seconds, 3600);
        assert_eq!(updated.session_type, SessionType::LongBreak);
        assert_eq!(updated.mode, TimerMode::Pomodoro);

        let (stored_updated_at,): (String,) =
            sqlx::query_as("SELECT updated_at FROM sessions WHERE id = ?")
                .bind(&session_id)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(stored_updated_at, "2026-11-23T18:00:03Z");
    }

    #[tokio::test]
    async fn update_session_validates_timestamps_active_session_and_project() {
        let pool = setup_test_pool().await;
        let now = DateTime::parse_from_rfc3339("2026-11-23T18:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let project_id = create_project_in_pool(
            &pool,
            "Active".into(),
            "Desc".into(),
            "#3B82F6".into(),
            None,
        )
        .await
        .unwrap();
        let deleted_project_id = create_project_in_pool(
            &pool,
            "Deleted".into(),
            "Desc".into(),
            "#EF4444".into(),
            None,
        )
        .await
        .unwrap();
        delete_project_in_pool(&pool, deleted_project_id.clone())
            .await
            .unwrap();

        let session_id = seed_session(
            &pool,
            &project_id,
            now - Duration::hours(2),
            Some(now - Duration::hours(1)),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T17:00:00Z"),
            0,
        )
        .await;

        // End <= Start rejected
        let err = update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: project_id.clone(),
                start_time: now - Duration::hours(1),
                end_time: now - Duration::hours(2),
                session_type: SessionType::Focus,
                mode: TimerMode::Stopwatch,
            },
            None,
            now,
        )
        .await
        .unwrap_err();
        assert!(err.contains("after start time"));

        // Future end time rejected
        let err = update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: project_id.clone(),
                start_time: now - Duration::hours(1),
                end_time: now + Duration::hours(1),
                session_type: SessionType::Focus,
                mode: TimerMode::Stopwatch,
            },
            None,
            now,
        )
        .await
        .unwrap_err();
        assert!(err.contains("future"));

        // Deleted project rejected
        let err = update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: deleted_project_id,
                start_time: now - Duration::hours(2),
                end_time: now - Duration::hours(1),
                session_type: SessionType::Focus,
                mode: TimerMode::Stopwatch,
            },
            None,
            now,
        )
        .await
        .unwrap_err();
        assert!(err.contains("does not exist"));

        // Active running session rejected
        let err = update_session_in_pool_at(
            &pool,
            UpdateSessionInput {
                id: session_id.clone(),
                project_id: project_id.clone(),
                start_time: now - Duration::hours(2),
                end_time: now - Duration::hours(1),
                session_type: SessionType::Focus,
                mode: TimerMode::Stopwatch,
            },
            Some(&session_id),
            now,
        )
        .await
        .unwrap_err();
        assert!(err.contains("timer is running"));
    }

    #[tokio::test]
    async fn delete_session_soft_deletes_advances_updated_at_and_blocks_active() {
        let pool = setup_test_pool().await;
        let now = DateTime::parse_from_rfc3339("2026-11-23T18:00:00Z")
            .unwrap()
            .with_timezone(&Utc);

        let project_id =
            create_project_in_pool(&pool, "Study".into(), "Desc".into(), "#3B82F6".into(), None)
                .await
                .unwrap();

        let session_id = seed_session(
            &pool,
            &project_id,
            now - Duration::hours(2),
            Some(now - Duration::hours(1)),
            "FOCUS",
            "STOPWATCH",
            Some("2026-11-23T18:00:00Z"),
            0,
        )
        .await;

        let active_err =
            delete_session_in_pool_at(&pool, session_id.clone(), Some(&session_id), now)
                .await
                .unwrap_err();
        assert!(active_err.contains("timer is running"));

        delete_session_in_pool_at(&pool, session_id.clone(), None, now)
            .await
            .unwrap();

        let (is_deleted, updated_at): (i64, String) =
            sqlx::query_as("SELECT is_deleted, updated_at FROM sessions WHERE id = ?")
                .bind(&session_id)
                .fetch_one(&pool)
                .await
                .unwrap();

        assert_eq!(is_deleted, 1);
        assert_eq!(updated_at, "2026-11-23T18:00:01Z");
        assert!(get_sessions_in_pool(&pool, None).await.unwrap().is_empty());
    }
}
