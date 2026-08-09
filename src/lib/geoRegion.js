// Routes a set to a stage (americas / europe / worldwide) based on city, festival_id,
// or falls back to the DB-provided vibe. Ported from the production _geoRegion function.
const AMER_IDS = new Set([
  'knockdown-nyc','triiple','sotrackboa','parque-povo','dblock','beatport-live','motion-lima',
  'reframe-la','hellbent-la','superior-ny','pacha-nyc','edc-orlando','laroc','monsoon',
  'universo-paralello','concourse','greenvalley','arc-chicago','edc-mexico','boilerroom',
  'clubspace','daytrip','fisher','smartbar','stereo','movement','panoramanyc','timegate',
  'wd4e','trotamundo','crssd','iii-points','exchange-la','academy-la','seismic',
  'alldayidream','mayan-warrior','bpm','housecalls',
]);
const EUR_IDS = new Set([
  'dc10','off-week','glastonbury','tlv-desert','intercell','selected-sessions','hi-ibiza',
  'berghain','fabric','tresor','awakenings','dekmantel','thuishaven','yoyaku','ra','fuse',
  'sunwaves','resistance','ctm','sonarfest','musicon','rex','shelter','faust','cprty',
  'timewarp','junction','junction2','clubtoclub','ade','egg','vunderground','printworks',
  'sonus','creamfields','shelter-ams','pacha','amnesia','nibiru',
  'tomorrowland','exit','dimensions','elrow',
]);
const AMER_CITIES = [
  'miami','chicago','los angeles','las vegas','austin','new york','brooklyn','detroit',
  'montreal','sao paulo','camboriú','camboriu','valinhos','brazil','mexico','atlanta',
  'san francisco','denver','san diego','montañita','montanita','ecuador','bogota','bogotá',
  'medellin','buenos aires','lima','santiago','colombia','peru',
];
const EUR_CITIES = [
  'london','berlin','amsterdam','paris','ibiza','rotterdam','barcelona','turin','mannheim',
  'tisno','cambridge','stockholm','brussels','glasgow','manchester','ghent','zagreb',
  'prague','budapest',
];

export function geoRegion(row) {
  const city = (row.city || '').toLowerCase();
  const fest = (row.festival_id || row.festival_name || '').toLowerCase();
  if (AMER_IDS.has(row.festival_id)) return 'americas';
  if (EUR_IDS.has(row.festival_id)) return 'europe';
  if (AMER_CITIES.some((c) => city.includes(c) || fest.includes(c))) return 'americas';
  if (EUR_CITIES.some((c) => city.includes(c) || fest.includes(c))) return 'europe';
  return row.vibe === 'americas' ? 'americas' : row.vibe === 'europe' ? 'europe' : 'worldwide';
}
