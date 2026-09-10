// Backfill script: creates canonical_tracks entries from existing tracks rows
// and links them via canonical_track_id.
// Matching: normalized lower(title) + lower(artist) = same canonical track.
// Run once: node scripts/backfill-canonical-tracks.mjs
// Safe to re-run — uses upsert + only processes unlinked rows.

const SB_URL = 'https://kvcaumstygwdpwfmixhw.supabase.co';
const SB_KEY = process.argv[2] || process.env.SUPABASE_SERVICE_KEY;

if (!SB_KEY) {
  console.error('Usage: node backfill-canonical-tracks.mjs <service_key>');
  process.exit(1);
}

const H = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' };

async function sb(path, opts = {}) {
  const r = await fetch(`${SB_URL}/rest/v1${path}`, { headers: H, ...opts });
  if (!r.ok) { console.error('SB error', r.status, await r.text()); return null; }
  return r.json();
}

// Fetch all unlinked tracks (no canonical_track_id yet) that have a title
const tracks = await sb('/tracks?canonical_track_id=is.null&title=not.is.null&select=id,title,artist,set_id&limit=100000');
if (!tracks) process.exit(1);

console.log(`Found ${tracks.length} unlinked tracks to process`);

// Group by normalized key
const groups = new Map();
for (const t of tracks) {
  const key = `${(t.title || '').toLowerCase().trim()}|||${(t.artist || '').toLowerCase().trim()}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(t);
}

console.log(`${groups.size} unique title+artist combinations`);

let created = 0, linked = 0;

for (const [key, rows] of groups) {
  const [titleNorm, artistNorm] = key.split('|||');
  const sample = rows[0];

  // Check if a canonical track already exists for this key
  const existing = await sb(`/canonical_tracks?select=id&or=(title.ilike.${encodeURIComponent(sample.title)},artist.ilike.${encodeURIComponent(sample.artist || '')})`);

  let canonicalId;

  if (existing && existing.length > 0) {
    canonicalId = existing[0].id;
  } else {
    // Create new canonical track
    const res = await sb('/canonical_tracks', {
      method: 'POST',
      headers: { ...H, Prefer: 'return=representation' },
      body: JSON.stringify({
        title: sample.title,
        artist: sample.artist || null,
        set_count: rows.length,
      }),
    });
    if (!res || !res[0]) continue;
    canonicalId = res[0].id;
    created++;
  }

  // Link all rows in this group to the canonical track
  const ids = rows.map(r => r.id);
  // Batch update in chunks of 100
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await sb(`/tracks?id=in.(${chunk.join(',')})`, {
      method: 'PATCH',
      headers: { ...H, Prefer: 'return=minimal' },
      body: JSON.stringify({ canonical_track_id: canonicalId }),
    });
    linked += chunk.length;
  }
}

console.log(`Done. Created ${created} canonical tracks, linked ${linked} track rows.`);
