// GET /api/ids — ID tracker endpoints
// ?track=<canonical_track_id>  → appearances for one track
// (no track param)             → ranked unreleased IDs list

export const maxDuration = 10;

// Filter out noise titles — comment reactions, question marks, generic labels
const NOISE_PATTERNS = [
  /^what a tune[!.]*/i,
  /^track\s*\?+$/i,
  /^track\s*id\s*\??$/i,
  /^id\s*\??$/i,
  /^\?+$/,
  /^banger[!.]*/i,
  /^fire[!.]*/i,
  /^omg[!.]*/i,
  /^wow[!.]*/i,
  /^anyone(\s+know)?[!.?]*/i,
  /^what('?s)?\s+this[!.?]*/i,
  /^name[!.?]*/i,
  /^unknown[!.?]*/i,
  /^song\s*\??$/i,
  /^music[!.?]*/i,
  /^please\s+id/i,
  /^\s*-\s*$/,
];

// Also filter "Artist - ID" entries where the track name IS "ID" (not a real title)
// e.g. "Max Styler - ID", "Priku - ID", "John Summit - ID"
function titlePart(full) {
  const dash = full.lastIndexOf(' - ');
  return dash >= 0 ? full.slice(dash + 3).trim() : full.trim();
}

function isNoise(title) {
  if (!title || title.trim().length < 2) return true;
  const t = title.trim();
  if (NOISE_PATTERNS.some(p => p.test(t))) return true;
  // Strip "Artist - " prefix and check if remaining title is just "ID" or "ID?"
  const tp = titlePart(t);
  if (/^id\s*\??$/i.test(tp)) return true;
  return false;
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const H = (key) => ({ apikey: key, Authorization: `Bearer ${key}` });

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'missing env' });

  // Track appearances mode
  if (req.query.track) {
    const id = req.query.track;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'invalid id' });

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/track_appearances?canonical_track_id=eq.${id}`,
      { headers: H(SUPABASE_KEY) }
    );
    if (!r.ok) return res.status(500).json({ error: 'db error' });
    const appearances = await r.json();
    res.setHeader('Cache-Control', 'public, s-maxage=60');
    return res.json({ count: appearances.length, appearances });
  }

  // Unreleased IDs list mode
  const limit = Math.min(parseInt(req.query.limit) || 100, 200);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/unreleased_ids?limit=${limit}`,
    { headers: H(SUPABASE_KEY) }
  );
  if (!r.ok) return res.status(500).json({ error: 'db error', detail: await r.text() });
  const raw = await r.json();
  const ids = raw.filter(t => !isNoise(t.title));
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  return res.json({ count: ids.length, ids });
}
