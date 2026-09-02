// POST /api/flag-embed  { video_id }
// The stage player calls this when YouTube refuses to embed a set (error 100/101/150).
// We flag it embeddable=false so /api/lineup drops it from every region going forward —
// the non-embeddable class of bug self-heals without a human in the loop.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const video_id = body?.video_id;

  // Validate: exactly a YouTube id. Prevents this open endpoint from being used to poke arbitrary rows.
  if (!video_id || !YT_ID_RE.test(video_id)) {
    return res.status(400).json({ error: 'valid video_id required' });
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/sets?video_id=eq.${video_id}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        // embeddable=false → excluded by /api/lineup. status=unavailable → semantic + de-dupes on
        // re-ingest so it isn't silently re-added. duration_sec kept intact (real value) so we don't
        // corrupt data; the lineup exclusion is the embeddable flag, not the duration floor.
        body: JSON.stringify({ embeddable: false, status: 'unavailable' }),
      }
    );
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: 'flag failed', status: r.status, detail: detail.slice(0, 200) });
    }
    return res.status(200).json({ ok: true, video_id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
