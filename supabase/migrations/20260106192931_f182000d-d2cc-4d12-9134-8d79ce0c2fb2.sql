-- Delete incorrectly placed Colorado/Buffs content from Browns huddle
DELETE FROM public.huddle_messages 
WHERE huddle_id = '676eb501-dc38-48a0-ab70-743c41c720a9' 
AND is_pulse_moment = true
AND (content ILIKE '%Buffs%' OR content ILIKE '%Colorado%' OR content ILIKE '%CUBuffs%' OR content ILIKE '%Lovo%' OR content ILIKE '%GoBuffs%' OR content ILIKE '%SkoBuffs%' OR content ILIKE '%Ralphie%');