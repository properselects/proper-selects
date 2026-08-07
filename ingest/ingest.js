// proper-selects set ingestion
// Polls YouTube channels daily → writes new full sets to Supabase public_sets
// Run: node ingest/ingest.js  (or deploy as Vercel cron)
// Env: YOUTUBE_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://bcodfuggztfosuzsyyla.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!YOUTUBE_API_KEY || !SUPABASE_KEY) {
  console.error('Missing YOUTUBE_API_KEY or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Channels to watch → maps to festival_id + region
const CHANNELS = [
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom',        festival_name: 'Boiler Room',        city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom-berlin', festival_name: 'Boiler Room Berlin',  city: 'Berlin',      vibe: 'europe',   cityFilter: 'Berlin' },
  { channelId: 'UCl2CLatrfJiU6OqmHZNUDNg', festival_id: 'dekmantel',         festival_name: 'Dekmantel',          city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCDHvlud7Hf86FxFsogrBcMg', festival_id: 'ra',                festival_name: 'Resident Advisor',   city: 'London',      vibe: 'europe' },
  { channelId: 'UCOlJBEcHjFpQ0SQlNNqEuIA', festival_id: 'cercle',            festival_name: 'Cercle',             city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UC2KhiKAhm8wIkjt2chtIUTA', festival_id: 'thuishaven',        festival_name: 'Thuishaven',         city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCNKR0GnJRSqMcKx6JWXBhwA', festival_id: 'yoyaku',           festival_name: 'Yoyaku',             city: 'Paris',       vibe: 'europe' },
  { channelId: 'UCwmFOfFuvRPI112vR5DN8vQ', festival_id: 'rawcuts',           festival_name: 'Raw Cuts',           city: 'New York',    vibe: 'americas' },
  { channelId: 'UC3ifTl5zKiCAhHIBQYcaTrg', festival_id: 'greenvalley',       festival_name: 'Green Valley',       city: 'Camboriú',    vibe: 'americas' },
  { channelId: 'UCp_MbSA-jJzGjsBBgYZTmjA', festival_id: 'dc10',             festival_name: 'DC-10',              city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'NIBIRU_PLACEHOLDER',         festival_id: 'nibiru',           festival_name: 'Nibiru Universe',    city: 'Costinești',  vibe: 'europe' },
  // Amsterdam venues + festivals added 2026-08-06
  { channelId: 'UCzyHGSqC5g9FrxiBiWZodSg', festival_id: 'het-sieraad',      festival_name: 'Het Sieraad',        city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCxGCaygaT8AKwN2-CZJTHRw', festival_id: 'loveland',         festival_name: 'Loveland',           city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCyPL9zjOpks6Ae2DgY5xVug', festival_id: 'into-the-woods',   festival_name: 'Into the Woods',     city: 'Amersfoort',  vibe: 'europe' },
  { channelId: 'UCYX_IcIznJjbV_CeiIsoJYA', festival_id: 'mysteryland',      festival_name: 'Mysteryland',        city: 'Haarlemmermeer', vibe: 'europe' },
  { channelId: 'UCJ2RRwUFwr2iKTJWRl-D6dA', festival_id: 'ade',              festival_name: 'Amsterdam Dance Event', city: 'Amsterdam', vibe: 'europe' },
  { channelId: 'UC66Z6LkocrEkjbuw8Jj622w', festival_id: 'warehouse-elem',   festival_name: 'Warehouse Elementenstraat', city: 'Amsterdam', vibe: 'europe' },
  { channelId: 'UCppt30WbwOWOEh7qLlBJoJA', festival_id: 'techno-tuesday',   festival_name: 'Techno Tuesday Amsterdam', city: 'Amsterdam', vibe: 'europe' },
  { channelId: 'UC-OFGLPQXxV7uhwb9ydzfmw', festival_id: 'adam-open-air',    festival_name: 'Amsterdam Open Air', city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCsXsIwJkujO2FwsqkzrljoA', festival_id: 'melkweg',          festival_name: 'Melkweg',            city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCwXhRDLdSBM3s5L_uMnX7uA', festival_id: 'ot301',            festival_name: 'OT301',              city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCfyFtw01Nf973V9gggJVi_Q', festival_id: 'unum',             festival_name: 'UNUM Festival',      city: 'Shëngjin',    vibe: 'europe' },
];

const MIN_DURATION_SECONDS = 45 * 60; // 45 minutes minimum for a full set

function parseISO8601Duration(d) {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0);
}

async function getRecentVideos(channelId, maxResults = 15) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=${maxResults}&order=date&type=video&videoDuration=long&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube search failed for ${channelId}: ${res.status}`);
  const data = await res.json();
  return (data.items || []).map(i => ({
    video_id: i.id.videoId,
    title: i.snippet.title,
    published_at: i.snippet.publishedAt,
  }));
}

async function getVideoDurations(videoIds) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds.join(',')}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const map = {};
  for (const item of (data.items || [])) {
    map[item.id] = parseISO8601Duration(item.contentDetails.duration);
  }
  return map;
}

async function getExistingVideoIds() {
  const url = `${SUPABASE_URL}/rest/v1/public_sets?select=video_id`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  if (!res.ok) return new Set();
  const rows = await res.json();
  return new Set(rows.map(r => r.video_id));
}

async function insertSets(sets) {
  const rows = sets.map(({ video_id, festival_id, source, artist, title, duration_sec, published_at }) =>
    ({ video_id, festival_id, source, artist, title, duration_sec, published_at, status: 'live', embeddable: true })
  );
  const res = await fetch(`${SUPABASE_URL}/rest/v1/sets`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=ignore-duplicates',
    },
    body: JSON.stringify(rows),
  });
  return res.ok;
}

async function run() {
  console.log('Starting ingestion…');
  const existing = await getExistingVideoIds();
  console.log(`${existing.size} existing sets in DB`);

  const toInsert = [];

  for (const ch of CHANNELS) {
    if (ch.channelId.includes('PLACEHOLDER')) continue;
    try {
      const videos = await getRecentVideos(ch.channelId);
      const newVideos = videos.filter(v => !existing.has(v.video_id));
      if (!newVideos.length) { console.log(`${ch.festival_name}: no new videos`); continue; }

      const ids = newVideos.map(v => v.video_id);
      const durations = await getVideoDurations(ids);

      for (const v of newVideos) {
        const dur = durations[v.video_id] || 0;
        if (dur < MIN_DURATION_SECONDS) {
          console.log(`  skip ${v.video_id} (${Math.round(dur/60)}min) — too short`);
          continue;
        }
        // City filter for channels that post multiple cities (e.g. Boiler Room global)
        if (ch.cityFilter && !v.title.toLowerCase().includes(ch.cityFilter.toLowerCase())) continue;

        toInsert.push({
          video_id: v.video_id,
          festival_id: ch.festival_id,
          artist: v.title,
          title: v.title,
          source: 'youtube',
          duration_sec: v.duration_sec || null,
          published_at: v.published_at,
        });
        console.log(`  ✓ queued: ${v.title.slice(0, 60)}`);
      }
    } catch (e) {
      console.error(`${ch.festival_name} error:`, e.message);
    }
  }

  if (!toInsert.length) { console.log('Nothing new to insert.'); return; }

  console.log(`\nInserting ${toInsert.length} sets…`);
  const ok = await insertSets(toInsert);
  console.log(ok ? `✅ Inserted ${toInsert.length} sets` : '❌ Insert failed');
}

run().catch(console.error);
