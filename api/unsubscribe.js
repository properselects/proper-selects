// GET /api/unsubscribe?token=xxx
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send('Invalid link.');

  // Validate UUID format to prevent PostgREST filter injection
  if (!/^[0-9a-f-]{36}$/i.test(token)) return res.status(400).send('Invalid link.');

  await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${encodeURIComponent(token)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ unsubscribed_at: new Date().toISOString() }),
  });

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
    <!doctype html><html><head><meta charset="UTF-8">
    <title>Unsubscribed — Proper Selects</title>
    <style>body{margin:0;background:#0a0a0e;color:#EDEAE2;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}
    .brand{font-weight:800;letter-spacing:.16em;font-size:13px;opacity:.6;margin-bottom:16px;}
    h1{font-size:22px;margin:0 0 10px;}p{opacity:.5;font-size:14px;}</style></head>
    <body><div><div class="brand">PROPER SELECTS</div><h1>Unsubscribed</h1><p>You won't receive any more emails from us.</p></div></body></html>
  `);
}
