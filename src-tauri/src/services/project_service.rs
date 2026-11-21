use crate::database::models::folder::Folder;
use crate::database::models::project::Project;
use crate::models::dbstate::DbState;
use crate::services::folder_service::get_folders_in_pool;
use chrono::{DateTime, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use tauri::State;
use uuid::Uuid;

const MAX_RECOMMENDED_PROJECTS: usize = 3;
const RECENCY_HALF_LIFE_DAYS: f64 = 7.0;
const MAX_SESSION_DURATION_SECS: i64 = 12 * 3600;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimerProjectsResponse {
    pub recommended: Vec<Project>,
    pub projects: Vec<Project>,
    pub folders: Vec<Folder>,
}

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

async fn validate_folder_id(
    pool: &SqlitePool,
    folder_id: Option<String>,
) -> Result<Option<String>, String> {
    let normalized = folder_id
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty());

    if let Some(ref fid) = normalized {
        let exists = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM folders WHERE id = ? AND is_deleted = 0",
            fid
        )
        .fetch_one(pool)
        .await
        .map_err(|e| e.to_string())?;

        if exists == 0 {
            return Err("Selected folder does not exist".to_string());
        }
    }

    Ok(normalized)
}

pub async fn create_project_in_pool(
    pool: &SqlitePool,
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
) -> Result<String, String> {
    let folder_id = validate_folder_id(pool, folder_id).await?;
    let uuid = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO projects (id, name, description, color, folder_id) VALUES (?, ?, ?, ?, ?)",
        uuid,
        name,
        description,
        color,
        folder_id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(uuid)
}

pub async fn update_project_in_pool(
    pool: &SqlitePool,
    uuid: String,
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    let folder_id = validate_folder_id(pool, folder_id).await?;

    sqlx::query!(
        "UPDATE projects SET name = ?, description = ?, color = ?, folder_id = ? WHERE id = ?",
        name,
        description,
        color,
        folder_id,
        uuid
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn update_project_folder_in_pool(
    pool: &SqlitePool,
    project_id: String,
    folder_id: Option<String>,
) -> Result<(), String> {
    let folder_id = validate_folder_id(pool, folder_id).await?;

    sqlx::query!(
        "UPDATE projects SET folder_id = ? WHERE id = ? AND is_deleted = 0",
        folder_id,
        project_id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn get_projects_in_pool(pool: &SqlitePool) -> Result<Vec<Project>, sqlx::Error> {
    sqlx::query_as!(
        Project,
        r#"
        SELECT
            id as "id!",
            name,
            description,
            color,
            folder_id,
            is_deleted as "is_deleted: i64"
        FROM projects
        WHERE is_deleted = 0
        ORDER BY created_at DESC, LOWER(name) ASC
        "#
    )
    .fetch_all(pool)
    .await
}

pub async fn delete_project_in_pool(pool: &SqlitePool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    sqlx::query!("UPDATE projects SET is_deleted = 1 WHERE id = ?", id)
        .execute(&mut *tx)
        .await
        .map_err(|e| e.to_string())?;

    sqlx::query!(
        "UPDATE sessions SET is_deleted = 1 WHERE project_id = ?",
        id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Default)]
struct ProjectUsageStats {
    recent_score: f64,
    session_count: u64,
    total_mins: f64,
    last_activity: Option<DateTime<Utc>>,
}

impl ProjectUsageStats {
    fn total_score(&self) -> f64 {
        if self.session_count == 0 {
            return 0.0;
        }
        let popularity = 0.25 * (1.0 + self.session_count as f64).ln()
            + 0.15 * (1.0 + self.total_mins / 30.0).ln();
        self.recent_score + popularity
    }
}

pub async fn get_timer_projects_in_pool(
    pool: &SqlitePool,
    now: DateTime<Utc>,
) -> Result<TimerProjectsResponse, String> {
    let project_rows = sqlx::query!(
        r#"
        SELECT
            id as "id!",
            name,
            description,
            color,
            folder_id,
            created_at as "created_at!",
            is_deleted as "is_deleted: i64"
        FROM projects
        WHERE is_deleted = 0
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let session_rows = sqlx::query!(
        r#"
        SELECT
            project_id as "project_id!",
            start_time as "start_time!",
            end_time
        FROM sessions
        WHERE is_deleted = 0
          AND session_type = 'FOCUS'
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    let folders = get_folders_in_pool(pool).await.map_err(|e| e.to_string())?;

    let mut usage_map: HashMap<String, ProjectUsageStats> = HashMap::new();

    for row in session_rows {
        let Some(start_dt) = parse_timestamp(&row.start_time) else {
            continue;
        };
        let end_dt = row.end_time.as_deref().and_then(parse_timestamp);
        let effective_end = end_dt.unwrap_or_else(|| now.max(start_dt));
        let duration_secs = (effective_end - start_dt)
            .num_seconds()
            .clamp(0, MAX_SESSION_DURATION_SECS);
        let duration_mins = duration_secs as f64 / 60.0;

        let activity_time = effective_end;
        let age_days = ((now - activity_time).num_seconds().max(0) as f64) / 86_400.0;
        let recency_decay = 0.5_f64.powf(age_days / RECENCY_HALF_LIFE_DAYS);
        let session_weight = 1.0 + (1.0 + duration_mins / 15.0).ln();

        let stats = usage_map.entry(row.project_id).or_default();
        stats.recent_score += session_weight * recency_decay;
        stats.session_count += 1;
        stats.total_mins += duration_mins;
        stats.last_activity = Some(match stats.last_activity {
            Some(prev) => prev.max(activity_time),
            None => activity_time,
        });
    }

    let mut scored: Vec<(
        Project,
        f64,
        u64,
        Option<DateTime<Utc>>,
        Option<DateTime<Utc>>,
    )> = project_rows
        .into_iter()
        .map(|row| {
            let stats = usage_map.get(&row.id);
            let score = stats.map(ProjectUsageStats::total_score).unwrap_or(0.0);
            let session_count = stats.map(|s| s.session_count).unwrap_or(0);
            let last_activity = stats.and_then(|s| s.last_activity);
            let created_at = parse_timestamp(&row.created_at);

            let project = Project {
                id: row.id,
                name: row.name,
                description: row.description,
                color: row.color,
                folder_id: row.folder_id,
                is_deleted: row.is_deleted,
            };
            (project, score, session_count, last_activity, created_at)
        })
        .collect();

    scored.sort_by(|a, b| {
        b.1.total_cmp(&a.1)
            .then_with(|| b.3.cmp(&a.3))
            .then_with(|| b.4.cmp(&a.4))
            .then_with(|| a.0.name.to_lowercase().cmp(&b.0.name.to_lowercase()))
    });

    let recommended: Vec<Project> = scored
        .iter()
        .filter(|(_, _, session_count, _, _)| *session_count > 0)
        .take(MAX_RECOMMENDED_PROJECTS)
        .map(|(project, _, _, _, _)| project.clone())
        .collect();

    let projects: Vec<Project> = scored
        .into_iter()
        .map(|(project, _, _, _, _)| project)
        .collect();

    Ok(TimerProjectsResponse {
        recommended,
        projects,
        folders,
    })
}

pub async fn create_project(
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<String, String> {
    create_project_in_pool(&db.pool, name, description, color, folder_id).await
}

pub async fn update_project(
    uuid: String,
    name: String,
    description: String,
    color: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    update_project_in_pool(&db.pool, uuid, name, description, color, folder_id).await
}

pub async fn update_project_folder(
    project_id: String,
    folder_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    update_project_folder_in_pool(&db.pool, project_id, folder_id).await
}

pub async fn get_projects(db: State<'_, DbState>) -> Result<Vec<Project>, sqlx::Error> {
    get_projects_in_pool(&db.pool).await
}

pub async fn delete_project(id: String, db: State<'_, DbState>) -> Result<(), String> {
    delete_project_in_pool(&db.pool, id).await
}

pub async fn get_timer_projects(db: State<'_, DbState>) -> Result<TimerProjectsResponse, String> {
    get_timer_projects_in_pool(&db.pool, Utc::now()).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::folder_service::{create_folder_in_pool, delete_folder_in_pool};
    use chrono::Duration;
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

    async fn insert_session(
        pool: &SqlitePool,
        project_id: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        session_type: &str,
        is_deleted: i64,
    ) {
        let id = Uuid::new_v4().to_string();
        let start_str = start.to_rfc3339();
        let end_str = end.to_rfc3339();
        sqlx::query(
            "INSERT INTO sessions (id, project_id, start_time, end_time, session_type, mode, is_deleted)
             VALUES (?, ?, ?, ?, ?, 'STOPWATCH', ?)",
        )
        .bind(id)
        .bind(project_id)
        .bind(start_str)
        .bind(end_str)
        .bind(session_type)
        .bind(is_deleted)
        .execute(pool)
        .await
        .unwrap();
    }

    #[tokio::test]
    async fn timer_projects_ranks_recent_active_projects_above_old_ones_and_recommends_top_3() {
        let pool = setup_test_pool().await;
        let now = Utc::now();

        let old_popular = create_project_in_pool(
            &pool,
            "Old Popular".into(),
            "desc".into(),
            "#111111".into(),
            None,
        )
        .await
        .unwrap();
        let new_active = create_project_in_pool(
            &pool,
            "New Active".into(),
            "desc".into(),
            "#222222".into(),
            None,
        )
        .await
        .unwrap();
        let medium_recent = create_project_in_pool(
            &pool,
            "Medium Recent".into(),
            "desc".into(),
            "#333333".into(),
            None,
        )
        .await
        .unwrap();
        let weekly_heavy = create_project_in_pool(
            &pool,
            "Weekly Heavy".into(),
            "desc".into(),
            "#444444".into(),
            None,
        )
        .await
        .unwrap();
        let unused_project = create_project_in_pool(
            &pool,
            "Unused".into(),
            "desc".into(),
            "#555555".into(),
            None,
        )
        .await
        .unwrap();

        // Old Popular: 15 sessions 120 days ago
        for i in 0..15 {
            let start = now - Duration::days(120 + i);
            insert_session(
                &pool,
                &old_popular,
                start,
                start + Duration::minutes(45),
                "FOCUS",
                0,
            )
            .await;
        }

        // Weekly Heavy: 6 sessions in the last 3 days (both recent AND popular -> #1)
        for i in 0..6 {
            let start = now - Duration::hours(4 + i * 10);
            insert_session(
                &pool,
                &weekly_heavy,
                start,
                start + Duration::minutes(50),
                "FOCUS",
                0,
            )
            .await;
        }

        // New Active: 3 sessions today (-> #2, beating old_popular!)
        for i in 0..3 {
            let start = now - Duration::hours(1 + i);
            insert_session(
                &pool,
                &new_active,
                start,
                start + Duration::minutes(30),
                "FOCUS",
                0,
            )
            .await;
        }

        // Medium Recent: 1 session 2 days ago (-> #3)
        let med_start = now - Duration::days(2);
        insert_session(
            &pool,
            &medium_recent,
            med_start,
            med_start + Duration::minutes(40),
            "FOCUS",
            0,
        )
        .await;

        // Unused project only has a break session and a deleted focus session -> must NOT count
        insert_session(
            &pool,
            &unused_project,
            now - Duration::minutes(20),
            now - Duration::minutes(10),
            "SHORT_BREAK",
            0,
        )
        .await;
        insert_session(
            &pool,
            &unused_project,
            now - Duration::minutes(40),
            now - Duration::minutes(10),
            "FOCUS",
            1,
        )
        .await;

        let res = get_timer_projects_in_pool(&pool, now).await.unwrap();

        assert_eq!(res.recommended.len(), 3);
        assert_eq!(res.recommended[0].id, weekly_heavy);
        assert_eq!(res.recommended[1].id, new_active);
        assert_eq!(res.recommended[2].id, medium_recent);

        assert_eq!(res.projects.len(), 5);
        assert_eq!(res.projects[0].id, weekly_heavy);
        assert_eq!(res.projects[1].id, new_active);
        assert_eq!(res.projects[2].id, medium_recent);
        assert_eq!(res.projects[3].id, old_popular);
        assert_eq!(res.projects[4].id, unused_project);
    }

    #[tokio::test]
    async fn assigning_project_to_deleted_or_missing_folder_fails() {
        let pool = setup_test_pool().await;
        let folder_id = create_folder_in_pool(&pool, "Work".into(), "#3B82F6".into(), None)
            .await
            .unwrap();
        let project_id = create_project_in_pool(
            &pool,
            "Solato".into(),
            "App".into(),
            "#3B82F6".into(),
            Some(folder_id.clone()),
        )
        .await
        .unwrap();

        delete_folder_in_pool(&pool, folder_id.clone())
            .await
            .unwrap();

        let err = update_project_folder_in_pool(&pool, project_id, Some(folder_id))
            .await
            .unwrap_err();
        assert!(err.contains("does not exist"));
    }
}
