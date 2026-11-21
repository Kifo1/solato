use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSync {
    pub id: Uuid,
    pub name: String,
    pub description: String,
    pub color: String,
    #[serde(
        default,
        deserialize_with = "crate::models::sync::deserialize_present_option_uuid"
    )]
    pub folder_id: Option<Option<Uuid>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}
