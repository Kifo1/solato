-- Add keep_awake_pomodoro setting (enabled by default)
ALTER TABLE settings
ADD COLUMN keep_awake_pomodoro BOOLEAN NOT NULL DEFAULT 1;
