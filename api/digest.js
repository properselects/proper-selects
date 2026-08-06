// GET /api/digest — send the weekly Proper Selects email digest
// Triggered by Vercel cron: every Monday at 9AM CT (14:00 UTC)
import nodemailer from 'nodemailer';

export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

async function getNewSets() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/public_sets?published_at=gte.${since}&select=video_id,artist,festival_id,city,accent&order=published_at.desc&limit=8`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return r.ok ? r.json() : [];
}

async function getTopSet() {
  // Most recently featured set from vault
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/public_sets?select=video_id,artist,festival_id,city&order=published_at.desc&limit=1`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

async function getConfirmedSubscribers() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/subscribers?confirmed=eq.true&unsubscribed_at=is.null&select=id,email`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  return r.ok ? r.json() : [];
}

function setCard(s) {
  const thumb = `https://img.youtube.com/vi/${s.video_id}/hqdefault.jpg`;
  const url = `https://proper-selects.vercel.app`;
  const accent = s.accent || '#F4A93C';
  return `
    <a href="${url}" style="display:block;text-decoration:none;margin-bottom:16px;border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;background:rgba(255,255,255,.03);">
      <img src="${thumb}" alt="${s.artist}" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;">
      <div style="padding:12px 14px;">
        <div style="font-size:13px;font-weight:700;color:#EDEAE2;margin-bottom:3px;">${s.artist}</div>
        <div style="font-size:11px;color:${accent};opacity:.8;">${s.festival_id || ''}${s.city ? ' · ' + s.city : ''}</div>
      </div>
    </a>`;
}

function buildEmail(sets, unsubToken) {
  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const unsubUrl = `https://proper-selects.vercel.app/api/unsubscribe?token=${unsubToken}`;
  const setCards = sets.slice(0, 5).map(setCard).join('');
  const count = sets.length;

  return `
    <!doctype html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#0a0a0e;">
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#0a0a0e;color:#EDEAE2;">

        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);">
          <span style="font-weight:800;letter-spacing:.16em;font-size:13px;">PROPER SELECTS</span>
          <span style="opacity:.4;font-size:10px;letter-spacing:.3em;">WEEKLY DROP</span>
        </div>

        <h1 style="font-size:24px;font-weight:800;margin:0 0 6px;line-height:1.2;">New this week</h1>
        <p style="opacity:.5;font-size:12px;margin:0 0 28px;letter-spacing:.06em;text-transform:uppercase;">${week} · ${count} new set${count !== 1 ? 's' : ''} in the vault</p>

        ${setCards}

        <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,.08);">
          <a href="https://proper-selects.vercel.app" style="display:inline-block;padding:12px 32px;background:#F4A93C;color:#0a0a0e;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:.04em;">
            Open the vault →
          </a>
        </div>

        <p style="text-align:center;opacity:.3;font-size:11px;margin-top:28px;">
          <a href="${unsubUrl}" style="color:inherit;">Unsubscribe</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

export default async function handler(req, res) {
  // Verify cron secret to prevent abuse
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Gmail credentials not configured' });
  }

  const [newSets, subscribers] = await Promise.all([getNewSets(), getConfirmedSubscribers()]);

  if (!newSets.length) {
    return res.status(200).json({ ok: true, message: 'No new sets this week, skipping digest' });
  }
  if (!subscribers.length) {
    return res.status(200).json({ ok: true, message: 'No confirmed subscribers yet' });
  }

  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  let sent = 0, failed = 0;
  const transport = createTransport();

  for (const sub of subscribers) {
    const html = buildEmail(newSets, sub.id);
    try {
      await transport.sendMail({
        from: `"Proper Selects" <${GMAIL_USER}>`,
        to: sub.email,
        subject: `Proper Selects — New sets this week (${week})`,
        html,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  // Update last_sent_at on all confirmed subscribers
  await fetch(`${SUPABASE_URL}/rest/v1/subscribers?confirmed=eq.true&unsubscribed_at=is.null`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_sent_at: new Date().toISOString() }),
  });

  return res.status(200).json({ ok: true, sent, failed, total: subscribers.length });
}
