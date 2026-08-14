// GET /api/search-sets?q=artist
// Real-time YouTube search → filter → insert new sets → return results
// Fires only when the local DB search returns few/no results.

import { parseVenue, parseCity, cleanArtist } from './_region.js';

export const maxDuration = 20;

// Dedicated search key keeps its own quota separate from the ingest key
const YT_KEY = process.env.YOUTUBE_SEARCH_KEY || process.env.YOUTUBE_API_KEY;

// Best-effort venue name from a YouTube title: known-venue keyword first, then
// generic "@ Venue" / "Live from|at Venue" patterns. Returns null if nothing clean.
function venueFromTitle(title) {
  const kw = parseVenue(title);
  if (kw) return kw;
  const m = String(title || '').match(/(?:@|live\s+(?:from|at)|\bfrom\b)\s+([^|,\-–—()]{2,40})/i);
  if (m) {
    const v = m[1].replace(/\s+/g, ' ').trim();
    if (v && /[a-z]/i.test(v)) return v.slice(0, 40);
  }
  return null;
}
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const MIN_SECS = 60 * 60; // 60-min floor — search/discovery ingest, keeps borderline non-sets out

const NON_MUSICAL = [
  /\bpanel\b/i, /\bdiscussion\b/i, /\binterview\b/i, /\bconference\b/i,
  /\baftermovie\b/i, /\brecap\b/i, /\btrailer\b/i, /\bdocumentary\b/i,
  /\bpodcast\b/i, /\bepisode\s*\d+/i, /#djset\b/i, /\bpres\.\s+\w.*#/i,
  /\bhip\s*[- ]?hop\b/i, /\bneo\s+soul\b/i, /\br\s*&\s*b\b/i,
  /\blo-?fi\b/i, /\btrap\s+(mix|set)\b/i, /\breggaeton\b/i, /\bdancehall\b/i,
  // Compilations / mixtapes / "best of" — not live DJ sets
  /\bcompil(?:ation|é|e)?\b/i, /\bbest\s+songs?\b/i, /\bbest\s+of\b/i,
  /\bgreatest\s+hits\b/i, /\bmeilleur/i, /\bmega[\s-]?mix\b/i, /\bmixtape\b/i,
  /\bnon[\s-]?stop\b/i, /\bplaylist\b/i, /\btop\s+\d+\b/i,
  // Non-electronic compilation genres that slip past a bare "DJ set" search
  /\bmbol[eé]\b/i, /\bbukutsi\b/i, /\bmakossa\b/i, /\bndombolo\b/i,
  /\bcoupe[\s-]?d[eé]cal[eé]\b/i, /\bafrodegame\b/i, /\bcamer\b/i, /\bnaija\b/i,
];

const VENUE_ROUTES = [
  { re: /boiler\s+room/i,       festival_id: 'boilerroom',   festival_name: 'Boiler Room',       city: 'London',      vibe: 'worldwide' },
  { re: /cercle/i,              festival_id: 'cercle',       festival_name: 'Cercle',            city: 'Worldwide',   vibe: 'worldwide' },
  { re: /dekmantel/i,           festival_id: 'dekmantel',    festival_name: 'Dekmantel',         city: 'Amsterdam',   vibe: 'europe' },
  { re: /thuishaven/i,          festival_id: 'thuishaven',   festival_name: 'Thuishaven',        city: 'Amsterdam',   vibe: 'europe' },
  { re: /awakenings/i,          festival_id: 'awakenings',   festival_name: 'Awakenings',        city: 'Amsterdam',   vibe: 'europe' },
  { re: /fabric/i,              festival_id: 'fabric',       festival_name: 'fabric',            city: 'London',      vibe: 'europe' },
  { re: /berghain|panorama\s+bar/i, festival_id: 'berghain', festival_name: 'Berghain',         city: 'Berlin',      vibe: 'europe' },
  { re: /tresor/i,              festival_id: 'tresor',       festival_name: 'Tresor',            city: 'Berlin',      vibe: 'europe' },
  { re: /watergate/i,           festival_id: 'watergate',    festival_name: 'Watergate',         city: 'Berlin',      vibe: 'europe' },
  { re: /dc[\s-]?10|circoloco/i, festival_id: 'circoloco',   festival_name: 'Circoloco',         city: 'Ibiza',       vibe: 'europe' },
  { re: /movement/i,            festival_id: 'movement',     festival_name: 'Movement Festival', city: 'Detroit',     vibe: 'americas' },
  { re: /concourse\s+project/i, festival_id: 'concourse',    festival_name: 'The Concourse Project', city: 'Austin', vibe: 'americas' },
  { re: /club\s+space|clubspace/i, festival_id: 'clubspace', festival_name: 'Club Space',        city: 'Miami',       vibe: 'americas' },
  { re: /crssd/i,               festival_id: 'crssd',        festival_name: 'CRSSD Festival',    city: 'San Diego',   vibe: 'americas' },
  { re: /dirtybird|birdhouse/i, festival_id: 'dirtybird',    festival_name: 'Dirtybird',         city: 'San Francisco', vibe: 'americas' },
  { re: /dgtl/i,                festival_id: 'dgtl',         festival_name: 'DGTL Festival',     city: 'Amsterdam',   vibe: 'europe' },
  { re: /h[oö]r\s+berlin|h[oö]r-/i, festival_id: 'hor-berlin', festival_name: 'HÖR Berlin',     city: 'Berlin',      vibe: 'europe' },
  { re: /loveland/i,            festival_id: 'loveland',     festival_name: 'Loveland Festival', city: 'Amsterdam',   vibe: 'europe' },
  { re: /ra\s+live|resident\s+advisor/i, festival_id: 'ra',  festival_name: 'Resident Advisor',  city: 'London',      vibe: 'worldwide' },
];

function route(title) {
  for (const r of VENUE_ROUTES) {
    if (r.re.test(title)) return r;
  }
  // Un-matched → discovered bucket, but derive display fields from the actual
  // title instead of the generic "Discovered · Worldwide".
  return {
    festival_id: 'discovered',
    festival_name: venueFromTitle(title),   // real venue or null (never "Discovered")
    city: parseCity(title) || '',           // real city or '' (never "Worldwide")
    vibe: 'worldwide',
  };
}

function parseDuration(d) {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0));
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function sbInsert(rows) {
  if (!rows.length) return;
  // Insert into the base `sets` table (NOT the public_sets view, which isn't insertable).
  // festival_name/city/accent live on the festivals table; `vibe` on sets is a stages FK, so omit them.
  const payload = rows.map((r) => ({
    video_id: r.video_id,
    festival_id: r.festival_id,
    artist: r.artist,
    title: r.title,
    source: r.source,
    duration_sec: r.duration_sec,
    status: r.status,
    embeddable: r.embeddable,
    published_at: r.published_at,
    // For the generic discovered bucket, persist the parsed venue/city so the
    // vault view (COALESCE on s.venue / s.city) shows real info, not "Discovered".
    venue: r.festival_id === 'discovered' ? (venueFromTitle(r.title) || cleanArtist(r.title)) : null,
    city: parseCity(r.title) || null,
  }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sets`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error('search-sets insert failed:', res.status, await res.text().catch(() => ''));
}

export default async function handler(req, res) {
  if (!YT_KEY || !SUPABASE_KEY) return res.status(500).json({ error: 'Missing env vars' });

  const q = (req.query.q || '').trim().slice(0, 80);
  if (!q || q.length < 2) return res.status(400).json({ error: 'Query too short' });

  // Search YouTube
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q + ' DJ set')}&type=video&videoDuration=long&maxResults=10&order=relevance&key=${YT_KEY}`;
  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    const errBody = await searchRes.json().catch(() => ({}));
    return res.status(502).json({ error: 'YouTube search failed', status: searchRes.status, detail: errBody?.error?.message || errBody });
  }
  const searchData = await searchRes.json();

  const candidates = (searchData.items || [])
    .map(i => ({ video_id: i.id.videoId, title: i.snippet.title, published_at: i.snippet.publishedAt }))
    .filter(v => !NON_MUSICAL.some(re => re.test(v.title)));

  if (!candidates.length) return res.json({ sets: [] });

  // Get existing video IDs to avoid duplicates
  const existing = new Set(
    (await sbGet('public_sets?select=video_id')).map(r => r.video_id)
  );

  const newCandidates = candidates.filter(v => !existing.has(v.video_id));

  let newSets = [];
  if (newCandidates.length) {
    // Fetch durations
    const ids = newCandidates.map(v => v.video_id).join(',');
    const durRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}&key=${YT_KEY}`);
    const durData = durRes.ok ? await durRes.json() : { items: [] };
    const durs = Object.fromEntries((durData.items || []).map(i => [i.id, parseDuration(i.contentDetails.duration)]));

    newSets = newCandidates
      .filter(v => (durs[v.video_id] || 0) >= MIN_SECS)
      .map(v => {
        const r = route(v.title);
        return {
          video_id: v.video_id,
          festival_id: r.festival_id,
          festival_name: r.festival_name,
          city: r.city,
          vibe: r.vibe,
          artist: v.title,
          title: v.title,
          source: 'youtube',
          duration_sec: durs[v.video_id],
          status: 'live',
          embeddable: true,
          published_at: v.published_at,
          accent: null,
        };
      });

    if (newSets.length) await sbInsert(newSets);
  }

  // Return all matching sets (new + existing that match the query)
  const allSets = candidates
    .filter(v => {
      const dur = newSets.find(s => s.video_id === v.video_id)?.duration_sec;
      return existing.has(v.video_id) || (dur && dur >= MIN_SECS);
    })
    .map(v => {
      const found = newSets.find(s => s.video_id === v.video_id);
      return {
        video_id: v.video_id,
        artist: v.title,
        title: v.title,
        festival_name: found?.festival_name || null,
        city: found?.city || null,
        is_new: !!found,
      };
    });

  return res.json({ sets: allSets, inserted: newSets.length });
}
