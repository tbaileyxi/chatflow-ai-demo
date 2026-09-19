import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import shLogo from '@/assets/sh-logo-updated.png';
import { appStoreUrl, STORE_CAMPAIGN } from '@/lib/appStore';

// https://sidehuddlesports.com/invite/{token} — a verified-creator invite.
//
// With the app installed, iOS opens the app straight from the link (universal
// link, /invite/* in apple-app-site-association) and this page never shows.
// Without it, this is where they land: get the app, then open the link again.
// The claim itself happens in the app, after signup or login.

type Preview = { x_handle: string; team_name: string | null; status: 'pending' | 'claimed' | 'revoked' };

export default function CreatorInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    (supabase.rpc as any)('creator_invite_preview', { p_token: token })
      .then(({ data }: { data: Preview[] | Preview | null }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.x_handle) setPreview(row);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [token]);

  const openInApp = () => {
    window.location.href = `sidehuddle://invite/${token ?? ''}`;
  };

  const dead = preview && preview.status !== 'pending';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-6 text-center text-white">
      <Helmet>
        <title>Your verified room — Side Huddle</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <img src={shLogo} alt="Side Huddle" className="mb-6 h-16 w-16 rounded-2xl" />

      {dead ? (
        <>
          <h1 className="text-3xl font-black">This link has already been used.</h1>
          <p className="mt-3 max-w-md text-white/75">
            Invite links work once. If this is yours, ask us for a new one: ty@sidehuddlesports.com
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#FFD700]">Verified creator</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">
            {preview ? `@${preview.x_handle}, your room is ready.` : loaded ? 'Your room is ready.' : ' '}
          </h1>
          <p className="mt-3 max-w-md text-white/75">
            {preview?.team_name ? `Your ${preview.team_name} room on Side Huddle, with the verified badge. ` : 'Your room on Side Huddle, with the verified badge. '}
            Your posts on X land in it on their own. Open this link on your iPhone to claim it.
          </p>

          <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
            <button onClick={openInApp} className="rounded-full bg-[#FFD700] px-6 py-3 font-bold text-black">
              Open in the app
            </button>
            <a href={appStoreUrl(STORE_CAMPAIGN.inviteCode)}
              className="rounded-full border border-white/20 px-6 py-3 font-bold text-white">
              Get the app
            </a>
          </div>
          <p className="mt-4 max-w-xs text-xs text-white/50">
            New to Side Huddle? Get the app, sign up, then tap this link again.
          </p>
        </>
      )}
    </div>
  );
}
