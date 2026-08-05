import React, { useEffect, useMemo, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

const CHIPS_VISIBLE = 10;

/**
 * Vault — venue-scoped grid of every set in the DB.
 * Features:
 *   - Featured Venue banner (auto-picks venue with most sets, or from psVaultVenue localStorage)
 *   - Next Event widget (fetches from events table where verified=true)
 *   - Set grid with clickable tiles (opens YouTube iframe overlay)
 */
async function fetchVault() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?select=*&limit=500`,
    { headers: supabaseHeaders }
  );
  return r.ok ? r.json() : [];
}

async function fetchNextEvent(festivalId) {
  const now = new Date().toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/events?festival_id=eq.${encodeURIComponent(festivalId)}` +
      `&verified=eq.true&starts_at=gte.${encodeURIComponent(now)}` +
      `&order=starts_at.asc&limit=1`,
    { headers: supabaseHeaders }
  );
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}

export default function VaultTab() {
  const [sets, setSets] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [playing, setPlaying] = useState(null);
  const [nextEvent, setNextEvent] = useState(null);
  const [showAllChips, setShowAllChips] = useState(false);

  useEffect(() => {
    fetchVault().then(setSets).catch(() => setSets([]));
  }, []);

  // On load, pick venue from localStorage or fall back to top-set-count
  useEffect(() => {
    if (selectedVenue || !sets?.length) return;
    let pick = '';
    try {
      const lv = localStorage.getItem('psVaultVenue');
      if (lv && sets.find((s) => s.festival_id === lv)) pick = lv;
    } catch {}
    if (!pick) {
      const counts = {};
      for (const s of sets) counts[s.festival_id] = (counts[s.festival_id] || 0) + 1;
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (top) pick = top[0];
    }
    if (pick) setSelectedVenue(pick);
  }, [sets, selectedVenue]);

  // Listen for sidebar-driven venue changes
  useEffect(() => {
    const h = () => {
      try {
        const lv = localStorage.getItem('psVaultVenue');
        if (lv && sets?.find((s) => s.festival_id === lv)) setSelectedVenue(lv);
      } catch {}
    };
    window.addEventListener('focus', h);
    window.addEventListener('psVaultSelect', h);
    return () => {
      window.removeEventListener('focus', h);
      window.removeEventListener('psVaultSelect', h);
    };
  }, [sets]);

  // Fetch next event when venue changes
  useEffect(() => {
    if (!selectedVenue || selectedVenue === 'all') {
      setNextEvent(null);
      return;
    }
    fetchNextEvent(selectedVenue).then(setNextEvent).catch(() => setNextEvent(null));
  }, [selectedVenue]);

  const counts = useMemo(() => {
    const c = { all: sets?.length || 0 };
    if (sets) for (const s of sets) if (s.festival_id) c[s.festival_id] = (c[s.festival_id] || 0) + 1;
    return c;
  }, [sets]);

  const chips = useMemo(() => {
    if (!sets) return [];
    const map = new Map();
    for (const s of sets) {
      if (!s.festival_id || map.has(s.festival_id)) continue;
      map.set(s.festival_id, {
        k: s.festival_id,
        name: s.festival_name || s.festival_id,
        city: s.city || '',
        accent: s.accent || '#F4A93C',
      });
    }
    return [...map.values()].sort((a, b) => (counts[b.k] || 0) - (counts[a.k] || 0)).slice(0, 30);
  }, [sets, counts]);

  const filtered = useMemo(() => {
    if (!sets) return [];
    if (!selectedVenue || selectedVenue === 'all') {
      // Cap at 3 per venue so no single venue dominates the All view
      const seen = {};
      return sets.filter((s) => {
        seen[s.festival_id] = (seen[s.festival_id] || 0) + 1;
        return seen[s.festival_id] <= 3;
      });
    }
    return sets.filter((s) => s.festival_id === selectedVenue);
  }, [sets, selectedVenue]);

  const featured = sets?.find((s) => s.festival_id === selectedVenue);

  if (!sets) return <div style={{ padding: 40, opacity: 0.5, textAlign: 'center' }}>Loading vault…</div>;

  return (
    <div className="tg-root">
      <div className="tg-filters">
        <button
          className={'tg-chip' + (!selectedVenue || selectedVenue === 'all' ? ' on' : '')}
          onClick={() => setSelectedVenue('all')}
        >
          All <span className="tg-count">{counts.all}</span>
        </button>
        {(showAllChips ? chips : chips.slice(0, CHIPS_VISIBLE)).map((v) => (
          <button
            key={v.k}
            className={'tg-chip' + (selectedVenue === v.k ? ' on' : '')}
            onClick={() => setSelectedVenue(v.k)}
          >
            <span className="tg-chip-dot" style={{ background: v.accent }} />
            {v.name}
            <span className="tg-count">{counts[v.k]}</span>
            <span className="tg-chip-blurb">{v.city}</span>
          </button>
        ))}
        {chips.length > CHIPS_VISIBLE && (
          <button
            className="tg-chip"
            onClick={() => setShowAllChips((x) => !x)}
          >
            {showAllChips ? '− Less' : `+ ${chips.length - CHIPS_VISIBLE} more`}
          </button>
        )}
      </div>

      {nextEvent && selectedVenue !== 'all' && (
        <div
          style={{
            margin: '16px 24px',
            padding: 16,
            background: 'rgba(255,255,255,.05)',
            border: '1px solid ' + ((featured?.accent || '#555') + '44'),
            borderRadius: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 4 }}>
              Next Event
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>{nextEvent.title}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>
              {new Date(nextEvent.starts_at).toLocaleDateString(undefined, {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              {nextEvent.headliner ? ' · ' + nextEvent.headliner : ''}
            </div>
            {nextEvent.supporting_acts?.length > 0 && (
              <div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>{nextEvent.supporting_acts.join(' · ')}</div>
            )}
          </div>
          {nextEvent.ticket_url && (
            <a
              href={nextEvent.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                background: featured?.accent || '#fff',
                color: '#000',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Get Tickets{nextEvent.ticket_price_from ? ` · $${nextEvent.ticket_price_from}` : ''}
            </a>
          )}
        </div>
      )}

      {selectedVenue !== 'all' && featured && (
        <div style={{ padding: '20px 24px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.5 }}>
            Featured Venue
          </div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: '-.03em' }}>
            {featured.festival_name || featured.festival_id}
          </h2>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {counts[selectedVenue] || 0} sets in vault{featured.city ? ' · ' + featured.city : ''}
          </div>
        </div>
      )}

      <div className="tg-grid">
        {filtered.map((s) => (
          <div key={s.video_id} className="tg-tile" onClick={() => setPlaying(s)}>
            <div className="tg-frame">
              <img
                className="tg-thumb"
                loading="lazy"
                alt={s.artist}
                src={`https://img.youtube.com/vi/${s.video_id}/hqdefault.jpg`}
              />
              <div className="tg-play" style={{ borderColor: s.accent || '#F4A93C' }}>
                <span style={{ color: s.accent || '#F4A93C' }}>▷</span>
              </div>
            </div>
            <div className="tg-meta">
              <div className="tg-artist">{parseArtist(s.artist)}</div>
              <div className="tg-fest">
                {s.festival_name}
                {s.city ? ` · ${s.city}` : ''}
              </div>
            </div>
          </div>
        ))}
      </div>

      {playing && (
        <div
          onClick={(e) => e.target === e.currentTarget && setPlaying(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 900, aspectRatio: '16/9' }}>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${playing.video_id}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              style={{ border: 0, borderRadius: 12 }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
