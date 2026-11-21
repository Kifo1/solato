use crate::database::models::folder::Folder;
use crate::models::dbstate::DbState;
use sqlx::SqlitePool;
use std::collections::HashSet;
use tauri::State;
use uuid::Uuid;

fn validate_folder_name(name: String) -> Result<String, String> {
    let trimmed = name.trim().to_string();
    if trimmed.is_empty() {
        return Err("Folder name cannot be empty".to_string());
    }
    if trimmed.chars().count() > 30 {
        return Err("Folder name cannot exceed 30 characters".to_string());
    }
    Ok(trimmed)
}

fn normalize_folder_color(color: String) -> String {
    let trimmed = color.trim();
    if trimmed.is_empty() {
        "#3B82F6".to_string()
    } else {
        trimmed.to_string()
    }
}

async fn validate_parent_id(
    pool: &SqlitePool,
    folder_id: Option<&str>,
    parent_id: Option<String>,
) -> Result<Option<String>, String> {
    let normalized = parent_id
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty());

    let Some(pid) = normalized else {
        return Ok(None);
    };

    if folder_id == Some(pid.as_str()) {
        return Err("A folder cannot be its own parent".to_string());
    }

    let mut visited = HashSet::new();
    let mut cursor = Some(pid.clone());
    let mut is_first = true;

    while let Some(current_id) = cursor {
        if !visited.insert(current_id.clone()) {
            // Defensive guard against corrupted pre-existing cycles.
            break;
        }

        let row = sqlx::query!(
            "SELECT parent_id FROM folders WHERE id = ? AND is_deleted = 0",
            current_id
        )
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

        let Some(record) = row else {
            if is_first {
                return Err("Selected parent folder does not exist".to_string());
            }
            break;
        };

        is_first = false;

        if let Some(ref next_parent) = record.parent_id {
            if folder_id == Some(next_parent.as_str()) {
                return Err("Cannot move a folder into one of its own subfolders".to_string());
            }
        }

        cursor = record.parent_id;
    }

    Ok(Some(pid))
}

pub async fn create_folder_in_pool(
    pool: &SqlitePool,
    name: String,
    color: String,
    parent_id: Option<String>,
) -> Result<String, String> {
    let name = validate_folder_name(name)?;
    let color = normalize_folder_color(color);
    let parent_id = validate_parent_id(pool, None, parent_id).await?;
    let uuid = Uuid::new_v4().to_string();

    sqlx::query!(
        "INSERT INTO folders (id, name, color, parent_id) VALUES (?, ?, ?, ?)",
        uuid,
        name,
        color,
        parent_id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(uuid)
}

pub async fn update_folder_in_pool(
    pool: &SqlitePool,
    id: String,
    name: String,
    color: String,
    parent_id: Option<String>,
) -> Result<(), String> {
    let name = validate_folder_name(name)?;
    let color = normalize_folder_color(color);
    let parent_id = validate_parent_id(pool, Some(&id), parent_id).await?;

    let result = sqlx::query!(
        "UPDATE folders SET name = ?, color = ?, parent_id = ? WHERE id = ? AND is_deleted = 0",
        name,
        color,
        parent_id,
        id
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    if result.rows_affected() == 0 {
        return Err("Folder not found".to_string());
    }

    Ok(())
}

pub async fn get_folders_in_pool(pool: &SqlitePool) -> Result<Vec<Folder>, sqlx::Error> {
    sqlx::query_as!(
        Folder,
        r#"
        SELECT
            id as "id!",
            name,
            color,
            parent_id,
            is_deleted as "is_deleted: i64"
        FROM folders
        WHERE is_deleted = 0
        ORDER BY LOWER(name) ASC, created_at ASC
        "#
    )
    .fetch_all(pool)
    .await
}

pub async fn delete_folder_in_pool(pool: &SqlitePool, id: String) -> Result<(), String> {
    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    let parent_row = sqlx::query!(
        "SELECT parent_id FROM folders WHERE id = ? AND is_deleted = 0",
        id
    )
    .fetch_optional(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    let promoted_parent_id = match parent_row.and_then(|r| r.parent_id) {
        Some(pid) => {
            let parent_active = sqlx::query_scalar!(
                "SELECT COUNT(*) FROM folders WHERE id = ? AND is_deleted = 0",
                pid
            )
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
            if parent_active > 0 {
                Some(pid)
            } else {
                None
            }
        }
        None => None,
    };

    sqlx::query!(
        "UPDATE folders SET is_deleted = 1, parent_id = NULL WHERE id = ?",
        id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Promote direct child folders up one level instead of orphaning or deleting them.
    sqlx::query!(
        "UPDATE folders SET parent_id = ? WHERE parent_id = ? AND is_deleted = 0",
        promoted_parent_id,
        id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    // Promote direct projects up to the deleted folder's parent (or unassigned if top-level).
    sqlx::query!(
        "UPDATE projects SET folder_id = ? WHERE folder_id = ? AND is_deleted = 0",
        promoted_parent_id,
        id
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| e.to_string())?;

    tx.commit().await.map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn create_folder(
    name: String,
    color: String,
    parent_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<String, String> {
    create_folder_in_pool(&db.pool, name, color, parent_id).await
}

pub async fn update_folder(
    id: String,
    name: String,
    color: String,
    parent_id: Option<String>,
    db: State<'_, DbState>,
) -> Result<(), String> {
    update_folder_in_pool(&db.pool, id, name, color, parent_id).await
}

pub async fn get_folders(db: State<'_, DbState>) -> Result<Vec<Folder>, sqlx::Error> {
    get_folders_in_pool(&db.pool).await
}

pub async fn delete_folder(id: String, db: State<'_, DbState>) -> Result<(), String> {
    delete_folder_in_pool(&db.pool, id).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::project_service::{create_project_in_pool, get_projects_in_pool};
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

    #[tokio::test]
    async fn folder_crud_and_delete_unassigns_projects_without_deleting_them() {
        let pool = setup_test_pool().await;

        let folder_id =
            create_folder_in_pool(&pool, "  University  ".into(), "#10B981".into(), None)
                .await
                .unwrap();

        let folders = get_folders_in_pool(&pool).await.unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].name, "University");
        assert_eq!(folders[0].color, "#10B981");
        assert_eq!(folders[0].parent_id, None);

        update_folder_in_pool(
            &pool,
            folder_id.clone(),
            "Uni".into(),
            "#F59E0B".into(),
            None,
        )
        .await
        .unwrap();
        let folders = get_folders_in_pool(&pool).await.unwrap();
        assert_eq!(folders[0].name, "Uni");
        assert_eq!(folders[0].color, "#F59E0B");

        let project_id = create_project_in_pool(
            &pool,
            "Algorithms".into(),
            "Study".into(),
            "#3B82F6".into(),
            Some(folder_id.clone()),
        )
        .await
        .unwrap();

        let projects = get_projects_in_pool(&pool).await.unwrap();
        assert_eq!(projects.len(), 1);
        assert_eq!(projects[0].id, project_id);
        assert_eq!(projects[0].folder_id.as_deref(), Some(folder_id.as_str()));

        delete_folder_in_pool(&pool, folder_id).await.unwrap();

        assert!(get_folders_in_pool(&pool).await.unwrap().is_empty());

        let projects_after = get_projects_in_pool(&pool).await.unwrap();
        assert_eq!(projects_after.len(), 1);
        assert_eq!(projects_after[0].id, project_id);
        assert_eq!(projects_after[0].folder_id, None);
    }

    #[tokio::test]
    async fn nested_folders_prevent_cycles_and_promote_children_on_delete() {
        let pool = setup_test_pool().await;

        let root_id = create_folder_in_pool(&pool, "Uni".into(), "#3B82F6".into(), None)
            .await
            .unwrap();
        let child_id = create_folder_in_pool(
            &pool,
            "Semester 4".into(),
            "#10B981".into(),
            Some(root_id.clone()),
        )
        .await
        .unwrap();
        let grandchild_id = create_folder_in_pool(
            &pool,
            "Math".into(),
            "#F59E0B".into(),
            Some(child_id.clone()),
        )
        .await
        .unwrap();

        let project_in_child = create_project_in_pool(
            &pool,
            "Lecture Notes".into(),
            "Notes".into(),
            "#8B5CF6".into(),
            Some(child_id.clone()),
        )
        .await
        .unwrap();

        // Self-parenting must fail
        let self_err = update_folder_in_pool(
            &pool,
            root_id.clone(),
            "Uni".into(),
            "#3B82F6".into(),
            Some(root_id.clone()),
        )
        .await
        .unwrap_err();
        assert!(self_err.contains("own parent"));

        // Moving root into grandchild (3-level cycle) must fail
        let cycle_err = update_folder_in_pool(
            &pool,
            root_id.clone(),
            "Uni".into(),
            "#3B82F6".into(),
            Some(grandchild_id.clone()),
        )
        .await
        .unwrap_err();
        assert!(cycle_err.contains("subfolder"));

        // Deleting middle folder promotes grandchild AND child's project up to root
        delete_folder_in_pool(&pool, child_id).await.unwrap();

        let folders = get_folders_in_pool(&pool).await.unwrap();
        assert_eq!(folders.len(), 2);
        let grandchild = folders.iter().find(|f| f.id == grandchild_id).unwrap();
        assert_eq!(grandchild.parent_id.as_deref(), Some(root_id.as_str()));

        let projects = get_projects_in_pool(&pool).await.unwrap();
        let promoted_proj = projects.iter().find(|p| p.id == project_in_child).unwrap();
        assert_eq!(promoted_proj.folder_id.as_deref(), Some(root_id.as_str()));
    }

    #[tokio::test]
    async fn empty_folder_name_is_rejected() {
        let pool = setup_test_pool().await;
        let err = create_folder_in_pool(&pool, "   ".into(), "#3B82F6".into(), None)
            .await
            .unwrap_err();
        assert!(err.contains("empty"));
    }
}
