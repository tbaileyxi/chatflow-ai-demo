-- Tell the client WHICH hash matched, so it can name the person the way the
-- user already knows them.
--
-- Contact matching returned only the matched profile, so the list showed that
-- person's Side Huddle display_name — "burnsyny2000". The user has no idea who
-- that is, even though the match came out of their own address book where the
-- contact is saved as "Mike Burns". The device holds the answer and we were
-- discarding it: hashes went up, profiles came back, and nothing connected a
-- returned profile to the contact that produced it.
--
-- Returning matched_hash closes the loop. It leaks nothing — the caller
-- computed and sent that exact hash a moment earlier, and it only ever maps
-- back to a contact already on their phone.
--
-- DROP first: CREATE OR REPLACE cannot change a function's return type.

DROP FUNCTION IF EXISTS public.match_contacts(text[]);

CREATE FUNCTION public.match_contacts(p_hashes text[])
RETURNS TABLE (
  user_id           uuid,
  display_name      text,
  username          text,
  avatar_url        text,
  already_connected boolean,
  matched_hash      text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    EXISTS (
      SELECT 1 FROM public.friend_connections fc
      WHERE fc.status = 'accepted'
        AND ((fc.requester_id = auth.uid() AND fc.addressee_id = p.user_id)
          OR (fc.addressee_id = auth.uid() AND fc.requester_id = p.user_id))
    ),
    -- Whichever key matched. Phone wins when both do; the client only needs one
    -- to find its way back to the right address-book entry.
    CASE
      WHEN p.phone_hash = ANY(p_hashes) THEN p.phone_hash
      ELSE p.email_hash
    END
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.user_id <> auth.uid()
    AND (p.phone_hash = ANY(p_hashes) OR p.email_hash = ANY(p_hashes))
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.match_contacts(text[]) TO authenticated;
