-- A claimed room shouldn't be silent, and free the Hoboken code for re-testing.
--
-- Claiming a room drops the president into an empty screen with no indication
-- anything worked or what to do next. The first thing in their room should tell
-- them it is theirs and give them the one action that matters.
--
-- Run in the Supabase SQL editor. Safe to run twice.

-- ── 1. claim_chapter_huddle now says hello ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_chapter_huddle(p_code text)
RETURNS TABLE (huddle_id uuid, huddle_name text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lead public.chapter_leads%rowtype;
  v_team_id uuid;
  v_huddle_id uuid;
  v_created boolean := false;
  v_system uuid;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING errcode = '42501';
  END IF;
  IF v_code = '' THEN
    RAISE EXCEPTION 'Enter your code.';
  END IF;

  SELECT * INTO v_lead FROM public.chapter_leads WHERE claim_code = v_code;
  IF v_lead.id IS NULL THEN
    RAISE EXCEPTION 'That code doesn''t match anything. Check the email it came in.';
  END IF;

  IF v_lead.claimed_huddle_id IS NOT NULL THEN
    v_huddle_id := v_lead.claimed_huddle_id;
  ELSE
    SELECT t.id INTO v_team_id
    FROM public.teams t
    WHERE lower(regexp_replace(coalesce(t.city, '') || t.name, '[^a-zA-Z0-9]', '', 'g'))
        = lower(regexp_replace(coalesce(v_lead.org, ''), '[^a-zA-Z0-9]', '', 'g'))
       OR lower(regexp_replace(t.name, '[^a-zA-Z0-9]', '', 'g'))
        = lower(regexp_replace(coalesce(v_lead.org, ''), '[^a-zA-Z0-9]', '', 'g'))
    LIMIT 1;

    IF v_team_id IS NULL THEN
      RAISE EXCEPTION 'We don''t have % set up yet — reply to the email and we''ll sort it.', v_lead.org;
    END IF;

    INSERT INTO public.huddles
      (name, owner_id, team_id, is_private, is_official_team_huddle,
       is_verified, official_status, member_count)
    VALUES
      (v_lead.chapter_name, v_user, v_team_id, false, false, false, 'active', 0)
    RETURNING id INTO v_huddle_id;

    v_created := true;

    UPDATE public.chapter_leads
    SET claimed_huddle_id = v_huddle_id,
        claimed_at        = now(),
        status            = 'onboarded',
        last_touch        = current_date
    WHERE id = v_lead.id;

    -- The room's first message. Only on creation, so a second person redeeming
    -- the same code does not get a duplicate.
    --
    -- Two jobs: confirm it worked, and name the ONE next action. A president
    -- who lands in an empty room with no instruction closes the app.
    BEGIN
      v_system := public.get_or_create_system_user();
      IF v_system IS NOT NULL THEN
        INSERT INTO public.huddle_messages
          (huddle_id, user_id, content, is_bot_message, message_type)
        VALUES (
          v_huddle_id,
          v_system,
          'This room is yours — ' || v_lead.chapter_name || '.' || chr(10) || chr(10) ||
          'Add a photo from the menu up top and it sits behind every message in here, ' ||
          'and on the card people see when you share the room.' || chr(10) || chr(10) ||
          'Then hit the invite button and send your members the link. ' ||
          'The ' || coalesce(v_lead.org, 'team') || ' news shows up on its own from here.',
          true,
          'system'
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- A missing welcome is a blemish. A failed claim is a lost chapter.
      RAISE WARNING '[claim_chapter_huddle] welcome message skipped: %', SQLERRM;
    END;
  END IF;

  INSERT INTO public.huddle_members (huddle_id, user_id)
  VALUES (v_huddle_id, v_user)
  ON CONFLICT DO NOTHING;

  huddle_id := v_huddle_id;
  SELECT h.name INTO huddle_name FROM public.huddles h WHERE h.id = v_huddle_id;
  created := v_created;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_chapter_huddle(text) TO authenticated;


-- ── 2. give the Hoboken code back ────────────────────────────────────────────
-- Hoboken Browns Backers (Justin Mathess, Cork City Pub) was spent on the first
-- real test. This frees the code; the room it created is left alone so you can
-- delete it from the app or keep it.
UPDATE public.chapter_leads
SET claimed_huddle_id = NULL,
    claimed_at        = NULL,
    status            = 'new'
WHERE claim_code = 'QBCKAK';


-- ── 3. check ─────────────────────────────────────────────────────────────────
SELECT chapter_name, claim_code, status, claimed_huddle_id
FROM public.chapter_leads
WHERE claim_code = 'QBCKAK';
