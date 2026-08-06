// Weekly cron: delete lineups older than 30 days
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/lineups?created_at=lt.${encodeURIComponent(cutoff)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Prefer: 'return=representation',
      },
    }
  );
  const deleted = r.ok ? await r.json() : [];
  return res.json({ deleted: deleted.length, cutoff });
}
