CREATE TABLE IF NOT EXISTS public.friend_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'blocked')),
  source text NOT NULL DEFAULT 'invite_link'
    CHECK (source IN ('invite_link', 'contact', 'manual', 'room_presence')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CHECK (requester_id <> addressee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS friend_connections_unique_pair
ON public.friend_connections (
  LEAST(requester_id::text, addressee_id::text),
  GREATEST(requester_id::text, addressee_id::text)
);

ALTER TABLE public.friend_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their friend connections" ON public.friend_connections;
CREATE POLICY "Users can view their friend connections"
ON public.friend_connections
FOR SELECT
USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "Users can request friend connections" ON public.friend_connections;
CREATE POLICY "Users can request friend connections"
ON public.friend_connections
FOR INSERT
WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their friend connections" ON public.friend_connections;
CREATE POLICY "Users can update their friend connections"
ON public.friend_connections
FOR UPDATE
USING (requester_id = auth.uid() OR addressee_id = auth.uid())
WITH CHECK (requester_id = auth.uid() OR addressee_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  huddle_id uuid NOT NULL REFERENCES public.huddles(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code text NOT NULL UNIQUE,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  accepted_at timestamptz
);

ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view room invites they touched" ON public.room_invites;
CREATE POLICY "Users can view room invites they touched"
ON public.room_invites
FOR SELECT
USING (
  inviter_id = auth.uid()
  OR invited_user_id = auth.uid()
  OR accepted_by = auth.uid()
);

DROP POLICY IF EXISTS "Room owners can create room invites" ON public.room_invites;
CREATE POLICY "Room owners can create room invites"
ON public.room_invites
FOR INSERT
WITH CHECK (
  inviter_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.huddles h
    WHERE h.id = room_invites.huddle_id
      AND h.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Invite participants can update room invites" ON public.room_invites;
CREATE POLICY "Invite participants can update room invites"
ON public.room_invites
FOR UPDATE
USING (
  inviter_id = auth.uid()
  OR invited_user_id = auth.uid()
  OR accepted_by = auth.uid()
)
WITH CHECK (
  inviter_id = auth.uid()
  OR invited_user_id = auth.uid()
  OR accepted_by = auth.uid()
);
