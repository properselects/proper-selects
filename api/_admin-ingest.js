// TEMPORARY one-off admin insert — remove after use.
// GET /api/_admin-ingest?token=...  inserts a single hardcoded set server-side.
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TOKEN = 'b909286f4c22bb26ce000d399417cffc';

export default async function handler(req, res) {
  if ((req.query.token || '') !== TOKEN) return res.status(403).json({ error: 'forbidden' });
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'not configured' });

  const row = {
    video_id: 'Qy1Cr_AJ3Qk',
    festival_id: 'discovered',
    source: 'youtube',
    artist: 'Franky Rizardo - Live at Coachella 2026 (More To Life)',
    title: 'Franky Rizardo | Live at Coachella | 2026 (More To Life)',
    venue: 'Coachella 2026',
    duration_sec: 7150,
    published_at: '2026-05-01T18:00:06Z',
    status: 'live',
    embeddable: true,
    auto_ingested: false,
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/sets`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=ignore-duplicates',
    },
    body: JSON.stringify([row]),
  });

  const text = await r.text();
  return res.status(r.ok ? 200 : 500).json({ ok: r.ok, status: r.status, body: text });
}
