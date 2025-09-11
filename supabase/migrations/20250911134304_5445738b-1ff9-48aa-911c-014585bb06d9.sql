-- Remove the incorrect college Pick 'Em instance from the Browns huddle
-- This instance should not exist in an NFL team's huddle
DELETE FROM pickem_instance_games WHERE instance_id = '0362126c-031e-4b5a-a9e7-42a1e87a2a93';
DELETE FROM pickem_picks WHERE entry_id IN (
    SELECT id FROM pickem_entries WHERE instance_id = '0362126c-031e-4b5a-a9e7-42a1e87a2a93'
);
DELETE FROM pickem_entries WHERE instance_id = '0362126c-031e-4b5a-a9e7-42a1e87a2a93';
DELETE FROM pickem_instances WHERE id = '0362126c-031e-4b5a-a9e7-42a1e87a2a93';