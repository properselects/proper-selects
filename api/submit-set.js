// POST /api/submit-set — community set submission for Bedroom DJ pipeline
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function extractVideoId(url) {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

async function verifyEmbeddable(videoId) {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function pingTelegram(msg) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: msg, parse_mode: 'HTML', disable_web_page_preview: false }),
    });
  } catch {}
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { video_url, submitter_name, submitter_location, is_own_set, why } = req.body || {};

  if (!video_url) return res.status(400).json({ error: 'video_url required' });

  const video_id = extractVideoId(video_url);
  if (!video_id) return res.status(400).json({ error: 'Not a valid YouTube URL' });

  const embeddable = await verifyEmbeddable(video_id);
  if (!embeddable) return res.status(400).json({ error: 'Video is private, unavailable, or blocked from embedding' });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const r = await fetch(`${SUPABASE_URL}/rest/v1/submissions`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      video_url,
      video_id,
      submitter_name: submitter_name || null,
      submitter_location: submitter_location || null,
      is_own_set: !!is_own_set,
      why: why || null,
      status: 'pending',
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('Submission error:', err);
    return res.status(500).json({ error: 'Failed to save submission' });
  }

  const kind = is_own_set ? '🎧 Bedroom DJ submission' : '📀 Set submission';
  const who = submitter_name ? `<b>${escapeHtml(submitter_name)}</b>${submitter_location ? ` (${escapeHtml(submitter_location)})` : ''}` : 'Anonymous';
  await pingTelegram(`${kind}\n\nBy: ${who}\n${why ? `Why: ${escapeHtml(why)}\n\n` : ''}${escapeHtml(video_url)}`);

  return res.status(200).json({ ok: true, message: is_own_set ? "Your set is in the queue — we'll listen this week." : 'Thanks — added to the queue for review.' });
}
