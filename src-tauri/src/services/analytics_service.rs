use std::{collections::HashMap, sync::Mutex};

use chrono::{Duration, Local, NaiveDate};
use sqlx::Row;
use tauri::State;

use crate::models::{
    analytics::{calendar_data::CalendarData, streak_data::StreakData},
    dbstate::DbState,
};

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

pub async fn get_analytic_streak_data(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<StreakData, String> {
    let pool = &db.pool;
    let project_ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    if project_ids.is_empty() {
        return Ok(StreakData {
            current_streak: 0,
            active_today: false,
        });
    }

    let mut query_string = String::from(
        r#"
        SELECT DISTINCT date(start_time, 'localtime') AS session_date
        FROM sessions
        WHERE session_type = 'FOCUS'
          AND is_deleted = 0
        "#,
    );

    if !project_ids.is_empty() {
        query_string.push_str(" AND project_id IN (");
        let placeholders: Vec<String> = project_ids.iter().map(|_| "?".to_string()).collect();
        query_string.push_str(&placeholders.join(", "));
        query_string.push_str(")");
    }

    query_string.push_str(" ORDER BY session_date DESC");

    let mut query = sqlx::query(&query_string);

    if !project_ids.is_empty() {
        for id in project_ids {
            query = query.bind(id);
        }
    }

    let records = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

    let active_dates: Vec<NaiveDate> = records
        .iter()
        .filter_map(|r| {
            let date_str: String = r.get("session_date");
            NaiveDate::parse_from_str(&date_str, "%Y-%m-%d").ok()
        })
        .collect();

    if active_dates.is_empty() {
        return Ok(StreakData {
            current_streak: 0,
            active_today: false,
        });
    }

    let today = Local::now().date_naive();
    let yesterday = today - Duration::days(1);

    let active_today = active_dates.contains(&today);
    let active_yesterday = active_dates.contains(&yesterday);

    if !active_today && !active_yesterday {
        return Ok(StreakData {
            current_streak: 0,
            active_today: false,
        });
    }

    let mut current_streak = 0;
    let mut check_date = if active_today { today } else { yesterday };

    for date in active_dates {
        if date == check_date {
            current_streak += 1;
            check_date -= Duration::days(1);
        } else if date < check_date {
            break;
        }
    }

    Ok(StreakData {
        current_streak,
        active_today,
    })
}

pub async fn get_analytic_calendar_data(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<CalendarData, String> {
    let pool = &db.pool;
    let project_ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    if project_ids.is_empty() {
        return Ok(CalendarData {
            history: HashMap::new(),
        });
    }

    let mut query_string = String::from(
        r#"
        SELECT 
            date(start_time, 'localtime') AS session_date,
            SUM(
                CASE 
                    WHEN end_time IS NOT NULL THEN (strftime('%s', end_time) - strftime('%s', start_time))
                    ELSE (strftime('%s', 'now') - strftime('%s', start_time))
                END
            ) AS total_seconds
        FROM sessions
        WHERE session_type = 'FOCUS'
          AND is_deleted = 0
          AND start_time >= datetime('now', '-1 year')
        "#,
    );

    if !project_ids.is_empty() {
        query_string.push_str(" AND project_id IN (");
        let placeholders: Vec<String> = project_ids.iter().map(|_| "?".to_string()).collect();
        query_string.push_str(&placeholders.join(", "));
        query_string.push_str(")");
    }

    query_string.push_str(" GROUP BY date(start_time, 'localtime')");

    let mut query = sqlx::query(&query_string);

    if !project_ids.is_empty() {
        for id in project_ids {
            query = query.bind(id);
        }
    }

    let records = query.fetch_all(pool).await.map_err(|e| e.to_string())?;

    let mut history = HashMap::new();
    for row in records {
        let session_date: String = row.get("session_date");
        let total_seconds: i64 = row.get("total_seconds");

        history.insert(session_date, total_seconds.max(0) as u64);
    }

    Ok(CalendarData { history })
}
