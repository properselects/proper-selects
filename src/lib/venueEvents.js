import { supabaseHeaders, SUPABASE_URL } from './supabase.js';

export async function fetchNextEvent(festivalId) {
  if (!festivalId) return null;
  const now = new Date().toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/events?festival_id=eq.${encodeURIComponent(festivalId)}` +
      `&starts_at=gte.${encodeURIComponent(now)}&order=starts_at.asc&limit=1`,
    { headers: supabaseHeaders }
  );
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

export function EventStrip({ event, accent = '#F4A93C', label }) {
  if (!event) return null;
  const date = new Date(event.starts_at);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 8, margin: '8px 0',
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)',
      gap: 10,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.14em', opacity: .4, marginBottom: 3 }}>
          {label || 'UPCOMING'}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#EDEAE2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {event.headliner || event.title}
        </div>
        <div style={{ fontSize: 10, opacity: .5, marginTop: 2 }}>
          {dateStr} · {timeStr}{event.ticket_price_from ? ` · from $${event.ticket_price_from}` : ''}
        </div>
      </div>
      {event.ticket_url && !event.sold_out && (
        <a
          href={event.ticket_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{
            flexShrink: 0, padding: '7px 14px', borderRadius: 6,
            background: accent, color: '#0a0a0e',
            fontWeight: 800, fontSize: 11, textDecoration: 'none', letterSpacing: '.04em',
          }}
        >
          Tickets →
        </a>
      )}
      {event.sold_out && (
        <span style={{ flexShrink: 0, fontSize: 10, opacity: .4 }}>Sold out</span>
      )}
    </div>
  );
}
