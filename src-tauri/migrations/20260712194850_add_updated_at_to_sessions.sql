-- Session updated_at column
ALTER TABLE sessions ADD COLUMN updated_at TEXT;
UPDATE sessions SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW') WHERE updated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);