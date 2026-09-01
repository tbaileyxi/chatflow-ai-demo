import React from 'react';
import { Link } from 'react-router-dom';
import { SiteNav, SiteFooter } from '@/components/site/SiteChrome';
import { ALL_TEAMS, TEAMS } from '@/lib/teams';

/**
 * The directory of every team room.
 *
 * This exists for two audiences that want the same thing. A visitor who heard
 * about the app wants to find their own team without guessing a URL. And a
 * crawler needs a path to the ~180 team pages: the sitemap tells Google those
 * pages EXIST, but internal links are what tell it they matter. Pages nothing
 * links to get crawled last and dropped first.
 *
 * Grouped by league because a list of 180 names in one column is not something
 * anyone reads — they scan for their own, and the league narrows it first.
 */

const LEAGUE_ORDER = ['College', 'NFL', 'NBA', 'MLB', 'NHL'] as const;

export default function TeamsIndex() {
  const groups = new Map<string, Array<{ slug: string; name: string; curated: boolean }>>();
  for (const [slug, t] of Object.entries(ALL_TEAMS)) {
    const league = t.leagueLabel ?? (t.league === 'nfl' ? 'NFL' : 'College');
    if (!groups.has(league)) groups.set(league, []);
    groups.get(league)!.push({ slug, name: t.name, curated: slug in TEAMS });
  }
  for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const total = Object.keys(ALL_TEAMS).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <SiteNav />

      <section className="px-6 pt-12 pb-10 max-w-5xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
          Every team room
        </h1>
        <p className="mt-3 text-white/50 max-w-xl leading-relaxed">
          {total} rooms where fans watch the game together — live plays, the
          argument, and the group chat in one place. Find yours.
        </p>
      </section>

      <section className="px-6 pb-24 max-w-5xl mx-auto">
        {LEAGUE_ORDER.filter((l) => groups.has(l)).map((league) => (
          <div key={league} className="mb-12">
            <h2 className="text-[11px] uppercase tracking-widest text-white/30 mb-4">
              {league} · {groups.get(league)!.length}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2.5">
              {groups.get(league)!.map((t) => (
                <Link
                  key={t.slug}
                  to={`/t/${t.slug}`}
                  className="text-sm text-white/60 hover:text-white transition-colors truncate"
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
