// On-demand ID-Radar miner for a single set. Called by the player when a set
// has no mined IDs yet: mines its YouTube comments live and returns the moments
// so the ID Radar can populate immediately. Cheap (~1 YouTube unit/comment call).

import { mineAndStore } from './_mine.js';

export const maxDuration = 30;

export default async function handler(req, res) {
  const videoId = String(req.query.video_id || '').trim();
  if (!videoId) return res.status(400).json({ error: 'video_id required' });

  const SB = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_KEY;
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` };
  const q = `${SB}/rest/v1/set_id_moments?select=*&video_id=eq.${encodeURIComponent(videoId)}&order=likes.desc&limit=200`;

  const read = async () => {
    try { const r = await fetch(q, { headers }); return r.ok ? await r.json() : []; }
    catch { return []; }
  };

  // Already mined → return what we have, no YouTube call.
  let moments = await read();
  if (Array.isArray(moments) && moments.length) {
    return res.json({ mined: false, moments });
  }

  // Mine now, then re-read.
  await mineAndStore([videoId], 1);
  moments = await read();
  return res.json({ mined: true, moments: Array.isArray(moments) ? moments : [] });
}
