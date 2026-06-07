import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initWasm, Resvg } from 'npm:@resvg/resvg-wasm';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------- Types ----------
interface GameRow {
  id: string;
  start_time: string;
  home_score: number;
  away_score: number;
  home_team: { name: string; abbreviation: string; logo_url: string | null };
  away_team: { name: string; abbreviation: string; logo_url: string | null };
}

// ---------- SVG card ----------
function buildScoreCardSvg(games: GameRow[], dateLabel: string): string {
  const cardW = 1080;
  const headerH = 160;
  const rowH = 100;
  const footerH = 80;
  const totalH = headerH + games.length * rowH + footerH;

  const rows = games
    .map((g, i) => {
      const y = headerH + i * rowH;
      const bg = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'transparent';
      const homeWon = g.home_score > g.away_score;
      const awayWon = g.away_score > g.home_score;
      return `
      <rect x="0" y="${y}" width="${cardW}" height="${rowH}" fill="${bg}"/>
      <!-- Away team -->
      <text x="80" y="${y + 38}" font-family="system-ui,sans-serif" font-size="28" font-weight="${awayWon ? '700' : '400'}" fill="${awayWon ? '#ffffff' : 'rgba(255,255,255,0.65)'}">${esc(g.away_team.abbreviation)}</text>
      <text x="80" y="${y + 68}" font-family="system-ui,sans-serif" font-size="18" fill="rgba(255,255,255,0.4)">${esc(g.away_team.name)}</text>
      <!-- Away score -->
      <text x="460" y="${y + 58}" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="${awayWon ? '#4ade80' : 'rgba(255,255,255,0.75)'}" text-anchor="end">${g.away_score}</text>
      <!-- VS -->
      <text x="540" y="${y + 58}" font-family="system-ui,sans-serif" font-size="22" fill="rgba(255,255,255,0.25)" text-anchor="middle">–</text>
      <!-- Home score -->
      <text x="620" y="${y + 58}" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="${homeWon ? '#4ade80' : 'rgba(255,255,255,0.75)'}" text-anchor="start">${g.home_score}</text>
      <!-- Home team -->
      <text x="1000" y="${y + 38}" font-family="system-ui,sans-serif" font-size="28" font-weight="${homeWon ? '700' : '400'}" fill="${homeWon ? '#ffffff' : 'rgba(255,255,255,0.65)'}" text-anchor="end">${esc(g.home_team.abbreviation)}</text>
      <text x="1000" y="${y + 68}" font-family="system-ui,sans-serif" font-size="18" fill="rgba(255,255,255,0.4)" text-anchor="end">${esc(g.home_team.name)}</text>
    `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${cardW}" height="${totalH}" viewBox="0 0 ${cardW} ${totalH}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${cardW}" y2="${totalH}" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0d1117"/>
      <stop offset="100%" stop-color="#161b22"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${cardW}" height="${totalH}" fill="url(#bg)"/>

  <!-- Accent top bar -->
  <rect width="${cardW}" height="6" fill="#c8102e"/>

  <!-- Header -->
  <text x="${cardW / 2}" y="72" font-family="system-ui,sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle">LAST NIGHT'S RESULTS</text>
  <text x="${cardW / 2}" y="118" font-family="system-ui,sans-serif" font-size="26" fill="rgba(255,255,255,0.5)" text-anchor="middle">${esc(dateLabel)}</text>

  <!-- Divider -->
  <line x1="60" y1="${headerH - 10}" x2="${cardW - 60}" y2="${headerH - 10}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Score rows -->
  ${rows}

  <!-- Footer divider -->
  <line x1="60" y1="${headerH + games.length * rowH + 10}" x2="${cardW - 60}" y2="${headerH + games.length * rowH + 10}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>

  <!-- Branding -->
  <text x="${cardW / 2}" y="${totalH - 26}" font-family="system-ui,sans-serif" font-size="22" fill="rgba(255,255,255,0.3)" text-anchor="middle">@VarsityDispatch</text>
</svg>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Instagram Graph API ----------
async function uploadImageToInstagram(
  igUserId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string,
): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_url: imageUrl, caption, access_token: pageAccessToken }),
    },
  );
  const json = await res.json();
  if (!res.ok || !json.id) {
    throw new Error(`IG media container failed: ${JSON.stringify(json)}`);
  }
  return json.id as string;
}

async function publishInstagramContainer(
  igUserId: string,
  pageAccessToken: string,
  creationId: string,
): Promise<string> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: creationId, access_token: pageAccessToken }),
    },
  );
  const json = await res.json();
  if (!res.ok || !json.id) {
    throw new Error(`IG publish failed: ${JSON.stringify(json)}`);
  }
  return json.id as string;
}

// ---------- Main handler ----------
let wasmInitialized = false;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const igUserId = Deno.env.get('INSTAGRAM_BUSINESS_ACCOUNT_ID')!;
    const pageToken = Deno.env.get('INSTAGRAM_PAGE_ACCESS_TOKEN')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;

    if (!igUserId || !pageToken) {
      return new Response(JSON.stringify({ error: 'Missing Instagram credentials' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Yesterday's date range (ET = UTC-4/UTC-5; use UTC-5 conservatively for 7am ET)
    const now = new Date();
    const yesterdayEnd = new Date(now);
    yesterdayEnd.setUTCHours(12, 0, 0, 0); // noon UTC = 7am ET cutoff
    const yesterdayStart = new Date(yesterdayEnd);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    yesterdayStart.setUTCHours(0, 0, 0, 0);

    // Query final games from yesterday
    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select(`
        id, start_time, home_score, away_score,
        home_team:teams!games_home_team_id_fkey(name, abbreviation, logo_url),
        away_team:teams!games_away_team_id_fkey(name, abbreviation, logo_url)
      `)
      .eq('status', 'final')
      .gte('start_time', yesterdayStart.toISOString())
      .lt('start_time', yesterdayEnd.toISOString())
      .order('start_time', { ascending: true });

    if (gamesErr) throw gamesErr;

    if (!games || games.length === 0) {
      console.log('No final games yesterday — skipping Instagram post');
      return new Response(JSON.stringify({ posted: false, reason: 'no_games' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rows = games as unknown as GameRow[];

    // Build date label
    const dateLabel = yesterdayStart.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
    });

    // Generate SVG → PNG
    if (!wasmInitialized) {
      await initWasm();
      wasmInitialized = true;
    }

    const svg = buildScoreCardSvg(rows, dateLabel);
    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } });
    const pngData = resvg.render();
    const pngBytes = pngData.asPng();

    // Upload to Supabase Storage (public bucket: instagram-cards)
    const fileName = `scores-${yesterdayStart.toISOString().slice(0, 10)}.png`;
    const { error: uploadErr } = await supabase.storage
      .from('instagram-cards')
      .upload(fileName, pngBytes, { contentType: 'image/png', upsert: true });

    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);

    const { data: publicUrlData } = supabase.storage
      .from('instagram-cards')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;
    console.log(`[post-instagram] Image URL: ${imageUrl}`);

    // Build caption
    const scoreLines = rows.map((g) => {
      const winner = g.home_score > g.away_score ? g.home_team.abbreviation : g.away_team.abbreviation;
      return `${g.away_team.abbreviation} ${g.away_score} – ${g.home_score} ${g.home_team.abbreviation} ✓ ${winner}`;
    });
    const caption = [
      `Last Night's Results — ${dateLabel}`,
      '',
      ...scoreLines,
      '',
      '#SportsRecap #VarsityDispatch #NBA #NFL #NHL',
    ].join('\n');

    // Post to Instagram
    const containerId = await uploadImageToInstagram(igUserId, pageToken, imageUrl, caption);
    console.log(`[post-instagram] Container created: ${containerId}`);

    // Brief wait for Instagram to process the image
    await new Promise((r) => setTimeout(r, 3000));

    const postId = await publishInstagramContainer(igUserId, pageToken, containerId);
    console.log(`[post-instagram] Published post: ${postId}`);

    return new Response(
      JSON.stringify({ posted: true, postId, games: rows.length, imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[post-instagram] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
