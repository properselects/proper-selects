import React, { useEffect, useMemo, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';
import { fetchNextEvent, EventStrip } from '../lib/venueEvents.jsx';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import IdRadar from './IdRadar.jsx';
import { ytSeek } from '../lib/ytPostMessage.js';

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

// Fetch all festival_ids (paginated) for accurate chip counts — lightweight rows, no data bloat.
async function fetchAllFestivalIds() {
  const rows = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 10000; offset += PAGE) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/vault_sets?select=festival_id&limit=${PAGE}&offset=${offset}`,
      { headers: supabaseHeaders }
    );
    if (!r.ok) break;
    const batch = await r.json();
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}


export default function VaultTab({ lineup = [], onLineupChange, onNowPlaying }) {
  const lineupIds = React.useMemo(() => new Set((lineup || []).map((s) => s.video_id)), [lineup]);

  function toggleLineup(s) {
    if (lineupIds.has(s.video_id)) {
      onLineupChange && onLineupChange(lineup.filter((x) => x.video_id !== s.video_id));
    } else {
      if (lineup.length >= 12) return;
      onLineupChange && onLineupChange([...lineup, s]);
    }
  }

  const [sets, setSets] = useState(null);
  const [allIds, setAllIds] = useState(null);
  const [selectedVenue, setSelectedVenue] = useState('');
  const [playing, setPlaying] = useState(null);
  const playerFrame = React.useRef(null);
  const [nextEvent, setNextEvent] = useState(null);
  const [playingEvent, setPlayingEvent] = useState(null);
  const [showAllChips, setShowAllChips] = useState(false);

  useEffect(() => {
    fetchVault().then(setSets).catch(() => setSets([]));
    fetchAllFestivalIds().then(setAllIds).catch(() => {});
  }, []);

  // Single-player coordination: when a set is playing here, stop other surfaces.
  useEffect(() => {
    if (!playing) return;
    startExclusive('vault');
    registerPlayer('vault', () => setPlaying(null));
    lockScroll();
    onNowPlaying?.({
      video_id: playing.video_id,
      artist: playing.artist,
      festival_name: playing.festival_name,
      city: playing.city,
    });
    return () => { unregisterPlayer('vault'); unlockScroll(); };
  }, [playing]);

  // On load, pick venue from localStorage or fall back to top-set-count
  useEffect(() => {
    if (selectedVenue || !sets?.length) return;
    let pick = '';
    try {
      const lv = localStorage.getItem('psVaultVenue');
      const lvDate = localStorage.getItem('psVaultVenueDate');
      const today = new Date().toISOString().slice(0, 10);
      // Only reuse the stored venue if it was picked TODAY
      if (lv && lvDate === today && sets.find((s) => s.festival_id === lv)) pick = lv;
    } catch {}
    if (!pick) {
      // Featured venue rotates daily — deterministic pick from all venues with ≥3 sets
      const venues = [...new Set(sets.map((s) => s.festival_id).filter(Boolean))];
      const eligible = venues.filter((v) => sets.filter((s) => s.festival_id === v).length >= 3);
      const pool = eligible.length ? eligible : venues;
      // Day-of-year seed → same venue for all users on the same day, rotates each day
      const now = new Date();
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      pick = pool[dayOfYear % pool.length];
      try {
        localStorage.setItem('psVaultVenue', pick);
        localStorage.setItem('psVaultVenueDate', now.toISOString().slice(0, 10));
      } catch {}
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
    // Use paginated allIds for accurate per-venue totals; fall back to the 500-set sample while loading.
    const source = allIds || sets || [];
    const c = { all: (allIds ? allIds.length : sets?.length) || 0 };
    for (const s of source) if (s.festival_id) c[s.festival_id] = (c[s.festival_id] || 0) + 1;
    return c;
  }, [sets, allIds]);

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

  // When a specific venue is selected, fetch its FULL set list — the initial
  // 500-set (newest-first) load can miss a venue's older classics (e.g. Boiler
  // Room sets from 2013–2019 that fall outside the recency window).
  const [venueSets, setVenueSets] = useState(null);
  useEffect(() => {
    if (!selectedVenue || selectedVenue === 'all') { setVenueSets(null); return; }
    let cancelled = false;
    setVenueSets(null);
    fetch(`${SUPABASE_URL}/rest/v1/vault_sets?select=*&festival_id=eq.${encodeURIComponent(selectedVenue)}&order=published_at.desc&limit=200`, { headers: supabaseHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => { if (!cancelled) setVenueSets(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setVenueSets([]); });
    return () => { cancelled = true; };
  }, [selectedVenue]);

  const filtered = useMemo(() => {
    if (selectedVenue && selectedVenue !== 'all') {
      // Prefer the complete per-venue fetch; fall back to the cached page while it loads
      if (venueSets) return venueSets;
      return sets ? sets.filter((s) => s.festival_id === selectedVenue) : [];
    }
    if (!sets) return [];
    // Cap at 3 per venue so no single venue dominates the All view
    const seen = {};
    return sets.filter((s) => {
      seen[s.festival_id] = (seen[s.festival_id] || 0) + 1;
      return seen[s.festival_id] <= 3;
    });
  }, [sets, selectedVenue, venueSets]);

  const featured = (venueSets && venueSets[0]) || sets?.find((s) => s.festival_id === selectedVenue);

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
            {(venueSets ? venueSets.length : counts[selectedVenue]) || 0} sets in vault{featured.city ? ' · ' + featured.city : ''}
          </div>
        </div>
      )}

      <div className="tg-grid">
        {filtered.map((s) => (
          <div key={s.video_id} className="tg-tile" onClick={() => { setPlaying(s); setPlayingEvent(null); fetchNextEvent(s.festival_id).then(setPlayingEvent).catch(() => {}); }} style={{ position: 'relative' }}>
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
            <div className="tg-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tg-artist">{parseArtist(s.artist)}</div>
                <div className="tg-fest">
                  {s.festival_name}
                  {s.city ? ` · ${s.city}` : ''}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); toggleLineup(s); }}
                title={lineupIds.has(s.video_id) ? 'Remove from lineup' : 'Add to lineup'}
                style={{
                  background: 'none', border: 'none', flexShrink: 0,
                  color: lineupIds.has(s.video_id) ? (s.accent || '#F4A93C') : 'rgba(237,234,226,.3)',
                  fontSize: 18, cursor: 'pointer', padding: '4px', lineHeight: 1,
                }}
              >
                {lineupIds.has(s.video_id) ? '◈' : '＋'}
              </button>
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
          <div style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setPlaying(null)} className="jb-modal-close">✕ Close</button>
            </div>
            <div style={{ aspectRatio: '16/9' }}>
              <iframe
                ref={playerFrame}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${playing.video_id}?autoplay=1&rel=0&enablejsapi=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ border: 0, borderRadius: 12 }}
              />
            </div>
            <EventStrip
              event={playingEvent}
              accent={playing.accent || '#F4A93C'}
              label={playing.festival_name ? `UPCOMING AT ${playing.festival_name.toUpperCase()}` : 'UPCOMING'}
            />
            <IdRadar
              videoId={playing.video_id}
              accent={playing.accent || '#F4A93C'}
              onSeek={(s) => ytSeek(playerFrame.current, s)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
