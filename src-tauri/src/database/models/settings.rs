use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

#[derive(Serialize, Deserialize, FromRow, Debug)]
pub struct AppSettings {
    pub focus_duration: i64,
    pub short_break: i64,
    pub long_break: i64,
    pub discord_rich_presence: bool,
}
