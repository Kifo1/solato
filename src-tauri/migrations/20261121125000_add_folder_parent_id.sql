-- Allow folders to be nested inside other folders
ALTER TABLE folders ADD COLUMN parent_id TEXT REFERENCES folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
