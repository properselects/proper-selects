// Vercel serverless function — called by cron daily at 4am UTC
// Also callable manually: GET /api/ingest

export const maxDuration = 60;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CHANNELS = [
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom',   festival_name: 'Boiler Room',           city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCl2CLatrfJiU6OqmHZNUDNg', festival_id: 'dekmantel',    festival_name: 'Dekmantel',             city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCDHvlud7Hf86FxFsogrBcMg', festival_id: 'ra',           festival_name: 'Resident Advisor',      city: 'London',      vibe: 'europe' },
  { channelId: 'UCOlJBEcHjFpQ0SQlNNqEuIA', festival_id: 'cercle',       festival_name: 'Cercle',                city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UCGbDh9LIjFRrMEO0sxvKVyA', festival_id: 'thuishaven',   festival_name: 'Thuishaven',            city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCNKR0GnJRSqMcKx6JWXBhwA', festival_id: 'yoyaku',       festival_name: 'Yoyaku',                city: 'Paris',       vibe: 'europe' },
  { channelId: 'UCwmFOfFuvRPI112vR5DN8vQ', festival_id: 'rawcuts',       festival_name: 'Raw Cuts',              city: 'New York',    vibe: 'americas' },
  { channelId: 'UC3ifTl5zKiCAhHIBQYcaTrg', festival_id: 'greenvalley',   festival_name: 'Green Valley',          city: 'Camboriú',    vibe: 'americas' },
  { channelId: 'UCp_MbSA-jJzGjsBBgYZTmjA', festival_id: 'dc10',          festival_name: 'DC-10',                 city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UCaSjh0kdrd3xEn0zqcjbiDg', festival_id: 'concourse',     festival_name: 'The Concourse Project', city: 'Austin',      vibe: 'americas' },
  // USA venues added 2026-08-02
  { channelId: 'UCnf2atji58GrDey0R4AOKVg', festival_id: 'movement',      festival_name: 'Movement Festival',     city: 'Detroit',     vibe: 'americas' },
  { channelId: 'UCT1Tq7SDg9kd4XgFjc47_4Q', festival_id: 'iii-points',   festival_name: 'III Points',            city: 'Miami',       vibe: 'americas' },
  { channelId: 'UCFXhLNpftXbCi9W58CJLrJQ', festival_id: 'crssd',         festival_name: 'CRSSD Festival',        city: 'San Diego',   vibe: 'americas' },
  { channelId: 'UCDZELNPHzTdvB9Nu5-s--4w', festival_id: 'exchange-la',   festival_name: 'Exchange LA',           city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UC2iQ3op3Xar4TLX03oEmJYg', festival_id: 'concourse',     festival_name: 'The Concourse Project', city: 'Austin',      vibe: 'americas' },
  { channelId: 'UCdIjpGkpXGw9WJ_5reM-5WQ', festival_id: 'academy-la',   festival_name: 'Academy LA',            city: 'Los Angeles', vibe: 'americas' },
];

const MIN_SECS = 45 * 60;

// Non-musical content patterns — panels, talks, radio streams, aftermovies, interviews
const NON_MUSICAL_PATTERNS = [
  /\bpanel\b/i,
  /\bdiscussion\b/i,
  /\binterview\b/i,
  /\bconference\b/i,
  /\bnetworking\b/i,
  /\bresearch\b/i,
  /\blab finale\b/i,
  /\bresynthesising\b/i,
  /\baftermovie\b/i,
  /\brecap\b/i,
  /\btrailer\b/i,
  /\bteaser\b/i,
  /\bdocumentary\b/i,
  /\bpodcast\b/i,
  /\bmasterclass\b/i,
  /\bworkshop\b/i,
  /\btalk\b/i,
  /\bkeynote\b/i,
  /\bq\s*&\s*a\b/i,
  /\bbehind the scenes\b/i,
  /\bepisode\s*\d+/i,          // Episode 12 etc — usually podcast/radio
  /\b\d{4}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2}/,  // radio-style timestamps (2025 02 25 14 03)
  /\binjected\b/i,
  // Non-house/techno genres
  /\bhip\s*[- ]?hop\b/i,
  /\bhiphop\b/i,
  /\bneo\s+soul\b/i,
  /\bnu\s*soul\b/i,
  /\br\s*&\s*b\b/i,
  /\brnb\b/i,
  /\brap\s+(mix|set|dj)\b/i,
  /\blo-?fi\b/i,
  /\bchillhop\b/i,
  /\btrap\s+(mix|set)\b/i,
  /\bdrill\b/i,
  /\bafrobeat(s)?\s+(mix|top|hit)/i,
  /\breggaeton\b/i,
  /\bdancehall\b/i,
  /\bjazz\s+(mix|hits)/i,
];

function isNonMusicalContent(title) {
  if (!title) return true;
  return NON_MUSICAL_PATTERNS.some(re => re.test(title));
}

function parseDuration(d) {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0));
}

async function ytSearch(channelId) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&videoDuration=long&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return (d.items||[]).map(i => ({ video_id: i.id.videoId, title: i.snippet.title, published_at: i.snippet.publishedAt }));
}

// Venue detection from title — routes sets to proper festival_id/city
// Ordered by specificity (most specific patterns first)
// vibe MUST be set on every route — this is the authoritative region source.
// When a title match fires, the channel's default vibe is ignored entirely.
const VENUE_ROUTES = [
  { re: /EDC\s+Orlando/i,           festival_id: 'edc-orlando',         festival_name: 'EDC Orlando',                  city: 'Orlando',      vibe: 'americas' },
  { re: /EDC\s+Mexico/i,            festival_id: 'edc-mexico',          festival_name: 'EDC Mexico',                   city: 'Mexico City',  vibe: 'americas' },
  { re: /H(ï|i)\s+ibiza/i,          festival_id: 'hi-ibiza',            festival_name: 'Hï Ibiza',                     city: 'Ibiza',        vibe: 'europe' },
  { re: /Knockdown\s+Center/i,      festival_id: 'knockdown-nyc',       festival_name: 'Knockdown Center',             city: 'New York',     vibe: 'americas' },
  { re: /ARC\s+(Chicago|Music)/i,   festival_id: 'arc-chicago',         festival_name: 'ARC Music Festival',           city: 'Chicago',      vibe: 'americas' },
  { re: /LAROC/i,                   festival_id: 'laroc',               festival_name: 'Laroc Club',                   city: 'Itupeva',      vibe: 'americas' },
  { re: /Universo\s+Paralello/i,    festival_id: 'universo-paralello',  festival_name: 'Universo Paralello',           city: 'Bahia',        vibe: 'americas' },
  { re: /Concourse\s+Project/i,     festival_id: 'concourse',           festival_name: 'The Concourse Project',        city: 'Austin',       vibe: 'americas' },
  { re: /Destino.*Ibiza|Ibiza.*Destino/i, festival_id: 'dc10',          festival_name: 'DC-10',                        city: 'Ibiza',        vibe: 'europe' },
  { re: /TRIIIPLE/i,                festival_id: 'triiple',             festival_name: 'TRIIIPLE Festival',            city: 'Valinhos',     vibe: 'americas' },
  { re: /SO\s+TRACK\s+BOA/i,        festival_id: 'sotrackboa',          festival_name: 'SO TRACK BOA',                 city: 'São Paulo',    vibe: 'americas' },
  { re: /PARQUE\s+DO\s+POVO/i,      festival_id: 'parque-povo',         festival_name: 'Parque do Povo',               city: 'São Paulo',    vibe: 'americas' },
  { re: /D-EDGE/i,                  festival_id: 'dblock',              festival_name: 'D-Edge',                       city: 'São Paulo',    vibe: 'americas' },
  { re: /@beatport\s+Live/i,        festival_id: 'beatport-live',       festival_name: 'Beatport Live',                city: 'Los Angeles',  vibe: 'americas' },
  { re: /Motion\s+Festival.*Lima/i, festival_id: 'motion-lima',         festival_name: 'Motion Festival',              city: 'Lima',         vibe: 'americas' },
  { re: /Re:frame/i,                festival_id: 'reframe-la',          festival_name: 'Re:frame LA',                  city: 'Los Angeles',  vibe: 'americas' },
  { re: /Selected\s+Sessions/i,     festival_id: 'selected-sessions',   festival_name: 'Selected Sessions',            city: 'Amsterdam',    vibe: 'europe' },
  { re: /Monsoon/i,                 festival_id: 'monsoon',             festival_name: 'Monsoon',                      city: 'Peru',         vibe: 'americas' },
  { re: /Hellbent/i,                festival_id: 'hellbent-la',         festival_name: 'Hellbent',                     city: 'Los Angeles',  vibe: 'americas' },
  { re: /Superior\s+Ingredients/i,  festival_id: 'superior-ny',         festival_name: 'Superior Ingredients',         city: 'New York',     vibe: 'americas' },
  { re: /Off\s+Week/i,              festival_id: 'off-week',            festival_name: 'Off Week',                     city: 'Barcelona',    vibe: 'europe' },
  { re: /(Sde\s+Boker|Dead\s+Sea|Hanokdim)/i, festival_id: 'tlv-desert', festival_name: 'Sde Boker Desert Sessions',  city: 'Sde Boker',    vibe: 'europe' },
  { re: /Glastonbury/i,             festival_id: 'glastonbury',         festival_name: 'Glastonbury Festival',         city: 'Glastonbury',  vibe: 'europe' },
  { re: /Intercell/i,               festival_id: 'intercell',           festival_name: 'Intercell',                    city: 'Rotterdam',    vibe: 'europe' },
  { re: /Pacha\s+New\s+York|Pacha\s+NYC/i, festival_id: 'pacha-nyc',    festival_name: 'Pacha New York',              city: 'New York',     vibe: 'americas' },
  { re: /Movement\s+(Festival|Detroit|Music)/i, festival_id: 'movement',   festival_name: 'Movement Festival',       city: 'Detroit',      vibe: 'americas' },
  { re: /III\s+Points/i,                festival_id: 'iii-points',          festival_name: 'III Points',              city: 'Miami',        vibe: 'americas' },
  { re: /CRSSD/i,                       festival_id: 'crssd',               festival_name: 'CRSSD Festival',          city: 'San Diego',    vibe: 'americas' },
  { re: /Exchange\s+(LA|Los Angeles)/i, festival_id: 'exchange-la',         festival_name: 'Exchange LA',             city: 'Los Angeles',  vibe: 'americas' },
  { re: /Seismic\s+Dance/i,             festival_id: 'concourse',           festival_name: 'The Concourse Project',   city: 'Austin',       vibe: 'americas' },
  { re: /Academy\s+(LA|Hollywood)/i,    festival_id: 'academy-la',          festival_name: 'Academy LA',              city: 'Los Angeles',  vibe: 'americas' },
];

function routeByTitle(title, defaultCh) {
  for (const r of VENUE_ROUTES) {
    if (r.re.test(title)) return { ...defaultCh, festival_id: r.festival_id, festival_name: r.festival_name, city: r.city, vibe: r.vibe };
  }
  return defaultCh;
}

async function ytDurations(ids) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, parseDuration(i.contentDetails.duration)]));
}

async function getExisting() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = r.ok ? await r.json() : [];
  return new Set(rows.map(x => x.video_id));
}

async function insertSets(sets) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_sets`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(sets),
  });
  return r.ok;
}

import { parseDescription } from './hot-tracks.js';

async function ytDescriptions(ids) {
  if (!ids.length) return {};
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, i.snippet?.description ?? '']));
}

async function insertTracks(tracks) {
  if (!tracks.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(tracks),
  });
}

export default async function handler(req, res) {
  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) return res.status(500).json({ error: 'Missing env vars' });

  const existing = await getExisting();
  const toInsert = [];

  for (const ch of CHANNELS) {
    try {
      const videos = (await ytSearch(ch.channelId)).filter(v => !existing.has(v.video_id));
      if (!videos.length) continue;
      const durs = await ytDurations(videos.map(v => v.video_id));
      for (const v of videos) {
        if ((durs[v.video_id]||0) < MIN_SECS) continue;
        if (isNonMusicalContent(v.title)) continue;
        const routed = routeByTitle(v.title, ch);
        toInsert.push({ video_id: v.video_id, festival_id: routed.festival_id, festival_name: routed.festival_name, city: routed.city, vibe: routed.vibe || ch.vibe, artist: v.title, title: v.title, source: 'youtube', duration_sec: durs[v.video_id] || null, status: 'live', embeddable: true, published_at: v.published_at, accent: null });
      }
    } catch (e) {
      console.error(ch.festival_name, e.message);
    }
  }

  if (toInsert.length) {
    await insertSets(toInsert);

    // Fetch descriptions and parse tracklists for new sets
    try {
      const ids = toInsert.map(s => s.video_id);
      const descs = await ytDescriptions(ids);
      const allTracks = [];
      for (const s of toInsert) {
        const parsed = parseDescription(descs[s.video_id] || '', s.video_id);
        allTracks.push(...parsed);
      }
      if (allTracks.length) await insertTracks(allTracks);
      console.log(`Parsed ${allTracks.length} track entries from ${toInsert.length} new sets`);
    } catch (e) {
      console.error('Tracklist parse error:', e.message);
    }
  }

  res.json({ inserted: toInsert.length, checked: CHANNELS.length });
}
