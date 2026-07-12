use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::database::models::session::{SessionType, TimerMode};

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSync {
    pub id: Uuid,
    pub project_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub session_type: SessionType,
    pub mode: TimerMode,
    pub updated_at: DateTime<Utc>,
    pub is_deleted: bool,
}