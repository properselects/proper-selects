// Sync upcoming events from Resident Advisor into Supabase events table.
// Called daily by cron; also callable manually: GET /api/events-sync

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// RA area IDs with approximate city center coordinates for proximity matching
const RA_AREAS = [
  { id: '38',  city: 'Miami',       lat: 25.7617,   lng: -80.1918,  region: 'americas' },
  { id: '23',  city: 'Los Angeles', lat: 34.0522,   lng: -118.2437, region: 'americas' },
  { id: '17',  city: 'Chicago',     lat: 41.8781,   lng: -87.6298,  region: 'americas' },
  { id: '8',   city: 'New York',    lat: 40.7128,   lng: -74.0060,  region: 'americas' },
  { id: '321', city: 'Austin',      lat: 30.2672,   lng: -97.7431,  region: 'americas' },
  { id: '19',  city: 'Detroit',     lat: 42.3314,   lng: -83.0458,  region: 'americas' },
  { id: '13',  city: 'London',      lat: 51.5074,   lng: -0.1278,   region: 'europe'   },
  { id: '34',  city: 'Berlin',      lat: 52.5200,   lng: 13.4050,   region: 'europe'   },
  { id: '29',  city: 'Amsterdam',   lat: 52.3676,   lng: 4.9041,    region: 'europe'   },
  { id: '25',  city: 'Ibiza',       lat: 38.9067,   lng: 1.4206,    region: 'europe'   },
  { id: '20',  city: 'Barcelona',   lat: 41.3851,   lng: 2.1734,    region: 'europe'   },
  { id: '537', city: 'Seoul',       lat: 37.5665,   lng: 126.9780,  region: 'worldwide' },
  { id: '27',  city: 'Tokyo',       lat: 35.6762,   lng: 139.6503,  region: 'worldwide' },
];

const RA_QUERY = `
  query eventListings($filters: FilterInputDtoInput, $pageSize: Int, $page: Int) {
    eventListings(filters: $filters, pageSize: $pageSize, page: $page) {
      data {
        listingDate
        event {
          id
          title
          date
          startTime
          cost
          contentUrl
          venue { id name address }
          lineup
          images { filename }
        }
      }
    }
  }
`;

async function fetchRAEvents(areaId, dateFrom, dateTo) {
  const res = await fetch('https://ra.co/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0',
      'Referer': 'https://ra.co/events',
      'Origin': 'https://ra.co',
    },
    body: JSON.stringify({
      operationName: 'eventListings',
      query: RA_QUERY,
      variables: {
        filters: {
          areas: { id: areaId },
          listingDate: { gte: dateFrom, lte: dateTo },
        },
        pageSize: 40,
        page: 1,
      },
    }),
  });
  const data = await res.json();
  return (data?.data?.eventListings?.data || []).map((item) => item.event).filter(Boolean);
}

function parseLineup(lineup) {
  if (!lineup) return { headliner: null, supporting: null };
  const text = typeof lineup === 'string' ? lineup : JSON.stringify(lineup);
  // Strip XML-like artist tags: <artist id="123">Name</artist>
  const stripped = text.replace(/<artist[^>]*>([^<]+)<\/artist>/g, '$1').replace(/<[^>]+>/g, '');
  const names = stripped.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
  return { headliner: names[0] || null, supporting: names.slice(1).join(', ') || null };
}

function parseCost(cost) {
  if (!cost) return null;
  const m = String(cost).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

async function clearOldRAEvents() {
  // Remove past RA events and stale upcoming ones before reinserting fresh data
  const cutoff = new Date().toISOString();
  await fetch(
    `${SUPABASE_URL}/rest/v1/events?ticket_url=like.https://ra.co%&starts_at=lt.${cutoff}`,
    {
      method: 'DELETE',
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    }
  );
}

async function insertEvents(events) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(events),
  });
  return res.ok;
}

export default async function handler(req, res) {
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_KEY' });

  const now = new Date();
  const dateFrom = now.toISOString().slice(0, 10);
  const dateTo = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  await clearOldRAEvents();

  let totalInserted = 0;
  const errors = [];

  for (const area of RA_AREAS) {
    try {
      const events = await fetchRAEvents(area.id, dateFrom, dateTo);
      if (!events.length) continue;

      const rows = events.map((e) => {
        const { headliner, supporting } = parseLineup(e.lineup);
        const venue = e.venue || {};
        const img = (e.images || [])[0];
        const startsAt = e.date
          ? `${e.date.slice(0, 10)}T${e.startTime || '22:00:00'}`
          : null;
        return {
          festival_id: null,
          title: e.title || 'Untitled',
          starts_at: startsAt,
          headliner: headliner,
          supporting_acts: supporting,
          venue_name: venue.name || null,
          flyer_url: img ? `https://ra.co/images/${img.filename}` : null,
          ticket_url: e.contentUrl ? `https://ra.co${e.contentUrl}` : null,
          ticket_price_from: parseCost(e.cost),
          sold_out: false,
          verified: true,
          lat: area.lat,
          lng: area.lng,
        };
      }).filter((r) => r.starts_at);

      if (rows.length) {
        await insertEvents(rows);
        totalInserted += rows.length;
      }
    } catch (err) {
      errors.push(`${area.city}: ${err.message}`);
    }
  }

  res.json({ inserted: totalInserted, areas: RA_AREAS.length, errors, dateRange: `${dateFrom} → ${dateTo}` });
}
