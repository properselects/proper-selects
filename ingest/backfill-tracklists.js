// One-shot backfill: fetch YouTube descriptions for all live sets and parse tracklists
// Run: YOUTUBE_API_KEY=xxx SUPABASE_URL=xxx SUPABASE_SERVICE_KEY=xxx node ingest/backfill-tracklists.js

const YT_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bcodfuggztfosuzsyyla.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!YT_KEY || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const TS_RE = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—·|]?\s*/;
const TRACK_LINE_RE = /^\d{1,2}:\d{2}/;

function parseTimestamp(h, m, s) {
  return (parseInt(h || 0) * 3600) + (parseInt(m) * 60) + parseInt(s);
}

function parseTrackLine(raw) {
  let line = raw.replace(TS_RE, '').trim();
  const labelMatch = line.match(/[\[\(]([A-Z][^\]\)]{2,30})[\]\)]$/);
  const label = labelMatch ? labelMatch[1] : null;
  if (labelMatch) line = line.slice(0, labelMatch.index).trim();
  line = line.replace(/\s*[-–—]\s*(Original Mix|Extended Mix|Radio Edit|Remix)$/i, '').trim();
  const sep = line.match(/\s+[-–]\s+/);
  if (sep) {
    const idx = line.search(/\s+[-–]\s+/);
    return { artist: line.slice(0, idx).trim(), title: line.slice(idx + sep[0].length).trim(), label };
  }
  return { artist: null, title: line, label };
}

function parseDescription(description, videoId) {
  if (!description) return [];
  const lines = description.split('\n');
  const tracks = [];
  let position = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!TRACK_LINE_RE.test(line)) continue;
    const tsMatch = line.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
    if (!tsMatch) continue;
    const timestamp_sec = parseTimestamp(tsMatch[1], tsMatch[2], tsMatch[3]);
    const { artist, title, label } = parseTrackLine(line);
    if (!title || title.length < 3) continue;
    tracks.push({ video_id: videoId, position: ++position, timestamp_sec, artist: artist || null, title, label: label || null, raw_line: line });
  }
  return tracks;
}

async function getAllSets() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sets?select=id,video_id&status=eq.live&embeddable=eq.true`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  return r.ok ? r.json() : [];
}

async function getExistingVideoIds() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks?select=video_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = r.ok ? await r.json() : [];
  return new Set(rows.map(x => x.video_id));
}

async function fetchDescriptions(ids) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=${YT_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, i.snippet?.description ?? '']));
}

async function insertTracks(tracks) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(tracks),
  });
  return r.ok;
}

async function run() {
  console.log('Fetching all live sets...');
  const sets = await getAllSets();
  const alreadyDone = await getExistingVideoIds();
  const todo = sets.filter(s => !alreadyDone.has(s.video_id));
  console.log(`${sets.length} total sets, ${todo.length} need tracklist scrape`);

  const BATCH = 50;
  let totalTracks = 0, withTracklist = 0;

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const ids = batch.map(s => s.video_id);
    const descs = await fetchDescriptions(ids);
    const setMap = Object.fromEntries(batch.map(s => [s.video_id, s.id]));

    const allTracks = [];
    for (const [vid, desc] of Object.entries(descs)) {
      const parsed = parseDescription(desc, vid);
      if (parsed.length) {
        withTracklist++;
        allTracks.push(...parsed.map(t => ({ ...t, set_id: setMap[vid] })));
      }
    }

    if (allTracks.length) {
      await insertTracks(allTracks);
      totalTracks += allTracks.length;
    }

    console.log(`Batch ${Math.floor(i/BATCH)+1}: ${allTracks.length} tracks from ${batch.length} sets`);
    await new Promise(r => setTimeout(r, 300)); // rate limit
  }

  console.log(`\nDone. ${withTracklist}/${todo.length} sets had tracklists. ${totalTracks} total track entries stored.`);
  const matchRate = todo.length ? Math.round(withTracklist / todo.length * 100) : 0;
  console.log(`Match rate: ${matchRate}%`);
}

run().catch(console.error);
