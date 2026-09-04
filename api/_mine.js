// Shared ID-Radar miner. Reads timestamped track callouts out of a set's YouTube comments and
// stores them in `id_moments` (base table; the set_id_moments VIEW is not insertable). Used by the
// ingest crons (channel/search/trending) at ingest time, and by a weekly backfill sweep.

const TS_RE = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
const UNRESOLVED_RE = /^id\b|\bid\?|what(?:'s|\s+is)?\s+(?:this|that|the\s+track|song)|track\s*id|anyone\s+know/i;

function env() {
  return {
    SB: process.env.SUPABASE_URL,
    KEY: process.env.SUPABASE_SERVICE_KEY,
    YT: process.env.YOUTUBE_SEARCH_KEY || process.env.YOUTUBE_API_KEY,
  };
}
const sbHeaders = (KEY) => ({ apikey: KEY, Authorization: `Bearer ${KEY}` });

async function jget(url, headers) {
  try { const r = await fetch(url, { headers }); return r.ok ? await r.json() : null; } catch { return null; }
}

// Parse one comment's lines → [{t_sec, label, resolved}]
function parseComment(text) {
  const out = [];
  for (const line of String(text || '').split('\n')) {
    const ts = line.match(TS_RE);
    if (!ts) continue;
    const t_sec = (parseInt(ts[1] || 0) * 3600) + (parseInt(ts[2]) * 60) + parseInt(ts[3]);
    if (t_sec < 30) continue; // skip intro / 0:00
    let after = line.slice(line.indexOf(ts[0]) + ts[0].length).replace(/^[\s.·•\-–—)\]|:>»]+/, '').trim();
    after = after.replace(/\s+/g, ' ').slice(0, 120);
    if (after.length < 2 || !/[a-z]/i.test(after)) continue;
    const isID = UNRESOLVED_RE.test(after) || /^id\s*[-–—]?\s*id?$/i.test(after);
    out.push({ t_sec, label: isID ? 'ID?' : after, resolved: !isID });
  }
  return out;
}

// Mine one video's comments → moment rows for a given set_id (or [] if nothing usable)
async function mineVideo(video_id, set_id, YT) {
  // Pull replies inline too (part=replies gives up to 5 per thread) — tracklists are very often
  // posted as a REPLY to a "track ID?" comment, which a top-level-only scan would miss entirely.
  // For threads with more than 5 replies, do a follow-up comments.list call to get them all.
  const data = await jget(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${video_id}&order=relevance&maxResults=100&key=${YT}`);
  if (!data) return [];
  const comments = [];
  for (const it of (data.items || [])) {
    const top = it.snippet?.topLevelComment?.snippet;
    comments.push({ lines: parseComment(top?.textOriginal || ''), likes: top?.likeCount || 0 });
    const inlineReplies = it.replies?.comments || [];
    const totalReplyCount = it.snippet?.totalReplyCount || 0;
    for (const rep of inlineReplies) {
      const rs = rep.snippet;
      comments.push({ lines: parseComment(rs?.textOriginal || ''), likes: rs?.likeCount || 0 });
    }
    // If the thread has more replies than the API returned inline (>5), fetch all of them
    if (totalReplyCount > inlineReplies.length) {
      const threadId = it.snippet?.topLevelComment?.id;
      if (threadId) {
        const allReplies = await jget(`https://www.googleapis.com/youtube/v3/comments?part=snippet&parentId=${encodeURIComponent(threadId)}&maxResults=100&key=${YT}`);
        const seen = new Set(inlineReplies.map((r) => r.id));
        for (const rep of (allReplies?.items || [])) {
          if (seen.has(rep.id)) continue;
          const rs = rep.snippet;
          comments.push({ lines: parseComment(rs?.textOriginal || ''), likes: rs?.likeCount || 0 });
        }
      }
    }
  }
  // Prefer the single richest tracklist comment; else merge scattered individual IDs.
  let best = null;
  for (const c of comments) if (c.lines.length >= 3 && (!best || c.lines.length > best.lines.length)) best = c;
  const chosen = best ? [best] : comments;
  const seen = new Set();
  const rows = [];
  for (const c of chosen) {
    for (const m of c.lines) {
      const k = m.t_sec + '|' + m.label.toLowerCase();
      if (seen.has(k)) continue; seen.add(k);
      rows.push({ set_id, t_sec: m.t_sec, label: m.label, resolved: m.resolved, likes: c.likes, source: 'comment' });
    }
  }
  return rows;
}

async function insertMoments(rows, SB, KEY) {
  if (!rows.length) return 0;
  try {
    const r = await fetch(`${SB}/rest/v1/id_moments`, {
      method: 'POST',
      headers: { ...sbHeaders(KEY), 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(rows),
    });
    return r.ok ? rows.length : 0;
  } catch { return 0; }
}

// Resolve set ids for a list of video ids, mine each, store. Self-contained; never throws.
export async function mineAndStore(videoIds, cap = 25) {
  const { SB, KEY, YT } = env();
  if (!SB || !KEY || !YT || !videoIds?.length) return 0;
  const ids = [...new Set(videoIds)].slice(0, cap);
  const map = {};
  const rows = await jget(`${SB}/rest/v1/sets?select=id,video_id&video_id=in.(${ids.join(',')})`, sbHeaders(KEY));
  (rows || []).forEach((r) => { map[r.video_id] = r.id; });
  let total = 0;
  for (const vid of ids) {
    const set_id = map[vid];
    if (!set_id) continue;
    const moments = await mineVideo(vid, set_id, YT);
    total += await insertMoments(moments, SB, KEY);
  }
  return total;
}

// Store pre-parsed moments that carry a video_id (e.g. description / YouTube-Music IDs) — resolves
// each to its set_id and writes to id_moments. Self-contained; never throws.
export async function storeMomentsByVideo(moments) {
  const { SB, KEY } = env();
  if (!SB || !KEY || !moments?.length) return 0;
  const vids = [...new Set(moments.map((m) => m.video_id))];
  const map = {};
  const rows = await jget(`${SB}/rest/v1/sets?select=id,video_id&video_id=in.(${vids.join(',')})`, sbHeaders(KEY));
  (rows || []).forEach((r) => { map[r.video_id] = r.id; });
  const payload = moments.filter((m) => map[m.video_id]).map((m) => ({
    set_id: map[m.video_id], t_sec: m.t_sec, label: m.label, resolved: m.resolved, likes: m.likes || 0, source: m.source || 'comment',
  }));
  return insertMoments(payload, SB, KEY);
}

// Weekly sweep: mine up to `limit` live sets that still have zero IDs. Self-contained.
export async function backfillMissing(limit = 120) {
  const { SB, KEY, YT } = env();
  if (!SB || !KEY || !YT) return { swept: 0, moments: 0 };
  const have = new Set((await jget(`${SB}/rest/v1/id_moments?select=set_id&limit=100000`, sbHeaders(KEY)) || []).map((x) => x.set_id));
  const sets = await jget(`${SB}/rest/v1/sets?select=id,video_id&status=eq.live&source=eq.youtube&order=created_at.desc&limit=5000`, sbHeaders(KEY)) || [];
  const missing = sets.filter((s) => s.video_id && !have.has(s.id)).slice(0, limit);
  let moments = 0;
  for (const s of missing) {
    const rows = await mineVideo(s.video_id, s.id, YT);
    moments += await insertMoments(rows, SB, KEY);
  }
  return { swept: missing.length, moments };
}
