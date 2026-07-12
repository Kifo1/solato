use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use crate::models::sync::project_sync::ProjectSync;
use crate::models::sync::session_sync::SessionSync;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResponseDto {
    pub sync_timestamp: DateTime<Utc>,
    pub projects: Vec<ProjectSync>,
    pub sessions: Vec<SessionSync>,
}