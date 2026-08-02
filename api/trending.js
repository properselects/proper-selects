// /api/trending — discovers popular new house/techno sets across YouTube
// Weekly cron: searches broader terms, filters by view velocity (views/day)
// Adds newly viral sets even from channels not in our watchlist

export const maxDuration = 60;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Search queries — targeted at the exact type of content we want
const DISCOVERY_QUERIES = [
  // Genre + year (broad)
  'house DJ set full 2026',
  'tech house festival full set 2026',
  'techno warehouse set 2026',
  'melodic house techno set 2026',
  'afro house festival 2026',
  'deep house set 2026',
  'minimal house dj set 2026',
  'italo disco dj set 2026',
  // Venue/event specific
  'circoloco ibiza dj set 2026',
  'ADE amsterdam full set 2026',
  'boiler room 2026 full set',
  'awakenings 2026 full set',
  'dekmantel 2026 dj set',
  'time warp 2026 full set',
  'club space miami full set 2026',
  'thuishaven 2026 dj set',
  'nibiru romania 2026 set',
  'sonar barcelona 2026 dj set',
  'movement detroit 2026 dj set',
  'green valley brazil 2026 set',
  'exit festival 2026 dance arena',
  'creamfields 2026 full set',
  'hi ibiza full set 2026',
  'pacha ibiza 2026 dj set',
  'shelter amsterdam 2026 set',
  // Recent big-name artists
  'chris stussy 2026 dj set',
  'anyma 2026 dj set',
  'mochakk 2026 dj set',
  'i hate models 2026 techno set',
];

const MIN_SECS = 45 * 60;
const MIN_VIEWS_PER_DAY = 500; // discard slow burners
const MAX_AGE_DAYS = 60;

const NON_MUSICAL_PATTERNS = [
  /\bpanel\b/i, /\bdiscussion\b/i, /\binterview\b/i, /\bnetworking\b/i,
  /\bresearch\b/i, /\baftermovie\b/i, /\brecap\b/i, /\btrailer\b/i, /\bteaser\b/i,
  /\bpodcast\b/i, /\bmasterclass\b/i, /\bworkshop\b/i, /\btalk\b/i, /\bkeynote\b/i,
  /\bhip\s*[- ]?hop\b/i, /\bhiphop\b/i, /\bneo\s+soul\b/i, /\br\s*&\s*b\b/i,
  /\brap\s+(mix|set|dj)\b/i, /\blo-?fi\b/i, /\bchillhop\b/i, /\btrap\s+(mix|set)\b/i,
  /\bmix\s+#\d/i, /\brnb\b/i, /\bnu\s*soul\b/i, /\bdrill\b/i, /\bdancehall\b/i,
];

// Reuse VENUE_ROUTES pattern from ingest.js
const VENUE_ROUTES = [
  { re: /EDC\s+Orlando/i, festival_id: 'edc-orlando', festival_name: 'EDC Orlando', city: 'Orlando' },
  { re: /EDC\s+Mexico/i, festival_id: 'edc-mexico', festival_name: 'EDC Mexico', city: 'Mexico City' },
  { re: /H(ï|i)\s+ibiza/i, festival_id: 'hi-ibiza', festival_name: 'Hï Ibiza', city: 'Ibiza' },
  { re: /Knockdown\s+Center/i, festival_id: 'knockdown-nyc', festival_name: 'Knockdown Center', city: 'New York' },
  { re: /ARC\s+(Chicago|Music)/i, festival_id: 'arc-chicago', festival_name: 'ARC Music Festival', city: 'Chicago' },
  { re: /Concourse\s+Project/i, festival_id: 'concourse', festival_name: 'The Concourse Project', city: 'Austin' },
  { re: /Thuishaven/i, festival_id: 'thuishaven', festival_name: 'Thuishaven', city: 'Amsterdam' },
  { re: /Green\s+Valley/i, festival_id: 'greenvalley', festival_name: 'Green Valley', city: 'Camboriú' },
  { re: /Yoyaku/i, festival_id: 'yoyaku', festival_name: 'Yoyaku', city: 'Paris' },
  { re: /Awakenings/i, festival_id: 'awakenings', festival_name: 'Awakenings', city: 'Amsterdam' },
  { re: /Dekmantel/i, festival_id: 'dekmantel', festival_name: 'Dekmantel', city: 'Amsterdam' },
  { re: /Boiler\s+Room.*Berlin/i, festival_id: 'boilerroom-berlin', festival_name: 'Boiler Room Berlin', city: 'Berlin' },
  { re: /Boiler\s+Room/i, festival_id: 'boilerroom', festival_name: 'Boiler Room', city: 'Chicago' },
  { re: /Cercle/i, festival_id: 'cercle', festival_name: 'Cercle', city: 'Worldwide' },
  { re: /Circoloco.*DC-?10|DC-?10.*Circoloco/i, festival_id: 'dc10', festival_name: 'DC-10', city: 'Ibiza' },
  { re: /Pacha\s+New\s+York|Pacha\s+NYC/i, festival_id: 'pacha-nyc', festival_name: 'Pacha New York', city: 'New York' },
  { re: /Pacha/i, festival_id: 'pacha', festival_name: 'Pacha', city: 'Ibiza' },
  { re: /Amnesia/i, festival_id: 'amnesia', festival_name: 'Amnesia', city: 'Ibiza' },
  { re: /Intercell/i, festival_id: 'intercell', festival_name: 'Intercell', city: 'Rotterdam' },
  { re: /MODE\s+Festival/i, festival_id: 'mode', festival_name: 'MODE Festival', city: 'Sydney' },
  { re: /Nibiru/i, festival_id: 'nibiru', festival_name: 'Nibiru Universe', city: 'Costinești' },
  { re: /Club\s+Space|Space\s+Miami/i, festival_id: 'clubspace', festival_name: 'Club Space', city: 'Miami' },
  { re: /Time\s+Warp/i, festival_id: 'timewarp', festival_name: 'Time Warp', city: 'Mannheim' },
  { re: /S(ó|o)nar/i, festival_id: 'sonarfest', festival_name: 'Sónar', city: 'Barcelona' },
  { re: /Movement\s+(Festival|Detroit)/i, festival_id: 'movement', festival_name: 'Movement Festival', city: 'Detroit' },
  { re: /Exit\s+Festival|Dance\s+Arena/i, festival_id: 'exit', festival_name: 'EXIT Festival', city: 'Novi Sad' },
  { re: /Creamfields/i, festival_id: 'creamfields', festival_name: 'Creamfields', city: 'Warrington' },
  { re: /Shelter\s+Amsterdam/i, festival_id: 'shelter-ams', festival_name: 'Shelter Amsterdam', city: 'Amsterdam' },
  { re: /Junction\s+2/i, festival_id: 'junction2', festival_name: 'Junction 2', city: 'London' },
  { re: /Printworks/i, festival_id: 'printworks', festival_name: 'Printworks', city: 'London' },
  { re: /Fabric/i, festival_id: 'fabriclondon', festival_name: 'fabric', city: 'London' },
  { re: /Watergate/i, festival_id: 'watergate', festival_name: 'Watergate', city: 'Berlin' },
  { re: /Tresor/i, festival_id: 'tresor', festival_name: 'Tresor', city: 'Berlin' },
  { re: /Berghain/i, festival_id: 'berghain', festival_name: 'Berghain', city: 'Berlin' },
];

function parseDuration(d) {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0));
}

function isNonMusical(title) {
  if (!title) return true;
  return NON_MUSICAL_PATTERNS.some(re => re.test(title));
}

function routeByTitle(title) {
  for (const r of VENUE_ROUTES) {
    if (r.re.test(title)) return { festival_id: r.festival_id, festival_name: r.festival_name, city: r.city };
  }
  return null; // unrouted trending sets get skipped, protects catalog quality
}

async function ytSearch(query, publishedAfter) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&maxResults=25&order=viewCount&type=video&videoDuration=long&publishedAfter=${publishedAfter}&key=${YOUTUBE_API_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  return (d.items||[]).map(i => ({ video_id: i.id.videoId, title: i.snippet.title, published_at: i.snippet.publishedAt }));
}

async function ytDetails(ids) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, {
    duration: parseDuration(i.contentDetails.duration),
    views: parseInt(i.statistics?.viewCount || 0),
  }]));
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

  const publishedAfter = new Date(Date.now() - MAX_AGE_DAYS * 864e5).toISOString();
  const existing = await getExisting();
  const seen = new Set(existing);
  const candidates = [];

  for (const q of DISCOVERY_QUERIES) {
    try {
      const videos = (await ytSearch(q, publishedAfter)).filter(v => !seen.has(v.video_id));
      videos.forEach(v => seen.add(v.video_id));
      candidates.push(...videos);
    } catch (e) {
      console.error(q, e.message);
    }
  }

  if (!candidates.length) return res.json({ discovered: 0, inserted: 0 });

  // Get stats for all candidates in one call (chunked at 50)
  const detailMap = {};
  for (let i = 0; i < candidates.length; i += 50) {
    const chunk = candidates.slice(i, i + 50);
    Object.assign(detailMap, await ytDetails(chunk.map(v => v.video_id)));
  }

  const toInsert = [];
  const now = Date.now();

  for (const v of candidates) {
    const d = detailMap[v.video_id];
    if (!d) continue;
    if (d.duration < MIN_SECS) continue;
    if (isNonMusical(v.title)) continue;
    const ageDays = Math.max(1, (now - new Date(v.published_at).getTime()) / 864e5);
    if (d.views / ageDays < MIN_VIEWS_PER_DAY) continue;
    const routed = routeByTitle(v.title);
    if (!routed) continue; // require known venue → keeps quality bar
    toInsert.push({
      video_id: v.video_id,
      festival_id: routed.festival_id,
      festival_name: routed.festival_name,
      city: routed.city,
      artist: v.title,
      title: v.title,
      source: 'youtube',
      duration_sec: d.duration,
      status: 'live',
      embeddable: true,
      published_at: v.published_at,
    });
  }

  if (toInsert.length) await insertSets(toInsert);
  res.json({ discovered: candidates.length, inserted: toInsert.length });
}
