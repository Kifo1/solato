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
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::time::sleep;
use crate::services::discord_service;

fn get_session_info(state: &crate::models::timer::TimerState) -> (SessionType, TimerMode) {
    match state.active_mode {
        ActiveMode::Stopwatch => (SessionType::Focus, TimerMode::Stopwatch),
        ActiveMode::Pomodoro => (state.pomodoro.phase.into(), TimerMode::Pomodoro),
    }
}

pub async fn start_timer(
    app: AppHandle,
    state: SharedTimerState,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let (project_id, session_info) = {
        let s = state.lock().map_err(|_| "Mutex Error")?;
        if s.is_running {
            return Ok(());
        }
        let pid = s.selected_project.as_ref().map(|p| p.id.clone());
        let info = get_session_info(&s);
        (pid, info)
    };

    let session_id = if let Some(pid) = project_id {
        let (s_type, mode) = session_info;
        Some(session_service::start_session(pid, s_type, mode, db.inner()).await?)
    } else {
        None
    };

    {
        let mut state_lock = state.lock().map_err(|_| "Mutex Error")?;
        state_lock.is_running = true;
        state_lock.current_session_id = session_id;

        let now = Instant::now();
        match state_lock.active_mode {
            ActiveMode::Stopwatch => {
                state_lock.stopwatch.start_instant =
                    Some(now - Duration::from_millis(state_lock.stopwatch.elapsed_millis));
            }
            ActiveMode::Pomodoro => {
                state_lock.pomodoro.start_instant =
                    Some(now - Duration::from_millis(state_lock.pomodoro.elapsed_millis));
            }
        }
    }

    let db_handle = db.inner().clone();
    let state_clone = state.clone();

    tauri::async_runtime::spawn(async move {
        let mut last_heartbeat = Instant::now();
        let heartbeat_interval = Duration::from_secs(30);

        loop {
            let mut session_to_stop: Option<String> = None;
            let mut new_session_data: Option<(String, SessionType, TimerMode)> = None;
            let current_id;

            let result = {
                let mut s = state_clone.lock().unwrap();
                if !s.is_running {
                    break;
                }

                current_id = s.current_session_id.clone();

                match s.active_mode {
                    ActiveMode::Stopwatch => {
                        if let Some(start) = s.stopwatch.start_instant {
                            s.stopwatch.elapsed_millis = start.elapsed().as_millis() as u64;
                        }
                        Ok(s.stopwatch.elapsed_millis)
                    }
                    ActiveMode::Pomodoro => {
                        if let Some(start) = s.pomodoro.start_instant {
                            s.pomodoro.elapsed_millis = start.elapsed().as_millis() as u64;
                        }
                        let left = s.pomodoro.current_phase_millis_left();

                        if left == 0 {
                            session_to_stop = s.current_session_id.take();
                            s.pomodoro.start_next_phase();

                            let new_phase = s.pomodoro.phase;
                            if let Some(p) = &s.selected_project {
                                new_session_data =
                                    Some((p.id.clone(), new_phase.into(), TimerMode::Pomodoro));
                            }

                            s.pomodoro.start_instant = Some(Instant::now());
                            s.pomodoro.elapsed_millis = 0;

                            Err(new_phase as u8)
                        } else {
                            Ok(left)
                        }
                    }
                }
            };

            match result {
                Ok(elapsed) => {
                    let _ = app.emit("timer-tick", elapsed);
                }
                Err(phase_idx) => {
                    let _ = app.emit("pomodoro-phase", phase_idx);
                    let _ = app.emit("pomodoro-phase-sound", ());
                    let _ = app.emit("timer-tick", 0);
                    discord_service::set_discord_presence(
                        &app,
                        discord_service::PresenceState::Working,
                    )
                        .await
                        .unwrap_or_else(|e| eprintln!("Failed to set Discord presence: {}", e));
                }
            }

            if let Some(id) = current_id {
                if last_heartbeat.elapsed() >= heartbeat_interval {
                    let _ = session_service::stop_session(id, &db_handle).await;
                    last_heartbeat = Instant::now();
                }
            }

            if let Some(id) = session_to_stop {
                let _ = session_service::stop_session(id, &db_handle).await;
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

pub async fn stop_timer(state: SharedTimerState, db: State<'_, DbState>) -> Result<(), String> {
    let session_id = {
        let mut state_lock = state.lock().map_err(|_| "Mutex Error")?;
        stop_timer_inner(&mut state_lock)
    };

    if let Some(id) = session_id {
        session_service::stop_session(id, db.inner()).await?;
    }

    Ok(())
}

pub fn stop_timer_inner(state: &mut crate::models::timer::TimerState) -> Option<String> {
    if !state.is_running {
        return None;
    }

    let session_id = state.current_session_id.take();
    state.is_running = false;

    match state.active_mode {
        ActiveMode::Stopwatch => {
            if let Some(start) = state.stopwatch.start_instant {
                state.stopwatch.elapsed_millis = start.elapsed().as_millis() as u64;
            }
            state.stopwatch.start_instant = None;
        }
        ActiveMode::Pomodoro => {
            if let Some(start) = state.pomodoro.start_instant {
                state.pomodoro.elapsed_millis = start.elapsed().as_millis() as u64;
            }
            state.pomodoro.start_instant = None;
        }
    }

    session_id
}

pub async fn reset_timer(
    app: AppHandle,
    state: SharedTimerState,
    db: State<'_, DbState>,
) -> Result<(), String> {
    let was_running = {
        let mut state_lock = state.lock().map_err(|_| "Mutex Error")?;
        let was_running = state_lock.is_running;

        let session_id = stop_timer_inner(&mut state_lock);

        match state_lock.active_mode {
            ActiveMode::Stopwatch => state_lock.stopwatch.elapsed_millis = 0,
            ActiveMode::Pomodoro => {
                state_lock.pomodoro.elapsed_millis = 0;
                state_lock.pomodoro.phase = crate::models::pomodoro::PomodoroPhase::FocusOne;
                let _ = app.emit("pomodoro-phase", state_lock.pomodoro.phase as u8);
            }
        }
        (was_running, session_id)
    };

    if let Some(id) = was_running.1 {
        let _ = session_service::stop_session(id, db.inner()).await;
    }

    if was_running.0 {
        start_timer(app, state, db).await
    } else {
        Ok(())
    }
}

pub async fn update_project_session(
    project: Option<Project>,
    state: SharedTimerState,
    db: &DbState,
) -> Result<(), String> {
    let (is_running, old_session_id, session_info) = {
        let mut state_lock = state.lock().map_err(|_| "Mutex Error")?;
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
            let _ = session_service::stop_session(id, db).await;
        }

        if let Some(p) = project {
            if let Some((s_type, mode)) = session_info {
                let new_id = session_service::start_session(p.id, s_type, mode, db).await?;
                if let Ok(mut s) = state.lock() {
                    s.current_session_id = Some(new_id);
                }
            }
        }
    }

    Ok(())
}

pub async fn sync_timer_with_settings(state: SharedTimerState, db: &DbState) -> Result<(), String> {
    let settings = crate::services::settings_service::get_settings(db)
        .await
        .map_err(|_| "Failed to get settings")?;

    {
        let mut state_lock = state.lock().map_err(|_| "Mutex Error")?;

        state_lock.pomodoro.focus_minutes = settings.focus_duration;
        state_lock.pomodoro.short_break_minutes = settings.short_break;
        state_lock.pomodoro.long_break_minutes = settings.long_break;

        if !state_lock.is_running {
            state_lock.pomodoro.elapsed_millis = 0;
        }
    }

    Ok(())
}
