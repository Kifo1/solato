-- Projects
ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Projects
CREATE TRIGGER IF NOT EXISTS update_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE projects
    SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')
    WHERE id = NEW.id;
END;

-- Sessions
CREATE TRIGGER IF NOT EXISTS update_sessions_updated_at
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE sessions
    SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ', 'NOW')
    WHERE id = NEW.id;
END;