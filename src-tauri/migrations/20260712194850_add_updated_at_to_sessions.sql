-- Session updated_at column
ALTER TABLE sessions ADD COLUMN updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW'));

CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);