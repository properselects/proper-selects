// Serverless endpoint for the /stays/b2b Event Hospitality Portal.
// Emails a formatted concierge order/inquiry to 4TC + a copy to Proper Selects.
import nodemailer from 'nodemailer';

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

const INQUIRY_TO = 'contact@4tcproductions.com';
const INQUIRY_CC = 'proper.selects@gmail.com';

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const money = (n) => '$' + Number(n || 0).toLocaleString();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    return res.status(500).json({ error: 'Email not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const {
    prodCo = '', eventName = '', checkIn = '', checkOut = '', nights = '',
    headcount = '', subtotal = 0, fee = 0, total = 0, lines = [],
    contactName = '', contactEmail = '', contactPhone = '',
  } = body;

  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: 'Empty order' });
  }

  const rows = lines.map((l) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;">
        ${esc(l.name)}${l.party ? ` <span style="color:#888;font-size:12px;">(${esc(l.party)})</span>` : ''}
        ${l.mgr ? `<div style="color:#999;font-size:12px;">${esc(l.mgr)}</div>` : ''}
        <div style="color:#999;font-size:12px;">${esc(l.sub || '')}</div>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:14px;color:#111;text-align:right;white-space:nowrap;">${money(l.v)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><body style="margin:0;background:#f5f5f0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f0;padding:28px 14px;"><tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e6e6e6;">
        <tr><td style="background:#0a0a0f;padding:22px 24px;">
          <div style="color:#F4A93C;font-weight:800;letter-spacing:.04em;font-size:13px;">PROPER SELECTS · EVENT HOSPITALITY</div>
          <div style="color:#fff;font-size:20px;font-weight:700;margin-top:6px;">New concierge inquiry</div>
          <div style="color:#9aa0ad;font-size:13px;margin-top:2px;">Powered by 4TC Concierge Hospitality Group</div>
        </td></tr>
        <tr><td style="padding:20px 24px;">
          <table role="presentation" width="100%" style="font-size:14px;color:#111;">
            <tr><td style="padding:4px 0;color:#666;width:150px;">Company / Group</td><td style="padding:4px 0;font-weight:600;">${esc(prodCo) || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Event</td><td style="padding:4px 0;font-weight:600;">${esc(eventName) || '—'}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Dates</td><td style="padding:4px 0;font-weight:600;">${esc(checkIn)} → ${esc(checkOut)} (${esc(nights)} nights)</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Headcount</td><td style="padding:4px 0;font-weight:600;">${esc(headcount) || '—'}</td></tr>
            ${contactName || contactEmail || contactPhone ? `
            <tr><td colspan="2" style="padding-top:10px;border-top:1px solid #eee;"></td></tr>
            <tr><td style="padding:4px 0;color:#666;">Contact</td><td style="padding:4px 0;font-weight:600;">${esc(contactName)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Email</td><td style="padding:4px 0;font-weight:600;">${esc(contactEmail)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">Phone</td><td style="padding:4px 0;font-weight:600;">${esc(contactPhone)}</td></tr>` : ''}
          </table>

          <div style="font-weight:700;font-size:14px;margin:18px 0 6px;color:#111;">Order</div>
          <table role="presentation" width="100%" style="border-collapse:collapse;">${rows}</table>

          <table role="presentation" width="100%" style="margin-top:14px;font-size:14px;color:#111;">
            <tr><td style="padding:4px 0;color:#666;">Subtotal</td><td style="padding:4px 0;text-align:right;">${money(subtotal)}</td></tr>
            <tr><td style="padding:4px 0;color:#666;">4TC concierge fee (15%)</td><td style="padding:4px 0;text-align:right;">${money(fee)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:800;font-size:17px;border-top:2px solid #111;">Order total (est.)</td><td style="padding:8px 0;font-weight:800;font-size:17px;text-align:right;border-top:2px solid #111;color:#c8860f;">${money(total)}</td></tr>
          </table>
          <div style="color:#999;font-size:12px;margin-top:14px;">Estimate only — a 4TC coordinator confirms vendor availability and returns a signed quote within 24h.</div>
        </td></tr>
      </table>
    </td></tr></table>
  </body></html>`;

  try {
    const info = await createTransport().sendMail({
      from: `"Proper Selects × 4TC" <${GMAIL_USER}>`,
      to: INQUIRY_TO,
      cc: INQUIRY_CC,
      replyTo: contactEmail || undefined,
      subject: `New concierge inquiry — ${prodCo || 'Group'} (${checkIn || 'dates TBD'}) · ${money(total)}`,
      html,
    });
    return res.status(200).json({ ok: true, id: info.messageId });
  } catch (e) {
    return res.status(500).json({ error: 'Send failed' });
  }
}
