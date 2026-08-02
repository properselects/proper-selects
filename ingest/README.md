# Proper Selects — Set Ingestion

Polls YouTube channels daily and writes new full sets (45min+) to Supabase.

## Setup

Add these to Vercel environment variables (or a local `.env`):

```
YOUTUBE_API_KEY=your_key_here
SUPABASE_URL=https://bcodfuggztfosuzsyyla.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

Get keys:
- YouTube API: console.cloud.google.com → APIs & Services → YouTube Data API v3
- Supabase service key: supabase.com/dashboard → project → Settings → API → service_role

## Run manually

```bash
cd ingest
node ingest.js
```

## Channels tracked

Boiler Room, Dekmantel, Resident Advisor, Cercle, Thuishaven, Yoyaku, Raw Cuts, Green Valley, DC-10

Add new channels in `CHANNELS` array with `channelId`, `festival_id`, `vibe` (americas/europe/worldwide).
