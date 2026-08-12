// Shared digest data fetchers and email builder — used by api/digest.js and api/subscribe.js

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_SEARCH_KEY || process.env.YOUTUBE_API_KEY;
const SITE_URL = process.env.SITE_URL || 'https://proper-selects.vercel.app';

async function sb(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return r.ok ? r.json() : [];
}

export async function getNewSets() {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  return sb(`vault_sets?published_at=gte.${encodeURIComponent(since)}&source=eq.youtube&duration_sec=gte.2700&select=video_id,artist,festival_name,city,accent&order=published_at.desc&limit=3`);
}

export async function getTopLineupSets() {
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const lineups = await sb(`lineups?created_at=gte.${encodeURIComponent(since)}&select=video_ids&limit=100`);
  if (!lineups.length) return [];
  const counts = {};
  for (const l of lineups) {
    for (const id of (l.video_ids || [])) counts[id] = (counts[id] || 0) + 1;
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  if (!top.length) return [];
  const sets = await sb(`vault_sets?video_id=in.(${top.join(',')})&select=video_id,artist,festival_name,city,accent`);
  return top.map(id => sets.find(s => s.video_id === id)).filter(Boolean);
}

export async function getTopIds() {
  return sb(`set_id_moments?resolved=eq.true&select=video_id,label,t_sec,likes&order=likes.desc&limit=5`);
}

export async function getRadarSets() {
  const now = new Date();
  const qMonth = Math.floor(now.getUTCMonth() / 3) * 3;
  const quarterStart = new Date(Date.UTC(now.getUTCFullYear(), qMonth, 1)).toISOString();
  const pull = (sinceIso, inWindow) =>
    sb(`vault_sets?published_at=gte.${encodeURIComponent(sinceIso)}&source=eq.youtube&duration_sec=gte.2700&select=video_id,artist,festival_name,city,accent&order=published_at.desc&limit=80`)
      .then(rows => rows.map(x => ({ ...x, _inWindow: inWindow })));

  let sets = await pull(quarterStart, true);
  if (sets.length < 6) {
    const since60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const wide = await pull(since60, false);
    const seen = new Set(sets.map(s => s.video_id));
    sets = sets.concat(wide.filter(s => !seen.has(s.video_id)));
  }
  if (!sets.length || !YOUTUBE_API_KEY) return sets.slice(0, 2);
  const ids = sets.map(s => s.video_id).join(',');
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}&key=${YOUTUBE_API_KEY}`);
    const d = r.ok ? await r.json() : { items: [] };
    const views = Object.fromEntries((d.items || []).map(i => [i.id, parseInt(i.statistics?.viewCount || 0)]));
    return sets.map(s => ({ ...s, views: views[s.video_id] || 0 }))
      .sort((a, b) => (Number(b._inWindow) - Number(a._inWindow)) || (b.views - a.views))
      .slice(0, 2);
  } catch { return sets.slice(0, 2); }
}

function formatTs(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(v) {
  if (!v) return null;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M views`;
  if (v >= 1e3) return `${Math.round(v / 1e3)}K views`;
  return `${v} views`;
}

function sectionHeader(label) {
  return `<div style="font-size:10px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;opacity:.4;margin:32px 0 14px;">${label}</div>`;
}

function setCard(s, badge) {
  const thumb = `https://img.youtube.com/vi/${s.video_id}/hqdefault.jpg`;
  const accent = s.accent || '#F4A93C';
  const venueLine = [s.festival_name, s.city].filter(Boolean).join(' · ');
  const badgeHtml = badge ? `<div style="position:absolute;top:10px;left:10px;background:${accent};color:#0a0a0e;font-size:10px;font-weight:800;padding:3px 8px;border-radius:4px;letter-spacing:.06em;">${badge}</div>` : '';
  return `
    <a href="https://www.youtube.com/watch?v=${s.video_id}" style="display:block;text-decoration:none;margin-bottom:12px;border:1px solid rgba(255,255,255,.1);border-radius:10px;overflow:hidden;background:rgba(255,255,255,.03);position:relative;">
      <div style="position:relative;">
        <img src="${thumb}" alt="" style="width:100%;display:block;aspect-ratio:16/9;object-fit:cover;">
        ${badgeHtml}
      </div>
      <div style="padding:11px 14px;">
        <div style="font-size:13px;font-weight:700;color:#EDEAE2;margin-bottom:3px;">${s.artist || ''}</div>
        <div style="font-size:11px;color:${accent};opacity:.8;">${venueLine}</div>
        ${s.views ? `<div style="font-size:10px;opacity:.4;margin-top:4px;">${formatViews(s.views)}</div>` : ''}
      </div>
    </a>`;
}

function idRow(idm, i) {
  return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.05);">
      <span style="font-size:11px;opacity:.3;width:16px;flex-shrink:0;">${i + 1}</span>
      <a href="https://www.youtube.com/watch?v=${idm.video_id}&t=${idm.t_sec}" style="flex:1;text-decoration:none;">
        <div style="font-size:13px;font-weight:700;color:#EDEAE2;">${idm.label}</div>
        <div style="font-size:11px;opacity:.4;margin-top:2px;">ID'd at ${formatTs(idm.t_sec)} &middot; ${idm.likes} ▲</div>
      </a>
    </div>`;
}

export function buildEmail(data, unsubToken) {
  const { newSets, lineupSets, topIds, radarSets, newCount } = data;
  const week = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${unsubToken}`;

  const freshSection = newSets.length ? `
    ${sectionHeader('Fresh this week')}
    ${newSets.map(s => setCard(s)).join('')}
  ` : '';

  const lineupSection = lineupSets.length ? `
    ${sectionHeader('What people are playing')}
    <p style="font-size:12px;opacity:.5;margin:0 0 14px;line-height:1.5;">Sets being added to lineups and shared this week.</p>
    ${lineupSets.map((s, i) => setCard(s, i === 0 ? '#1 IN LINEUPS' : null)).join('')}
  ` : '';

  const idSection = topIds.length ? `
    ${sectionHeader('IDs of the week')}
    <p style="font-size:12px;opacity:.5;margin:0 0 14px;line-height:1.5;">Community-identified tracks — tap a timestamp to hear it.</p>
    ${topIds.map((id, i) => idRow(id, i)).join('')}
  ` : '';

  const radarSection = radarSets.length ? `
    ${sectionHeader('On radar')}
    <p style="font-size:12px;opacity:.5;margin:0 0 14px;line-height:1.5;">Highest-viewed sets this quarter.</p>
    ${radarSets.map(s => setCard(s)).join('')}
  ` : '';

  return `<!doctype html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0e;">
<div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 20px;background:#0a0a0e;color:#EDEAE2;">

  <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:32px;padding-bottom:20px;border-bottom:1px solid rgba(255,255,255,.08);">
    <span style="font-weight:800;letter-spacing:.16em;font-size:13px;">PROPER SELECTS</span>
    <span style="opacity:.4;font-size:10px;letter-spacing:.3em;">WEEKLY DROP</span>
  </div>

  <h1 style="font-size:24px;font-weight:800;margin:0 0 6px;line-height:1.2;">This week in the vault</h1>
  <p style="opacity:.5;font-size:12px;margin:0 0 4px;letter-spacing:.06em;text-transform:uppercase;">${week}</p>
  <p style="opacity:.35;font-size:12px;margin:0 0 0;">${newCount} new set${newCount !== 1 ? 's' : ''} added this week</p>

  ${freshSection}
  ${lineupSection}
  ${idSection}
  ${radarSection}

  <div style="text-align:center;margin-top:36px;padding-top:24px;border-top:1px solid rgba(255,255,255,.08);">
    <a href="${SITE_URL}" style="display:inline-block;padding:12px 32px;background:#F4A93C;color:#0a0a0e;border-radius:8px;font-weight:800;font-size:13px;text-decoration:none;letter-spacing:.04em;">
      Open the vault &rarr;
    </a>
  </div>

  <p style="text-align:center;opacity:.3;font-size:11px;margin-top:28px;">
    <a href="${unsubUrl}" style="color:inherit;">Unsubscribe</a>
  </p>
</div>
</body>
</html>`;
}
