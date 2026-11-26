use crate::{database::models::session::SessionType, services::settings_service};
use chrono::{DateTime, Duration, Utc};
use tauri::AppHandle;

#[derive(Debug, Copy, Clone, PartialEq, Eq)]
pub enum PomodoroPhase {
    FocusOne = 0,
    ShortBreak = 1,
    FocusTwo = 2,
    LongBreak = 3,
}

impl From<PomodoroPhase> for SessionType {
    fn from(phase: PomodoroPhase) -> Self {
        match phase {
            PomodoroPhase::FocusOne | PomodoroPhase::FocusTwo => SessionType::Focus,
            PomodoroPhase::ShortBreak => SessionType::ShortBreak,
            PomodoroPhase::LongBreak => SessionType::LongBreak,
        }
    }
}

pub struct PomodoroState {
    pub elapsed_millis: u64,
    pub started_at: Option<DateTime<Utc>>,

    pub focus_minutes: i64,
    pub short_break_minutes: i64,
    pub long_break_minutes: i64,

    pub phase: PomodoroPhase,
}

impl PomodoroState {
    pub async fn new(app: AppHandle) -> Self {
        let settings = settings_service::get_settings(app).await.unwrap();
        Self::from_durations(
            settings.focus_duration,
            settings.short_break,
            settings.long_break,
        )
    }

    pub fn from_durations(focus_minutes: i64, short_break_minutes: i64, long_break_minutes: i64) -> Self {
        Self {
            elapsed_millis: 0,
            started_at: None,
            focus_minutes,
            short_break_minutes,
            long_break_minutes,
            phase: PomodoroPhase::FocusOne,
        }
    }

    pub fn current_phase_duration_millis(&self) -> u64 {
        match self.phase {
            PomodoroPhase::FocusOne | PomodoroPhase::FocusTwo => {
                self.focus_minutes.max(0) as u64 * 60 * 1000
            }
            PomodoroPhase::ShortBreak => self.short_break_minutes.max(0) as u64 * 60 * 1000,
            PomodoroPhase::LongBreak => self.long_break_minutes.max(0) as u64 * 60 * 1000,
        }
    }

    pub fn current_phase_millis_left(&self) -> u64 {
        self.current_phase_duration_millis()
            .saturating_sub(self.elapsed_millis)
    }

    pub fn start_at(&mut self, now: DateTime<Utc>) {
        self.started_at = Some(now - Duration::milliseconds(self.elapsed_millis as i64));
    }

    pub fn elapsed_at(&self, now: DateTime<Utc>) -> u64 {
        if let Some(start) = self.started_at {
            let computed = (now - start).num_milliseconds().max(0) as u64;
            computed.max(self.elapsed_millis)
        } else {
            self.elapsed_millis
        }
    }

    pub fn raw_elapsed_at(&self, at: DateTime<Utc>) -> u64 {
        if let Some(start) = self.started_at {
            (at - start).num_milliseconds().max(0) as u64
        } else {
            self.elapsed_millis
        }
    }

    pub fn scheduled_phase_end(&self) -> Option<DateTime<Utc>> {
        self.started_at.map(|start| {
            start + Duration::milliseconds(self.current_phase_duration_millis() as i64)
        })
    }

    pub fn advance_phase(&mut self) {
        self.elapsed_millis = 0;
        self.started_at = None;
        self.phase = match self.phase {
            PomodoroPhase::FocusOne => PomodoroPhase::ShortBreak,
            PomodoroPhase::ShortBreak => PomodoroPhase::FocusTwo,
            PomodoroPhase::FocusTwo => PomodoroPhase::LongBreak,
            PomodoroPhase::LongBreak => PomodoroPhase::FocusOne,
        };
    }

    pub fn start_next_phase_at(&mut self, now: DateTime<Utc>) {
        self.advance_phase();
        self.started_at = Some(now);
    }
}
