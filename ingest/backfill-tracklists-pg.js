// Backfill tracklists using direct postgres + YouTube API
const { Pool } = require('pg');

const YT_KEY = process.env.YOUTUBE_API_KEY;
const DB_URL = process.env.DB_URL;

if (!YT_KEY || !DB_URL) { console.error('Need YOUTUBE_API_KEY and DB_URL'); process.exit(1); }

const pool = new Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

const TRACK_LINE_RE = /^\d{1,2}:\d{2}/;

function parseTimestamp(h, m, s) {
  return (parseInt(h||0)*3600)+(parseInt(m)*60)+parseInt(s);
}
function parseTrackLine(raw) {
  let line = raw.replace(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—·|]?\s*/, '').trim();
  const labelMatch = line.match(/[\[\(]([A-Z][^\]\)]{2,30})[\]\)]$/);
  const label = labelMatch ? labelMatch[1] : null;
  if (labelMatch) line = line.slice(0, labelMatch.index).trim();
  line = line.replace(/\s*[-–—]\s*(Original Mix|Extended Mix|Radio Edit|Remix)$/i, '').trim();
  const sep = line.match(/\s+[-–]\s+/);
  if (sep) {
    const idx = line.search(/\s+[-–]\s+/);
    return { artist: line.slice(0,idx).trim(), title: line.slice(idx+sep[0].length).trim(), label };
  }
  return { artist: null, title: line, label };
}
function parseDescription(desc, videoId) {
  if (!desc) return [];
  const tracks = [];
  let pos = 0;
  for (const raw of desc.split('\n')) {
    const line = raw.trim();
    if (!TRACK_LINE_RE.test(line)) continue;
    const m = line.match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})/);
    if (!m) continue;
    const ts = parseTimestamp(m[1], m[2], m[3]);
    const { artist, title, label } = parseTrackLine(line);
    if (!title || title.length < 3) continue;
    tracks.push({ video_id: videoId, position: ++pos, timestamp_sec: ts, artist: artist||null, title, label: label||null, raw_line: line });
  }
  return tracks;
}

async function run() {
  const { rows: sets } = await pool.query(`
    SELECT s.id, s.video_id FROM sets s
    WHERE s.status = 'live' AND s.embeddable = true
    AND s.video_id NOT IN (SELECT DISTINCT video_id FROM tracks)
    ORDER BY s.published_at DESC NULLS LAST
  `);
  console.log(`${sets.length} sets to process`);
  
  let totalTracks = 0, withTracklist = 0;
  const BATCH = 50;
  
  for (let i = 0; i < sets.length; i += BATCH) {
    const batch = sets.slice(i, i+BATCH);
    const ids = batch.map(s => s.video_id).join(',');
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}&key=${YT_KEY}`);
    const d = await r.json();
    const descMap = Object.fromEntries((d.items||[]).map(i => [i.id, i.snippet?.description||'']));
    const setMap = Object.fromEntries(batch.map(s => [s.video_id, s.id]));
    
    for (const [vid, desc] of Object.entries(descMap)) {
      const tracks = parseDescription(desc, vid);
      if (!tracks.length) continue;
      withTracklist++;
      for (const t of tracks) {
        await pool.query(`
          INSERT INTO tracks (video_id, set_id, position, timestamp_sec, artist, title, label, raw_line)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT DO NOTHING
        `, [t.video_id, setMap[vid], t.position, t.timestamp_sec, t.artist, t.title, t.label, t.raw_line]);
      }
      totalTracks += tracks.length;
    }
    
    process.stdout.write(`\rBatch ${Math.floor(i/BATCH)+1}/${Math.ceil(sets.length/BATCH)}: ${withTracklist} sets with tracklists, ${totalTracks} tracks`);
    await new Promise(r => setTimeout(r, 250));
  }
  
  console.log(`\n\nDone! ${withTracklist}/${sets.length} sets had tracklists (${Math.round(withTracklist/sets.length*100)}%). ${totalTracks} track entries stored.`);
  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
