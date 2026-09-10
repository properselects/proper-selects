// GET /api/unreleased-ids
// Returns tracks with no Beatport ID, ranked by how many sets played them.
// These are "ID" tracks — unreleased or unidentified.

export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'missing env' });

  const limit = Math.min(parseInt(req.query.limit) || 50, 200);

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/unreleased_ids?limit=${limit}`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );

  if (!r.ok) return res.status(500).json({ error: 'db error', detail: await r.text() });

  const ids = await r.json();
  res.setHeader('Cache-Control', 'public, s-maxage=300');
  return res.json({ count: ids.length, ids });
}
