import React, { useEffect, useRef, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import IdRadar from './IdRadar.jsx';
import { ytSeek } from '../lib/ytPostMessage.js';

// Artists hidden from the Atlas map (still fully searchable via the vault/search).
const ATLAS_HIDE_RE = /\badam\s*ten\b|\bmaccabi\b/i;
const hiddenOnAtlas = (s) => ATLAS_HIDE_RE.test(`${s.artist || ''} ${s.title || ''}`);

async function fetchVenuesWithSets() {
  const venueRes = await fetch(`${SUPABASE_URL}/rest/v1/festivals?select=id,name,city,country,lat,lng,accent,region,promo_code,promo_label,promo_url,ticket_url,partner&active=eq.true`, { headers: supabaseHeaders });
  const venues = venueRes.ok ? await venueRes.json() : [];

  // PostgREST caps every response at 1000 rows, so a single limit=4000 query only sees the 1000
  // newest sets — which silently drops any venue whose only sets are older (e.g. 2018 Boiler Rooms).
  // Page through the whole vault so every venue with a qualifying set earns its pin.
  const festIdsWithSets = new Set();
  const PAGE = 1000;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/vault_sets?select=festival_id,artist,title&order=video_id.asc&limit=${PAGE}&offset=${offset}`,
      { headers: supabaseHeaders }
    );
    if (!r.ok) break;
    const batch = await r.json();
    // A venue only earns a pin if it has at least one set that ISN'T a hidden artist,
    // so venues whose entire catalog is Adam Ten / Maccabi drop off the map.
    batch.filter((s) => !hiddenOnAtlas(s)).forEach((s) => festIdsWithSets.add(s.festival_id));
    if (batch.length < PAGE) break;
  }
  return venues.filter((v) => festIdsWithSets.has(v.id));
}

async function fetchSetsForVenue(festivalId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=video_id,artist,title,festival_name,city&order=published_at.desc&limit=500`,
    { headers: supabaseHeaders }
  );
  if (!r.ok) return [];
  const sets = await r.json();
  return sets.filter((s) => !hiddenOnAtlas(s));
}

async function fetchUpcomingEvents(festivalId) {
  const now = new Date().toISOString();
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/events?festival_id=eq.${encodeURIComponent(festivalId)}&starts_at=gte.${encodeURIComponent(now)}&select=id,title,headliner,supporting_acts,starts_at,ticket_url,ticket_price_from,sold_out&order=starts_at.asc&limit=3`,
    { headers: supabaseHeaders }
  );
  return r.ok ? r.json() : [];
}

const REGIONS = [
  { id: 'all',       label: 'All',       color: '#EDEAE2' },
  { id: 'americas',  label: 'Americas',  color: '#F4A93C' },
  { id: 'europe',    label: 'Europe',    color: '#4FC3F7' },
  { id: 'worldwide', label: 'Worldwide', color: '#FF3B57' },
];

export default function AtlasTab({ lineup = [], onLineupChange, isActive = false, onNowPlaying }) {
  const lineupIds = React.useMemo(() => new Set((lineup || []).map((s) => s.video_id)), [lineup]);

  function toggleLineup(s) {
    if (lineupIds.has(s.video_id)) {
      onLineupChange && onLineupChange(lineup.filter((x) => x.video_id !== s.video_id));
    } else {
      if (lineup.length >= 12) return;
      onLineupChange && onLineupChange([...lineup, s]);
    }
  }

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [venues, setVenues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const playerFrame = useRef(null);

  useEffect(() => {
    fetchVenuesWithSets().then(setVenues).catch(() => {});
  }, []);

  // Single-player coordination.
  useEffect(() => {
    if (!playing) return;
    startExclusive('atlas');
    registerPlayer('atlas', () => setPlaying(null));
    lockScroll();
    onNowPlaying?.({
      video_id: playing.video_id,
      artist: playing.artist,
      festival_name: playing.festival_name,
      city: playing.city,
    });
    return () => { unregisterPlayer('atlas'); unlockScroll(); };
  }, [playing]);

  useEffect(() => {
    if (!venues.length || mapInstance.current || !mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://tiles.openfreemap.org/styles/dark',
      center: [10, 25],
      zoom: 1.4,
      minZoom: 1,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => { try { map.resize(); } catch {} });

    for (const v of venues) {
      if (v.lat == null || v.lng == null) continue;
      const accent = v.accent || '#F4A93C';
      const isPartner = v.partner === true;
      const el = document.createElement('div');
      const size = isPartner ? 20 : 14;
      el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${accent};`
        + `border:2px solid ${isPartner ? accent : '#0a0a0e'};box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 12px ${accent}66;`
        + `cursor:pointer;transition:transform .12s,opacity .2s;`;
      if (isPartner) el.style.boxShadow = `0 0 0 3px rgba(0,0,0,.4),0 0 18px ${accent}`;
      el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.35)'; });
      el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)'; });
      el.addEventListener('click', (e) => { e.stopPropagation(); setSelected(v); });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([v.lng, v.lat]).addTo(map);
      marker._venueRegion = v.region;
      marker._el = el;
      markersRef.current.push(marker);
    }
    mapInstance.current = map;
    return () => {
      try { markersRef.current.forEach((m) => m.remove()); } catch {}
      markersRef.current = [];
      try { mapInstance.current?.remove(); } catch {}
      mapInstance.current = null;
    };
  }, [venues]);

  useEffect(() => {
    if (!selected) {
      setSelectedSets([]);
      setSelectedEvents([]);
      return;
    }
    fetchSetsForVenue(selected.id).then(setSelectedSets).catch(() => setSelectedSets([]));
    fetchUpcomingEvents(selected.id).then(setSelectedEvents).catch(() => setSelectedEvents([]));
  }, [selected]);

  // When tab becomes visible, tell MapLibre to recalculate its size
  useEffect(() => {
    if (isActive && mapInstance.current) {
      setTimeout(() => { try { mapInstance.current?.resize(); } catch {} }, 60);
    }
  }, [isActive]);

  // Show/hide markers based on region filter
  useEffect(() => {
    for (const m of markersRef.current) {
      const show = regionFilter === 'all' || m._venueRegion === regionFilter;
      if (m._el) {
        m._el.style.opacity = show ? '1' : '0.12';
        m._el.style.pointerEvents = show ? 'auto' : 'none';
      }
    }
  }, [regionFilter]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0e' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Region filter chips + legend */}
      <div className="am-controls">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            className={'am-region-chip' + (regionFilter === r.id ? ' on' : '')}
            onClick={() => setRegionFilter(r.id)}
            style={regionFilter === r.id ? { borderColor: r.color, color: r.color } : undefined}
          >
            {r.id !== 'all' && (
              <span className="am-region-dot" style={{ background: r.color }} />
            )}
            {r.label}
          </button>
        ))}
      </div>

      {selected && (
        <div className={'am-drawer open'} style={{ borderColor: selected.accent || '#F4A93C' }}>
          <button className="am-drawer-close" onClick={() => setSelected(null)}>
            ✕
          </button>
          <div className="am-drawer-city" style={{ color: selected.accent || '#F4A93C' }}>
            {selected.city}
            {selected.country ? `, ${selected.country}` : ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 className="am-drawer-name" style={{ margin: 0 }}>{selected.name}</h2>
            {selected.partner && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', padding: '2px 6px', borderRadius: 4, background: selected.accent || '#F4A93C', color: '#0a0a0e' }}>
                PARTNER
              </span>
            )}
          </div>
          <div className="am-drawer-region" style={{ marginTop: 4 }}>{selected.region}</div>

          {selected.ticket_url && (
            <a
              href={selected.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block', marginTop: 12,
                padding: '8px 16px', borderRadius: 8,
                background: selected.accent || '#F4A93C',
                color: '#0a0a0e', fontWeight: 800, fontSize: 12,
                textDecoration: 'none', letterSpacing: '.04em',
              }}
            >
              Get tickets →
            </a>
          )}

          {selected.promo_code && (
            <div className="am-promo">
              <div className="am-promo-label" style={{ color: selected.accent || '#F4A93C' }}>
                {selected.promo_label || 'Promo code'}
              </div>
              <div className="am-promo-row">
                <span className="am-promo-code">{selected.promo_code}</span>
                <button
                  className="am-promo-copy"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selected.promo_code);
                      const btn = event.currentTarget;
                      const orig = btn.textContent;
                      btn.textContent = 'Copied ✓';
                      setTimeout(() => (btn.textContent = orig), 1500);
                    } catch {}
                  }}
                >
                  Copy
                </button>
              </div>
              {selected.promo_url && (
                <a href={selected.promo_url} target="_blank" rel="noopener noreferrer" className="am-promo-link">
                  Redeem →
                </a>
              )}
            </div>
          )}

          {selectedEvents.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.18em', opacity: .4, marginBottom: 8 }}>UPCOMING SHOWS</div>
              {selectedEvents.map((ev) => {
                const date = new Date(ev.starts_at);
                const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                return (
                  <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#EDEAE2' }}>{ev.headliner || ev.title}</div>
                      <div style={{ fontSize: 10, opacity: .5, marginTop: 2 }}>{dateStr} · {timeStr}{ev.ticket_price_from ? ` · from $${ev.ticket_price_from}` : ''}</div>
                    </div>
                    {ev.ticket_url && !ev.sold_out && (
                      <a href={ev.ticket_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 800, color: selected.accent || '#F4A93C', textDecoration: 'none', flexShrink: 0, marginLeft: 8 }}>
                        Tickets →
                      </a>
                    )}
                    {ev.sold_out && <span style={{ fontSize: 10, opacity: .4, flexShrink: 0, marginLeft: 8 }}>Sold out</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="am-drawer-sets">
            {selectedSets.length === 0 ? (
              <div style={{ opacity: 0.4, fontSize: 12, padding: '20px 0' }}>No sets yet for this venue.</div>
            ) : (
              selectedSets.map((s) => (
                <div key={s.video_id} style={{ display: 'flex', alignItems: 'center' }}>
                <button className="am-set" onClick={() => setPlaying(s)} style={{ flex: 1 }}>
                  <img
                    src={`https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`}
                    alt={s.artist}
                    className="am-set-thumb"
                  />
                  <span className="am-set-name">{s.artist}</span>
                  <span className="am-set-play" style={{ color: selected.accent || '#F4A93C' }}>▷</span>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLineup(s); }}
                  title={lineupIds.has(s.video_id) ? 'Remove from lineup' : 'Add to lineup'}
                  style={{
                    background: 'none', border: 'none', flexShrink: 0,
                    color: lineupIds.has(s.video_id) ? (selected.accent || '#F4A93C') : 'rgba(237,234,226,.3)',
                    fontSize: 18, cursor: 'pointer', padding: '4px 8px', lineHeight: 1,
                  }}
                >
                  {lineupIds.has(s.video_id) ? '◈' : '＋'}
                </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {playing && (
        <div
          onClick={(e) => e.target === e.currentTarget && setPlaying(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.9)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }}>
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
