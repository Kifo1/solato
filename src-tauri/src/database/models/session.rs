use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::Type)]
#[sqlx(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SessionType {
    Focus,
    ShortBreak,
    LongBreak,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone, sqlx::Type)]
#[sqlx(rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TimerMode {
    Stopwatch,
    Pomodoro,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct _Session {
    pub id: String,
    pub project_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: Option<DateTime<Utc>>,
    pub session_type: SessionType,
    pub mode: TimerMode,
    pub is_deleted: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionEntry {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub project_color: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub duration_seconds: i64,
    pub session_type: SessionType,
    pub mode: TimerMode,
}

#[derive(Debug, Deserialize, Clone)]
pub struct UpdateSessionInput {
    pub id: String,
    pub project_id: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub session_type: SessionType,
    pub mode: TimerMode,
}
