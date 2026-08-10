// POST /api/subscribe — add an email to the Proper Selects weekly digest list
import nodemailer from 'nodemailer';

export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SITE_URL = process.env.SITE_URL || 'https://proper-selects.vercel.app';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Simple in-memory sliding-window rate limiter (per IP).
// Resets on cold start — fine for abuse mitigation, not for strict SLA.
const rateBuckets = new Map();
const RATE_LIMIT = 5;              // max attempts
const RATE_WINDOW_MS = 60 * 60_000; // 1 hour

function checkRateLimit(ip) {
  if (!ip) return true;
  const now = Date.now();
  const bucket = (rateBuckets.get(ip) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT) {
    rateBuckets.set(ip, bucket);
    return false;
  }
  bucket.push(now);
  rateBuckets.set(ip, bucket);
  // Periodic GC to prevent unbounded growth
  if (rateBuckets.size > 5000) {
    for (const [k, v] of rateBuckets) {
      if (!v.length || now - v[v.length - 1] > RATE_WINDOW_MS) rateBuckets.delete(k);
    }
  }
  return true;
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

async function sendConfirmEmail(email, token) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const confirmUrl = `${SITE_URL}/api/confirm?token=${token}`;
  await createTransport().sendMail({
    from: `"Proper Selects" <${GMAIL_USER}>`,
    to: email,
    subject: 'You\'re one click away from the best DJ sets on the internet',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f0;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#0a0a0e;border-radius:16px;overflow:hidden;">

        <!-- Hero -->
        <tr><td style="padding:48px 40px 32px;text-align:center;background:linear-gradient(180deg,#1a0f05 0%,#0a0a0e 100%);">
          <div style="font-size:10px;font-weight:800;letter-spacing:.42em;color:#F4A93C;margin-bottom:32px;">
            [ PROPER SELECTS ]
          </div>
          <h1 style="font-size:36px;line-height:1.05;margin:0 0 12px;color:#EDEAE2;font-weight:900;letter-spacing:-.02em;">
            The world's best<br/>
            <span style="color:#F4A93C;">DJ sets</span>, curated.
          </h1>
          <p style="font-size:15px;line-height:1.5;margin:20px 0 32px;color:rgba(237,234,226,.65);">
            One email a week. No noise, no algorithms — just the sets that mattered.
          </p>

          <!-- CTA -->
          <a href="${confirmUrl}" style="display:inline-block;padding:16px 44px;background:#F4A93C;color:#0a0a0e;border-radius:10px;font-weight:900;font-size:15px;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 4px 20px rgba(244,169,60,.4);">
            ▷ Confirm my subscription
          </a>
          <p style="margin:16px 0 0;font-size:11px;color:rgba(237,234,226,.4);letter-spacing:.06em;">Takes one tap. Under 24 hours.</p>
        </td></tr>

        <!-- What you get -->
        <tr><td style="padding:0 40px 40px;background:#0a0a0e;">
          <div style="border-top:1px solid rgba(255,255,255,.08);padding-top:32px;margin-top:8px;">
            <p style="font-size:11px;font-weight:800;letter-spacing:.16em;color:#F4A93C;margin:0 0 20px;text-transform:uppercase;">
              What you're getting
            </p>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:32px;color:#F4A93C;font-size:16px;font-weight:900;vertical-align:top;">◈</td>
                  <td>
                    <div style="color:#EDEAE2;font-size:15px;font-weight:700;margin-bottom:2px;">The Weekly Drop</div>
                    <div style="color:rgba(237,234,226,.55);font-size:13px;line-height:1.5;">Monday morning — 5 sets we couldn't stop playing. Boiler Room, Cercle, fabric, Awakenings, and the underground gems.</div>
                  </td>
                </tr></table>
              </td></tr>

              <tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:32px;color:#F4A93C;font-size:16px;font-weight:900;vertical-align:top;">⊕</td>
                  <td>
                    <div style="color:#EDEAE2;font-size:15px;font-weight:700;margin-bottom:2px;">The Radar</div>
                    <div style="color:rgba(237,234,226,.55);font-size:13px;line-height:1.5;">What's trending right now — ranked by real views, updated daily. The sets everyone will be talking about next week.</div>
                  </td>
                </tr></table>
              </td></tr>

              <tr><td style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.06);">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:32px;color:#F4A93C;font-size:16px;font-weight:900;vertical-align:top;">⟶</td>
                  <td>
                    <div style="color:#EDEAE2;font-size:15px;font-weight:700;margin-bottom:2px;">The Vault</div>
                    <div style="color:rgba(237,234,226,.55);font-size:13px;line-height:1.5;">700+ curated sets from 100+ venues worldwide. Build a lineup in 30 seconds, share it with one link.</div>
                  </td>
                </tr></table>
              </td></tr>

              <tr><td style="padding:14px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
                  <td style="width:32px;color:#F4A93C;font-size:16px;font-weight:900;vertical-align:top;">⊞</td>
                  <td>
                    <div style="color:#EDEAE2;font-size:15px;font-weight:700;margin-bottom:2px;">The Atlas</div>
                    <div style="color:rgba(237,234,226,.55);font-size:13px;line-height:1.5;">Discover new venues by city. From Amsterdam to Ibiza to Chicago to Tokyo — see where the sound is happening.</div>
                  </td>
                </tr></table>
              </td></tr>
            </table>
          </div>
        </td></tr>

        <!-- Stats bar -->
        <tr><td style="padding:24px 40px;background:rgba(244,169,60,.06);border-top:1px solid rgba(244,169,60,.15);">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td style="text-align:center;">
              <div style="color:#F4A93C;font-size:22px;font-weight:900;">793</div>
              <div style="color:rgba(237,234,226,.5);font-size:10px;letter-spacing:.1em;text-transform:uppercase;">sets in vault</div>
            </td>
            <td style="text-align:center;border-left:1px solid rgba(255,255,255,.08);border-right:1px solid rgba(255,255,255,.08);">
              <div style="color:#F4A93C;font-size:22px;font-weight:900;">114</div>
              <div style="color:rgba(237,234,226,.5);font-size:10px;letter-spacing:.1em;text-transform:uppercase;">venues</div>
            </td>
            <td style="text-align:center;">
              <div style="color:#F4A93C;font-size:22px;font-weight:900;">Daily</div>
              <div style="color:rgba(237,234,226,.5);font-size:10px;letter-spacing:.1em;text-transform:uppercase;">fresh drops</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- Final CTA -->
        <tr><td style="padding:36px 40px 44px;background:#0a0a0e;text-align:center;">
          <a href="${confirmUrl}" style="display:inline-block;padding:14px 36px;background:#F4A93C;color:#0a0a0e;border-radius:10px;font-weight:900;font-size:14px;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;">
            Confirm & unlock the vault →
          </a>
          <p style="margin:20px 0 0;font-size:11px;color:rgba(237,234,226,.3);line-height:1.6;">
            If you didn't sign up, you can ignore this email — you won't hear from us again.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 40px;background:#050609;text-align:center;">
          <p style="margin:0;font-size:10px;color:rgba(237,234,226,.3);letter-spacing:.15em;text-transform:uppercase;">
            Proper Selects · <a href="https://properselects.com" style="color:rgba(244,169,60,.6);text-decoration:none;">properselects.com</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });
}

async function getCount(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: 'count=exact' },
  });
  return parseInt((r.headers.get('content-range') || '').split('/')[1] || '0', 10);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET /api/subscribe?stats=1 — aggregate counts for internal reporting
  if (req.method === 'GET' && req.query.stats === '1') {
    if (!SUPABASE_KEY) return res.status(500).json({ error: 'Missing config' });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [subsTotal, subsConfirmed, subsThisWeek, sets, venues] = await Promise.all([
      getCount('subscribers?unsubscribed_at=is.null'),
      getCount('subscribers?confirmed=eq.true&unsubscribed_at=is.null'),
      getCount(`subscribers?created_at=gte.${encodeURIComponent(weekAgo)}&unsubscribed_at=is.null`),
      getCount('sets?status=eq.live'),
      getCount('festivals?active=eq.true'),
    ]);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.json({ subsTotal, subsConfirmed, subsThisWeek, sets, venues });
  }



  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 5 requests per hour per IP
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { email, website } = req.body || {};

  // Honeypot — bots fill hidden fields, humans don't
  if (website) return res.status(200).json({ ok: true, message: 'Check your email to confirm' });

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Rate limit / anti-bomb: if this email already has a subscriber row, don't re-send.
  // Same row will be found on legitimate re-attempts too — user was already emailed.
  const throttleCheck = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?email=eq.${encodeURIComponent(normalizedEmail)}&select=id,confirmed`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const existing = throttleCheck.ok ? await throttleCheck.json() : [];
  if (existing[0]) {
    return res.status(200).json({ ok: true, message: existing[0].confirmed ? 'Already subscribed' : 'Check your email to confirm' });
  }

  // Insert new subscriber
  const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      email: normalizedEmail,
      confirmed: false,
      unsubscribed_at: null,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Failed to save subscription' });
  }

  const [row] = await r.json();
  if (row?.confirm_token) {
    await sendConfirmEmail(email, row.confirm_token).catch(console.error);
  }

  return res.status(200).json({ ok: true, message: 'Check your email to confirm' });
}
