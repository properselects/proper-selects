// GET /api/digest — send the weekly Proper Selects email digest
// Triggered by Vercel cron: every Monday at 9AM CT (14:00 UTC)
import nodemailer from 'nodemailer';
import { getNewSets, getTopLineupSets, getTopIds, getRadarSets, buildEmail } from '../lib/digest-builder.js';

export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.SITE_URL || 'https://proper-selects.vercel.app';

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function getConfirmedSubscribers() {
  return sb(`subscribers?confirmed=eq.true&unsubscribed_at=is.null&select=id,email`);
}

// ── Venue report (monthly, folded in to stay under 12-function limit) ──────────

async function getVenuePartners() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/festivals?contact_email=not.is.null&select=id,name,city,country,accent,ticket_url,contact_email&active=eq.true`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function getVenueStats(festivalId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [sets, lineups] = await Promise.all([
    sb(`vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=video_id`),
    sb(`lineups?created_at=gte.${encodeURIComponent(since)}&select=video_ids`),
  ]);
  const venueIds = new Set(sets.map(s => s.video_id));
  const lineupInclusions = lineups.filter(l => (l.video_ids || []).some(id => venueIds.has(id))).length;
  const topSets = await sb(`vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=artist,video_id&limit=3`);
  return { setCount: sets.length, lineupInclusions, topSets };
}

function buildVenueEmail(venue, stats) {
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const accent = venue.accent || '#F4A93C';
  const setsHtml = stats.topSets.map(s => `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:#EDEAE2;">${s.artist}</div>`).join('');
  return `<!doctype html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#0a0a0e;">
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#0a0a0e;color:#EDEAE2;">
  <div style="font-weight:800;letter-spacing:.16em;font-size:13px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);">PROPER SELECTS <span style="opacity:.4;font-size:10px;letter-spacing:.3em;">VENUE REPORT</span></div>
  <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">${venue.name}</h1>
  <p style="opacity:.5;font-size:12px;margin:0 0 28px;text-transform:uppercase;">${month} Discovery Report</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:28px;">
    <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,.08);">
      <div style="font-size:32px;font-weight:800;color:${accent};">${stats.setCount}</div>
      <div style="font-size:11px;opacity:.5;margin-top:4px;">Sets in the vault</div>
    </div>
    <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:16px;border:1px solid rgba(255,255,255,.08);">
      <div style="font-size:32px;font-weight:800;color:${accent};">${stats.lineupInclusions}</div>
      <div style="font-size:11px;opacity:.5;margin-top:4px;">Lineups built this month</div>
    </div>
  </div>
  ${stats.topSets.length ? `<div style="font-size:10px;font-weight:800;letter-spacing:.18em;opacity:.4;margin-bottom:12px;">YOUR SETS</div>${setsHtml}` : ''}
  <div style="text-align:center;margin-top:32px;">
    <a href="${SITE_URL}" style="display:inline-block;padding:12px 28px;background:${accent};color:#0a0a0e;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;">View on Proper Selects →</a>
  </div>
</div></body></html>`;
}

async function sendVenueReports(res) {
  const venues = await getVenuePartners();
  if (!venues.length) return res.status(200).json({ ok: true, sent: 0, message: 'No venue contacts on file' });
  const transport = createTransport();
  let sent = 0; const errors = [];
  for (const venue of venues) {
    try {
      const stats = await getVenueStats(venue.id);
      await transport.sendMail({ from: `"Proper Selects" <${GMAIL_USER}>`, to: venue.contact_email, subject: `${venue.name} — Your Proper Selects Report`, html: buildVenueEmail(venue, stats) });
      sent++;
    } catch (e) { errors.push({ venue: venue.id, error: e.message }); }
  }
  return res.status(200).json({ ok: true, sent, errors });
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Gmail credentials not configured' });
  }

  // venue-report mode — triggered by monthly cron via ?mode=venues
  if (req.query?.mode === 'venues') {
    return sendVenueReports(res);
  }

  const [newSets, lineupSets, topIds, radarSets, subscribers] = await Promise.all([
    getNewSets(),
    getTopLineupSets(),
    getTopIds(),
    getRadarSets(),
    getConfirmedSubscribers(),
  ]);

  if (!newSets.length && !lineupSets.length) {
    return res.status(200).json({ ok: true, message: 'No content for digest this week' });
  }
  if (!subscribers.length) {
    return res.status(200).json({ ok: true, message: 'No confirmed subscribers yet' });
  }

  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const data = { newSets, lineupSets, topIds, radarSets, newCount: newSets.length };
  let sent = 0, failed = 0;
  const transport = createTransport();

  for (const sub of subscribers) {
    try {
      await transport.sendMail({
        from: `"Proper Selects" <${GMAIL_USER}>`,
        to: sub.email,
        subject: `Proper Selects — Weekly Drop (${week})`,
        html: buildEmail(data, sub.id),
      });
      sent++;
    } catch { failed++; }
  }

  await fetch(`${SUPABASE_URL}/rest/v1/subscribers?confirmed=eq.true&unsubscribed_at=is.null`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ last_sent_at: new Date().toISOString() }),
  });

  return res.status(200).json({ ok: true, sent, failed, total: subscribers.length });
}
