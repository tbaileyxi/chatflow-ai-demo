import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import shLogo from '@/assets/sh-logo-updated.png';

// Smart invite landing for https://www.sidehuddlesports.com/i/{code}.
// Mobile shares mint these links (room_invites.invite_code). If the app is
// installed, "Open in app" deep-links via the custom scheme; otherwise the
// page is the pitch + download CTA. Invite preview comes from the
// get_invite_preview RPC when available and degrades to a generic invite.

const APP_SCHEME_PREFIX = 'sidehuddle://i/';
// TODO: replace with the real App Store URL once the listing is live.
const APP_STORE_URL = 'https://www.sidehuddlesports.com';

type InvitePreview = {
  huddle_name: string | null;
  member_count: number | null;
  inviter_name: string | null;
};

export default function InviteCodePage() {
  const { code } = useParams<{ code: string }>();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    // Optional enrichment — RPC may not exist yet; the page works without it.
    (supabase.rpc as any)('get_invite_preview', { p_invite_code: code })
      .then(({ data }: { data: InvitePreview[] | InvitePreview | null }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.huddle_name) setPreview(row);
      })
      .catch(() => {});
  }, [code]);

  const deepLink = `${APP_SCHEME_PREFIX}${code ?? ''}`;

  const openInApp = () => {
    // If the app is installed the scheme fires; if not, nothing happens and
    // the user stays here with the download CTA.
    window.location.href = deepLink;
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const roomLabel = preview?.huddle_name ?? 'a private room';

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <Helmet>
        <title>You're invited — Side Huddle</title>
        <meta
          name="description"
          content={`Join ${roomLabel} on Side Huddle — game rooms with your friends.`}
        />
      </Helmet>

      <img src={shLogo} alt="Side Huddle" className="h-16 w-16 rounded-2xl mb-6" />

      <h1 className="text-3xl font-black text-foreground">
        You're invited to {roomLabel}
      </h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        {preview?.inviter_name
          ? `${preview.inviter_name} saved you a seat.`
          : 'A friend saved you a seat.'}{' '}
        Side Huddle is where you and your friends watch games together — live
        scores, the room bot, and prediction cards in one private chat.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <button
          onClick={openInApp}
          className="rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Open in the app
        </button>
        <a
          href={APP_STORE_URL}
          className="rounded-full border border-border px-6 py-3 font-bold text-foreground"
        >
          Get Side Huddle
        </a>
        <button
          onClick={copyLink}
          className="text-sm text-muted-foreground underline"
        >
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>

      <p className="mt-8 text-xs text-muted-foreground">
        Already installed? Open the app and your invite will be waiting after
        you sign in.
      </p>
    </div>
  );
}
