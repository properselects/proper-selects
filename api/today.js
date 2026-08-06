// /api/today — Hybrid daily lineup per region
// Fresh layer: sets discovered by ingest in last 72h (via created_at)
// Fill layer: curated vault variety per region when fresh is sparse

export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const BAD_CONTENT_RE = [
  /\bpanel\b/i, /\bdiscussion\b/i, /\binterview\b/i, /\bconference\b/i,
  /\bresearch\b/i, /\blab\s+finale\b/i, /\bresynthesising\b/i,
  /\baftermovie\b/i, /\brecap\b/i, /\btrailer\b/i, /\bdocumentary\b/i,
  /\bpodcast\b/i, /\bepisode\s*\d+/i, /\d{4}\s+\d{2}\s+\d{2}\s+\d{2}/,
  /\binjected\b/i, /\bkhao\s+san\b/i, /@beatport\s+live\b/i,
  /\bhip\s*[- ]?hop\b/i, /\bneo\s+soul\b/i, /\bchillhop\b/i, /\blo-?fi\b/i,
  /\btrap\s+(mix|set)\b/i, /\bdrill\b/i, /\breggaeton\b/i, /\bdancehall\b/i,
];

function isBad(row) {
  const t = (row.artist || row.title || '').toLowerCase();
  return BAD_CONTENT_RE.some((re) => re.test(t));
}

function djKey(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .split(/\s*[·@:]\s*/)[0]
    .split(/\s+-\s+/)[0]
    .replace(/\s+(live set|dj set|full set|live at)\b.*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function applyFilters(sets) {
  return sets.filter((r) => !isBad(r));
}

// Dedupe by DJ artist key + cap per venue for variety
function applyDiversity(sets, maxPerVenue = 2) {
  const seenDj = new Set();
  const venueCounts = {};
  return sets.filter((r) => {
    const k = djKey(r.artist || r.title);
    if (!k || seenDj.has(k)) return false;
    const vid = r.festival_id || 'unknown';
    if ((venueCounts[vid] || 0) >= maxPerVenue) return false;
    seenDj.add(k);
    venueCounts[vid] = (venueCounts[vid] || 0) + 1;
    return true;
  });
}

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

const REGIONS = ['americas', 'europe', 'worldwide'];
const FRESH_WINDOW_HOURS = 72;
const TARGET_PER_REGION = 20;
const MIN_FRESH_TARGET = 8;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const freshCutoff = new Date(Date.now() - FRESH_WINDOW_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch fresh sets across all regions — recently discovered by the ingest
  const freshAllPromise = sbFetch(
    `public_sets?select=*&status=eq.live&duration_sec=gte.2700&created_at=gte.${encodeURIComponent(freshCutoff)}&order=created_at.desc&limit=500`
  );

  // Fetch vault fill pool per region — older sets for variety fill
  const fillPromises = REGIONS.map((region) =>
    sbFetch(
      `public_sets?select=*&status=eq.live&duration_sec=gte.2700&vibe=eq.${region}&created_at=lt.${encodeURIComponent(freshCutoff)}&order=published_at.desc&limit=400`
    )
  );

  const [freshAll, ...fillPools] = await Promise.all([freshAllPromise, ...fillPromises]);

  const result = {};

  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i];

    // Fresh sets for this region, cleaned and diversity-filtered
    const freshRegion = applyFilters(freshAll.filter((r) => r.vibe === region));
    const freshDiverse = applyDiversity([...freshRegion], 2);

    // Fill with shuffled vault variety if fresh is sparse
    const fillNeeded = Math.max(0, TARGET_PER_REGION - freshDiverse.length);
    let fillDiverse = [];

    if (fillNeeded > 0) {
      const freshIds = new Set(freshDiverse.map((r) => r.video_id));
      const pool = applyFilters(fillPools[i]).filter((r) => !freshIds.has(r.video_id));
      shuffle(pool);
      fillDiverse = applyDiversity(pool, 2).slice(0, fillNeeded);
    }

    result[region] = [...freshDiverse, ...fillDiverse];
  }

  // Flat array — client geoRegion() will re-route misclassified sets
  const flat = Object.entries(result).flatMap(([vibe, sets]) =>
    sets.map((s) => ({ ...s, vibe }))
  );

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json(flat);
}
