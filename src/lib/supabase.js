// Client-side Supabase constants. Public anon key = safe to embed.
export const SUPABASE_URL = 'https://bcodfuggztfosuzsyyla.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjb2RmdWdnenRmb3N1enN5eWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjgyNTQsImV4cCI6MjEwMDAwNDI1NH0.RSD_E1f0Qy9E2s3vHMK5H9Mch0_-aCOrNhJs1hxCv5Y';

export const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

export async function fetchJson(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders });
  if (!r.ok) throw new Error(`Supabase fetch failed: ${path}`);
  return r.json();
}
