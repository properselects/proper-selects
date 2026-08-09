// GET /api/venue-report — send monthly discovery reports to partner venues
// Triggered by Vercel cron: 1st of each month at 10am CT (15:00 UTC)
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

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

async function getVenueStats(festivalId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Count sets in vault
  const sets = await sbGet(`vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=video_id`);

  // Count how many lineups include this venue's sets in the last 30 days
  const lineups = await sbGet(`lineups?created_at=gte.${encodeURIComponent(since)}&select=video_ids,set_metadata`);
  const venueSetIds = new Set(sets.map(s => s.video_id));
  let lineupInclusions = 0;
  for (const l of lineups) {
    if ((l.video_ids || []).some(id => venueSetIds.has(id))) lineupInclusions++;
  }

  // Top set by title
  const topSets = await sbGet(`vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=artist,video_id&limit=3`);

  return { setCount: sets.length, lineupInclusions, topSets };
}

function buildVenueEmail(venue, stats) {
  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const accent = venue.accent || '#F4A93C';

  const setsHtml = stats.topSets.slice(0, 3).map(s =>
    `<div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06);font-size:13px;color:#EDEAE2;">${s.artist}</div>`
  ).join('');

  return `<!doctype html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0e;">
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#0a0a0e;color:#EDEAE2;">

  <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);">
    <span style="font-weight:800;letter-spacing:.16em;font-size:13px;">PROPER SELECTS</span>
    <span style="opacity:.4;font-size:10px;letter-spacing:.3em;">VENUE REPORT</span>
  </div>

  <h1 style="font-size:22px;font-weight:800;margin:0 0 6px;">${venue.name}</h1>
  <p style="opacity:.5;font-size:12px;margin:0 0 28px;letter-spacing:.06em;text-transform:uppercase;">${month} Discovery Report</p>

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

  ${stats.topSets.length ? `
  <div style="font-size:10px;font-weight:800;letter-spacing:.18em;opacity:.4;margin-bottom:12px;">YOUR SETS ON PROPER SELECTS</div>
  ${setsHtml}
  ` : ''}

  <div style="margin-top:28px;padding:16px;background:rgba(255,255,255,.04);border-radius:10px;border:1px solid rgba(255,255,255,.08);">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;">Want more visibility?</div>
    <p style="font-size:12px;opacity:.6;margin:0 0 12px;line-height:1.6;">Add a promo code or ticket link to your Proper Selects profile. It shows up on the Atlas map whenever someone taps your venue.</p>
    <a href="mailto:brian@proper-selects.com?subject=Venue%20Partnership%20-%20${encodeURIComponent(venue.name)}" style="font-size:12px;font-weight:800;color:${accent};text-decoration:none;">Get in touch →</a>
  </div>

  <div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid rgba(255,255,255,.08);">
    <a href="https://proper-selects.vercel.app" style="display:inline-block;padding:12px 28px;background:${accent};color:#0a0a0e;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;">
      View on Proper Selects →
    </a>
  </div>

  <p style="text-align:center;opacity:.3;font-size:11px;margin-top:24px;">
    You're receiving this because your venue is featured on Proper Selects.<br>
    <a href="mailto:brian@proper-selects.com?subject=Remove%20${encodeURIComponent(venue.name)}" style="color:inherit;">Remove my venue</a>
  </p>
</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Gmail credentials not configured' });
  }

  // Get all venues with a contact_email set
  const venues = await sbGet(`festivals?contact_email=not.is.null&select=id,name,city,country,accent,ticket_url,contact_email&active=eq.true`);

  if (!venues.length) {
    return res.status(200).json({ ok: true, sent: 0, message: 'No venue contacts on file yet' });
  }

  const transport = createTransport();
  let sent = 0;
  const errors = [];

  for (const venue of venues) {
    try {
      const stats = await getVenueStats(venue.id);
      const html = buildVenueEmail(venue, stats);
      await transport.sendMail({
        from: `"Proper Selects" <${GMAIL_USER}>`,
        to: venue.contact_email,
        subject: `${venue.name} — Your Proper Selects Report`,
        html,
      });
      sent++;
    } catch (e) {
      errors.push({ venue: venue.id, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, sent, errors });
}
