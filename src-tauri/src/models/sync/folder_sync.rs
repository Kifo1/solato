use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FolderSync {
    pub id: Uuid,
    pub name: String,
    pub color: String,
    #[serde(
        default,
        deserialize_with = "crate::models::sync::deserialize_present_option_uuid"
    )]
    pub parent_id: Option<Option<Uuid>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}
