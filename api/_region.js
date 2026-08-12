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
  // Major UK/European venue names (so London/EU events route right even when the title omits the city)
  ' fabric','fabriclondon','printworks',' xoyo','phonox','corsica studios','village underground',
  'drumsheds','tobacco dock','ministry of sound',' koko ','brixton','hackney','peckham','oval space',
  'fold ldn','e1 london','outernet','berghain','panorama bar','watergate','sisyphos','about blan',
  'de marktkantine','shelter amsterdam','de school','paradiso','melkweg','razzmatazz','fuse brussels',
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

// Best-guess actual location from a set's title, so the card shows where the set really happened
// instead of the (often generic) festival/bucket city. [keyword, DisplayName] — most specific first.
// Returns a display string or null (caller falls back to the festival's city).
const LOCATIONS = [
  // Americas — cities
  ['south beach', 'Miami'], ['wynwood', 'Miami'], ['miami', 'Miami'], ['brooklyn', 'New York'],
  ['nyc', 'New York'], ['new york', 'New York'], ['chicago', 'Chicago'], ['detroit', 'Detroit'],
  ['los angeles', 'Los Angeles'], ['hollywood', 'Los Angeles'], ['lab la', 'Los Angeles'],
  ['lab l.a', 'Los Angeles'], ['las vegas', 'Las Vegas'],
  ['austin', 'Austin'], ['san francisco', 'San Francisco'], ['san diego', 'San Diego'],
  ['denver', 'Denver'], ['atlanta', 'Atlanta'], ['seattle', 'Seattle'], ['toronto', 'Toronto'],
  ['montreal', 'Montreal'], ['tulum', 'Tulum'], ['mexico city', 'Mexico City'], ['guadalajara', 'Guadalajara'],
  ['são paulo', 'São Paulo'], ['sao paulo', 'São Paulo'], ['rio de janeiro', 'Rio de Janeiro'],
  ['camboriú', 'Camboriú'], ['camboriu', 'Camboriú'], ['buenos aires', 'Buenos Aires'],
  ['montañita', 'Montañita'], ['montanita', 'Montañita'], ['lima', 'Lima'], ['bogotá', 'Bogotá'],
  ['bogota', 'Bogotá'], ['medellín', 'Medellín'], ['medellin', 'Medellín'], ['santiago', 'Santiago'],
  // Europe — cities
  ['london', 'London'], ['manchester', 'Manchester'], ['glasgow', 'Glasgow'], ['bristol', 'Bristol'],
  ['berlin', 'Berlin'], ['munich', 'Munich'], ['cologne', 'Cologne'], ['hamburg', 'Hamburg'],
  ['frankfurt', 'Frankfurt'], ['mannheim', 'Mannheim'], ['amsterdam', 'Amsterdam'], ['rotterdam', 'Rotterdam'],
  ['utrecht', 'Utrecht'], ['paris', 'Paris'], ['lyon', 'Lyon'], ['marseille', 'Marseille'],
  ['ibiza', 'Ibiza'], ['barcelona', 'Barcelona'], ['madrid', 'Madrid'], ['valencia', 'Valencia'],
  ['milan', 'Milan'], ['milano', 'Milan'], ['rome', 'Rome'], ['naples', 'Naples'], ['turin', 'Turin'],
  ['lisbon', 'Lisbon'], ['porto', 'Porto'], ['brussels', 'Brussels'], ['antwerp', 'Antwerp'],
  ['zurich', 'Zurich'], ['geneva', 'Geneva'], ['vienna', 'Vienna'], ['zagreb', 'Zagreb'], ['tisno', 'Tisno'],
  ['pula', 'Pula'], ['warsaw', 'Warsaw'], ['krakow', 'Kraków'], ['prague', 'Prague'], ['budapest', 'Budapest'],
  ['bucharest', 'Bucharest'], ['sofia', 'Sofia'], ['athens', 'Athens'], ['stockholm', 'Stockholm'],
  ['copenhagen', 'Copenhagen'], ['oslo', 'Oslo'], ['helsinki', 'Helsinki'], ['dublin', 'Dublin'],
  ['tbilisi', 'Tbilisi'], ['tel aviv', 'Tel Aviv'],
  // Worldwide — cities/countries
  ['tokyo', 'Tokyo'], ['osaka', 'Osaka'], ['seoul', 'Seoul'], ['bali', 'Bali'], ['jakarta', 'Jakarta'],
  ['bangkok', 'Bangkok'], ['singapore', 'Singapore'], ['mumbai', 'Mumbai'], ['goa', 'Goa'],
  ['dubai', 'Dubai'], ['shanghai', 'Shanghai'], ['hong kong', 'Hong Kong'], ['taipei', 'Taipei'],
  ['sydney', 'Sydney'], ['melbourne', 'Melbourne'], ['cape town', 'Cape Town'],
  ['johannesburg', 'Johannesburg'], ['durban', 'Durban'], ['limpopo', 'Limpopo'], ['lagos', 'Lagos'],
  ['nairobi', 'Nairobi'], ['marrakech', 'Marrakech'],
  // Country-level fallbacks (only if no city matched above)
  ['thailand', 'Thailand'], ['japan', 'Japan'], ['south korea', 'South Korea'], ['korea', 'South Korea'],
  ['india', 'India'], ['indonesia', 'Indonesia'], ['australia', 'Australia'], ['south africa', 'South Africa'],
  ['brazil', 'Brazil'], ['brasil', 'Brazil'], ['mexico', 'Mexico'], ['colombia', 'Colombia'],
  ['argentina', 'Argentina'], ['chile', 'Chile'], ['peru', 'Peru'], ['ecuador', 'Ecuador'],
];

export function parseCity(text) {
  const t = ' ' + String(text || '').toLowerCase() + ' ';
  for (const [kw, name] of LOCATIONS) if (t.includes(kw)) return name;
  return null; // no location in title → caller falls back to festival city
}
