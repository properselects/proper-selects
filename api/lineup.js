// GET /api/lineup?slug=xxx  → fetch a lineup
// POST /api/lineup { name, videoIds, setMetadata } → create and return slug

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
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
    // retry once on collision (extremely unlikely)
    const { data: existing } = await sb(`lineups?slug=eq.${slug}&select=slug`);
    if (existing?.length) slug = randomSlug();

    const { ok, data } = await sb('lineups', {
      method: 'POST',
      body: JSON.stringify({ slug, name: name || null, video_ids: videoIds, set_metadata: setMetadata || [] }),
    });
    if (!ok) return res.status(500).json({ error: 'Insert failed', detail: data });
    return res.status(201).json({ slug });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
