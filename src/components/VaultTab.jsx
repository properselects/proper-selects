import React, { useEffect, useMemo, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';
import { fetchNextEvent, EventStrip } from '../lib/venueEvents.jsx';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import IdRadar from './IdRadar.jsx';
import { ytSeek } from '../lib/ytPostMessage.js';

const CHIPS_VISIBLE = 10;

// Normalize a raw artist string into a stable grouping key.
const artistKey = (a) => parseArtist(a || '').trim().toLowerCase();

/**
 * Vault — artist-scoped grid of every set in the DB.
 * Features:
 *   - Featured Artist banner (auto-picks artist with most sets, or from psVaultArtist localStorage)
 *   - Set grid with clickable tiles (opens YouTube iframe overlay)
 */
async function fetchVault() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?select=*&limit=500`,
    { headers: supabaseHeaders }
  );
  return r.ok ? r.json() : [];
}

// Fetch all artists (paginated) for accurate chip counts — lightweight rows, no data bloat.
async function fetchAllArtists() {
  const rows = [];
  const PAGE = 1000;
  for (let offset = 0; offset < 10000; offset += PAGE) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/vault_sets?select=artist&limit=${PAGE}&offset=${offset}`,
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
  const [selectedArtist, setSelectedArtist] = useState('');
  const [playing, setPlaying] = useState(null);
  const playerFrame = React.useRef(null);
  const [playingEvent, setPlayingEvent] = useState(null);
  const [showAllChips, setShowAllChips] = useState(false);

  useEffect(() => {
    fetchVault().then(setSets).catch(() => setSets([]));
    fetchAllArtists().then(setAllIds).catch(() => {});
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

  // On load, pick artist from localStorage or fall back to top-set-count
  useEffect(() => {
    if (selectedArtist || !sets?.length) return;
    let pick = '';
    try {
      const lv = localStorage.getItem('psVaultArtist');
      const lvDate = localStorage.getItem('psVaultArtistDate');
      const today = new Date().toISOString().slice(0, 10);
      // Only reuse the stored artist if it was picked TODAY
      if (lv && lvDate === today && sets.find((s) => artistKey(s.artist) === lv)) pick = lv;
    } catch {}
    if (!pick) {
      // Featured artist rotates daily — deterministic pick from all artists with ≥3 sets
      const artists = [...new Set(sets.map((s) => artistKey(s.artist)).filter(Boolean))];
      const eligible = artists.filter((a) => sets.filter((s) => artistKey(s.artist) === a).length >= 3);
      const pool = eligible.length ? eligible : artists;
      // Day-of-year seed → same artist for all users on the same day, rotates each day
      const now = new Date();
      const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
      pick = pool[dayOfYear % pool.length];
      try {
        localStorage.setItem('psVaultArtist', pick);
        localStorage.setItem('psVaultArtistDate', now.toISOString().slice(0, 10));
      } catch {}
    }
    if (pick) setSelectedArtist(pick);
  }, [sets, selectedArtist]);

  // Listen for sidebar-driven artist changes
  useEffect(() => {
    const h = () => {
      try {
        const lv = localStorage.getItem('psVaultArtist');
        if (lv && sets?.find((s) => artistKey(s.artist) === lv)) setSelectedArtist(lv);
      } catch {}
    };
    window.addEventListener('focus', h);
    window.addEventListener('psVaultSelect', h);
    return () => {
      window.removeEventListener('focus', h);
      window.removeEventListener('psVaultSelect', h);
    };
  }, [sets]);

  const counts = useMemo(() => {
    // Use paginated allIds for accurate per-artist totals; fall back to the 500-set sample while loading.
    const source = allIds || sets || [];
    const c = { all: (allIds ? allIds.length : sets?.length) || 0 };
    for (const s of source) {
      const k = artistKey(s.artist);
      if (k) c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [sets, allIds]);

  const chips = useMemo(() => {
    if (!sets) return [];
    const map = new Map();
    for (const s of sets) {
      const k = artistKey(s.artist);
      if (!k || map.has(k)) continue;
      map.set(k, {
        k,
        name: parseArtist(s.artist || ''),   // display-cased artist name
        accent: s.accent || '#F4A93C',
      });
    }
    return [...map.values()].sort((a, b) => (counts[b.k] || 0) - (counts[a.k] || 0)).slice(0, 30);
  }, [sets, counts]);

  // When a specific artist is selected, fetch their FULL set list — the initial
  // 500-set (newest-first) load can miss an artist's older classics that fall
  // outside the recency window. We can't filter by the parsed key server-side,
  // so we do a broad ILIKE on the first token of the parsed artist name, then
  // client-filter by exact artistKey for precision.
  const [venueSets, setVenueSets] = useState(null);
  useEffect(() => {
    if (!selectedArtist || selectedArtist === 'all') { setVenueSets(null); return; }
    let cancelled = false;
    setVenueSets(null);
    // Derive a coarse search token from the selected artist key (first word).
    const token = selectedArtist.split(/\s+/)[0] || selectedArtist;
    fetch(`${SUPABASE_URL}/rest/v1/vault_sets?select=*&artist=ilike.*${encodeURIComponent(token)}*&order=published_at.desc&limit=200`, { headers: supabaseHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (cancelled) return;
        const arr = Array.isArray(rows) ? rows : [];
        // Precise: keep only rows whose parsed artistKey matches the selection.
        setVenueSets(arr.filter((s) => artistKey(s.artist) === selectedArtist));
      })
      .catch(() => { if (!cancelled) setVenueSets([]); });
    return () => { cancelled = true; };
  }, [selectedArtist]);

  const filtered = useMemo(() => {
    if (selectedArtist && selectedArtist !== 'all') {
      // Prefer the complete per-artist fetch; fall back to the cached page while it loads
      if (venueSets) return venueSets;
      return sets ? sets.filter((s) => artistKey(s.artist) === selectedArtist) : [];
    }
    if (!sets) return [];
    // Cap at 3 per artist so no single artist dominates the All view
    const seen = {};
    return sets.filter((s) => {
      const k = artistKey(s.artist);
      seen[k] = (seen[k] || 0) + 1;
      return seen[k] <= 3;
    });
  }, [sets, selectedArtist, venueSets]);

  const featured = (venueSets && venueSets[0]) || sets?.find((s) => artistKey(s.artist) === selectedArtist);

  if (!sets) return <div style={{ padding: 40, opacity: 0.5, textAlign: 'center' }}>Loading vault…</div>;

  return (
    <div className="tg-root">
      <div className="tg-filters">
        <button
          className={'tg-chip' + (!selectedArtist || selectedArtist === 'all' ? ' on' : '')}
          onClick={() => setSelectedArtist('all')}
        >
          All <span className="tg-count">{counts.all}</span>
        </button>
        {(showAllChips ? chips : chips.slice(0, CHIPS_VISIBLE)).map((v) => (
          <button
            key={v.k}
            className={'tg-chip' + (selectedArtist === v.k ? ' on' : '')}
            onClick={() => setSelectedArtist(v.k)}
          >
            <span className="tg-chip-dot" style={{ background: v.accent }} />
            {v.name}
            <span className="tg-count">{counts[v.k]}</span>
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

      {selectedArtist !== 'all' && featured && (
        <div style={{ padding: '20px 24px 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', opacity: 0.5 }}>
            Featured Artist
          </div>
          <h2 style={{ fontSize: 'clamp(32px,5vw,60px)', fontWeight: 800, margin: 0, lineHeight: 1, letterSpacing: '-.03em' }}>
            {parseArtist(featured.artist || '')}
          </h2>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {(venueSets ? venueSets.length : counts[selectedArtist]) || 0} sets in vault{featured.city ? ' · ' + featured.city : ''}
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
