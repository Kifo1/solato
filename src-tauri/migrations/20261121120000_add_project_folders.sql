-- Create folders table for organizing projects
CREATE TABLE IF NOT EXISTS folders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'NOW')),
    updated_at TEXT NOT NULL DEFAULT (STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'NOW')),
    is_deleted INTEGER NOT NULL DEFAULT 0 -- 0 = active, 1 = deleted
);

CREATE INDEX IF NOT EXISTS idx_folders_name ON folders(name);
CREATE INDEX IF NOT EXISTS idx_folders_updated_at ON folders(updated_at);

CREATE TRIGGER IF NOT EXISTS update_folders_updated_at
AFTER UPDATE ON folders
FOR EACH ROW
WHEN NEW.updated_at IS OLD.updated_at
BEGIN
    UPDATE folders
    SET updated_at = STRFTIME('%Y-%m-%dT%H:%M:%SZ', 'NOW')
    WHERE id = NEW.id;
END;

-- Add optional folder reference to projects
ALTER TABLE projects ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_folder_id ON projects(folder_id);
