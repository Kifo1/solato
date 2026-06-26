use std::sync::Mutex;

use tauri::State;

use crate::models::dbstate::DbState;

#[derive(Default)]
pub struct ActiveProjectFilterState {
    pub selected_project_ids: Mutex<Vec<String>>,
}

pub async fn get_overall_project_time(
    project_id: String,
    db: State<'_, DbState>,
) -> Result<u64, String> {
    let pool = &db.pool;

    let record = sqlx::query!(
        r#"
        SELECT 
            SUM(
                CASE 
                    WHEN end_time IS NOT NULL THEN (strftime('%s', end_time) - strftime('%s', start_time))
                    ELSE (strftime('%s', 'now') - strftime('%s', start_time))
                END
            ) AS "total_seconds!: i64"
        FROM sessions
        WHERE project_id = ?
        AND session_type = 'FOCUS'
        AND is_deleted = 0
        "#,
        project_id,
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(record.total_seconds.max(0) as u64)
}

pub async fn get_todays_overall_time(db: State<'_, DbState>) -> Result<u64, String> {
    let pool = &db.pool;

    let record = sqlx::query!(
        r#"
    SELECT
        SUM(
            MIN(
                strftime('%s', COALESCE(end_time, 'now')), 
                strftime('%s', 'now')
            ) - 
            MAX(
                strftime('%s', start_time), 
                strftime('%s', 'now', 'start of day')
            )
        ) AS "total_seconds!: i64"
    FROM sessions
    WHERE session_type = 'FOCUS'
    AND is_deleted = 0
    AND (
        (start_time >= datetime('now', 'start of day')) 
        OR 
        (COALESCE(end_time, 'now') > datetime('now', 'start of day'))
    )
    AND start_time < datetime('now', 'start of day', '+1 day')
    "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(record.total_seconds.max(0) as u64)
}

pub async fn get_most_active_project_name(db: State<'_, DbState>) -> Result<String, String> {
    let pool = &db.pool;

    let record = sqlx::query!(
        r#"
        SELECT 
            p.name as "project_name!"
        FROM sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.session_type = 'FOCUS'
          AND s.is_deleted = 0
          AND p.is_deleted = 0
          AND s.start_time >= datetime('now', '-7 days')
        GROUP BY s.project_id
        ORDER BY SUM(
            CASE 
                WHEN s.end_time IS NOT NULL THEN (strftime('%s', s.end_time) - strftime('%s', s.start_time))
                ELSE (strftime('%s', 'now') - strftime('%s', s.start_time))
            END
        ) DESC
        LIMIT 1
        "#
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(record
        .map(|r| r.project_name)
        .unwrap_or_else(|| "No project".to_string()))
}
