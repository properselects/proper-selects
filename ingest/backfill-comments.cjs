// Backfill ID Radar: mine YouTube comments for timestamped track callouts on sets that have none.
// The live ingest only mines comments for newly-inserted CHANNEL sets (capped) — search/trending
// sets (RAW CUTS, Club Space, etc.) were never mined. Re-runnable; only touches sets with 0 IDs.
// Writes to the base table `id_moments` (set_id, t_sec, label, resolved, likes, source).
//
// Usage:
//   node backfill-comments.cjs --video=VIDEO_ID
//   node backfill-comments.cjs --region=americas --limit=300
//   node backfill-comments.cjs --all --limit=1500
//   add --dry to preview without writing
const fs = require('fs');
const SB = 'https://bcodfuggztfosuzsyyla.supabase.co';
const SVC = fs.readFileSync('/tmp/ps_svc.txt', 'utf8').trim();
const YT = process.env.YT_KEY || 'AIzaSyAxhobAGoVMmXTokIyY0JEtioKngH23YnU';

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true];
}));
const DRY = !!args.dry;

const TS_RE = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
const UNRESOLVED_RE = /^id\b|\bid\?|what(?:'s|\s+is)?\s+(?:this|that|the\s+track|song)|track\s*id|anyone\s+know/i;

async function jget(url, headers) {
  const r = await fetch(url, { headers });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}
const sb = (path) => jget(`${SB}/rest/v1/${path}`, { apikey: SVC, Authorization: `Bearer ${SVC}` });

// Mine one video's comments → array of {t_sec, label, resolved, likes, source}
async function mine(video_id) {
  const r = await jget(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video_id}&order=relevance&maxResults=100&key=${YT}`);
  if (!r.ok) return [];
  const comments = (r.json.items || []).map(it => ({
    text: it.snippet?.topLevelComment?.snippet?.textOriginal || '',
    likes: it.snippet?.topLevelComment?.snippet?.likeCount || 0,
  }));

  const parseLines = (text, likes) => {
    const out = [];
    for (const line of text.split('\n')) {
      const ts = line.match(TS_RE);
      if (!ts) continue;
      const t_sec = (parseInt(ts[1] || 0) * 3600) + (parseInt(ts[2]) * 60) + parseInt(ts[3]);
      if (t_sec < 30) continue; // skip intro / 0:00
      let after = line.slice(line.indexOf(ts[0]) + ts[0].length).replace(/^[\s.·•\-–—)\]]+/, '').trim();
      after = after.replace(/\s+/g, ' ').slice(0, 120);
      if (after.length < 2 || !/[a-z]/i.test(after)) continue;
      const isID = UNRESOLVED_RE.test(after) || /^id\s*[-–—]?\s*id?$/i.test(after);
      out.push({ t_sec, label: isID ? 'ID?' : after, resolved: !isID, likes, source: 'comment' });
    }
    return out;
  };

  // Prefer the single richest tracklist comment (most timestamped lines); fall back to merging
  // scattered individual-ID comments if no full list exists.
  let best = null;
  for (const c of comments) {
    const lines = parseLines(c.text, c.likes);
    if (lines.length >= 3 && (!best || lines.length > best.length)) best = lines;
  }
  let moments = best || comments.flatMap(c => parseLines(c.text, c.likes));

  const seen = new Set();
  return moments.filter(m => { const k = m.t_sec + '|' + m.label.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function insertMoments(rows) {
  if (DRY || !rows.length) return rows.length;
  const r = await fetch(`${SB}/rest/v1/id_moments`, {
    method: 'POST',
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  });
  if (!r.ok) { console.error('  insert failed', r.status, (await r.text().catch(() => '')).slice(0, 160)); return 0; }
  return rows.length;
}

(async () => {
  let candidates = [];
  if (args.video) {
    const s = (await sb(`sets?select=id,video_id&video_id=eq.${args.video}`)).json || [];
    candidates = s.map(r => ({ set_id: r.id, video_id: r.video_id }));
  } else {
    const vibe = args.region ? `&vibe=eq.${args.region}` : '';
    const vrows = (await sb(`vault_sets?select=video_id${vibe}&order=published_at.desc&limit=5000`)).json || [];
    const idmap = {};
    ((await sb('sets?select=id,video_id&limit=10000')).json || []).forEach(r => { idmap[r.video_id] = r.id; });
    const have = new Set(((await sb('id_moments?select=set_id&limit=100000')).json || []).map(x => x.set_id));
    candidates = vrows.map(r => ({ set_id: idmap[r.video_id], video_id: r.video_id }))
                      .filter(c => c.set_id && !have.has(c.set_id));
  }
  const limit = parseInt(args.limit || (args.video ? 5 : 40), 10);
  candidates = candidates.slice(0, limit);
  console.log(`candidates to mine: ${candidates.length}${DRY ? ' (DRY RUN)' : ''}`);

  let totalMoments = 0, setsWithIds = 0;
  for (const c of candidates) {
    const moments = await mine(c.video_id);
    const rows = moments.map(m => ({ set_id: c.set_id, t_sec: m.t_sec, label: m.label, resolved: m.resolved, likes: m.likes, source: m.source }));
    if (rows.length) {
      const n = await insertMoments(rows);
      totalMoments += n; setsWithIds++;
      console.log(`  ${c.video_id}: ${rows.length} IDs  e.g. "${rows[0].label}" @${rows[0].t_sec}s`);
    }
    await new Promise(r => setTimeout(r, 120)); // gentle on YT quota
  }
  console.log(`\nDONE — ${setsWithIds}/${candidates.length} sets got IDs, ${totalMoments} moments inserted.`);
})();
