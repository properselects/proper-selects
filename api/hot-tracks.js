// GET /api/hot-tracks — returns tracks appearing in 2+ sets in last 90 days
// Also used internally by ingest to parse + store YouTube description tracklists

export const maxDuration = 30;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Timestamp formats:  00:00  /  0:00  /  1:23:45
const TS_RE = /^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—·|]?\s*/;

// Patterns that indicate a line IS a track entry
const TRACK_LINE_RE = /^\d{1,2}:\d{2}/;

function parseTimestamp(h, m, s) {
  return (parseInt(h || 0) * 3600) + (parseInt(m) * 60) + parseInt(s);
}

// Extract artist + title from a tracklist line after timestamp is stripped
function parseTrackLine(raw) {
  // Strip leading timestamp
  let line = raw.replace(TS_RE, '').trim();

  // Remove trailing label hints like [Label] or (Label)
  const labelMatch = line.match(/[\[\(]([A-Z][^\]\)]{2,30})[\]\)]$/);
  const label = labelMatch ? labelMatch[1] : null;
  if (labelMatch) line = line.slice(0, labelMatch.index).trim();

  // Remove common suffixes
  line = line.replace(/\s*[-–—]\s*(Original Mix|Extended Mix|Radio Edit|Remix)$/i, '').trim();

  // Split on " - " or " – "
  const sep = line.match(/\s+[-–]\s+/);
  if (sep) {
    const idx = line.search(/\s+[-–]\s+/);
    return {
      artist: line.slice(0, idx).trim(),
      title: line.slice(idx + sep[0].length).trim(),
      label,
    };
  }

  // Fallback: whole line is title, no artist split
  return { artist: null, title: line, label };
}

export function parseDescription(description, videoId) {
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

    tracks.push({
      video_id: videoId,
      position: ++position,
      timestamp_sec,
      artist: artist || null,
      title,
      label: label || null,
      raw_line: line,
    });
  }

  return tracks;
}

async function fetchDescription(videoId) {
  if (!YOUTUBE_API_KEY) return null;
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  return d.items?.[0]?.snippet?.description ?? null;
}

async function upsertTracks(tracks, setId) {
  if (!tracks.length) return 0;
  const payload = tracks.map(t => ({ ...t, set_id: setId }));
  const r = await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(payload),
  });
  return r.ok ? tracks.length : 0;
}

// Called by ingest pipeline for a newly ingested set
export async function scrapeTracklist(videoId, setId) {
  const desc = await fetchDescription(videoId);
  if (!desc) return 0;
  const tracks = parseDescription(desc, videoId);
  if (!tracks.length) return 0;
  return upsertTracks(tracks, setId);
}

// HTTP handler: GET /api/hot-tracks
export default async function handler(req, res) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return res.status(500).json({ error: 'missing env' });

  // Optional: trigger backfill for a specific video
  if (req.method === 'POST') {
    const { video_id, set_id } = req.body ?? {};
    if (!video_id || !set_id) return res.status(400).json({ error: 'need video_id and set_id' });
    const count = await scrapeTracklist(video_id, set_id);
    return res.json({ scraped: count });
  }

  // GET: return hot tracks
  const r = await fetch(`${SUPABASE_URL}/rest/v1/hot_tracks?limit=50`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) return res.status(500).json({ error: 'db error' });
  const tracks = await r.json();
  res.json({ tracks, total: tracks.length });
}
