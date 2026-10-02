use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
};

use chrono::{Duration, Local, NaiveDate, TimeZone, Timelike};
use sqlx::{QueryBuilder, Row, SqlitePool};
use tauri::State;

use crate::models::{
    analytics::{
        calendar_data::CalendarData,
        hourly_time_data::{HourlyTime, HourlyTimeData},
        project_time_share_data::{ProjectTimeShare, ProjectTimeShareData},
        streak_data::StreakData,
        weekday_time_data::{WeekdayTime, WeekdayTimeData},
    },
    dbstate::DbState,
};

const WEEKDAY_COUNT: usize = 7;
const HOUR_COUNT: usize = 24;

/// Session duration in seconds, treating a missing `end_time` as "still running".
const SESSION_SECONDS_SQL: &str = r#"
    CASE
        WHEN end_time IS NOT NULL THEN (strftime('%s', end_time) - strftime('%s', start_time))
        ELSE (strftime('%s', 'now') - strftime('%s', start_time))
    END
"#;

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

    let mut query_builder = QueryBuilder::new(
        r#"
        SELECT DISTINCT date(start_time, 'localtime') AS session_date
        FROM sessions
        WHERE session_type = 'FOCUS'
          AND is_deleted = 0
        "#,
    );

    if !project_ids.is_empty() {
        query_builder.push(" AND project_id IN (");
        let mut separated = query_builder.separated(", ");
        for id in &project_ids {
            separated.push_bind(id);
        }
        query_builder.push(")");
    }

    query_builder.push(" ORDER BY session_date DESC");

    let records = query_builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

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

    let mut query_builder = QueryBuilder::new(
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
        query_builder.push(" AND project_id IN (");
        let mut separated = query_builder.separated(", ");
        for id in &project_ids {
            separated.push_bind(id);
        }
        query_builder.push(")");
    }

    query_builder.push(" GROUP BY date(start_time, 'localtime')");

    let records = query_builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut history = HashMap::new();
    for row in records {
        let session_date: String = row.get("session_date");
        let total_seconds: i64 = row.get("total_seconds");

        history.insert(session_date, total_seconds.max(0) as u64);
    }

    Ok(CalendarData { history })
}

pub async fn get_analytic_project_time_share_data(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<ProjectTimeShareData, String> {
    let pool = &db.pool;
    let project_ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    if project_ids.is_empty() {
        return Ok(ProjectTimeShareData {
            total_seconds: 0,
            entries: Vec::new(),
        });
    }

    let mut query_builder = QueryBuilder::new(
        r#"
        SELECT
            p.id AS project_id,
            p.name AS project_name,
            p.color AS project_color,
            SUM(
                CASE
                    WHEN s.end_time IS NOT NULL THEN (strftime('%s', s.end_time) - strftime('%s', s.start_time))
                    ELSE (strftime('%s', 'now') - strftime('%s', s.start_time))
                END
            ) AS total_seconds
        FROM sessions s
        JOIN projects p ON s.project_id = p.id
        WHERE s.session_type = 'FOCUS'
          AND s.is_deleted = 0
          AND p.is_deleted = 0
          AND s.project_id IN (
        "#,
    );

    let mut separated = query_builder.separated(", ");
    for id in &project_ids {
        separated.push_bind(id);
    }

    query_builder.push(") GROUP BY s.project_id ORDER BY total_seconds DESC");

    let records = query_builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut entries: Vec<ProjectTimeShare> = Vec::new();
    let mut total_seconds: u64 = 0;

    for row in records {
        let project_id: String = row.get("project_id");
        let name: String = row.get("project_name");
        let color: String = row.get("project_color");
        let seconds: i64 = row.get("total_seconds");

        let seconds = seconds.max(0) as u64;
        if seconds == 0 {
            continue;
        }

        total_seconds += seconds;
        entries.push(ProjectTimeShare {
            project_id,
            name,
            color,
            total_seconds: seconds,
        });
    }

    Ok(ProjectTimeShareData {
        total_seconds,
        entries,
    })
}

/// Focus time aggregated per day of the week (Monday first), over all time.
///
/// `average_seconds` divides the total by the number of days that actually had
/// focus time, so days without any focus time never drag the average down.
pub async fn get_analytic_weekday_time_data(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<WeekdayTimeData, String> {
    let project_ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    weekday_time_from_pool(&db.pool, &project_ids).await
}

async fn weekday_time_from_pool(
    pool: &SqlitePool,
    project_ids: &[String],
) -> Result<WeekdayTimeData, String> {
    if project_ids.is_empty() {
        return Ok(WeekdayTimeData::empty());
    }

    let mut query_builder = QueryBuilder::new(
        r#"
        SELECT
            CAST(strftime('%w', start_time, 'localtime') AS INTEGER) AS weekday_index,
            date(start_time, 'localtime') AS session_date,
            SUM(
    "#,
    );
    query_builder.push(SESSION_SECONDS_SQL);
    query_builder.push(
        r#"
            ) AS total_seconds
        FROM sessions
        WHERE session_type = 'FOCUS'
          AND is_deleted = 0
          AND project_id IN (
    "#,
    );

    let mut separated = query_builder.separated(", ");
    for id in project_ids {
        separated.push_bind(id);
    }

    query_builder.push(") GROUP BY weekday_index, session_date");

    let records = query_builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut totals = [0u64; WEEKDAY_COUNT];
    let mut active_days = [0u64; WEEKDAY_COUNT];

    for row in records {
        let weekday_index: i64 = row.get("weekday_index");
        let total_seconds: i64 = row.get("total_seconds");

        let seconds = total_seconds.max(0) as u64;
        let slot = match monday_first_slot(weekday_index) {
            Some(slot) => slot,
            None => continue,
        };

        totals[slot] += seconds;
        if seconds > 0 {
            active_days[slot] += 1;
        }
    }

    let mut entries = Vec::with_capacity(WEEKDAY_COUNT);
    let mut total_seconds = 0u64;

    for slot in 0..WEEKDAY_COUNT {
        total_seconds += totals[slot];

        entries.push(WeekdayTime {
            weekday: slot as u8,
            total_seconds: totals[slot],
            active_days: active_days[slot],
            average_seconds: average_per_active_day(totals[slot], active_days[slot]),
        });
    }

    Ok(WeekdayTimeData {
        total_seconds,
        entries,
    })
}

/// Focus time aggregated per hour of the day (local time), over all time.
///
/// Unlike the other analytics queries a session is *not* attributed to a single
/// bucket: a session spanning several hours contributes the part of its runtime
/// that falls into each of those hours.
pub async fn get_analytic_hourly_time_data(
    db: State<'_, DbState>,
    filter_state: State<'_, ActiveProjectFilterState>,
) -> Result<HourlyTimeData, String> {
    let project_ids = filter_state
        .selected_project_ids
        .lock()
        .map_err(|e| e.to_string())?
        .clone();

    hourly_time_from_pool(&db.pool, &project_ids).await
}

async fn hourly_time_from_pool(
    pool: &SqlitePool,
    project_ids: &[String],
) -> Result<HourlyTimeData, String> {
    if project_ids.is_empty() {
        return Ok(HourlyTimeData::empty());
    }

    let mut query_builder = QueryBuilder::new(
        r#"
        SELECT
            CAST(strftime('%s', start_time) AS INTEGER) AS start_epoch,
            CAST(strftime('%s', COALESCE(end_time, 'now')) AS INTEGER) AS end_epoch
        FROM sessions
        WHERE session_type = 'FOCUS'
          AND is_deleted = 0
          AND project_id IN (
    "#,
    );

    let mut separated = query_builder.separated(", ");
    for id in project_ids {
        separated.push_bind(id);
    }

    query_builder.push(")");

    let records = query_builder
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    let mut totals = vec![0u64; HOUR_COUNT];
    let mut active_days: Vec<HashSet<NaiveDate>> =
        (0..HOUR_COUNT).map(|_| HashSet::new()).collect();

    for row in records {
        let start_epoch: i64 = row.get("start_epoch");
        let end_epoch: i64 = row.get("end_epoch");

        distribute_session_across_hours(start_epoch, end_epoch, &mut totals, &mut active_days);
    }

    let mut entries = Vec::with_capacity(HOUR_COUNT);
    let mut total_seconds = 0u64;

    for slot in 0..HOUR_COUNT {
        total_seconds += totals[slot];

        entries.push(HourlyTime {
            hour: slot as u8,
            total_seconds: totals[slot],
            active_days: active_days[slot].len() as u64,
            average_seconds: average_per_active_day(totals[slot], active_days[slot].len() as u64),
        });
    }

    Ok(HourlyTimeData {
        total_seconds,
        entries,
    })
}

fn average_per_active_day(total_seconds: u64, active_days: u64) -> u64 {
    if active_days == 0 {
        return 0;
    }

    total_seconds / active_days
}

/// Splits a single session's runtime across the local hours it spans and records
/// the day each touched hour belongs to. Sessions that end before they start are
/// treated as zero length, matching how the other analytics queries clamp.
fn distribute_session_across_hours(
    start_epoch: i64,
    end_epoch: i64,
    totals: &mut [u64],
    active_days: &mut [HashSet<NaiveDate>],
) {
    let (start, end) = (start_epoch, end_epoch);
    if end <= start {
        return;
    }

    let Some(mut bucket_start) = floor_to_local_hour(start) else {
        return;
    };

    while bucket_start.timestamp() < end {
        let bucket_end = bucket_start + Duration::hours(1);
        let seconds = end.min(bucket_end.timestamp()) - start.max(bucket_start.timestamp());

        if seconds > 0 {
            let slot = bucket_start.hour() as usize;
            totals[slot] += seconds as u64;
            active_days[slot].insert(bucket_start.date_naive());
        }

        bucket_start = bucket_end;
    }
}

/// Maps SQLite's Sunday based `%w` weekday (0 = Sunday .. 6 = Saturday) onto a
/// Monday first slot (0 = Monday .. 6 = Sunday).
fn monday_first_slot(sqlite_weekday: i64) -> Option<usize> {
    if !(0..WEEKDAY_COUNT as i64).contains(&sqlite_weekday) {
        return None;
    }

    Some((sqlite_weekday as usize + WEEKDAY_COUNT - 1) % WEEKDAY_COUNT)
}

/// Truncates an epoch second to the start of its local hour, tolerating DST
/// transitions where a wall-clock hour is ambiguous or does not exist.
fn floor_to_local_hour(epoch_seconds: i64) -> Option<chrono::DateTime<Local>> {
    let local = Local.timestamp_opt(epoch_seconds, 0).single()?;
    let floored = local
        .with_minute(0)
        .and_then(|dt| dt.with_second(0))
        .and_then(|dt| dt.with_nanosecond(0));

    match floored {
        Some(dt) => Some(dt),
        None => local
            .with_minute(59)
            .and_then(|dt| dt.with_second(59))
            .and_then(|dt| dt.with_nanosecond(0))
            .and_then(|dt| dt.checked_add_signed(Duration::seconds(1))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    const SELECTED_PROJECT: &str = "project-selected";
    const OTHER_PROJECT: &str = "project-other";

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("in-memory database should open");

        sqlx::query(
            r#"
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                session_type TEXT NOT NULL,
                mode TEXT NOT NULL,
                is_deleted INTEGER NOT NULL DEFAULT 0
            )
            "#,
        )
        .execute(&pool)
        .await
        .expect("sessions table should be created");

        pool
    }

    async fn insert_session(
        pool: &SqlitePool,
        project_id: &str,
        start: i64,
        end: Option<i64>,
        session_type: &str,
        is_deleted: bool,
    ) {
        let format = |epoch: i64| {
            Local
                .timestamp_opt(epoch, 0)
                .single()
                .expect("epoch should map to a local timestamp")
                .with_timezone(&chrono::Utc)
                .format("%Y-%m-%dT%H:%M:%SZ")
                .to_string()
        };

        sqlx::query(
            "INSERT INTO sessions (id, project_id, start_time, end_time, session_type, mode, is_deleted)
             VALUES (?, ?, ?, ?, ?, 'STOPWATCH', ?)",
        )
        .bind(format!("session-{}", start))
        .bind(project_id)
        .bind(format(start))
        .bind(end.map(format))
        .bind(session_type)
        .bind(is_deleted)
        .execute(pool)
        .await
        .expect("session should be inserted");
    }

    fn local_epoch(year: i32, month: u32, day: u32, hour: u32, minute: u32, second: u32) -> i64 {
        Local
            .with_ymd_and_hms(year, month, day, hour, minute, second)
            .earliest()
            .expect("local timestamp should be valid")
            .timestamp()
    }

    fn empty_hourly_buckets() -> (Vec<u64>, Vec<HashSet<NaiveDate>>) {
        (
            vec![0u64; HOUR_COUNT],
            (0..HOUR_COUNT).map(|_| HashSet::new()).collect(),
        )
    }

    #[tokio::test]
    async fn weekday_data_only_covers_selected_projects() {
        let pool = test_pool().await;
        // 2025-03-10 is a Monday.
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 10, 9, 0, 0),
            Some(local_epoch(2025, 3, 10, 10, 0, 0)),
            "FOCUS",
            false,
        )
        .await;
        insert_session(
            &pool,
            OTHER_PROJECT,
            local_epoch(2025, 3, 11, 9, 0, 0),
            Some(local_epoch(2025, 3, 11, 11, 0, 0)),
            "FOCUS",
            false,
        )
        .await;

        let data = weekday_time_from_pool(&pool, &[SELECTED_PROJECT.to_string()])
            .await
            .expect("weekday data should load");

        assert_eq!(data.entries.len(), WEEKDAY_COUNT);
        assert_eq!(data.total_seconds, 3600);
        assert_eq!(data.entries[0].weekday, 0);
        assert_eq!(data.entries[0].total_seconds, 3600);
        assert_eq!(data.entries[0].active_days, 1);
        assert_eq!(data.entries[1].total_seconds, 0);
    }

    #[tokio::test]
    async fn weekday_data_ignores_breaks_deleted_sessions_and_zero_length_days() {
        let pool = test_pool().await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 10, 9, 0, 0), // Monday, 1h
            Some(local_epoch(2025, 3, 10, 10, 0, 0)),
            "FOCUS",
            false,
        )
        .await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 17, 9, 0, 0), // next Monday, 3h
            Some(local_epoch(2025, 3, 17, 12, 0, 0)),
            "FOCUS",
            false,
        )
        .await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 24, 9, 0, 0), // Monday, deleted
            Some(local_epoch(2025, 3, 24, 10, 0, 0)),
            "FOCUS",
            true,
        )
        .await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 25, 9, 0, 0), // Tuesday, break
            Some(local_epoch(2025, 3, 25, 10, 0, 0)),
            "SHORT_BREAK",
            false,
        )
        .await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 26, 9, 0, 0), // Wednesday, zero length
            Some(local_epoch(2025, 3, 26, 9, 0, 0)),
            "FOCUS",
            false,
        )
        .await;

        let data = weekday_time_from_pool(&pool, &[SELECTED_PROJECT.to_string()])
            .await
            .expect("weekday data should load");

        // Wednesday got a zero length session, so it has no focus time at all.
        assert_eq!(data.entries[2].total_seconds, 0);
        assert_eq!(data.entries[2].active_days, 0);
        assert_eq!(data.entries[2].average_seconds, 0);

        // Monday: 1h + 3h over exactly two days that had focus time.
        let monday = &data.entries[0];
        assert_eq!(monday.total_seconds, 4 * 3600);
        assert_eq!(monday.active_days, 2);
        assert_eq!(monday.average_seconds, 2 * 3600);
    }

    #[tokio::test]
    async fn weekday_data_starts_on_monday_and_is_empty_without_selection() {
        let pool = test_pool().await;

        let data = weekday_time_from_pool(&pool, &[])
            .await
            .expect("weekday data should load");

        assert_eq!(data.total_seconds, 0);
        assert_eq!(
            data.entries.iter().map(|e| e.weekday).collect::<Vec<_>>(),
            vec![0, 1, 2, 3, 4, 5, 6]
        );
    }

    #[tokio::test]
    async fn hourly_data_splits_sessions_and_only_covers_selected_projects() {
        let pool = test_pool().await;
        insert_session(
            &pool,
            SELECTED_PROJECT,
            local_epoch(2025, 3, 10, 9, 30, 0),
            Some(local_epoch(2025, 3, 10, 11, 0, 0)),
            "FOCUS",
            false,
        )
        .await;
        insert_session(
            &pool,
            OTHER_PROJECT,
            local_epoch(2025, 3, 10, 15, 0, 0),
            Some(local_epoch(2025, 3, 10, 16, 0, 0)),
            "FOCUS",
            false,
        )
        .await;

        let data = hourly_time_from_pool(&pool, &[SELECTED_PROJECT.to_string()])
            .await
            .expect("hourly data should load");

        assert_eq!(data.entries.len(), HOUR_COUNT);
        assert_eq!(data.total_seconds, 5400);
        assert_eq!(data.entries[9].total_seconds, 1800);
        assert_eq!(data.entries[10].total_seconds, 3600);
        assert_eq!(data.entries[9].active_days, 1);
        assert_eq!(data.entries[9].average_seconds, 1800);
        // The unselected project's hour stays empty.
        assert_eq!(data.entries[15].total_seconds, 0);
    }

    #[tokio::test]
    async fn hourly_data_counts_a_day_once_per_touched_hour() {
        let pool = test_pool().await;
        for day in [10, 11, 12] {
            insert_session(
                &pool,
                SELECTED_PROJECT,
                local_epoch(2025, 3, day, 8, 0, 0),
                Some(local_epoch(2025, 3, day, 8, 20, 0)),
                "FOCUS",
                false,
            )
            .await;
        }

        let data = hourly_time_from_pool(&pool, &[SELECTED_PROJECT.to_string()])
            .await
            .expect("hourly data should load");

        assert_eq!(data.entries[8].total_seconds, 3600);
        assert_eq!(data.entries[8].active_days, 3);
        assert_eq!(data.entries[8].average_seconds, 1200);
    }

    #[test]
    fn session_inside_a_single_hour_lands_in_that_hour() {
        let (mut totals, mut active_days) = empty_hourly_buckets();

        distribute_session_across_hours(
            local_epoch(2025, 3, 12, 14, 15, 0),
            local_epoch(2025, 3, 12, 14, 45, 0),
            &mut totals,
            &mut active_days,
        );

        assert_eq!(totals[14], 1800);
        assert_eq!(totals.iter().sum::<u64>(), 1800);
        assert_eq!(active_days[14].len(), 1);
    }

    #[test]
    fn session_spanning_an_hour_boundary_is_split() {
        let (mut totals, mut active_days) = empty_hourly_buckets();

        distribute_session_across_hours(
            local_epoch(2025, 3, 12, 14, 30, 0),
            local_epoch(2025, 3, 12, 15, 30, 0),
            &mut totals,
            &mut active_days,
        );

        assert_eq!(totals[14], 1800);
        assert_eq!(totals[15], 1800);
        assert_eq!(totals.iter().sum::<u64>(), 3600);
    }

    #[test]
    fn session_spanning_midnight_counts_both_days() {
        let (mut totals, mut active_days) = empty_hourly_buckets();

        distribute_session_across_hours(
            local_epoch(2025, 3, 12, 22, 30, 0),
            local_epoch(2025, 3, 13, 1, 30, 0),
            &mut totals,
            &mut active_days,
        );

        assert_eq!(totals[22], 1800);
        assert_eq!(totals[23], 3600);
        assert_eq!(totals[0], 3600);
        assert_eq!(totals[1], 1800);
        assert_eq!(totals.iter().sum::<u64>(), 10800);

        let days: std::collections::BTreeSet<NaiveDate> = active_days
            .iter()
            .flat_map(|days| days.iter().copied())
            .collect();
        assert_eq!(days.len(), 2);
        assert_eq!(active_days[23].iter().next(), active_days[22].iter().next());
        assert_ne!(active_days[0].iter().next(), active_days[22].iter().next());
    }

    #[test]
    fn sessions_on_different_days_share_a_bucket_but_count_as_two_days() {
        let (mut totals, mut active_days) = empty_hourly_buckets();

        distribute_session_across_hours(
            local_epoch(2025, 3, 12, 9, 0, 0),
            local_epoch(2025, 3, 12, 9, 30, 0),
            &mut totals,
            &mut active_days,
        );
        distribute_session_across_hours(
            local_epoch(2025, 3, 13, 9, 0, 0),
            local_epoch(2025, 3, 13, 9, 30, 0),
            &mut totals,
            &mut active_days,
        );

        assert_eq!(totals[9], 3600);
        assert_eq!(active_days[9].len(), 2);
        assert_eq!(
            average_per_active_day(totals[9], active_days[9].len() as u64),
            1800
        );
    }

    #[test]
    fn empty_and_inverted_sessions_are_ignored() {
        let (mut totals, mut active_days) = empty_hourly_buckets();

        let instant = local_epoch(2025, 3, 12, 8, 0, 0);
        distribute_session_across_hours(instant, instant, &mut totals, &mut active_days);
        distribute_session_across_hours(
            local_epoch(2025, 3, 12, 9, 0, 0),
            local_epoch(2025, 3, 12, 8, 0, 0),
            &mut totals,
            &mut active_days,
        );

        assert_eq!(totals.iter().sum::<u64>(), 0);
        assert!(active_days.iter().all(|days| days.is_empty()));
    }

    #[test]
    fn weekdays_are_ordered_monday_first() {
        assert_eq!(monday_first_slot(1), Some(0));
        assert_eq!(monday_first_slot(4), Some(3));
        assert_eq!(monday_first_slot(5), Some(4));
        assert_eq!(monday_first_slot(6), Some(5));
        assert_eq!(monday_first_slot(0), Some(6));
        assert_eq!(monday_first_slot(7), None);
        assert_eq!(monday_first_slot(-1), None);
    }

    #[test]
    fn average_ignores_days_without_focus_time() {
        // 3 active days with 600s, 900s and 300s -> 1800/3
        assert_eq!(average_per_active_day(1800, 3), 600);
        assert_eq!(average_per_active_day(1800, 0), 0);
    }

    #[test]
    fn empty_payloads_keep_all_buckets() {
        assert_eq!(WeekdayTimeData::empty().entries.len(), 7);
        assert_eq!(HourlyTimeData::empty().entries.len(), 24);
    }
}
