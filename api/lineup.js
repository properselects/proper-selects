// GET /api/lineup?slug=xxx  → fetch a saved lineup
// GET /api/lineup?today=1  → daily lineup: 8 newest sets (last 14 days) + 12 shuffled vault per region
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
  // Numbered podcast/mix series (e.g. "When We Dip 190", "fabric 123", "RA.945")
  /\bwhen\s+we\s+dip\s+\d+/i,
  /\bfabric\s+\d+\b/i,
  /\bra\.\d+\b/i,
  /\bmix\s+of\s+the\s+day\b/i,
  // Non-DJ-set junk / branded compilation mixes that slipped past discovery
  /\bmotivational\b/i,
  /\bhustle\s+mix\b/i,
  /\bsunset\s+mix\b/i,
  /\bgym\s*&(?:amp;)?\s*tonic\b/i,
  /\bback\s+in\s+da\s+days\b/i,
  /\bajegunle\b/i,
  // Radio shows / studio sessions — keep it to live sets at venues, shows & festivals
  /\bradio\b/i,
  /essential\s*mix/i,
  /selected\s*sessions/i,
  /\bstudio\s*(mix|set|session)/i,
  /\bin\s+the\s+lab\b/i,
  // Generic: title ends with a bare episode number ≥ 100 (strong signal of a series)
  /[-–\s]\d{3,}$/,
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

async function sbFetch(path, retries = 1) {
  // Retry once on transient failure so a single Supabase hiccup doesn't blank a region.
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
    if (!res.ok) throw new Error(`sb ${res.status}`);
    return await res.json();
  } catch (e) {
    if (retries > 0) return sbFetch(path, retries - 1);
    return [];
  }
}

const REGIONS = ['americas', 'europe', 'worldwide'];
const TARGET = 20;
const FRESH_TARGET = 8; // slots reserved for recently-surfaced sets
const FRESH_WINDOW_DAYS = 14; // "recently published" window
const INGEST_WINDOW_DAYS = 7; // "recently added to the vault" window
const MIN_PER_REGION = 12; // floor before we start relaxing filters to backfill from the vault

// Freshness = the more recent of when we ingested it vs when it was published, so a genuinely new
// upload AND a just-added back-catalog set both surface. ISO timestamps sort lexicographically.
function freshScore(r) {
  const c = r.created_at || '';
  const p = r.published_at || '';
  return c > p ? c : p;
}

async function todayLineup() {
  // Fresh layer: sets recently ADDED to the vault (or recently published) per region, ranked by how
  //   recently they surfaced — so the Today grid visibly turns over as daily ingest runs, even in a
  //   publish lull where nothing brand-new was uploaded.
  // Fill layer: shuffled vault for variety.
  // Fallback layer: if a region comes up thin (Supabase error, sparse region, or an aggressive
  //   diversity trim), progressively relax the query/filters so the grid is never blank as long as
  //   the database has *any* rows for that region.
  const since = new Date(Date.now() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sinceIngest = new Date(Date.now() - INGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Two pools per region: newest-published (breadth) + newest-ingested (so freshly-added older
  // uploads aren't buried past the 500-row publish-ordered cutoff). Merge + dedupe.
  const pools = await Promise.all(
    REGIONS.map(async (region) => {
      const q = `vault_sets?select=*&vibe=eq.${region}&source=eq.youtube&duration_sec=gte.2700`;
      const [byPub, byNew] = await Promise.all([
        sbFetch(`${q}&order=published_at.desc&limit=500`),
        sbFetch(`${q}&order=created_at.desc&limit=120`),
      ]);
      const seen = new Set(byPub.map((r) => r.video_id));
      return byPub.concat(byNew.filter((r) => !seen.has(r.video_id)));
    })
  );

  const out = [];
  for (let i = 0; i < REGIONS.length; i++) {
    const region = REGIONS[i];
    let all = pools[i];

    // Fallback 1: primary pool empty/thin (Supabase hiccup or sparse region) → re-query the vault
    // without the source/duration constraints so we still fill entirely from the database.
    if (all.length < MIN_PER_REGION) {
      const backfill = await sbFetch(`vault_sets?select=*&vibe=eq.${region}&order=published_at.desc&limit=500`);
      const seen = new Set(all.map((r) => r.video_id));
      all = all.concat(backfill.filter((r) => !seen.has(r.video_id)));
    }

    // Fresh = recently ingested OR recently published; rank by whichever is more recent.
    const recent = all
      .filter((r) => (r.created_at && r.created_at >= sinceIngest) || (r.published_at && r.published_at >= since))
      .sort((a, b) => freshScore(b).localeCompare(freshScore(a)));

    // Fresh slots: most recently surfaced, diversity-filtered
    const fresh = applyDiversity(recent, 2).slice(0, FRESH_TARGET);
    const freshIds = new Set(fresh.map((r) => r.video_id));

    // Fill slots: shuffle the rest for variety
    const pool = all.filter((r) => !freshIds.has(r.video_id));
    shuffle(pool);
    const fill = applyDiversity(pool, 2).slice(0, TARGET - fresh.length);

    let regionSets = [...fresh, ...fill];

    // Fallback 2: still short after diversity trimming → pad from whatever else is in the vault
    // (skip only clearly-bad content), so a region always serves as many sets as it can.
    if (regionSets.length < MIN_PER_REGION) {
      const used = new Set(regionSets.map((r) => r.video_id));
      const pad = all.filter((r) => !used.has(r.video_id) && !isBad(r)).slice(0, TARGET - regionSets.length);
      regionSets = regionSets.concat(pad);
    }

    out.push(...regionSets.map((s) => ({ ...s, vibe: region })));
  }

  // Global dedupe: a video mislabeled under two festival_ids can land in different regions
  // (e.g. a Club Space/Americas row and a Mixmag Lab/Europe row for the same set). Keep the
  // first occurrence so the same video never shows twice across the whole lineup.
  const seenVideo = new Set();
  return out.filter((s) => {
    if (!s.video_id) return true;
    if (seenVideo.has(s.video_id)) return false;
    seenVideo.add(s.video_id);
    return true;
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
