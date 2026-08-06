// POST /api/subscribe — add an email to the Proper Selects weekly digest list
import nodemailer from 'nodemailer';

export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

async function sendConfirmEmail(email, token) {
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return;
  const confirmUrl = `https://proper-selects.vercel.app/api/confirm?token=${token}`;
  await createTransport().sendMail({
    from: `"Proper Selects" <${GMAIL_USER}>`,
    to: email,
    subject: 'Confirm your Proper Selects subscription',
    html: `
      <div style="font-family:'Helvetica Neue',Arial,sans-serif;background:#0a0a0e;color:#EDEAE2;max-width:480px;margin:0 auto;padding:32px 24px;border-radius:12px;">
        <div style="font-weight:800;letter-spacing:.16em;font-size:13px;margin-bottom:24px;">
          PROPER SELECTS <span style="opacity:.5;letter-spacing:.3em;font-size:10px;margin-left:4px;">WEEKLY DROP</span>
        </div>
        <h2 style="font-size:22px;margin:0 0 12px;line-height:1.2;">One click to confirm</h2>
        <p style="opacity:.7;font-size:14px;line-height:1.6;margin:0 0 28px;">
          You're almost in. Confirm your email and you'll get the best new sets in your inbox every Monday.
        </p>
        <a href="${confirmUrl}" style="display:inline-block;padding:12px 28px;background:#F4A93C;color:#0a0a0e;border-radius:8px;font-weight:800;font-size:14px;text-decoration:none;letter-spacing:.04em;">
          Confirm subscription →
        </a>
        <p style="opacity:.4;font-size:11px;margin-top:28px;">If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Upsert subscriber (idempotent — re-subscribing resets token)
  const r = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({
      email: email.toLowerCase().trim(),
      confirmed: false,
      unsubscribed_at: null,
      subscribed_at: new Date().toISOString(),
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
