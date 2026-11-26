use chrono::{DateTime, Duration, Utc};

pub struct StopwatchState {
    pub elapsed_millis: u64,
    pub started_at: Option<DateTime<Utc>>,
}

impl StopwatchState {
    pub fn new() -> Self {
        Self {
            elapsed_millis: 0,
            started_at: None,
        }
    }

    pub fn start_at(&mut self, now: DateTime<Utc>) {
        self.started_at = Some(now - Duration::milliseconds(self.elapsed_millis as i64));
    }

    /// Monotonically non-decreasing elapsed time for normal ticking (guards against small NTP clock steps).
    pub fn elapsed_at(&self, now: DateTime<Utc>) -> u64 {
        if let Some(start) = self.started_at {
            let computed = (now - start).num_milliseconds().max(0) as u64;
            computed.max(self.elapsed_millis)
        } else {
            self.elapsed_millis
        }
    }

    /// Exact wall-clock elapsed time at a historical timestamp (used to roll back to sleep time).
    pub fn raw_elapsed_at(&self, at: DateTime<Utc>) -> u64 {
        if let Some(start) = self.started_at {
            (at - start).num_milliseconds().max(0) as u64
        } else {
            self.elapsed_millis
        }
    }
}
