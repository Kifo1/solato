use crate::models::pomodoro::PomodoroPhase;
use crate::models::timer::{SleepRecoveryAction, SleepRecoveryInfo, TimerState};
use crate::services::{discord_service, power_service};
use crate::{
    database::models::{
        project::Project,
        session::{SessionType, TimerMode},
    },
    models::{
        dbstate::DbState,
        timer::{ActiveMode, SharedTimerState},
    },
    services::session_service,
};
use chrono::{DateTime, Utc};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::sleep;

/// Wall-clock gap (in seconds) between two 100ms timer ticks that indicates
/// the host machine was suspended / put to sleep.
pub const SLEEP_DETECTION_THRESHOLD_SECS: i64 = 30;

fn get_session_info(state: &TimerState) -> (SessionType, TimerMode) {
    match state.active_mode {
        ActiveMode::Stopwatch => (SessionType::Focus, TimerMode::Stopwatch),
        ActiveMode::Pomodoro => (state.pomodoro.phase.into(), TimerMode::Pomodoro),
    }
}

/// Checks whether a sleep gap occurred between `last_tick_utc` and `now_utc`.
/// If so, records or updates `state.pending_sleep_recovery` and returns it.
pub fn detect_and_record_sleep(
    state: &mut TimerState,
    last_tick_utc: DateTime<Utc>,
    now_utc: DateTime<Utc>,
) -> Option<SleepRecoveryInfo> {
    let gap_secs = (now_utc - last_tick_utc).num_seconds();
    if gap_secs < SLEEP_DETECTION_THRESHOLD_SECS {
        return None;
    }

    let (slept_at, elapsed_at_sleep_millis) = if let Some(existing) = &state.pending_sleep_recovery {
        (existing.slept_at, existing.elapsed_at_sleep_millis)
    } else {
        let elapsed = match state.active_mode {
            ActiveMode::Stopwatch => state.stopwatch.raw_elapsed_at(last_tick_utc),
            ActiveMode::Pomodoro => state.pomodoro.raw_elapsed_at(last_tick_utc),
        };
        (last_tick_utc, elapsed)
    };

    let (mode, phase_ended_during_sleep, scheduled_phase_end, pomodoro_phase) =
        match state.active_mode {
            ActiveMode::Stopwatch => ("stopwatch".to_string(), false, None, None),
            ActiveMode::Pomodoro => {
                let scheduled_end = state.pomodoro.scheduled_phase_end();
                let phase_ended = scheduled_end.is_some_and(|end| now_utc >= end);
                (
                    "pomodoro".to_string(),
                    phase_ended,
                    scheduled_end,
                    Some(state.pomodoro.phase as u8),
                )
            }
        };

    let info = SleepRecoveryInfo {
        slept_at,
        woke_at: now_utc,
        sleep_duration_seconds: (now_utc - slept_at).num_seconds().max(0),
        elapsed_at_sleep_millis,
        mode,
        phase_ended_during_sleep,
        scheduled_phase_end,
        pomodoro_phase,
    };

    state.pending_sleep_recovery = Some(info.clone());
    Some(info)
}

#[derive(Debug, PartialEq, Eq)]
pub struct SleepRecoveryResolution {
    pub session_to_stop: Option<(String, DateTime<Utc>)>,
    pub heartbeat_session: Option<(String, DateTime<Utc>)>,
    pub emit_tick: Option<u64>,
    pub emit_phase: Option<u8>,
    pub emit_running: Option<bool>,
    pub keep_running: bool,
}

/// Applies the user's sleep recovery decision to `TimerState` and returns the
/// DB and event side-effects to execute outside the mutex lock.
pub fn apply_sleep_recovery_inner(
    state: &mut TimerState,
    action: SleepRecoveryAction,
    now_utc: DateTime<Utc>,
) -> Option<SleepRecoveryResolution> {
    let info = state.pending_sleep_recovery.take()?;

    match action {
        SleepRecoveryAction::EndAtSleep => {
            let session_id = state.current_session_id.take();
            state.is_running = false;

            let emit_tick = match state.active_mode {
                ActiveMode::Stopwatch => {
                    state.stopwatch.elapsed_millis = info.elapsed_at_sleep_millis;
                    state.stopwatch.started_at = None;
                    state.stopwatch.elapsed_millis
                }
                ActiveMode::Pomodoro => {
                    state.pomodoro.elapsed_millis = info
                        .elapsed_at_sleep_millis
                        .min(state.pomodoro.current_phase_duration_millis());
                    state.pomodoro.started_at = None;
                    state.pomodoro.current_phase_millis_left()
                }
            };

            Some(SleepRecoveryResolution {
                session_to_stop: session_id.map(|id| (id, info.slept_at)),
                heartbeat_session: None,
                emit_tick: Some(emit_tick),
                emit_phase: None,
                emit_running: Some(false),
                keep_running: false,
            })
        }
        SleepRecoveryAction::KeepFullTime => {
            if state.active_mode == ActiveMode::Pomodoro && info.phase_ended_during_sleep {
                let session_id = state.current_session_id.take();
                state.is_running = false;

                let phase_end = info.scheduled_phase_end.unwrap_or(info.woke_at);
                state.pomodoro.advance_phase();

                Some(SleepRecoveryResolution {
                    session_to_stop: session_id.map(|id| (id, phase_end)),
                    heartbeat_session: None,
                    emit_tick: Some(state.pomodoro.current_phase_millis_left()),
                    emit_phase: Some(state.pomodoro.phase as u8),
                    emit_running: Some(false),
                    keep_running: false,
                })
            } else {
                let emit_tick = match state.active_mode {
                    ActiveMode::Stopwatch => {
                        state.stopwatch.elapsed_millis = state.stopwatch.elapsed_at(now_utc);
                        state.stopwatch.elapsed_millis
                    }
                    ActiveMode::Pomodoro => {
                        state.pomodoro.elapsed_millis = state.pomodoro.elapsed_at(now_utc);
                        state.pomodoro.current_phase_millis_left()
                    }
                };

                Some(SleepRecoveryResolution {
                    session_to_stop: None,
                    heartbeat_session: state
                        .current_session_id
                        .clone()
                        .map(|id| (id, now_utc)),
                    emit_tick: Some(emit_tick),
                    emit_phase: None,
                    emit_running: None,
                    keep_running: true,
                })
            }
        }
    }
}

pub async fn start_timer(app: AppHandle) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();
    let db = app.state::<DbState>();

    let (project_id, session_info) = {
        let timer = timer.lock().map_err(|_| "Mutex Error")?;
        if timer.is_running {
            return Ok(());
        }
        let pid = timer.selected_project.as_ref().map(|p| p.id.clone());
        let info = get_session_info(&timer);
        (pid, info)
    };

    let session_id = if let Some(pid) = project_id {
        let (s_type, mode) = session_info;
        Some(session_service::start_session(pid, s_type, mode, db.inner()).await?)
    } else {
        None
    };

    let run_id = {
        let mut state_lock = timer.lock().map_err(|_| "Mutex Error")?;
        state_lock.is_running = true;
        state_lock.pending_sleep_recovery = None;
        state_lock.current_session_id = session_id;
        state_lock.timer_run_id = state_lock.timer_run_id.wrapping_add(1);

        let now = Utc::now();
        match state_lock.active_mode {
            ActiveMode::Stopwatch => {
                state_lock.stopwatch.start_at(now);
            }
            ActiveMode::Pomodoro => {
                state_lock.pomodoro.start_at(now);
            }
        }
        state_lock.timer_run_id
    };

    power_service::sync_keep_awake(&app);
    let _ = app.emit("timer-running-changed", true);

    let db_handle = db.inner().clone();
    let state_clone = timer.inner().clone();
    let app_handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let mut last_tick_utc = Utc::now();
        let mut last_heartbeat = Instant::now();
        let heartbeat_interval = Duration::from_secs(30);

        loop {
            let now_utc = Utc::now();
            let mut session_to_stop: Option<(String, DateTime<Utc>)> = None;
            let mut new_session_data: Option<(String, SessionType, TimerMode)> = None;
            let mut sleep_event: Option<SleepRecoveryInfo> = None;
            let mut phase_transition: Option<PomodoroPhase> = None;
            let current_id;
            let has_pending_sleep;

            let tick_value = {
                let mut s = state_clone.lock().unwrap();
                if !s.is_running || s.timer_run_id != run_id {
                    break;
                }

                if let Some(info) = detect_and_record_sleep(&mut s, last_tick_utc, now_utc) {
                    log::info!(
                        "Detected device sleep ({}s, slept at {}). Prompting user.",
                        info.sleep_duration_seconds,
                        info.slept_at
                    );
                    sleep_event = Some(info);
                }

                current_id = s.current_session_id.clone();
                has_pending_sleep = s.pending_sleep_recovery.is_some();

                match s.active_mode {
                    ActiveMode::Stopwatch => {
                        s.stopwatch.elapsed_millis = s.stopwatch.elapsed_at(now_utc);
                        s.stopwatch.elapsed_millis
                    }
                    ActiveMode::Pomodoro => {
                        if s.pending_sleep_recovery
                            .as_ref()
                            .is_some_and(|r| r.phase_ended_during_sleep)
                        {
                            // Hold at 0 until the user resolves the sleep recovery modal
                            s.pomodoro.elapsed_millis = s.pomodoro.current_phase_duration_millis();
                            0
                        } else {
                            s.pomodoro.elapsed_millis = s.pomodoro.elapsed_at(now_utc);
                            let left = s.pomodoro.current_phase_millis_left();

                            if left == 0 {
                                let scheduled_end = s.pomodoro.scheduled_phase_end();
                                if let Some(pending) = s.pending_sleep_recovery.as_mut() {
                                    // Phase boundary reached while sleep modal is still open
                                    pending.phase_ended_during_sleep = true;
                                    pending.scheduled_phase_end = scheduled_end;
                                    sleep_event = Some(pending.clone());
                                    0
                                } else {
                                    let phase_end = scheduled_end.unwrap_or(now_utc);
                                    if let Some(id) = s.current_session_id.take() {
                                        session_to_stop = Some((id, phase_end));
                                    }
                                    s.pomodoro.start_next_phase_at(now_utc);

                                    let new_phase = s.pomodoro.phase;
                                    if let Some(p) = &s.selected_project {
                                        new_session_data = Some((
                                            p.id.clone(),
                                            new_phase.into(),
                                            TimerMode::Pomodoro,
                                        ));
                                    }

                                    phase_transition = Some(new_phase);
                                    0
                                }
                            } else {
                                left
                            }
                        }
                    }
                }
            };

            last_tick_utc = now_utc;

            if let Some(info) = sleep_event {
                power_service::sync_keep_awake(&app_handle);
                let _ = app_handle.emit("sleep-recovery-needed", info);
            }

            if let Some(new_phase) = phase_transition {
                let _ = app_handle.emit("pomodoro-phase", new_phase as u8);
                let _ = app_handle.emit("pomodoro-phase-sound", ());
                let _ = app_handle.emit("timer-tick", 0);
                power_service::notify_pomodoro_phase_change(&app_handle, new_phase);
                discord_service::set_discord_presence(
                    app_handle.clone(),
                    discord_service::PresenceState::Working,
                )
                .await
                .unwrap_or_else(|e| log::error!("Failed to set Discord presence: {}", e));
            } else {
                let _ = app_handle.emit("timer-tick", tick_value);
            }

            // Pause DB heartbeats while awaiting sleep recovery decision so we never
            // overwrite the pre-sleep end_time before the user decides.
            if !has_pending_sleep {
                if let Some(id) = current_id {
                    if last_heartbeat.elapsed() >= heartbeat_interval {
                        let _ = session_service::stop_session(id, &db_handle).await;
                        last_heartbeat = Instant::now();
                    }
                }
            }

            if let Some((id, end_time)) = session_to_stop {
                let _ = session_service::stop_session_at(id, end_time, &db_handle).await;
            }

            if let Some((pid, s_type, mode)) = new_session_data {
                if let Ok(nid) = session_service::start_session(pid, s_type, mode, &db_handle).await
                {
                    if let Ok(mut s) = state_clone.lock() {
                        s.current_session_id = Some(nid);
                    }
                }
            }

            sleep(Duration::from_millis(100)).await;
        }
    });

    Ok(())
}

pub async fn resolve_sleep_recovery(
    app: AppHandle,
    action: SleepRecoveryAction,
) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();
    let db = app.state::<DbState>();
    let now = Utc::now();

    let resolution = {
        let mut state_lock = timer.lock().map_err(|_| "Mutex Error")?;
        apply_sleep_recovery_inner(&mut state_lock, action, now)
    };

    let Some(res) = resolution else {
        let _ = app.emit("sleep-recovery-resolved", ());
        return Ok(());
    };

    if let Some((id, end_time)) = res.session_to_stop {
        session_service::stop_session_at(id, end_time, db.inner()).await?;
    }

    if let Some((id, hb_time)) = res.heartbeat_session {
        let _ = session_service::stop_session_at(id, hb_time, db.inner()).await;
    }

    power_service::sync_keep_awake(&app);

    if let Some(phase) = res.emit_phase {
        let _ = app.emit("pomodoro-phase", phase);
    }
    if let Some(tick) = res.emit_tick {
        let _ = app.emit("timer-tick", tick);
    }
    if let Some(running) = res.emit_running {
        let _ = app.emit("timer-running-changed", running);
    }
    if !res.keep_running {
        let _ = discord_service::set_discord_presence(
            app.clone(),
            discord_service::PresenceState::Idle,
        )
        .await;
    }

    let _ = app.emit("sleep-recovery-resolved", ());
    Ok(())
}

pub async fn stop_timer(app: AppHandle) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();
    let db = app.state::<DbState>();

    let session_id = {
        let mut state_lock = timer.lock().map_err(|_| "Mutex Error")?;
        stop_timer_inner(&mut state_lock)
    };

    power_service::sync_keep_awake(&app);
    let _ = app.emit("timer-running-changed", false);
    let _ = app.emit("sleep-recovery-resolved", ());

    if let Some(id) = session_id {
        session_service::stop_session(id, db.inner()).await?;
    }

    Ok(())
}

pub fn stop_timer_inner(state: &mut TimerState) -> Option<String> {
    state.pending_sleep_recovery = None;

    if !state.is_running {
        return None;
    }

    let now = Utc::now();
    let session_id = state.current_session_id.take();
    state.is_running = false;

    match state.active_mode {
        ActiveMode::Stopwatch => {
            state.stopwatch.elapsed_millis = state.stopwatch.elapsed_at(now);
            state.stopwatch.started_at = None;
        }
        ActiveMode::Pomodoro => {
            state.pomodoro.elapsed_millis = state.pomodoro.elapsed_at(now);
            state.pomodoro.started_at = None;
        }
    }

    session_id
}

pub async fn reset_timer(app: AppHandle) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();
    let db = app.state::<DbState>();

    let was_running = {
        let mut timer_state = timer.lock().map_err(|_| "Mutex Error")?;
        let was_running = timer_state.is_running;
        let session_id = stop_timer_inner(&mut timer_state);

        match timer_state.active_mode {
            ActiveMode::Stopwatch => timer_state.stopwatch.elapsed_millis = 0,
            ActiveMode::Pomodoro => {
                timer_state.pomodoro.elapsed_millis = 0;
                timer_state.pomodoro.phase = PomodoroPhase::FocusOne;
                let _ = app.emit("pomodoro-phase", timer_state.pomodoro.phase as u8);
            }
        }
        (was_running, session_id)
    };

    power_service::sync_keep_awake(&app);
    let _ = app.emit("sleep-recovery-resolved", ());

    if let Some(id) = was_running.1 {
        let _ = session_service::stop_session(id, db.inner()).await;
    }

    if was_running.0 {
        start_timer(app).await
    } else {
        Ok(())
    }
}

pub async fn update_project_session(
    app: AppHandle,
    project: Option<Project>,
) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();
    let db = app.state::<DbState>();

    let (is_running, old_session_id, session_info) = {
        let mut state_lock = timer.lock().map_err(|_| "Mutex Error")?;
        let is_running = state_lock.is_running;
        let old_id = state_lock.current_session_id.take();

        state_lock.selected_project = project.clone();

        let info = if is_running {
            Some(get_session_info(&state_lock))
        } else {
            None
        };
        (is_running, old_id, info)
    };

    if is_running {
        if let Some(id) = old_session_id {
            let _ = session_service::stop_session(id, db.inner()).await;
        }

        if let Some(p) = project {
            if let Some((s_type, mode)) = session_info {
                let new_id = session_service::start_session(p.id, s_type, mode, db.inner()).await?;
                if let Ok(mut s) = timer.lock() {
                    s.current_session_id = Some(new_id);
                }
            }
        }
    }

    Ok(())
}

pub async fn sync_timer_with_settings(app: AppHandle) -> Result<(), String> {
    let timer = app.state::<SharedTimerState>();

    let settings = crate::services::settings_service::get_settings(app.clone())
        .await
        .map_err(|_| "Failed to get settings")?;

    {
        let mut state_lock = timer.lock().map_err(|_| "Mutex Error")?;

        state_lock.pomodoro.focus_minutes = settings.focus_duration;
        state_lock.pomodoro.short_break_minutes = settings.short_break;
        state_lock.pomodoro.long_break_minutes = settings.long_break;
        state_lock.keep_awake_pomodoro = settings.keep_awake_pomodoro;

        if !state_lock.is_running {
            state_lock.pomodoro.elapsed_millis = 0;
        }
    }

    power_service::sync_keep_awake(&app);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{pomodoro::PomodoroState, stopwatch::StopwatchState};
    use chrono::Duration as ChronoDuration;

    fn make_test_state(mode: ActiveMode) -> TimerState {
        TimerState {
            active_mode: mode,
            is_running: true,
            selected_project: None,
            current_session_id: Some("session-1".to_string()),
            keep_awake_pomodoro: true,
            pending_sleep_recovery: None,
            timer_run_id: 1,
            stopwatch: StopwatchState::new(),
            pomodoro: PomodoroState::from_durations(25, 5, 15),
        }
    }

    #[test]
    fn wall_clock_stopwatch_tracks_across_sleep_and_can_end_at_sleep() {
        let mut state = make_test_state(ActiveMode::Stopwatch);
        let t0 = DateTime::parse_from_rfc3339("2026-11-26T14:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let slept_at = t0 + ChronoDuration::minutes(20);
        let woke_at = t0 + ChronoDuration::minutes(60);

        state.stopwatch.start_at(t0);
        state.stopwatch.elapsed_millis = state.stopwatch.elapsed_at(slept_at);

        // No sleep detected for normal 100ms tick
        assert!(detect_and_record_sleep(&mut state, slept_at, slept_at + ChronoDuration::milliseconds(100)).is_none());

        // Sleep detected after 40-minute gap
        let info = detect_and_record_sleep(&mut state, slept_at, woke_at).expect("sleep should be detected");
        assert_eq!(info.slept_at, slept_at);
        assert_eq!(info.woke_at, woke_at);
        assert_eq!(info.sleep_duration_seconds, 40 * 60);
        assert_eq!(info.elapsed_at_sleep_millis, 20 * 60 * 1000);
        assert!(!info.phase_ended_during_sleep);

        // While modal is open, wall clock continues tracking
        assert_eq!(state.stopwatch.elapsed_at(woke_at), 60 * 60 * 1000);

        // User chooses EndAtSleep -> rolls back to 20 min and ends DB session at slept_at
        let res = apply_sleep_recovery_inner(&mut state, SleepRecoveryAction::EndAtSleep, woke_at)
            .expect("should resolve");
        assert!(!state.is_running);
        assert_eq!(state.stopwatch.elapsed_millis, 20 * 60 * 1000);
        assert_eq!(res.session_to_stop, Some(("session-1".to_string(), slept_at)));
        assert_eq!(res.emit_tick, Some(20 * 60 * 1000));
        assert_eq!(res.emit_running, Some(false));
        assert!(!res.keep_running);
    }

    #[test]
    fn stopwatch_keep_full_time_continues_running_with_sleep_included() {
        let mut state = make_test_state(ActiveMode::Stopwatch);
        let t0 = DateTime::parse_from_rfc3339("2026-11-26T14:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let slept_at = t0 + ChronoDuration::minutes(15);
        let woke_at = t0 + ChronoDuration::minutes(45);
        let resolved_at = woke_at + ChronoDuration::seconds(10);

        state.stopwatch.start_at(t0);
        detect_and_record_sleep(&mut state, slept_at, woke_at).unwrap();

        let res = apply_sleep_recovery_inner(&mut state, SleepRecoveryAction::KeepFullTime, resolved_at)
            .expect("should resolve");
        assert!(state.is_running);
        assert!(res.keep_running);
        assert_eq!(state.stopwatch.elapsed_millis, (45 * 60 + 10) * 1000);
        assert_eq!(res.session_to_stop, None);
        assert_eq!(res.heartbeat_session, Some(("session-1".to_string(), resolved_at)));
        assert!(state.pending_sleep_recovery.is_none());
    }

    #[test]
    fn pomodoro_sleep_past_phase_end_finishes_at_scheduled_end_and_pauses_next_phase() {
        let mut state = make_test_state(ActiveMode::Pomodoro);
        let t0 = DateTime::parse_from_rfc3339("2026-11-26T14:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let slept_at = t0 + ChronoDuration::minutes(20);
        let scheduled_end = t0 + ChronoDuration::minutes(25);
        let woke_at = t0 + ChronoDuration::minutes(90);

        state.pomodoro.start_at(t0);

        let info = detect_and_record_sleep(&mut state, slept_at, woke_at).unwrap();
        assert!(info.phase_ended_during_sleep);
        assert_eq!(info.scheduled_phase_end, Some(scheduled_end));
        assert_eq!(info.elapsed_at_sleep_millis, 20 * 60 * 1000);

        let res = apply_sleep_recovery_inner(&mut state, SleepRecoveryAction::KeepFullTime, woke_at)
            .expect("should resolve");
        assert!(!state.is_running);
        assert!(!res.keep_running);
        assert_eq!(res.session_to_stop, Some(("session-1".to_string(), scheduled_end)));
        assert_eq!(state.pomodoro.phase, PomodoroPhase::ShortBreak);
        assert_eq!(state.pomodoro.elapsed_millis, 0);
        assert_eq!(res.emit_phase, Some(PomodoroPhase::ShortBreak as u8));
        assert_eq!(res.emit_tick, Some(5 * 60 * 1000));
        assert_eq!(res.emit_running, Some(false));
    }

    #[test]
    fn pomodoro_sleep_within_same_phase_continues_seamlessly_when_kept() {
        let mut state = make_test_state(ActiveMode::Pomodoro);
        let t0 = DateTime::parse_from_rfc3339("2026-11-26T14:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let slept_at = t0 + ChronoDuration::minutes(10);
        let woke_at = t0 + ChronoDuration::minutes(15);

        state.pomodoro.start_at(t0);

        let info = detect_and_record_sleep(&mut state, slept_at, woke_at).unwrap();
        assert!(!info.phase_ended_during_sleep);

        let res = apply_sleep_recovery_inner(&mut state, SleepRecoveryAction::KeepFullTime, woke_at)
            .expect("should resolve");
        assert!(state.is_running);
        assert!(res.keep_running);
        assert_eq!(state.pomodoro.phase, PomodoroPhase::FocusOne);
        assert_eq!(state.pomodoro.current_phase_millis_left(), 10 * 60 * 1000);
    }

    #[test]
    fn repeated_sleep_before_resolution_preserves_original_slept_at() {
        let mut state = make_test_state(ActiveMode::Stopwatch);
        let t0 = DateTime::parse_from_rfc3339("2026-11-26T14:00:00Z")
            .unwrap()
            .with_timezone(&Utc);
        let first_sleep = t0 + ChronoDuration::minutes(10);
        let first_wake = t0 + ChronoDuration::minutes(30);
        let second_wake = t0 + ChronoDuration::minutes(50);

        state.stopwatch.start_at(t0);
        detect_and_record_sleep(&mut state, first_sleep, first_wake).unwrap();
        let second_info = detect_and_record_sleep(&mut state, first_wake, second_wake).unwrap();

        assert_eq!(second_info.slept_at, first_sleep);
        assert_eq!(second_info.woke_at, second_wake);
        assert_eq!(second_info.elapsed_at_sleep_millis, 10 * 60 * 1000);
        assert_eq!(second_info.sleep_duration_seconds, 40 * 60);
    }

    #[test]
    fn should_keep_awake_only_in_active_pomodoro_when_enabled() {
        let mut state = make_test_state(ActiveMode::Pomodoro);
        assert!(state.should_keep_awake());

        state.keep_awake_pomodoro = false;
        assert!(!state.should_keep_awake());

        state.keep_awake_pomodoro = true;
        state.active_mode = ActiveMode::Stopwatch;
        assert!(!state.should_keep_awake());

        state.active_mode = ActiveMode::Pomodoro;
        state.is_running = false;
        assert!(!state.should_keep_awake());
    }
}
