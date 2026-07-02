-- Add discord rich presents to settings
ALTER TABLE settings 
ADD COLUMN discord_rich_presence BOOLEAN NOT NULL DEFAULT 1;