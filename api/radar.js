// /api/radar — returns sets from our catalog sorted by YouTube view count this month
// Feeds the Radar "what's hot" view

export const maxDuration = 30;

// Use search key for view counts — keeps its own quota separate from ingest
const YOUTUBE_API_KEY = process.env.YOUTUBE_SEARCH_KEY || process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Fallback catalog if Supabase is unavailable
const FALLBACK_SETS = [
  { video_id: 'SLth9mPN_Lc', artist: 'Lavern · May 2026', festival_name: 'Thuishaven', city: 'Amsterdam', accent: '#F9C846' },
  { video_id: 'z2GyyJhJWgE', artist: 'OMAR+ · 2026', festival_name: 'Thuishaven', city: 'Amsterdam', accent: '#F9C846' },
  { video_id: 'TuSz4ecYi8s', artist: 'Noël Dekkers · 2026', festival_name: 'Boomerang Beach', city: 'Netherlands', accent: '#FB923C' },
  { video_id: 'XY2Yec_0w5U', artist: 'Chris Stussy · Circoloco 2024', festival_name: 'DC-10', city: 'Ibiza', accent: '#E84545' },
  { video_id: 'yQXb-bD8w1c', artist: 'Joris Voorn · 2026', festival_name: 'Green Valley', city: 'Camboriú', accent: '#4ADE80' },
  { video_id: 'NgzMwbqoPEA', artist: 'STOFFELA · NebulaX 2026', festival_name: 'Nibiru Universe', city: 'Costinești', accent: '#C084FC' },
  { video_id: 'GUdqwJYOYsw', artist: 'Inland Knights · Jan 2026', festival_name: 'fabric', city: 'London', accent: '#E2E8F0' },
  { video_id: 'm1SvbXLYEEc', artist: 'Charlotte de Witte · Awakenings 2025', festival_name: 'Awakenings', city: 'Amsterdam', accent: '#4FC3F7' },
  { video_id: 'zfcedYnYFNQ', artist: 'Gorgon City · Seismic 8.0', festival_name: 'Seismic Dance Event', city: 'Austin', accent: '#FF5FA0' },
  { video_id: 'rfxQxkUFhvE', artist: 'Elderbrook · Seismic 8.0', festival_name: 'Seismic Dance Event', city: 'Austin', accent: '#FF5FA0' },
];

async function getViewCounts(videoIds) {
  if (!YOUTUBE_API_KEY || !videoIds.length) return {};
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) chunks.push(videoIds.slice(i, i + 50));
  const results = {};
  for (const chunk of chunks) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${chunk.join(',')}&key=${YOUTUBE_API_KEY}`;
      const r = await fetch(url);
      const d = await r.json();
      for (const item of (d.items || [])) results[item.id] = parseInt(item.statistics?.viewCount || 0);
    } catch { }
  }
  return results;
}

// Radar = the top set(s) of the CURRENT calendar quarter, ranked by views. In-quarter sets are
// tagged `_inWindow` so they always lead; if the quarter is somehow too sparse to fill the grid we
// append the next-best recent sets (rolling 60d) as backfill — but the quarter's top always sits at #1.
async function fetchSince(sinceIso, inWindow) {
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/vault_sets?select=video_id,artist,festival_id,festival_name,city,accent,published_at&published_at=gte.${encodeURIComponent(sinceIso)}&source=eq.youtube&duration_sec=gte.2700&order=published_at.desc&limit=200`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = r.ok ? await r.json() : [];
    return rows.map((x) => ({ ...x, _inWindow: inWindow }));
  } catch { return []; }
}

// Compilations / mixtapes / non-live junk that may sit in the vault — keep Radar to live sets.
const RADAR_BAD_RE = [
  /\bcompil(?:ation|é|e)?\b/i, /\bbest\s+songs?\b/i, /\bbest\s+of\b/i,
  /\bgreatest\s+hits\b/i, /\bmeilleur/i, /\bmega[\s-]?mix\b/i, /\bmixtape\b/i,
  /\bnon[\s-]?stop\b/i, /\bplaylist\b/i, /\btop\s+\d+\b/i, /\bradio\b/i,
  /\bmbol[eé]\b/i, /\bbukutsi\b/i, /\bmakossa\b/i, /\bndombolo\b/i,
  /\bcoupe[\s-]?d[eé]cal[eé]\b/i, /\bafrodegame\b/i, /\bcamer\b/i, /\bnaija\b/i,
];
function radarIsBad(r) {
  const t = (r.artist || r.festival_name || '').toLowerCase();
  return RADAR_BAD_RE.some((re) => re.test(t));
}

function quarterStartISO() {
  const now = new Date();
  const qMonth = Math.floor(now.getUTCMonth() / 3) * 3; // 0,3,6,9
  return new Date(Date.UTC(now.getUTCFullYear(), qMonth, 1)).toISOString();
}

async function getRecentSets() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return FALLBACK_SETS;
  let rows = await fetchSince(quarterStartISO(), true);

  // Sparse quarter → append rolling-60d backfill (tagged out-of-window) so Radar stays full.
  if (rows.length < 10) {
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const wide = await fetchSince(since60, false);
    const seen = new Set(rows.map((r) => r.video_id));
    rows = rows.concat(wide.filter((r) => !seen.has(r.video_id)));
  }
  return rows.length >= 5 ? rows : FALLBACK_SETS;
}

// Same YouTube video is sometimes ingested under two festival_ids (venue mislabel),
// which would render the same set twice. Collapse to one row per video_id, preferring
// the row whose festival_name actually appears in the title (the correctly-labeled venue).
function dedupeByVideo(rows) {
  const best = new Map();
  for (const r of rows) {
    const id = r.video_id;
    if (!id) continue;
    const existing = best.get(id);
    if (!existing) { best.set(id, r); continue; }
    const title = (r.artist || '').toLowerCase();
    const score = (row) => (row.festival_name && title.includes(row.festival_name.toLowerCase()) ? 1 : 0);
    if (score(r) > score(existing)) best.set(id, r);
  }
  return [...best.values()];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');


  const sets = dedupeByVideo(await getRecentSets()).filter((s) => !radarIsBad(s));
  const ids = sets.map(s => s.video_id);
  const views = await getViewCounts(ids);

  // In-quarter sets lead (so #1 is the top set of the quarter), each group ranked by views.
  const ranked = sets
    .map(s => ({ ...s, views: views[s.video_id] || 0 }))
    .sort((a, b) => (Number(b._inWindow) - Number(a._inWindow)) || (b.views - a.views))
    .slice(0, 20)
    .map((s, i) => ({
      id: `r${i}`,
      video_id: s.video_id,
      artist: s.artist,
      views: s.views,
      festival_id: s.festival_id || null,
      festival: {
        name: s.festival_name || s.festival?.name || 'Unknown',
        city: s.city || s.festival?.city || '',
        accent: s.accent || s.festival?.accent || '#888',
      }
    }));

  res.json(ranked);
}
