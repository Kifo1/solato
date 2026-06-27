use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CalendarData {
    pub history: HashMap<String, u64>, // Key: "YYYY-MM-DD"
}
