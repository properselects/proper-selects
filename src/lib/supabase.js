// Client-side Supabase constants. Public anon key = safe to embed.
export const SUPABASE_URL = 'https://kvcaumstygwdpwfmixhw.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y2F1bXN0eWd3ZHB3Zm1peGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTU1MTIsImV4cCI6MjEwMjgzMTUxMn0.HkbyGFPovSue1BUxZ8vh3PK9_l2dKwxem5hHbQ65-Eo';

export const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

export async function fetchJson(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: supabaseHeaders });
  if (!r.ok) throw new Error(`Supabase fetch failed: ${path}`);
  return r.json();
}
