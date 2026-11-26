use crate::models::{pomodoro::PomodoroPhase, timer::SharedTimerState};
use keepawake::KeepAwake;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

pub struct PowerState {
    guard: Mutex<Option<KeepAwake>>,
}

impl PowerState {
    pub fn new() -> Self {
        Self {
            guard: Mutex::new(None),
        }
    }
}

/// Synchronizes the OS idle-sleep inhibitor with the current TimerState.
/// Keeps the system awake (while still allowing display sleep) only when
/// Pomodoro mode is actively running and `keep_awake_pomodoro` is enabled.
pub fn sync_keep_awake(app: &AppHandle) {
    let should_keep_awake = app
        .try_state::<SharedTimerState>()
        .and_then(|timer| timer.lock().ok().map(|s| s.should_keep_awake()))
        .unwrap_or(false);

    set_keep_awake(app, should_keep_awake);
}

pub fn set_keep_awake(app: &AppHandle, enable: bool) {
    let Some(power_state) = app.try_state::<PowerState>() else {
        return;
    };

    let Ok(mut guard) = power_state.guard.lock() else {
        log::error!("Failed to lock PowerState mutex");
        return;
    };

    if enable {
        if guard.is_none() {
            match keepawake::Builder::default()
                .idle(true)
                .display(false)
                .sleep(false)
                .reason("Solato Pomodoro timer is running")
                .app_name("Solato")
                .app_reverse_domain("de.kifo.solato")
                .create()
            {
                Ok(awake) => {
                    log::info!("Acquired system keep-awake assertion for Pomodoro mode.");
                    *guard = Some(awake);
                }
                Err(e) => {
                    log::warn!("Failed to acquire keep-awake assertion: {}", e);
                }
            }
        }
    } else if guard.is_some() {
        *guard = None;
        log::info!("Released system keep-awake assertion.");
    }
}

/// Best-effort attempt to wake the display when a Pomodoro phase ends.
/// Requires no elevated privileges.
pub fn wake_display() {
    #[cfg(target_os = "macos")]
    {
        if let Err(e) = std::process::Command::new("caffeinate")
            .args(["-u", "-t", "2"])
            .spawn()
        {
            log::warn!("Failed to run caffeinate to wake display: {}", e);
        }
    }

    #[cfg(target_os = "windows")]
    {
        tauri::async_runtime::spawn(async {
            if let Ok(display_guard) = keepawake::Builder::default()
                .display(true)
                .idle(true)
                .reason("Solato Pomodoro phase changed")
                .create()
            {
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                drop(display_guard);
            }
        });
    }

    #[cfg(target_os = "linux")]
    {
        let _ = std::process::Command::new("xdg-screensaver")
            .arg("reset")
            .spawn();
    }
}

/// Wakes the display and sends a native OS notification for a Pomodoro phase transition.
pub fn notify_pomodoro_phase_change(app: &AppHandle, new_phase: PomodoroPhase) {
    wake_display();

    let (title, body) = match new_phase {
        PomodoroPhase::FocusOne | PomodoroPhase::FocusTwo => (
            "Back to Focus",
            "Break is over. Time to get back to studying!",
        ),
        PomodoroPhase::ShortBreak => (
            "Short Break",
            "Focus session complete! Take a short break.",
        ),
        PomodoroPhase::LongBreak => (
            "Long Break",
            "Great work! Enjoy your long break.",
        ),
    };

    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::warn!("Failed to send Pomodoro phase notification: {}", e);
    }
}
