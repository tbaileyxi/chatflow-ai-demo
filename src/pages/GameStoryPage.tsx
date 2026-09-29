// The game story, playing in a browser.
//
// Sharing used to be a card and a wall — the link previewed well and then
// offered a download, and whoever tapped it could never watch the thing they
// had been sent. A share nobody can open is not a share, and sharing is the
// reason the story exists at all.
//
// So it plays here: no app, no account, no membership. The pieces are already
// public files with open CORS; what was never public is the LIST of them, and
// game_story() is the one thing that hands that over — only for rooms whose
// owner allows it, which is what story_shareable decides.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { appStoreUrl, STORE_CAMPAIGN } from '@/lib/appStore';

const PHOTO_MS = 4500;
const MAX_CLIP_MS = 8000;
const GOLD = '#F5C518';

type Item = {
  url: string;
  kind: 'image' | 'video';
  caption: string | null;
  author: string | null;
  created_at: string;
};

type Story = {
  found: boolean;
  shareable?: boolean;
  room?: string;
  roomPhoto?: string | null;
  people?: number;
  items?: Item[];
};

/** A message with a way out, rather than a blank screen. */
function Shell({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0A0A0B] px-6 text-center">
      <h1 className="font-orbitron text-2xl font-bold text-white">{title}</h1>
      <p className="max-w-sm text-[#A0A0A8]">{body}</p>
      <a
        href={appStoreUrl(STORE_CAMPAIGN.invite)}
        className="mt-2 rounded-full px-6 py-3 font-bold text-[#0A0A0B]"
        style={{ background: GOLD }}
      >
        Get Side Huddle
      </a>
    </div>
  );
}

export default function GameStoryPage() {
  const { huddleId } = useParams<{ huddleId: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [i, setI] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!huddleId) return;
    (supabase.rpc as any)('game_story', { p_huddle_id: huddleId })
      .then(({ data }: { data: Story | null }) => setStory(data ?? { found: false }))
      .catch(() => setStory({ found: false }));
  }, [huddleId]);

  const items = story?.items ?? [];
  const item = items[i] ?? null;

  const next = useCallback(() => {
    setProgress(0);
    setI((v) => Math.min(v + 1, items.length)); // one past the end = the outro
  }, [items.length]);

  // A still runs on a clock; a clip reports its own position below.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!item || item.kind === 'video' || paused) return;
    let elapsed = 0;
    timer.current = setInterval(() => {
      elapsed += 50;
      setProgress(Math.min(1, elapsed / PHOTO_MS));
      if (elapsed >= PHOTO_MS) next();
    }, 50);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [item, paused, next]);

  if (!story) {
    return <div className="min-h-screen bg-[#0A0A0B]" />;
  }
  if (!story.found) {
    return <Shell title="Story not found" body="This link may have expired, or the room was removed." />;
  }
  if (story.shareable === false) {
    return (
      <Shell
        title={story.room ? `${story.room} keeps its stories in` : 'Kept private'}
        body="This room's story is only watchable inside the app by the people in it."
      />
    );
  }
  if (items.length === 0) {
    return (
      <Shell
        title={story.room ?? 'Side Huddle'}
        body="No story from this room's last game yet."
      />
    );
  }

  const title = `${story.room ?? 'Side Huddle'} — the game story`;

  // Past the last piece: the only moment worth asking for anything, because
  // they have now seen what they were sent.
  if (!item) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#0A0A0B] px-6 text-center">
        <Helmet><title>{title}</title></Helmet>
        <h1 className="font-orbitron text-3xl font-extrabold text-white">{story.room}</h1>
        <p className="text-[#A0A0A8]">
          {items.length} from {story.people} of them, watching together.
        </p>
        <a
          href={appStoreUrl(STORE_CAMPAIGN.invite)}
          className="rounded-full px-7 py-3.5 text-lg font-bold text-[#0A0A0B]"
          style={{ background: GOLD }}
        >
          Get Side Huddle
        </a>
        <button onClick={() => { setI(0); setProgress(0); }} className="text-sm text-[#6A6A74] underline">
          Watch again
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-black">
      <Helmet><title>{title}</title></Helmet>

      <div className="absolute inset-0 flex items-center justify-center">
        {item.kind === 'video' ? (
          <video
            key={item.url}
            src={item.url}
            autoPlay
            playsInline
            // Muted, because a browser blocks autoplay with sound and a story
            // that needs a second tap to start is a story nobody watches.
            muted
            className="h-full w-full object-cover"
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              const dur = Math.min((v.duration || 8) * 1000, MAX_CLIP_MS);
              setProgress(Math.min(1, (v.currentTime * 1000) / dur));
              if (v.currentTime * 1000 >= dur) next();
            }}
            onEnded={next}
          />
        ) : (
          <img key={item.url} src={item.url} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      {/* Tap right to go on, left to go back. */}
      <div className="absolute inset-0 flex">
        <button
          aria-label="Previous"
          className="flex-1"
          onClick={() => { setProgress(0); setI((v) => Math.max(0, v - 1)); }}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
        <button
          aria-label="Next"
          className="flex-1"
          onClick={next}
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 p-3">
        <div className="flex gap-1">
          {items.map((it, k) => (
            <div key={it.url + k} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full rounded-full"
                style={{
                  background: GOLD,
                  width: k < i ? '100%' : k === i ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-sm font-bold text-white">{item.author ?? 'Someone'}</span>
          <span className="text-xs text-white/70">{story.room}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4">
        {item.caption ? (
          <div className="mb-3 inline-block rounded-xl bg-black/70 px-3 py-2 text-sm text-[#E4E4EC]">
            {item.caption}
          </div>
        ) : null}
        <a
          href={appStoreUrl(STORE_CAMPAIGN.invite)}
          className="pointer-events-auto inline-block rounded-full px-5 py-2.5 text-sm font-bold text-[#0A0A0B]"
          style={{ background: GOLD }}
        >
          Get Side Huddle
        </a>
      </div>
    </div>
  );
}
