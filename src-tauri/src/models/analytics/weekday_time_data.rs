use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WeekdayTime {
    pub weekday: u8, // 0 = Monday .. 6 = Sunday
    pub total_seconds: u64,
    pub active_days: u64,
    pub average_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WeekdayTimeData {
    pub total_seconds: u64,
    pub entries: Vec<WeekdayTime>, // Always 7 entries, Monday first
}

impl WeekdayTimeData {
    pub fn empty() -> Self {
        let entries = (0..7)
            .map(|weekday| WeekdayTime {
                weekday,
                total_seconds: 0,
                active_days: 0,
                average_seconds: 0,
            })
            .collect();

        Self {
            total_seconds: 0,
            entries,
        }
    }
}
