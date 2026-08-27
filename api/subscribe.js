// POST /api/subscribe — add an email to the Proper Selects weekly digest list
import nodemailer from 'nodemailer';
import { getNewSets, getTopLineupSets, getTopIds, getRadarSets, buildEmail } from '../lib/digest-builder.js';

export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const SITE_URL = process.env.SITE_URL || 'https://proper-selects.vercel.app';

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

// Disposable / throwaway email domains — common signup-spam sources.
// Extend via env DISPOSABLE_EMAIL_DOMAINS (comma-separated) without a redeploy.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.info', 'sharklasers.com',
  '10minutemail.com', 'tempmail.com', 'temp-mail.org', 'throwawaymail.com',
  'yopmail.com', 'getnada.com', 'trashmail.com', 'maildrop.cc', 'dispostable.com',
  'fakeinbox.com', 'mailnesia.com', 'mohmal.com', 'emailondeck.com', 'moakt.com',
  'tempmailo.com', 'mintemail.com', 'spamgourmet.com', 'mailcatch.com', 'inboxbear.com',
  ...(process.env.DISPOSABLE_EMAIL_DOMAINS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
]);

function isDisposableEmail(e) {
  const domain = String(e).toLowerCase().split('@')[1] || '';
  return DISPOSABLE_DOMAINS.has(domain);
}

// Simple in-memory sliding-window rate limiter (per IP).
// Resets on cold start — fine for abuse mitigation, not for strict SLA.
const rateBuckets = new Map();
const RATE_LIMIT = 5;              // max attempts
const RATE_WINDOW_MS = 60 * 60_000; // 1 hour

// Comma-separated list of IPs (v4/v6) exempt from the rate limit.
// Set RATE_LIMIT_ALLOWLIST in Vercel env vars — no redeploy needed after change.
const ALLOWLIST = new Set(
  (process.env.RATE_LIMIT_ALLOWLIST || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

function checkRateLimit(ip) {
  if (!ip) return true;
  if (ALLOWLIST.has(ip)) return true;
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

async function sendWelcomeEmail(email) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  await createTransport().sendMail({
    from: `"Proper Selects" <${GMAIL_USER}>`,
    to: email,
    subject: 'You\'re in — the best DJ sets on the internet, every Monday',
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
            You're in. ✓
          </h1>
          <p style="font-size:15px;line-height:1.5;margin:20px 0 32px;color:rgba(237,234,226,.65);">
            Every Monday you'll get the best new sets added to the vault — straight to your inbox. No noise, no algorithms.
          </p>

          <!-- CTA -->
          <a href="${SITE_URL}" style="display:inline-block;padding:16px 44px;background:#F4A93C;color:#0a0a0e;border-radius:10px;font-weight:900;font-size:15px;text-decoration:none;letter-spacing:.06em;text-transform:uppercase;box-shadow:0 4px 20px rgba(244,169,60,.4);">
            ▷ Browse the vault
          </a>
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

  // POST /api/subscribe with { kind: 'b2b_inquiry' } — Event Hospitality Portal order.
  // Folded in here (not a separate function) to stay under the Hobby 12-function cap.
  if (req.method === 'POST') {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch { b = {}; } }
    if (b && b.kind === 'b2b_inquiry') return handleB2BInquiry(b, res);
  }

  // GET /api/subscribe?whoami=1 — echo caller IP so it can be added to allowlist
  if (req.method === 'GET' && req.query.whoami === '1') {
    const ip = getClientIp(req);
    return res.json({ ip, allowlisted: ALLOWLIST.has(ip) });
  }

  // GET /api/subscribe?stats=1 — aggregate counts for internal reporting
  if (req.method === 'GET' && req.query.stats === '1') {
    if (!SUPABASE_KEY) return res.status(500).json({ error: 'Missing config' });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [subsTotal, subsConfirmed, subsThisWeek, sets, venues, lineupsTotal, lineupsToday] = await Promise.all([
      getCount('subscribers?unsubscribed_at=is.null'),
      getCount('subscribers?confirmed=eq.true&unsubscribed_at=is.null'),
      getCount(`subscribers?created_at=gte.${encodeURIComponent(weekAgo)}&unsubscribed_at=is.null`),
      getCount('sets?status=eq.live'),
      getCount('festivals?active=eq.true'),
      getCount('lineups?slug=not.is.null'),
      getCount(`lineups?created_at=gte.${encodeURIComponent(dayAgo)}`),
    ]);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.json({ subsTotal, subsConfirmed, subsThisWeek, sets, venues, lineupsTotal, lineupsToday });
  }



  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 5 requests per hour per IP
  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many requests. Try again later.' });
  }

  const { email, website, source } = req.body || {};

  // Honeypot — bots fill hidden fields, humans don't
  if (website) return res.status(200).json({ ok: true, message: 'Check your email to confirm' });

  // Sanitize source tag (where the signup came from) — short slug only
  const src = typeof source === 'string' && source.trim()
    ? source.trim().slice(0, 40).replace(/[^\w.-]/g, '')
    : null;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Block disposable/throwaway addresses — respond like the honeypot so bots get no signal
  if (isDisposableEmail(email)) {
    return res.status(200).json({ ok: true, message: 'Check your email to confirm' });
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
    return res.status(200).json({ ok: true, message: 'Already subscribed' });
  }

  // Insert new subscriber — auto-confirmed, no email click required
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
      confirmed: true,
      unsubscribed_at: null,
      ...(src ? { source: src } : {}),
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    console.error('Subscribe error:', err);
    return res.status(500).json({ error: 'Failed to save subscription' });
  }

  await sendWelcomeEmail(normalizedEmail).catch(console.error);

  // Fire-and-forget: send this week's digest to the new subscriber immediately
  const [row] = await r.json().catch(() => [null]);
  if (row?.id) {
    Promise.all([getNewSets(), getTopLineupSets(), getTopIds(), getRadarSets()])
      .then(([newSets, lineupSets, topIds, radarSets]) => {
        if (!newSets.length && !lineupSets.length) return;
        const data = { newSets, lineupSets, topIds, radarSets, newCount: newSets.length };
        const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        return createTransport().sendMail({
          from: `"Proper Selects" <${GMAIL_USER}>`,
          to: normalizedEmail,
          subject: `Proper Selects — Weekly Drop (${week})`,
          html: buildEmail(data, row.id),
        });
      })
      .catch(console.error);
  }

  return res.status(200).json({ ok: true, message: "You're in" });
}

// ── Event Hospitality Portal (/stays/b2b) inquiry → email 4TC + PS ──
const _esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const _money = (n) => '$' + Number(n || 0).toLocaleString();

async function handleB2BInquiry(body, res) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return res.status(500).json({ error: 'Email not configured' });
  const {
    prodCo = '', eventName = '', checkIn = '', checkOut = '', nights = '',
    headcount = '', subtotal = 0, fee = 0, total = 0, lines = [],
    contactName = '', contactEmail = '', source = 'b2b',
  } = body;
  if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ error: 'Empty order' });
  const isVIP = source === 'vip';
  const kindLabel = isVIP ? 'VIP concierge inquiry' : 'concierge inquiry';

  const rows = lines.map((l) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;">
        ${_esc(l.name)}${l.party ? ` <span style="color:#888;font-size:12px;">(${_esc(l.party)})</span>` : ''}
        ${l.mgr ? `<div style="color:#999;font-size:12px;">${_esc(l.mgr)}</div>` : ''}
        <div style="color:#999;font-size:12px;">${_esc(l.sub || '')}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;text-align:right;white-space:nowrap;">${_money(l.v)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f5f5f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:28px 14px;"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e6e6;">
        <tr><td style="background:#0a0a0f;padding:22px 24px;">
          <div style="color:#F4A93C;font-weight:800;letter-spacing:.04em;font-size:13px;">PROPER SELECTS · EVENT HOSPITALITY</div>
          <div style="color:#fff;font-size:20px;font-weight:700;margin-top:6px;">New ${kindLabel}</div>
          <div style="color:#9aa0ad;font-size:13px;margin-top:2px;">Powered by 4TC Concierge Hospitality Group</div>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" style="font-size:14px;color:#111;">
            <tr><td style="padding:4px 0;color:#666;width:150px;">Company / Group</td><td style="padding:4px 0;font-weight:600;">${_esc(prodCo) || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Event</td><td style="padding:4px 0;font-weight:600;">${_esc(eventName) || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Dates</td><td style="padding:4px 0;font-weight:600;">${_esc(checkIn)} → ${_esc(checkOut)} (${_esc(nights)} nights)</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Headcount</td><td style="padding:4px 0;font-weight:600;">${_esc(headcount) || '—'}</td></tr>
            <tr><td colspan="2" style="padding-top:10px;border-top:1px solid #eee;"></td></tr>
            <tr><td style="padding:4px 0;color:#666;">Contact</td><td style="padding:4px 0;font-weight:600;">${_esc(contactName) || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Email</td><td style="padding:4px 0;font-weight:600;">${_esc(contactEmail)}</td></tr>
          </table>
          <div style="font-weight:700;font-size:14px;margin:18px 0 6px;color:#111;">Order</div>
          <table role="presentation" width="100%" style="border-collapse:collapse;">${rows}</table>
          <table role="presentation" width="100%" style="margin-top:14px;font-size:14px;color:#111;">
            <tr><td style="padding:4px 0;color:#666;">Subtotal</td><td style="padding:4px 0;text-align:right;">${_money(subtotal)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">4TC concierge fee (15%)</td><td style="padding:4px 0;text-align:right;">${_money(fee)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:800;font-size:17px;border-top:2px solid #111;">Order total (est.)</td><td style="padding:8px 0;font-weight:800;font-size:17px;text-align:right;border-top:2px solid #111;color:#c8860f;">${_money(total)}</td></tr>
          </table>
          <div style="color:#999;font-size:12px;margin-top:14px;">Estimate only — a 4TC coordinator confirms vendor availability and returns a signed quote within 24h.</div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  try {
    const info = await createTransport().sendMail({
      from: `"Proper Selects × 4TC" <${GMAIL_USER}>`,
      to: 'contact@4tcproductions.com',
      cc: 'proper.selects@gmail.com',
      replyTo: contactEmail || undefined,
      subject: `New ${kindLabel} — ${prodCo || 'Guest'} (${checkIn || 'dates TBD'}) · ${_money(total)}`,
      html,
    });
    return res.status(200).json({ ok: true, id: info.messageId });
  } catch (e) {
    return res.status(500).json({ error: 'Send failed' });
  }
}
