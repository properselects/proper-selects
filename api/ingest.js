// Vercel serverless function — called by cron daily at 4am UTC
// Also callable manually: GET /api/ingest

export const maxDuration = 60;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const CHANNELS = [
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom',   festival_name: 'Boiler Room',           city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCl2CLatrfJiU6OqmHZNUDNg', festival_id: 'dekmantel',    festival_name: 'Dekmantel',             city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCDHvlud7Hf86FxFsogrBcMg', festival_id: 'ra',           festival_name: 'Resident Advisor',      city: 'London',      vibe: 'europe' },
  { channelId: 'UCOlJBEcHjFpQ0SQlNNqEuIA', festival_id: 'cercle',       festival_name: 'Cercle',                city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UC2KhiKAhm8wIkjt2chtIUTA', festival_id: 'thuishaven',   festival_name: 'Thuishaven',            city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCNKR0GnJRSqMcKx6JWXBhwA', festival_id: 'yoyaku',       festival_name: 'Yoyaku',                city: 'Paris',       vibe: 'europe' },
  { channelId: 'UCXAuu4lli9oBgKZVGapNvBw', festival_id: 'dgtl',          festival_name: 'DGTL Festival',         city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCJFXYDv0Fy7TavmclGFpaWg', festival_id: 'radion',         festival_name: 'Radion Amsterdam',       city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCxGCaygaT8AKwN2-CZJTHRw', festival_id: 'loveland',       festival_name: 'Loveland Festival',     city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCwatAPhCuO0UwCZUaqEzzRQ', festival_id: 'rawcuts',       festival_name: 'RAW CUTS',              city: 'New York',    vibe: 'americas' },
  { channelId: 'UC3ifTl5zKiCAhHIBQYcaTrg', festival_id: 'greenvalley',   festival_name: 'Green Valley',          city: 'Camboriú',    vibe: 'americas' },
  { channelId: 'UCp_MbSA-jJzGjsBBgYZTmjA', festival_id: 'dc10',          festival_name: 'DC-10',                 city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UCaSjh0kdrd3xEn0zqcjbiDg', festival_id: 'concourse',     festival_name: 'The Concourse Project', city: 'Austin',      vibe: 'americas' },
  // EU/Worldwide venues added 2026-08-02
  { channelId: 'UCV6qd2kF9ShJj_vaej6AJ9Q', festival_id: 'awakenings',  festival_name: 'Awakenings',           city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCU7wcDDNY1KkgAXfiShfNiQ', festival_id: 'amnesia',      festival_name: 'Amnesia',              city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UC7RZ3YtxzlR61_3kfjdolAA', festival_id: 'creamfields',  festival_name: 'Creamfields',          city: 'Warrington',  vibe: 'europe' },
  { channelId: 'UC3SQZc2g5eUXgJ-X0jkPChQ', festival_id: 'junction2',    festival_name: 'Junction 2',           city: 'London',      vibe: 'europe' },
  { channelId: 'UCjbDDt1C0iIXkhf7cxcHijg', festival_id: 'pacha',        festival_name: 'Pacha Ibiza',          city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UCWWOjDKnb2iZGlL12afBYzg', festival_id: 'printworks',   festival_name: 'Printworks',           city: 'London',      vibe: 'europe' },
  { channelId: 'UCgTcFmoQx7cA7gVZRbI450g', festival_id: 'sonus',        festival_name: 'Sonus Festival',       city: 'Tisno',       vibe: 'europe' },
  { channelId: 'UCAuKLTxRav0b5VGslSABLrw', festival_id: 'timewarp',     festival_name: 'Time Warp',            city: 'Mannheim',    vibe: 'europe' },
  { channelId: 'UCTy2NM-Gdpmz_1667ZXoZ6A', festival_id: 'tresor',       festival_name: 'Tresor',               city: 'Berlin',      vibe: 'europe' },
  { channelId: 'UCmmTMyfN0Euv0xiSzYXy4NQ', festival_id: 'dimensions',   festival_name: 'Dimensions Festival',  city: 'Pula',        vibe: 'worldwide' },
  { channelId: 'UCbjjpsKbWU_CwvgjTtO6CDA', festival_id: 'womb',         festival_name: 'Womb',                 city: 'Tokyo',       vibe: 'worldwide' },
  { channelId: 'UCGxYxFFsENVa3y3L3kkQ4QA', festival_id: 'trotamundo',   festival_name: 'Trotamundo @ Lost Beach Club', city: 'Montañita', vibe: 'americas' },
  // USA venues added 2026-08-02
  { channelId: 'UCnf2atji58GrDey0R4AOKVg', festival_id: 'movement',      festival_name: 'Movement Festival',     city: 'Detroit',     vibe: 'americas' },
  { channelId: 'UCT1Tq7SDg9kd4XgFjc47_4Q', festival_id: 'iii-points',   festival_name: 'III Points',            city: 'Miami',       vibe: 'americas' },
  { channelId: 'UCFXhLNpftXbCi9W58CJLrJQ', festival_id: 'crssd',         festival_name: 'CRSSD Festival',        city: 'San Diego',    vibe: 'americas' },
  { channelId: 'UCD7UAd18FFkcJ22wxNNwq7A', festival_id: 'dirtybird',      festival_name: 'Dirtybird',             city: 'San Francisco', vibe: 'americas' },
  { channelId: 'UC6MoTuUjFrdEoBd3S9AN8Cg', festival_id: 'splash-house',   festival_name: 'Splash House',          city: 'Palm Springs',  vibe: 'americas' },
  { channelId: 'UCDZELNPHzTdvB9Nu5-s--4w', festival_id: 'exchange-la',   festival_name: 'Exchange LA',           city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UC2iQ3op3Xar4TLX03oEmJYg', festival_id: 'concourse',     festival_name: 'The Concourse Project', city: 'Austin',      vibe: 'americas' },
  { channelId: 'UCdIjpGkpXGw9WJ_5reM-5WQ', festival_id: 'academy-la',   festival_name: 'Academy LA',            city: 'Los Angeles', vibe: 'americas' },
  // LA collectives added 2026-08-05
  { channelId: 'UCtw41MdFxU4GZNbzB2UuPpg', festival_id: 'tyf-la',      festival_name: 'Tell Your Friends',     city: 'Los Angeles', vibe: 'americas' },
  // Ibiza/Berlin venues added 2026-08-05
  { channelId: 'UCanV1p6ynx_FzdsraKLousQ', festival_id: 'circoloco',    festival_name: 'Circoloco',             city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UC072CZUvhdCg6Dsdvc18NkQ', festival_id: 'hi-ibiza',     festival_name: 'Hï Ibiza',              city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UCPQNk7oBBfQRf0tDFQBvgCA', festival_id: 'watergate',    festival_name: 'Watergate',             city: 'Berlin',      vibe: 'europe' },
  // US festival channels added 2026-08-05
  { channelId: 'UCPqwSbjPy6KdC7f_eCFUlWg', festival_id: 'hard-summer',   festival_name: 'Hard Summer',           city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UC-QVOEJcRTmqXTEwUFbPRLA', festival_id: 'lollapalooza',  festival_name: 'Lollapalooza',          city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCndfUzXCcrgdE4ecZhr79yw', festival_id: 'ultra',          festival_name: 'Ultra Music Festival',  city: 'Miami',       vibe: 'americas' },
  // Curator + DJ media channels added 2026-08-06
  { channelId: 'UC0e1D3NdDoAi8Om4KdaqAPw', festival_id: 'housecalls',    festival_name: 'House Calls TV',        city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UCmfF7JZv26UUKyRedViGIlw', festival_id: 'hor-berlin',    festival_name: 'HÖR Berlin',            city: 'Berlin',      vibe: 'europe' },
  { channelId: 'UCJEKlziKdxoos1qbptjGgLg', festival_id: 'djmag',         festival_name: 'DJ Mag',                city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UCnLorjUZZ7kORuVEE4d-lMA', festival_id: 'househats',     festival_name: 'House Hats',            city: 'Worldwide',   vibe: 'worldwide' },
  // Underground labels + curator channels added 2026-08-06
  { channelId: 'UCpiZh3AGeTygzfmUgioOFFg', festival_id: 'toolroom',      festival_name: 'Toolroom Records',      city: 'London',      vibe: 'europe' },
  { channelId: 'UCJ-IRkRfFXrzmkyxZ7hEgcA', festival_id: 'when-we-dip',   festival_name: 'When We Dip',           city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UCzwhGJV9o4KTPD5Nq6GPeqQ', festival_id: 'diynamic',      festival_name: 'DIYNAMIC',              city: 'Hamburg',     vibe: 'europe' },
  { channelId: 'UCC7eKMxcVk1LZwzJlBdsVuQ', festival_id: 'innervisions',  festival_name: 'Innervisions',          city: 'Berlin',      vibe: 'europe' },
  { channelId: 'UCyEMqKQPGdj8wKVKt2-agbQ', festival_id: 'beatport',      festival_name: 'Beatport',              city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UCCycRfTS7V9WOFfWfkNVCSg', festival_id: 'cercle-recs',   festival_name: 'Cercle Records',        city: 'Paris',       vibe: 'europe' },
  { channelId: 'UCCbpTuRINyfjtwFkjHuII1w', festival_id: 'mau5trap',      festival_name: 'mau5trap',              city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UCFZ75Bg73NJnJgmeUX9l62g', festival_id: 'selected',      festival_name: 'Selected.',             city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UC8Bhgj67ino3eyL6WXvYgAA', festival_id: 'anti-up',       festival_name: 'Anti Up',               city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UCKp7UVaoVuiW1qtyPLPVFMQ', festival_id: 'diplo',         festival_name: 'Diplo',                 city: 'Los Angeles', vibe: 'americas' },
  // US eminent DJ + festival channels added 2026-08-06
  { channelId: 'UCr45VhwCBYwMfdN-gz7W_OA', festival_id: 'insomniac',     festival_name: 'Insomniac',             city: 'Los Angeles', vibe: 'americas' },
  { channelId: 'UC5AOhbMw3M618Q2hk6zt5yw', festival_id: 'arc-chicago',   festival_name: 'ARC Music Festival',    city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCye08Q8h2bkXmH8syuftqmQ', festival_id: 'iii-points',    festival_name: 'III Points',            city: 'Miami',       vibe: 'americas' },
  { channelId: 'UCsIVrho83JfwUieSs_UKCmA', festival_id: 'john-summit',   festival_name: 'John Summit',           city: 'Chicago',     vibe: 'americas' },
  { channelId: 'UCAWEFemmYHWXFDtV_5FPN-w', festival_id: 'anyma',          festival_name: 'Anyma',                 city: 'Los Angeles', vibe: 'americas' },
  // Worldwide venues added 2026-08-04
  { channelId: 'UCglk_nXa4Vfbk255I8Lk4yQ', festival_id: 'tomorrowland',  festival_name: 'Tomorrowland',          city: 'Boom',             vibe: 'worldwide' },
  { channelId: 'UCDxMwHtvoQ2WzfgbpHdN5dQ', festival_id: 'elrow',          festival_name: 'elrow',                 city: 'Worldwide',        vibe: 'worldwide' },
  { channelId: 'UCyg-ercUs4czzf9x8dra1IQ', festival_id: 'bpm',            festival_name: 'The BPM Festival',      city: 'Costa Rica',       vibe: 'worldwide' },
  { channelId: 'UCEpSQWHN-ZBcT6n4_paHO_A', festival_id: 'fabric',         festival_name: 'fabric',                city: 'London',           vibe: 'europe' },
  { channelId: 'UCuaUS6xjyIGUDiso6am8Mtw', festival_id: 'octagon-seoul',  festival_name: 'Club Octagon',          city: 'Seoul',            vibe: 'worldwide' },
  { channelId: 'UCApQT8Gkxq7RgXaKVj5eveg', festival_id: 'mayan-warrior',  festival_name: 'Mayan Warrior',         city: 'Black Rock City',  vibe: 'worldwide' },
  { channelId: 'UC8LpEl1RM7sd28kjqYZpJ6w', festival_id: 'epizode',        festival_name: 'Epizode Festival',      city: 'Phú Quốc',        vibe: 'worldwide' },
];

const MIN_SECS = 45 * 60;

// Non-musical content patterns — panels, talks, radio streams, aftermovies, interviews
const NON_MUSICAL_PATTERNS = [
  /\bpanel\b/i,
  /\bdiscussion\b/i,
  /\bonline panel\b/i,
  /\bcreative scenes\b/i,
  /@beatport\s+live\b/i,
  /\bfree version\b/i,
  /\binterview\b/i,
  /\bconference\b/i,
  /\bnetworking\b/i,
  /\bresearch\b/i,
  /\blab finale\b/i,
  /\bresynthesising\b/i,
  /\baftermovie\b/i,
  /\brecap\b/i,
  /\btrailer\b/i,
  /\bteaser\b/i,
  /\bdocumentary\b/i,
  /\bpodcast\b/i,
  /\bmasterclass\b/i,
  /\bworkshop\b/i,
  /\btalk\b/i,
  /\bkeynote\b/i,
  /\bq\s*&\s*a\b/i,
  /\bbehind the scenes\b/i,
  /\bepisode\s*\d+/i,          // Episode 12 etc — usually podcast/radio
  /\b\d{4}\s+\d{2}\s+\d{2}\s+\d{2}\s+\d{2}/,  // radio-style timestamps (2025 02 25 14 03)
  /#djset\b/i,               // promo/studio mixes (not live venue recordings)
  /\bpres\.\s+\w.*#/i,       // "Monsoon~ pres. DJ #djset" style promos
  /\binjected\b/i,
  /\bkhao\s+san\b/i,               // radio beach party streams
  /Mixmag\s+Lab.*Bonobo|Bonobo.*Mixmag/i,
  /Ezra\s+Collective/i,
  /\bjazz\s+session/i,
  // Non-house/techno genres
  /\bhip\s*[- ]?hop\b/i,
  /\bhiphop\b/i,
  /\bneo\s+soul\b/i,
  /\bnu\s*soul\b/i,
  /\br\s*&\s*b\b/i,
  /\brnb\b/i,
  /\brap\s+(mix|set|dj)\b/i,
  /\blo-?fi\b/i,
  /\bchillhop\b/i,
  /\btrap\s+(mix|set)\b/i,
  /\bdrill\b/i,
  /\bafrobeat(s)?\s+(mix|top|hit)/i,
  /\breggaeton\b/i,
  /\bdancehall\b/i,
  /\bjazz\s+(mix|hits)/i,
];

function isNonMusicalContent(title) {
  if (!title) return true;
  return NON_MUSICAL_PATTERNS.some(re => re.test(title));
}

function parseDuration(d) {
  const m = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (+(m[1]||0))*3600 + (+(m[2]||0))*60 + (+(m[3]||0));
}

async function ytSearch(channelId) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=10&order=date&type=video&videoDuration=long&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return (d.items||[]).map(i => ({ video_id: i.id.videoId, title: i.snippet.title, published_at: i.snippet.publishedAt }));
}

// Venue detection from title — routes sets to proper festival_id/city
// Ordered by specificity (most specific patterns first)
// vibe MUST be set on every route — this is the authoritative region source.
// When a title match fires, the channel's default vibe is ignored entirely.
const VENUE_ROUTES = [
  { re: /EDC\s+Orlando/i,           festival_id: 'edc-orlando',         festival_name: 'EDC Orlando',                  city: 'Orlando',      vibe: 'americas' },
  { re: /EDC\s+Mexico/i,            festival_id: 'edc-mexico',          festival_name: 'EDC Mexico',                   city: 'Mexico City',  vibe: 'americas' },
  { re: /H(ï|i)\s+ibiza/i,          festival_id: 'hi-ibiza',            festival_name: 'Hï Ibiza',                     city: 'Ibiza',        vibe: 'europe' },
  { re: /Knockdown\s+Center/i,      festival_id: 'knockdown-nyc',       festival_name: 'Knockdown Center',             city: 'New York',     vibe: 'americas' },
  { re: /ARC\s+(Chicago|Music)/i,   festival_id: 'arc-chicago',         festival_name: 'ARC Music Festival',           city: 'Chicago',      vibe: 'americas' },
  { re: /LAROC/i,                   festival_id: 'laroc',               festival_name: 'Laroc Club',                   city: 'Itupeva',      vibe: 'americas' },
  { re: /Universo\s+Paralello/i,    festival_id: 'universo-paralello',  festival_name: 'Universo Paralello',           city: 'Bahia',        vibe: 'americas' },
  { re: /Concourse\s+Project/i,     festival_id: 'concourse',           festival_name: 'The Concourse Project',        city: 'Austin',       vibe: 'americas' },
  { re: /Destino.*Ibiza|Ibiza.*Destino/i, festival_id: 'dc10',          festival_name: 'DC-10',                        city: 'Ibiza',        vibe: 'europe' },
  { re: /TRIIIPLE/i,                festival_id: 'triiple',             festival_name: 'TRIIIPLE Festival',            city: 'Valinhos',     vibe: 'americas' },
  { re: /SO\s+TRACK\s+BOA/i,        festival_id: 'sotrackboa',          festival_name: 'SO TRACK BOA',                 city: 'São Paulo',    vibe: 'americas' },
  { re: /PARQUE\s+DO\s+POVO/i,      festival_id: 'parque-povo',         festival_name: 'Parque do Povo',               city: 'São Paulo',    vibe: 'americas' },
  { re: /D-EDGE/i,                  festival_id: 'dblock',              festival_name: 'D-Edge',                       city: 'São Paulo',    vibe: 'americas' },
  // NOTE: @beatport Live / The Circuit removed — brand streams not venue sets
  // { re: /@beatport\s+Live/i, festival_id: 'beatport-live' },
  { re: /Motion\s+Festival.*Lima/i, festival_id: 'motion-lima',         festival_name: 'Motion Festival',              city: 'Lima',         vibe: 'americas' },
  { re: /Re:frame/i,                festival_id: 'reframe-la',          festival_name: 'Re:frame LA',                  city: 'Los Angeles',  vibe: 'americas' },
  // { re: /Selected\s+Sessions/i, festival_id: 'selected-sessions' }, // removed — not a proper venue
  { re: /Monsoon/i,                 festival_id: 'monsoon',             festival_name: 'Monsoon',                      city: 'Peru',         vibe: 'americas' },
  { re: /Hellbent/i,                festival_id: 'hellbent-la',         festival_name: 'Hellbent',                     city: 'Los Angeles',  vibe: 'americas' },
  { re: /Superior\s+Ingredients/i,  festival_id: 'superior-ny',         festival_name: 'Superior Ingredients',         city: 'New York',     vibe: 'americas' },
  { re: /Off\s+Week/i,              festival_id: 'off-week',            festival_name: 'Off Week',                     city: 'Barcelona',    vibe: 'europe' },
  { re: /(Sde\s+Boker|Dead\s+Sea|Hanokdim)/i, festival_id: 'tlv-desert', festival_name: 'Sde Boker Desert Sessions',  city: 'Sde Boker',    vibe: 'europe' },
  { re: /Glastonbury/i,             festival_id: 'glastonbury',         festival_name: 'Glastonbury Festival',         city: 'Glastonbury',  vibe: 'europe' },
  { re: /Intercell/i,               festival_id: 'intercell',           festival_name: 'Intercell',                    city: 'Rotterdam',    vibe: 'europe' },
  { re: /Pacha\s+New\s+York|Pacha\s+NYC/i, festival_id: 'pacha-nyc',    festival_name: 'Pacha New York',              city: 'New York',     vibe: 'americas' },
  { re: /Movement\s+(Festival|Detroit|Music)/i, festival_id: 'movement',   festival_name: 'Movement Festival',       city: 'Detroit',      vibe: 'americas' },
  { re: /III\s+Points/i,                festival_id: 'iii-points',          festival_name: 'III Points',              city: 'Miami',        vibe: 'americas' },
  { re: /CRSSD/i,                       festival_id: 'crssd',               festival_name: 'CRSSD Festival',          city: 'San Diego',    vibe: 'americas' },
  { re: /Exchange\s+(LA|Los Angeles)/i, festival_id: 'exchange-la',         festival_name: 'Exchange LA',             city: 'Los Angeles',  vibe: 'americas' },
  { re: /Seismic\s+Dance/i,             festival_id: 'concourse',           festival_name: 'The Concourse Project',   city: 'Austin',       vibe: 'americas' },
  { re: /Academy\s+(LA|Hollywood)/i,    festival_id: 'academy-la',          festival_name: 'Academy LA',              city: 'Los Angeles',  vibe: 'americas' },
  { re: /Trotamundo|Lost\s+Beach\s+Club|Montañita/i, festival_id: 'trotamundo', festival_name: 'Trotamundo @ Lost Beach Club', city: 'Montañita', vibe: 'americas' },
];

function routeByTitle(title, defaultCh) {
  for (const r of VENUE_ROUTES) {
    if (r.re.test(title)) return { ...defaultCh, festival_id: r.festival_id, festival_name: r.festival_name, city: r.city, vibe: r.vibe };
  }
  return defaultCh;
}

async function ytDurations(ids) {
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, parseDuration(i.contentDetails.duration)]));
}

async function getExisting() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = r.ok ? await r.json() : [];
  return new Set(rows.map(x => x.video_id));
}

async function insertSets(sets) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/public_sets`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(sets),
  });
  return r.ok;
}

import { parseDescription } from './hot-tracks.js';

async function ytDescriptions(ids) {
  if (!ids.length) return {};
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=${YOUTUBE_API_KEY}`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, i.snippet?.description ?? '']));
}

async function insertTracks(tracks) {
  if (!tracks.length) return;
  await fetch(`${SUPABASE_URL}/rest/v1/tracks`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(tracks),
  });
}

export default async function handler(req, res) {
  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) return res.status(500).json({ error: 'Missing env vars' });

  const existing = await getExisting();
  const toInsert = [];

  for (const ch of CHANNELS) {
    try {
      const videos = (await ytSearch(ch.channelId)).filter(v => !existing.has(v.video_id));
      if (!videos.length) continue;
      const durs = await ytDurations(videos.map(v => v.video_id));
      for (const v of videos) {
        if ((durs[v.video_id]||0) < MIN_SECS) continue;
        if (isNonMusicalContent(v.title)) continue;
        const routed = routeByTitle(v.title, ch);
        toInsert.push({ video_id: v.video_id, festival_id: routed.festival_id, festival_name: routed.festival_name, city: routed.city, vibe: routed.vibe || ch.vibe, artist: v.title, title: v.title, source: 'youtube', duration_sec: durs[v.video_id] || null, status: 'live', embeddable: true, published_at: v.published_at, accent: null });
      }
    } catch (e) {
      console.error(ch.festival_name, e.message);
    }
  }

  if (toInsert.length) {
    await insertSets(toInsert);

    // Fetch descriptions and parse tracklists for new sets
    try {
      const ids = toInsert.map(s => s.video_id);
      const descs = await ytDescriptions(ids);
      const allTracks = [];
      for (const s of toInsert) {
        const parsed = parseDescription(descs[s.video_id] || '', s.video_id);
        allTracks.push(...parsed);
      }
      if (allTracks.length) await insertTracks(allTracks);
      console.log(`Parsed ${allTracks.length} track entries from ${toInsert.length} new sets`);
    } catch (e) {
      console.error('Tracklist parse error:', e.message);
    }
  }

  res.json({ inserted: toInsert.length, checked: CHANNELS.length });
}
