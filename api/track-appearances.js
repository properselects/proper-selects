// GET /api/track-appearances?id=<canonical_track_id>
// Returns every set a specific canonical track appeared in, with timestamps.

export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'missing env' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/track_appearances?canonical_track_id=eq.${encodeURIComponent(id)}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );

  if (!r.ok) return res.status(500).json({ error: 'db error' });

  const appearances = await r.json();
  res.setHeader('Cache-Control', 'public, s-maxage=60');
  return res.json({ count: appearances.length, appearances });
}
