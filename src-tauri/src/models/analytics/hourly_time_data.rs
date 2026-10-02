use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct HourlyTime {
    pub hour: u8, // 0..=23
    pub total_seconds: u64,
    pub active_days: u64,
    pub average_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HourlyTimeData {
    pub total_seconds: u64,
    pub entries: Vec<HourlyTime>, // Always 24 entries
}

impl HourlyTimeData {
    pub fn empty() -> Self {
        let entries = (0..24)
            .map(|hour| HourlyTime {
                hour,
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
