// Vercel serverless function — called by cron daily at 4am UTC
// Also callable manually: GET /api/ingest

export const maxDuration = 60;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CHANNELS = [
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom',        festival_name: 'Boiler Room',        city: 'Chicago',   vibe: 'americas' },
  { channelId: 'UCl2CLatrfJiU6OqmHZNUDNg', festival_id: 'dekmantel',         festival_name: 'Dekmantel',          city: 'Amsterdam', vibe: 'europe' },
  { channelId: 'UCDHvlud7Hf86FxFsogrBcMg', festival_id: 'ra',                festival_name: 'Resident Advisor',   city: 'London',    vibe: 'europe' },
  { channelId: 'UCOlJBEcHjFpQ0SQlNNqEuIA', festival_id: 'cercle',            festival_name: 'Cercle',             city: 'Worldwide', vibe: 'worldwide' },
  { channelId: 'UCGbDh9LIjFRrMEO0sxvKVyA', festival_id: 'thuishaven',        festival_name: 'Thuishaven',         city: 'Amsterdam', vibe: 'europe' },
  { channelId: 'UCNKR0GnJRSqMcKx6JWXBhwA', festival_id: 'yoyaku',           festival_name: 'Yoyaku',             city: 'Paris',     vibe: 'europe' },
  { channelId: 'UCwmFOfFuvRPI112vR5DN8vQ', festival_id: 'rawcuts',           festival_name: 'Raw Cuts',           city: 'New York',  vibe: 'americas' },
  { channelId: 'UC3ifTl5zKiCAhHIBQYcaTrg', festival_id: 'greenvalley',       festival_name: 'Green Valley',       city: 'Camboriú',  vibe: 'americas' },
  { channelId: 'UCp_MbSA-jJzGjsBBgYZTmjA', festival_id: 'dc10',             festival_name: 'DC-10',              city: 'Ibiza',     vibe: 'europe' },
  { channelId: 'UCaSjh0kdrd3xEn0zqcjbiDg', festival_id: 'concourse',         festival_name: 'The Concourse Project', city: 'Austin',   vibe: 'americas' },
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
        toInsert.push({ video_id: v.video_id, festival_id: ch.festival_id, festival_name: ch.festival_name, city: ch.city, vibe: ch.vibe, artist: v.title, source: 'youtube', published_at: v.published_at, accent: null });
      }
    } catch (e) {
      console.error(ch.festival_name, e.message);
    }
  }

  if (toInsert.length) await insertSets(toInsert);
  res.json({ inserted: toInsert.length, checked: CHANNELS.length });
}
