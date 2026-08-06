// GET /api/lineup?slug=xxx  → fetch a saved lineup
// GET /api/lineup?today=1  → hybrid daily lineup (fresh ingest + vault fill per region)
// POST /api/lineup { name, videoIds, setMetadata } → create and return slug
// DELETE /api/lineup → purge lineups older than 30 days

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

function base62(n) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  while (n > 0) { s = chars[n % 62] + s; n = Math.floor(n / 62); }
  return s.padStart(6, '0');
}

function randomSlug() {
  const n = Math.floor(Math.random() * 62 ** 6);
  return base62(n);
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ── Hybrid today lineup helpers ──────────────────────────────────────────────

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

function applyDiversity(sets, maxPerVenue = 2) {
  const seenDj = new Set();
  const venueCounts = {};
  return sets.filter((r) => {
    if (isBad(r)) return false;
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
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

const REGIONS = ['americas', 'europe', 'worldwide'];
const FRESH_HOURS = 72;
const TARGET = 20;

async function todayLineup() {
  const freshCutoff = new Date(Date.now() - FRESH_HOURS * 60 * 60 * 1000).toISOString();

  const [freshAll, ...fillPools] = await Promise.all([
    sbFetch(`public_sets?select=*&status=eq.live&duration_sec=gte.2700&created_at=gte.${encodeURIComponent(freshCutoff)}&order=created_at.desc&limit=500`),
    ...REGIONS.map((region) =>
      sbFetch(`public_sets?select=*&status=eq.live&duration_sec=gte.2700&vibe=eq.${region}&created_at=lt.${encodeURIComponent(freshCutoff)}&order=published_at.desc&limit=400`)
    ),
  ]);

  return REGIONS.flatMap((region, i) => {
    const freshDiverse = applyDiversity(freshAll.filter((r) => r.vibe === region), 2);
    const fillNeeded = Math.max(0, TARGET - freshDiverse.length);
    let fill = [];
    if (fillNeeded > 0) {
      const freshIds = new Set(freshDiverse.map((r) => r.video_id));
      const pool = fillPools[i].filter((r) => !freshIds.has(r.video_id));
      shuffle(pool);
      fill = applyDiversity(pool, 2).slice(0, fillNeeded);
    }
    return [...freshDiverse, ...fill].map((s) => ({ ...s, vibe: region }));
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === 'GET') {
    if (req.query.today) {
      const sets = await todayLineup();
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
      return res.json(sets);
    }
    const slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    const { ok, data } = await sb(`lineups?slug=eq.${encodeURIComponent(slug)}&select=*`);
    if (!ok || !data?.length) return res.status(404).json({ error: 'Not found' });
    return res.json(data[0]);
  }

  if (req.method === 'POST') {
    const { name, videoIds, setMetadata } = req.body || {};
    if (!videoIds?.length) return res.status(400).json({ error: 'videoIds required' });

    let slug = randomSlug();
    const { data: existing } = await sb(`lineups?slug=eq.${slug}&select=slug`);
    if (existing?.length) slug = randomSlug();

    const { ok, data } = await sb('lineups', {
      method: 'POST',
      body: JSON.stringify({ slug, name: name || null, video_ids: videoIds, set_metadata: setMetadata || [] }),
    });
    if (!ok) return res.status(500).json({ error: 'Insert failed', detail: data });
    return res.status(201).json({ slug });
  }

  if (req.method === 'DELETE') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { ok, data } = await sb(`lineups?created_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE' });
    return res.json({ deleted: ok ? (data?.length || 0) : 0, cutoff });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
