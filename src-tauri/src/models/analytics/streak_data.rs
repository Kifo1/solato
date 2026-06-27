use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct StreakData {
    pub current_streak: u32,
    pub active_today: bool,
}
