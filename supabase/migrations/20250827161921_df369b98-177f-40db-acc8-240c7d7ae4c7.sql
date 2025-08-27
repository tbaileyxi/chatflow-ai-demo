-- Add sponsor_url column to teams table to support clickable sponsor links
ALTER TABLE teams ADD COLUMN sponsor_url TEXT;