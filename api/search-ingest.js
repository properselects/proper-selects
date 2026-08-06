// Weekly YouTube keyword search — catches DJ sets from any channel.
// Sources: Club Space Miami / Ibiza circuit / Hard Summer / festival flyers.
// Cron: every Sunday 3am UTC. Also callable: GET /api/search-ingest

export const maxDuration = 60;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── DJ watchlist ──────────────────────────────────────────────────────────
// Sourced from: Club Space Miami flyers, DC-10/Circoloco/Amnesia Ibiza lineups,
// Hard Summer, Lollapalooza, Ultra — the artists Brian tracks.
const DJ_WATCHLIST = [
  // Club Space Miami regulars
  'Marco Carola', 'Loco Dice', 'Richie Hawtin', 'Victor Calderone',
  'Luciano', 'Danny Tenaglia', 'Nic Fanciulli', 'Dubfire',

  // Circoloco / DC-10 Ibiza
  'Seth Troxler', 'Peggy Gou', 'Solomun', 'Adriatique',
  'Maceo Plex', 'Jamie Jones', 'REBUKE', 'Apollonia',

  // Amnesia / Pacha / Hï Ibiza
  'Carl Cox', 'Sven Vath', 'Paul van Dyk', 'Martin Buttrich',
  'Joris Voorn', 'Tale of Us', 'Dixon', 'Ame',

  // Hard Summer / US festival circuit — eminent US DJs
  'John Summit', 'Fisher', 'Chris Lake', 'Skrillex',
  'Boys Noize', 'Four Tet', 'Floating Points',
  'Dom Dolla', 'Diplo', 'Kaskade', 'Deadmau5',
  'James Hype', 'Vintage Culture', 'Cassian', 'Anyma',
  'Sara Landry', 'Anfisa Letyago', 'Charlotte de Witte',
  'Kaytranada', 'Disclosure', 'Duke Dumont', 'Gorgon City',

  // Beltran / Classmatic / LA underground
  'Beltran', 'Classmatic', 'Chris Avantgarde', 'Eli Brown',
  'Dj Tennis', 'Sama Abdulhadi', 'HAAi',
  'Mochakk', 'Miss Monique', 'Massano',

  // Boiler Room / RA crowd
  'Blawan', 'SPFDJ', 'Paula Temple', 'KAS:ST',
  'ARTBAT', 'Ben UFO', 'Pearson Sound',

  // Lollapalooza / global
  'Gesaffelstein', 'Laurent Garnier', 'Recondite', 'Nina Kraviz',
  'Pan-Pot', 'Adam Beyer', 'Joseph Capriati',
];

// ─── vibe routing by artist ────────────────────────────────────────────────
const AMERICAS_ARTISTS = new Set([
  'marco carola', 'loco dice', 'richie hawtin', 'victor calderone', 'danny tenaglia',
  'john summit', 'fisher', 'chris lake', 'skrillex', 'boys noize',
  'beltran', 'classmatic', 'chris avantgarde', 'eli brown',
  'dom dolla', 'diplo', 'kaskade', 'deadmau5', 'james hype',
  'vintage culture', 'cassian', 'anyma', 'sara landry', 'kaytranada',
  'disclosure', 'duke dumont', 'gorgon city', 'mochakk',
]);

function vibeFor(djName) {
  const lower = djName.toLowerCase();
  if (AMERICAS_ARTISTS.has(lower)) return 'americas';
  return 'europe'; // default — Ibiza/Berlin DJs
}

// ─── helpers ───────────────────────────────────────────────────────────────
function parseDuration(d) {
  const m = (d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return m ? (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0)) : 0;
}

const MIN_SECS = 45 * 60;

// Reject non-musical content
const BAD = /\b(podcast|interview|recap|trailer|teaser|aftermovie|documentary|episode\s*\d|talk\b|panel|vlog|reaction|behind the scenes|watch party)\b/i;

async function ytSearch(query, publishedAfter) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('q', query);
  url.searchParams.set('type', 'video');
  url.searchParams.set('videoDuration', 'long');
  url.searchParams.set('order', 'date');
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('publishedAfter', publishedAfter);
  url.searchParams.set('key', YOUTUBE_API_KEY);
  const r = await fetch(url.toString());
  const d = await r.json();
  return (d.items || []).map((i) => ({
    video_id: i.id.videoId,
    title: i.snippet.title,
    published_at: i.snippet.publishedAt,
    channel: i.snippet.channelTitle,
  }));
}

async function ytDurations(ids) {
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`
  );
  const d = await r.json();
  return Object.fromEntries((d.items || []).map((i) => [i.id, parseDuration(i.contentDetails.duration)]));
}

async function getExisting() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  const rows = r.ok ? await r.json() : [];
  return new Set(rows.map((x) => x.video_id));
}

async function insertSets(sets) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sets`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(sets),
  });
  return r.ok;
}

// ─── handler ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing env vars' });
  }

  // Look back 90 days for recent uploads
  const publishedAfter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const existing = await getExisting();

  const candidates = [];
  const errors = [];
  const year = new Date().getFullYear();

  for (const dj of DJ_WATCHLIST) {
    try {
      const results = await ytSearch(`"${dj}" live set ${year}`, publishedAfter);
      for (const v of results) {
        if (!existing.has(v.video_id) && !BAD.test(v.title)) {
          candidates.push({ ...v, dj });
        }
      }
      // Rate limit — 100 units/search, stay under daily quota
      await new Promise((r) => setTimeout(r, 400));
    } catch (e) {
      errors.push(`${dj}: ${e.message}`);
    }
  }

  if (!candidates.length) {
    return res.json({ inserted: 0, searched: DJ_WATCHLIST.length, errors });
  }

  // Batch duration check
  const uniqueIds = [...new Set(candidates.map((c) => c.video_id))];
  const durs = await ytDurations(uniqueIds.slice(0, 50));

  const toInsert = [];
  for (const c of candidates) {
    const secs = durs[c.video_id] || 0;
    if (secs < MIN_SECS) continue;
    if (existing.has(c.video_id)) continue;
    existing.add(c.video_id); // dedup within this run
    toInsert.push({
      video_id: c.video_id,
      festival_id: 'search-ingest',
      festival_name: c.channel,
      city: 'Worldwide',
      vibe: vibeFor(c.dj),
      artist: c.title,
      title: c.title,
      source: 'youtube',
      duration_sec: secs,
      status: 'live',
      embeddable: true,
      published_at: c.published_at,
      accent: null,
    });
  }

  if (toInsert.length) await insertSets(toInsert);

  res.json({
    inserted: toInsert.length,
    candidates: candidates.length,
    searched: DJ_WATCHLIST.length,
    lookback: '21 days',
    errors,
  });
}
