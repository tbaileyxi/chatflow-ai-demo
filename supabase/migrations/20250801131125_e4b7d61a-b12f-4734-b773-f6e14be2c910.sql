-- Fix function security issue
CREATE OR REPLACE FUNCTION calculate_post_vote_score(post_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
  up_votes INTEGER;
  down_votes INTEGER;
BEGIN
  SELECT COUNT(*) INTO up_votes 
  FROM spotlight_votes 
  WHERE post_id = post_uuid AND vote_type = 'up';
  
  SELECT COUNT(*) INTO down_votes 
  FROM spotlight_votes 
  WHERE post_id = post_uuid AND vote_type = 'down';
  
  RETURN COALESCE(up_votes, 0) - COALESCE(down_votes, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;