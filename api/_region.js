// Per-set region classifier. Reads the actual location out of a set's title (+ festival name)
// and returns 'americas' | 'europe' | 'worldwide', or null when no location is recognised
// (caller then falls back to the festival's own region). Worldwide = everything that isn't
// clearly the Americas or Europe (Asia, Africa, Oceania, Middle East, or genuinely global).

const AMER = [
  'chicago','new york','nyc','brooklyn','manhattan','miami','detroit','los angeles','hollywood',
  'las vegas',' vegas','austin','san francisco','san diego','denver','atlanta','seattle','boston',
  'new orleans','nashville','phoenix','dallas','houston','portland','minneapolis','washington dc',
  'montreal','toronto','vancouver','canada',
  'mexico','méxico','guadalajara','monterrey','tulum','cancun','cancún','playa del carmen',
  'brazil','brasil','são paulo','sao paulo','rio de janeiro','camboriú','camboriu','florianopolis',
  'floripa','curitiba','belo horizonte','valinhos',
  'buenos aires','argentina','rosario',
  'chile','santiago','peru','lima','colombia','bogota','bogotá','medellin','medellín',
  'ecuador','montañita','montanita','guayaquil','quito','costa rica','panama','panamá',
  'uruguay','montevideo','venezuela','caracas','united states',' usa ',
];
const EUR = [
  'london',' uk ','united kingdom','manchester','glasgow','bristol','leeds','liverpool','birmingham',
  'sheffield','brighton','cardiff','edinburgh','scotland','wales','ireland','dublin','england',
  'berlin','germany','munich','münchen','cologne','köln','hamburg','frankfurt','leipzig','mannheim',
  'düsseldorf','dusseldorf',
  'amsterdam','netherlands','holland','rotterdam','utrecht','the hague','eindhoven',
  'paris','france','lyon','marseille','bordeaux','nantes',
  'ibiza','spain','barcelona','madrid','valencia','sevilla','seville','malaga','bilbao',
  'italy','milan','milano','rome',' roma ','naples','napoli','turin','torino','bologna','florence',
  'portugal','lisbon','lisboa','porto',
  'belgium','brussels','antwerp','ghent','gent',
  'switzerland','zurich','zürich','geneva','basel',
  'austria','vienna','wien',
  'croatia','zagreb','tisno','pula','split','rovinj',
  'poland','warsaw','warszawa','krakow','kraków','wroclaw',
  'czech','prague','praha',
  'hungary','budapest','romania','bucharest','bulgaria','sofia','greece','athens',
  'sweden','stockholm','gothenburg','malmo','malmö','denmark','copenhagen','norway','oslo',
  'finland','helsinki','iceland','reykjavik','estonia','tallinn','latvia','riga','lithuania','vilnius',
  'serbia','belgrade','slovenia','ljubljana','slovakia','bratislava',
  'glastonbury','warrington','tomorrowland','albania','shëngjin','shengjin','tirana','malta',
  'luxembourg','monaco','tbilisi','israel','tel aviv','jerusalem',
];
const WORLD = [
  'tokyo','japan','osaka','seoul','korea','busan','bali','indonesia','jakarta','bandung',
  'singapore','bangkok','thailand','phuket','mumbai','india','delhi','bangalore',' goa ',
  'dubai',' uae ','abu dhabi','doha','qatar','beirut','lebanon','riyadh','saudi',
  'shanghai','china','beijing','hong kong','taipei','taiwan','manila','philippines',
  'kuala lumpur','malaysia','vietnam','hanoi','ho chi minh',
  'sydney','melbourne','australia','brisbane','perth','adelaide','auckland','new zealand',
  'cape town','johannesburg','joburg','durban','limpopo','south africa','pretoria',
  'lagos','nigeria','nairobi','kenya','accra','ghana','marrakech','morocco','casablanca',
  'cairo','egypt','tunisia','tanzania',
  'afrikaburn','sunburn','zouk singapore','rainbow serpent',
];

export function classifyRegion(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  if (AMER.some((k) => t.includes(k))) return 'americas';
  if (EUR.some((k) => t.includes(k))) return 'europe';
  if (WORLD.some((k) => t.includes(k))) return 'worldwide';
  return null; // unknown → caller falls back to festival region
}
