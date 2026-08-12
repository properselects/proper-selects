// Vercel serverless function — called by cron daily at 4am UTC
// Also callable manually: GET /api/ingest

export const maxDuration = 60;

import { classifyRegion, parseCity, parseVenue, cleanArtist } from './_region.js';
const GENERIC_BUCKETS = new Set(['discovered', 'search-ingest']);

// Ingest uses its own key only — search key is reserved for user-facing search
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function ytFetch(url) {
  return fetch(url.replace('KEY_PLACEHOLDER', YOUTUBE_API_KEY));
}

const CHANNELS = [
  { channelId: 'UCGCoc4fAMC4wvp1vgEOpFzA', festival_id: 'boilerroom',   festival_name: 'Boiler Room',           city: '',            vibe: 'worldwide' },
  { channelId: 'UCl2CLatrfJiU6OqmHZNUDNg', festival_id: 'dekmantel',    festival_name: 'Dekmantel',             city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCDHvlud7Hf86FxFsogrBcMg', festival_id: 'ra',           festival_name: 'Resident Advisor',      city: 'London',      vibe: 'europe' },
  { channelId: 'UCOlJBEcHjFpQ0SQlNNqEuIA', festival_id: 'cercle',       festival_name: 'Cercle',                city: 'Worldwide',   vibe: 'worldwide' },
  { channelId: 'UC2KhiKAhm8wIkjt2chtIUTA', festival_id: 'thuishaven',   festival_name: 'Thuishaven',            city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCNKR0GnJRSqMcKx6JWXBhwA', festival_id: 'yoyaku',       festival_name: 'Yoyaku',                city: 'Paris',       vibe: 'europe' },
  { channelId: 'UCXAuu4lli9oBgKZVGapNvBw', festival_id: 'dgtl',          festival_name: 'DGTL Festival',         city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCJFXYDv0Fy7TavmclGFpaWg', festival_id: 'radion',         festival_name: 'Radion Amsterdam',       city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCxGCaygaT8AKwN2-CZJTHRw', festival_id: 'loveland',       festival_name: 'Loveland Festival',     city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCwatAPhCuO0UwCZUaqEzzRQ', festival_id: 'rawcuts',       festival_name: 'RAW CUTS',              city: 'New York',    vibe: 'worldwide' },
  { channelId: 'UC3ifTl5zKiCAhHIBQYcaTrg', festival_id: 'greenvalley',   festival_name: 'Green Valley',          city: 'Camboriú',    vibe: 'americas' },
  { channelId: 'UCp_MbSA-jJzGjsBBgYZTmjA', festival_id: 'dc10',          festival_name: 'DC-10',                 city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UCaSjh0kdrd3xEn0zqcjbiDg', festival_id: 'concourse',     festival_name: 'The Concourse Project', city: 'Austin',      vibe: 'americas' },
  // EU/Worldwide venues added 2026-08-02
  { channelId: 'UCV6qd2kF9ShJj_vaej6AJ9Q', festival_id: 'awakenings',  festival_name: 'Awakenings',           city: 'Amsterdam',   vibe: 'europe' },
  { channelId: 'UCU7wcDDNY1KkgAXfiShfNiQ', festival_id: 'amnesia',      festival_name: 'Amnesia',              city: 'Ibiza',       vibe: 'europe' },
  { channelId: 'UC7RZ3YtxzlR61_3kfjdolAA', festival_id: 'creamfields',  festival_name: 'Creamfields',          city: 'Warrington',  vibe: 'europe' },
  { channelId: 'UC3SQZc2g5eUXgJ-X0jkPChQ', festival_id: 'junction2',    festival_name: 'Junction 2',           city: 'London',      vibe: 'worldwide' },
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
  { channelId: 'UCanV1p6ynx_FzdsraKLousQ', festival_id: 'circoloco',    festival_name: 'Circoloco',             city: 'Ibiza',       vibe: 'worldwide' },
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
  { channelId: 'UCpiZh3AGeTygzfmUgioOFFg', festival_id: 'toolroom',      festival_name: 'Toolroom Records',      city: 'London',      vibe: 'worldwide' },
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
  { channelId: 'UCsIVrho83JfwUieSs_UKCmA', festival_id: 'john-summit',   festival_name: 'John Summit',           city: 'Chicago',     vibe: 'worldwide' },
  { channelId: 'UCAWEFemmYHWXFDtV_5FPN-w', festival_id: 'anyma',          festival_name: 'Anyma',                 city: 'Los Angeles', vibe: 'americas' },
  // Worldwide venues added 2026-08-04
  { channelId: 'UCglk_nXa4Vfbk255I8Lk4yQ', festival_id: 'tomorrowland',  festival_name: 'Tomorrowland',          city: 'Boom',             vibe: 'worldwide' },
  { channelId: 'UCDxMwHtvoQ2WzfgbpHdN5dQ', festival_id: 'elrow',          festival_name: 'elrow',                 city: 'Worldwide',        vibe: 'worldwide' },
  { channelId: 'UCyg-ercUs4czzf9x8dra1IQ', festival_id: 'bpm',            festival_name: 'The BPM Festival',      city: 'Costa Rica',       vibe: 'worldwide' },
  { channelId: 'UCEpSQWHN-ZBcT6n4_paHO_A', festival_id: 'fabric',         festival_name: 'fabric',                city: 'London',           vibe: 'europe' },
  { channelId: 'UCuaUS6xjyIGUDiso6am8Mtw', festival_id: 'octagon-seoul',  festival_name: 'Club Octagon',          city: 'Seoul',            vibe: 'worldwide' },
  { channelId: 'UCApQT8Gkxq7RgXaKVj5eveg', festival_id: 'mayan-warrior',  festival_name: 'Mayan Warrior',         city: 'Black Rock City',  vibe: 'worldwide' },
  { channelId: 'UC8LpEl1RM7sd28kjqYZpJ6w', festival_id: 'epizode',        festival_name: 'Epizode Festival',      city: 'Phú Quốc',        vibe: 'worldwide' },
  // Las Vegas venues added 2026-08-06
  { channelId: 'UCe710jxByDD7eF1A_C_im7A', festival_id: 'omnia-lv',       festival_name: 'Omnia Las Vegas',       city: 'Las Vegas',        vibe: 'americas' },
  { channelId: 'UCFma8dm2-m5KoFu6FW5i8mA', festival_id: 'xs-lv',          festival_name: 'XS Las Vegas',          city: 'Las Vegas',        vibe: 'americas' },
  { channelId: 'UCfyFtw01Nf973V9gggJVi_Q', festival_id: 'unum',           festival_name: 'UNUM Festival',         city: 'Shëngjin',         vibe: 'europe' },
  // Latin American showcase added 2026-08-11 (was mis-routing to circuit)
  { channelId: 'UCJIMunEutszYhRvy-4P5r0Q', festival_id: 'monsoon',        festival_name: 'Monsoon',               city: 'Peru',             vibe: 'americas' },
  // Live-audience studio-session brands (crowd present) — kept per curation rule
  { channelId: 'UCQdCIrTpkhEH5Z8KPsn7NvQ', festival_id: 'mixmag-lab',     festival_name: 'Mixmag Lab',            city: 'London',           vibe: 'europe' },
  { channelId: 'UCcsRjloqh4gIHCCnDZtoniQ', festival_id: 'crimson-kid',    festival_name: "Crimson Kid Studio's",  city: '',                 vibe: 'worldwide' },
  { channelId: 'UCveda-9Yg2L9SS5NbdNBNpg', festival_id: 'stillmoving',    festival_name: 'StillMoving',           city: 'Netherlands',      vibe: 'europe' },
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
  /\bwhen\s+we\s+dip\s+\d+/i, // When We Dip 190 — numbered podcast series
  /\bfabric\s+\d+\b/i,         // fabric 123 — numbered mix series
  /\bra\.\d+\b/i,              // RA.945 — RA podcast series
  /\bmix\s+of\s+the\s+day\b/i,
  /[-–\s]\d{3,}$/,             // title ends in bare episode number ≥ 100
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
  // Non-DJ-set junk / branded compilation mixes
  /\bmotivational\b/i,
  /\bhustle\s+mix\b/i,
  /\bsunset\s+mix\b/i,
  /\bgym\s*&(?:amp;)?\s*tonic\b/i,
  /\bback\s+in\s+da\s+days\b/i,
  /\bajegunle\b/i,
  // Radio shows / studio sessions — keep it to live sets at venues, shows & festivals
  /\bradio\b/i,               // Dirtybird/Toolroom/Creamfields/Diynamic/Circoloco Radio, mau5trap radio, BBC Radio 1
  /essential\s*mix/i,         // BBC Radio 1 Essential Mix
  // NOTE: live-crowd / studio-booth sessions kept on purpose (Mixmag Lab, Crimson Kid, RA Greenhouse, HÖR)
  /selected\s*sessions/i,
  /\bstudio\s*(mix|set|session)/i,
  /\bin\s+the\s+lab\b/i,
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

// YouTube titles come HTML-encoded (&amp; &#39; &quot; …). Decode so they don't render raw on the site.
function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, '&'); // last, so we don't re-create entities
}

async function ytSearch(channelId, pageToken = null) {
  const pt = pageToken ? `&pageToken=${pageToken}` : '';
  const r = await ytFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=50&order=date&type=video&videoDuration=long${pt}&key=KEY_PLACEHOLDER`);
  const d = await r.json();
  const items = (d.items||[]).map(i => ({ video_id: i.id.videoId, title: decodeEntities(i.snippet.title), published_at: i.snippet.publishedAt }));
  return { items, nextPageToken: d.nextPageToken || null };
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
  { re: /Essential\s+Mix/i,          festival_id: 'essential-mix',       festival_name: 'BBC Radio 1 Essential Mix',    city: 'London',       vibe: 'europe' },
  // Boiler Room is a global brand — its channel defaults to the worldwide bucket; pin known cities to the right region.
  { re: /Boiler\s*Room.*Berlin|Berlin.*Boiler\s*Room/i, festival_id: 'boilerroom-berlin', festival_name: 'Boiler Room Berlin', city: 'Berlin', vibe: 'europe' },
  { re: /Boiler\s*Room.*London|London.*Boiler\s*Room/i, festival_id: 'boilerroom-london', festival_name: 'Boiler Room London', city: 'London', vibe: 'europe' },
  // Mixmag Lab: US editions (NYC/LA/Miami) → Americas; The Lab LDN default stays Europe (channel default)
  { re: /Mixmag\s*Lab.*(NYC|New\s*York|\bLA\b|Los\s*Angeles|Miami)/i, festival_id: 'mixmag-lab-us', festival_name: 'Mixmag Lab US', city: 'New York', vibe: 'americas' },
];

function routeByTitle(title, defaultCh) {
  for (const r of VENUE_ROUTES) {
    if (r.re.test(title)) return { ...defaultCh, festival_id: r.festival_id, festival_name: r.festival_name, city: r.city, vibe: r.vibe };
  }
  return defaultCh;
}

async function ytDurations(ids) {
  const r = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=KEY_PLACEHOLDER`);
  const d = await r.json();
  return Object.fromEntries((d.items||[]).map(i => [i.id, parseDuration(i.contentDetails.duration)]));
}

async function getExisting() {
  // Use raw sets table (service key) to catch ALL existing video_ids regardless of status/embeddable
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sets?select=video_id&limit=10000`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const rows = r.ok ? await r.json() : [];
  return new Set(rows.map(x => x.video_id));
}

async function insertSets(sets) {
  const rows = sets.map(({ video_id, festival_id, festival_name, source, artist, title, duration_sec, published_at, status, embeddable }) =>
    ({ video_id, festival_id, source, artist, title, duration_sec, published_at, status: status || 'live', embeddable: embeddable !== false,
       region: classifyRegion(`${title || ''} ${festival_name || ''}`), city: parseCity(title),
       venue: GENERIC_BUCKETS.has(festival_id) ? (parseVenue(title) || cleanArtist(title)) : null })
  );
  const r = await fetch(`${SUPABASE_URL}/rest/v1/sets`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
    body: JSON.stringify(rows),
  });
  return r.ok;
}

import { parseDescription } from '../ingest/hot-tracks.js';

async function ytDescriptions(ids) {
  if (!ids.length) return {};
  const r = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(',')}&key=KEY_PLACEHOLDER`);
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

// Mine YouTube comments for timestamped "ID moments" (track callouts) on newly inserted sets.
// Capped per ingest to conserve YouTube quota. Fully self-contained: never throws to the caller.
async function mineCommentsFor(videoIds, cap = 10) {
  const moments = [];
  const TS_RE = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/;
  const ID_LABEL_RE = /[-–:]\s*(.+)/;
  const UNRESOLVED_RE = /\b(?:id\??|what(?:'s|\s+is)\s+(?:this|the\s+track)|what\s+song)\b/i;

  for (const video_id of (videoIds || []).slice(0, cap)) {
    try {
      const r = await ytFetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${video_id}&order=relevance&maxResults=50&key=KEY_PLACEHOLDER`);
      if (!r.ok) continue;
      const data = await r.json();
      for (const item of (data.items || [])) {
        const text = item.snippet?.topLevelComment?.snippet?.textOriginal || '';
        const likes = item.snippet?.topLevelComment?.snippet?.likeCount || 0;
        for (const line of text.split('\n')) {
          const tsMatch = line.match(TS_RE);
          if (!tsMatch) continue;
          const [, h, m, sec] = tsMatch;
          const t_sec = (parseInt(h || 0) * 3600) + (parseInt(m) * 60) + parseInt(sec);
          if (t_sec < 30) continue; // skip intros
          const afterTs = line.slice(line.indexOf(tsMatch[0]) + tsMatch[0].length);
          const labelMatch = afterTs.match(ID_LABEL_RE);
          const rawLabel = labelMatch ? labelMatch[1].trim() : afterTs.trim();
          if (!rawLabel || rawLabel.length < 2 || rawLabel.length > 120) continue;
          const isUnresolved = UNRESOLVED_RE.test(rawLabel) || rawLabel.toLowerCase().startsWith('id');
          moments.push({
            video_id,
            t_sec,
            label: isUnresolved ? 'ID?' : rawLabel,
            resolved: !isUnresolved,
            likes,
            source: 'comment',
          });
        }
      }
    } catch {}
  }
  return moments;
}

async function insertMoments(moments) {
  if (!moments.length) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/set_id_moments`, {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify(moments),
    });
  } catch (e) {
    console.error('insertMoments error:', e.message);
  }
}

export default async function handler(req, res) {
  // Cron-only: reject unauthenticated calls
  const CRON_SECRET = process.env.CRON_SECRET;
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!YOUTUBE_API_KEY || !SUPABASE_KEY) return res.status(500).json({ error: 'Missing env vars' });

  // Fix festivals stuck at lat=0,lng=0
  const VENUE_COORD_FIXES = [
    { id: 'housecalls',  lat: 41.8781, lng: -87.6298, city: 'Chicago',   region: 'americas' },
    { id: 'when-we-dip', lat: 52.5200, lng: 13.4050,  city: 'Berlin',    region: 'europe' },
    { id: 'elrow',       lat: 41.3851, lng: 2.1734,   city: 'Barcelona', region: 'europe' },
    { id: 'discovered',  lat: 51.5074, lng: -0.1278,  city: 'London',    region: 'worldwide' },
  ];
  for (const { id, ...patch } of VENUE_COORD_FIXES) {
    await fetch(`${SUPABASE_URL}/rest/v1/festivals?id=eq.${id}&lat=eq.0`, {
      method: 'PATCH',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  const existing = await getExisting();
  const toInsert = [];

  // Count existing sets per festival so we can do extra pages for thin venues
  const existingByFestival = {};
  for (const ch of CHANNELS) existingByFestival[ch.festival_id] = 0;
  for (const vid of existing) {/* existing is a Set of video_ids — count tracked below */}

  for (const ch of CHANNELS) {
    try {
      let pageToken = null;
      let pageCount = 0;
      const MAX_PAGES = 4; // up to 200 results (4 × 50) per channel to backfill thin venues
      do {
        const { items, nextPageToken } = await ytSearch(ch.channelId, pageToken);
        const newItems = items.filter(v => !existing.has(v.video_id));
        if (newItems.length) {
          const durs = await ytDurations(newItems.map(v => v.video_id));
          for (const v of newItems) {
            if ((durs[v.video_id]||0) < MIN_SECS) continue;
            if (isNonMusicalContent(v.title)) continue;
            const routed = routeByTitle(v.title, ch);
            toInsert.push({ video_id: v.video_id, festival_id: routed.festival_id, festival_name: routed.festival_name, city: routed.city, vibe: routed.vibe || ch.vibe, artist: v.title, title: v.title, source: 'youtube', duration_sec: durs[v.video_id] || null, status: 'live', embeddable: true, published_at: v.published_at, accent: null });
            existing.add(v.video_id);
          }
        }
        pageToken = nextPageToken;
        pageCount++;
        // If first page had no new items, stop — we're caught up for this channel
        if (pageCount === 1 && newItems.length === 0) break;
      } while (pageToken && pageCount < MAX_PAGES);
    } catch (e) {
      console.error(ch.festival_name, e.message);
    }
  }

  if (toInsert.length) {
    await insertSets(toInsert);

    // Fetch descriptions, parse tracklists, and extract ID moments
    try {
      const ids = toInsert.map(s => s.video_id);
      const descs = await ytDescriptions(ids);
      const allTracks = [];
      const descMoments = [];

      // YouTube auto-ID block pattern: "Song: X\nArtist: Y"
      const YT_MUSIC_RE = /Song:\s*(.+?)\nArtist:\s*(.+?)(?:\n|$)/gi;

      for (const s of toInsert) {
        const desc = descs[s.video_id] || '';
        const parsed = parseDescription(desc, s.video_id);
        allTracks.push(...parsed);

        // Mirror description tracklist → set_id_moments (resolved, from official tracklist)
        for (const t of parsed) {
          const label = [t.artist, t.title].filter(Boolean).join(' - ');
          if (label.length >= 3) {
            descMoments.push({ video_id: s.video_id, t_sec: t.timestamp_sec, label, resolved: true, likes: 0, source: 'description' });
          }
        }

        // YouTube auto music identification (from description "Song: X\nArtist: Y" blocks)
        let match;
        while ((match = YT_MUSIC_RE.exec(desc)) !== null) {
          const label = `${match[2].trim()} - ${match[1].trim()}`;
          if (label.length >= 3) {
            descMoments.push({ video_id: s.video_id, t_sec: 0, label, resolved: true, likes: 0, source: 'youtube-music-id' });
          }
        }
      }

      if (allTracks.length) await insertTracks(allTracks);
      if (descMoments.length) {
        await fetch(`${SUPABASE_URL}/rest/v1/set_id_moments`, {
          method: 'POST',
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal,resolution=ignore-duplicates' },
          body: JSON.stringify(descMoments),
        });
      }
      console.log(`Parsed ${allTracks.length} tracks, ${descMoments.length} ID moments from descriptions`);
    } catch (e) {
      console.error('Tracklist parse error:', e.message);
    }
  }

  // Mine YouTube comments for ID moments on newly inserted sets
  if (toInsert.length) {
    const moments = await mineCommentsFor(toInsert.map(s => s.video_id), 15);
    if (moments.length) await insertMoments(moments);
    console.log(`Mined ${moments.length} ID moments from comments`);
  }

  res.json({ inserted: toInsert.length, checked: CHANNELS.length });
}
