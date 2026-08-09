// GET /api/confirm?token=xxx — confirm email subscription
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://proper-selects.vercel.app';

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) {
    return res.status(400).send('<h2>Invalid confirmation link.</h2>');
  }

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?confirm_token=eq.${encodeURIComponent(token)}&select=id,email,confirmed`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await r.json();
  if (!rows?.length) {
    return res.status(404).send('<h2>Link not found or already used.</h2>');
  }

  const { id, confirmed } = rows[0];
  if (!confirmed) {
    await fetch(`${SUPABASE_URL}/rest/v1/subscribers?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ confirmed: true }),
    });
  }

  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`
    <!doctype html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Subscribed — Proper Selects</title>
      <style>
        body{margin:0;background:#0a0a0e;color:#EDEAE2;font-family:'Helvetica Neue',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px;}
        .wrap{max-width:400px;}
        .brand{font-weight:800;letter-spacing:.16em;font-size:13px;opacity:.6;margin-bottom:24px;}
        h1{font-size:28px;margin:0 0 12px;}
        p{opacity:.6;font-size:15px;line-height:1.6;margin:0 0 28px;}
        a{display:inline-block;padding:12px 28px;background:#F4A93C;color:#0a0a0e;border-radius:8px;font-weight:800;font-size:14px;text-decoration:none;}
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="brand">PROPER SELECTS</div>
        <h1>You're in ✓</h1>
        <p>Every Monday you'll get the best new sets added to the vault, straight to your inbox.</p>
        <a href="${SITE_URL}">Open Proper Selects →</a>
      </div>
    </body>
    </html>
  `);
}
