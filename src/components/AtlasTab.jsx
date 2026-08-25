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
  const venueRes = await fetch(`${SUPABASE_URL}/rest/v1/festivals?select=id,name,city,country,lat,lng,accent,region,promo_code,promo_label,promo_url,ticket_url,partner,is_venue&active=eq.true`, { headers: supabaseHeaders });
  const venues = venueRes.ok ? await venueRes.json() : [];

  // Page through the whole vault to collect per-festival stats (count + latest thumbnail).
  const festIdsWithSets = new Set();
  const festCounts = {};
  const festThumb = {}; // latest video_id per festival (vault is ordered by published_at desc via video_id asc here, so we take last seen)
  const PAGE = 1000;
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/vault_sets?select=festival_id,video_id,artist,title&order=published_at.desc&limit=${PAGE}&offset=${offset}`,
      { headers: supabaseHeaders }
    );
    if (!r.ok) break;
    const batch = await r.json();
    batch.filter((s) => !hiddenOnAtlas(s)).forEach((s) => {
      festIdsWithSets.add(s.festival_id);
      festCounts[s.festival_id] = (festCounts[s.festival_id] || 0) + 1;
      // First occurrence = most-recent set (order=published_at.desc)
      if (!festThumb[s.festival_id]) festThumb[s.festival_id] = s.video_id;
    });
    if (batch.length < PAGE) break;
  }
  return venues
    .filter((v) => festIdsWithSets.has(v.id))
    .map((v) => ({ ...v, setCount: festCounts[v.id] || 0, thumbId: festThumb[v.id] || null }));
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

// Group venues by city for city-level map pins.
// Returns array of { key, city, country, lat, lng, region, accent, venues[] }
// Group venues into one pin per physical city. The `country` field is unreliable
// (same city tagged DE/Germany/"Worldwide", US/USA, ES/null…), so we ignore it and
// cluster by city name + geographic proximity instead: venues sharing a (normalized)
// city name that sit within ~1.2° of each other merge; genuinely different same-named
// cities (e.g. Paris FR vs Paris TX) stay separate because they're far apart.
function groupByCity(venues) {
  const NEAR = 1.2; // degrees (~130km): larger than any city's sprawl, small enough to split distinct cities
  const byName = {};
  for (const v of venues) {
    if (v.lat == null || v.lng == null) continue;
    const nk = (v.city || '').trim().toLowerCase();
    (byName[nk] = byName[nk] || []).push(v);
  }
  const groups = [];
  for (const nk in byName) {
    const clusters = [];
    for (const v of byName[nk]) {
      let c = clusters.find((cl) => Math.abs(cl.lat - v.lat) < NEAR && Math.abs(cl.lng - v.lng) < NEAR);
      if (!c) {
        c = { key: `${nk}_${clusters.length}`, city: v.city || '', country: v.country || '',
              lat: v.lat, lng: v.lng, region: v.region, accent: v.accent || '#F4A93C', venues: [] };
        clusters.push(c);
      }
      c.venues.push(v);
    }
    groups.push(...clusters);
  }
  // Represent each city by its highest-set venue (color, exact coords, region label).
  return groups.map((g) => {
    const top = g.venues.slice().sort((a, b) => b.setCount - a.setCount)[0];
    return { ...g, accent: top?.accent || g.accent, city: top?.city || g.city,
             lat: top?.lat ?? g.lat, lng: top?.lng ?? g.lng, region: top?.region || g.region };
  });
}

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
  const mapInitialized = useRef(false);
  const [venues, setVenues] = useState([]);
  const [cityGroups, setCityGroups] = useState([]);
  const [selectedCity, setSelectedCity] = useState(null); // city group (has .venues[])
  const [selected, setSelected] = useState(null);         // specific festival
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [playing, setPlaying] = useState(null);
  const [regionFilter, setRegionFilter] = useState('all');
  const [atlasView, setAtlasView] = useState('map'); // 'map' | 'directory' | 'cities'
  const [dirRegion, setDirRegion] = useState(null); // null = region picker, else 'americas'|'europe'|'worldwide'
  const [citySearch, setCitySearch] = useState('');
  const playerFrame = useRef(null);

  function openCity(group) {
    if (group.venues.length === 1) {
      setSelectedCity(null);
      setSelected(group.venues[0]);
    } else {
      setSelectedCity(group);
      setSelected(null);
    }
  }

  useEffect(() => {
    fetchVenuesWithSets().then((v) => {
      setVenues(v);
      setCityGroups(groupByCity(v));
    }).catch(() => {});
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

  // Keep openCity in a ref so the stable map marker click handlers can always call the latest version.
  const openCityRef = useRef(openCity);
  useEffect(() => { openCityRef.current = openCity; });

  // Initialize only when the tab is visible — if we init in a display:none container,
  // MapLibre gets 0×0 dimensions and pins are placed wrong, causing a jump when the
  // tab becomes visible. Gate on isActive so the first render always has real dimensions.
  useEffect(() => {
    if (!cityGroups.length || !isActive || mapInitialized.current || !mapRef.current) return;
    mapInitialized.current = true;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [10, 25],
      zoom: 1.4,
      minZoom: 1,
      maxZoom: 16,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: true,
      doubleClickZoom: true,
      touchZoomRotate: true,
    });
    // Smooth scroll/pinch zoom (Set Roulette-style feel)
    try { map.scrollZoom.setWheelZoomRate(1 / 220); } catch {}
    try { map.scrollZoom.setZoomRate(1 / 110); } catch {}
    // Prominent +/- zoom controls, bottom-right
    map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => { try { map.resize(); } catch {} });

    // One pin per city group. Multi-festival cities show a count badge.
    for (const g of cityGroups) {
      const accent = g.accent || '#F4A93C';
      const multi = g.venues.length > 1;
      const isPartner = g.venues.some((v) => v.partner);
      const size = isPartner ? 20 : multi ? 18 : 14;

      const el = document.createElement('div');
      const HIT = 44;
      el.style.cssText = `width:${HIT}px;height:${HIT}px;display:flex;align-items:center;justify-content:center;`
        + `cursor:pointer;transition:opacity .2s;background:transparent;position:relative;`;

      const dot = document.createElement('div');
      dot.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${accent};`
        + `border:2px solid ${isPartner ? accent : '#0a0a0e'};box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 12px ${accent}66;`
        + `transition:transform .12s;pointer-events:none;`;
      if (isPartner) dot.style.boxShadow = `0 0 0 3px rgba(0,0,0,.4),0 0 18px ${accent}`;
      el.appendChild(dot);

      // Badge showing festival count for cities with multiple venues
      if (multi) {
        const badge = document.createElement('div');
        badge.style.cssText = `position:absolute;top:3px;right:3px;min-width:14px;height:14px;`
          + `border-radius:7px;background:${accent};color:#0a0a0e;font-size:8px;font-weight:900;`
          + `display:flex;align-items:center;justify-content:center;padding:0 3px;pointer-events:none;`
          + `border:1.5px solid #0a0a0e;`;
        badge.textContent = g.venues.length;
        el.appendChild(badge);
      }

      // City-name title (Set Roulette-style), revealed on zoom-in.
      const totalSets = g.venues.reduce((s, v) => s + (v.setCount || 0), 0);
      const fmtCount = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));
      const label = document.createElement('div');
      label.style.cssText = `position:absolute;left:calc(50% + ${size / 2 + 8}px);top:50%;`
        + `transform:translateY(-50%);white-space:nowrap;pointer-events:none;display:flex;`
        + `align-items:baseline;gap:5px;opacity:0;transition:opacity .18s;`;
      const nameEl = document.createElement('span');
      nameEl.textContent = (g.city || '').toUpperCase();
      nameEl.style.cssText = `font-size:11px;font-weight:800;letter-spacing:.02em;color:#101828;`
        + `text-shadow:0 0 3px #fff,0 1px 4px rgba(255,255,255,.95);`;
      const cntEl = document.createElement('span');
      cntEl.textContent = fmtCount(totalSets);
      cntEl.style.cssText = `font-size:10px;font-weight:700;color:${accent};`
        + `text-shadow:0 0 3px #fff,0 1px 4px rgba(255,255,255,.95);`;
      label.appendChild(nameEl); label.appendChild(cntEl);
      el.appendChild(label);
      // Bigger cities reveal their title at lower zoom levels
      el._label = label;
      el._labelMinZoom = totalSets >= 1000 ? 0 : totalSets >= 300 ? 2.4 : totalSets >= 60 ? 3.2 : 4.2;

      el.addEventListener('mouseenter', () => { dot.style.transform = 'scale(1.35)'; });
      el.addEventListener('mouseleave', () => { dot.style.transform = 'scale(1)'; });
      el.addEventListener('touchstart', (e) => { e.stopPropagation(); }, { passive: true });
      el.addEventListener('touchend', (e) => { e.stopPropagation(); }, { passive: true });
      el.addEventListener('click', (e) => { e.stopPropagation(); openCityRef.current(g); });

      const marker = new maplibregl.Marker({ element: el }).setLngLat([g.lng, g.lat]).addTo(map);
      marker._venueRegion = g.region;
      marker._el = el;
      markersRef.current.push(marker);
    }

    // Reveal city-name titles progressively as the map zooms in (Set Roulette-style).
    const syncLabels = () => {
      const z = map.getZoom();
      for (const mk of markersRef.current) {
        const el = mk._el;
        if (el && el._label) el._label.style.opacity = z >= el._labelMinZoom ? '1' : '0';
      }
    };
    map.on('zoom', syncLabels);
    map.on('load', syncLabels);
    syncLabels();

    mapInstance.current = map;
    // No cleanup here — map stays alive across tab switches (display:none/block).
  }, [cityGroups, isActive]);

  // True cleanup only on component unmount.
  useEffect(() => {
    return () => {
      try { markersRef.current.forEach((m) => m.remove()); } catch {}
      markersRef.current = [];
      try { mapInstance.current?.remove(); } catch {}
      mapInstance.current = null;
      mapInitialized.current = false;
    };
  }, []);

  useEffect(() => {
    if (!selected) {
      setSelectedSets([]);
      setSelectedEvents([]);
      return;
    }
    fetchSetsForVenue(selected.id).then(setSelectedSets).catch(() => setSelectedSets([]));
    fetchUpcomingEvents(selected.id).then(setSelectedEvents).catch(() => setSelectedEvents([]));
  }, [selected]);

  // When tab becomes visible, tell MapLibre to recalculate its size after paint.
  useEffect(() => {
    if (isActive && mapInstance.current) {
      requestAnimationFrame(() => { try { mapInstance.current?.resize(); } catch {} });
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

  const filteredVenues = regionFilter === 'all'
    ? venues
    : venues.filter((v) => v.region === regionFilter);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0a0a0e' }}>
      <div ref={mapRef} style={{ position: 'absolute', inset: 0, display: atlasView === 'map' ? 'block' : 'none' }} />

      {/* Festival Directory: drill-down flow */}
      {atlasView === 'directory' && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0a0a0e' }}>
          {!dirRegion ? (
            /* Step 1: Region picker */
            <div style={{ padding: '48px 16px 24px' }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.18em', opacity: .35, marginBottom: 20, textTransform: 'uppercase' }}>
                Explore by Region
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { id: 'americas', label: 'Americas', sub: 'Club Space · ARC · Movement · CRSSD', color: '#F4A93C' },
                  { id: 'europe',   label: 'Europe',   sub: 'Awakenings · Tresor · DC-10 · Loveland', color: '#4FC3F7' },
                  { id: 'worldwide',label: 'Worldwide', sub: 'Cercle · Boiler Room · Mayan Warrior', color: '#FF3B57' },
                ].map((r) => {
                  const count = venues.filter((v) => v.region === r.id && v.is_venue !== false && v.setCount > 0).length;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setDirRegion(r.id)}
                      style={{
                        background: `linear-gradient(135deg, rgba(${r.id==='americas'?'244,169,60':'r.id'==='europe'?'79,195,247':'255,59,87'},.08) 0%, rgba(10,10,14,0) 100%)`,
                        border: `1px solid ${r.color}33`,
                        borderRadius: 14, padding: '20px 20px', cursor: 'pointer',
                        textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'border-color .15s',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: r.color, letterSpacing: '-.02em' }}>{r.label}</div>
                        <div style={{ fontSize: 11, opacity: .45, marginTop: 4, color: '#EDEAE2' }}>{r.sub}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: r.color }}>{count}</div>
                        <div style={{ fontSize: 9, opacity: .4, letterSpacing: '.08em' }}>VENUES</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Step 2: Festival grid for selected region */
            <div style={{ padding: '48px 12px 24px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))',
                gap: 10,
              }}>
                {venues
                  .filter((v) => v.region === dirRegion && v.is_venue !== false && v.setCount > 0)
                  .sort((a, b) => b.setCount - a.setCount)
                  .map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelected(v)}
                      style={{
                        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        textAlign: 'left', borderRadius: 10, overflow: 'hidden',
                        boxShadow: selected?.id === v.id
                          ? `0 0 0 2px ${v.accent || '#F4A93C'}`
                          : '0 0 0 1px rgba(255,255,255,.08)',
                        transition: 'box-shadow .15s',
                      }}
                    >
                      <div style={{ position: 'relative', aspectRatio: '16/9', background: '#111' }}>
                        {v.thumbId && (
                          <img
                            src={`https://img.youtube.com/vi/${v.thumbId}/mqdefault.jpg`}
                            alt={v.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            loading="lazy"
                          />
                        )}
                        <div style={{
                          position: 'absolute', inset: 0,
                          background: 'linear-gradient(to top, rgba(10,10,14,.95) 0%, rgba(10,10,14,.15) 60%, transparent 100%)',
                        }} />
                        <div style={{
                          position: 'absolute', top: 6, right: 6,
                          background: 'rgba(0,0,0,.7)', borderRadius: 4,
                          fontSize: 9, fontWeight: 800, letterSpacing: '.06em',
                          color: v.accent || '#F4A93C', padding: '2px 5px',
                        }}>
                          {v.setCount} sets
                        </div>
                      </div>
                      <div style={{ padding: '8px 10px 10px', background: '#111' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#EDEAE2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {v.name}
                        </div>
                        <div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>
                          {[v.city, v.country].filter(Boolean).join(', ')}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* City index view — alphabetical city grid with set counts */}
      {atlasView === 'cities' && (
        <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: '#0a0a0e' }}>
          <div style={{ padding: '48px 14px 24px' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 20 }}>
              <span style={{ opacity: .35, fontSize: 14 }}>⌕</span>
              <input
                type="text"
                placeholder="Search cities…"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                style={{ background: 'none', border: 'none', outline: 'none', color: '#EDEAE2', fontSize: 13, flex: 1, fontFamily: 'inherit' }}
              />
            </div>
            {/* City grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {cityGroups
                .filter((g) => {
                  const q = citySearch.trim().toLowerCase();
                  return !q || (g.city || '').toLowerCase().includes(q) || (g.country || '').toLowerCase().includes(q);
                })
                .slice()
                .sort((a, b) => (a.city || '').localeCompare(b.city || ''))
                .map((g) => {
                  const totalSets = g.venues.reduce((sum, v) => sum + (v.setCount || 0), 0);
                  const venueNames = g.venues.map((v) => v.name).join(' · ');
                  return (
                    <button
                      key={g.key}
                      onClick={() => {
                        setAtlasView('map');
                        setTimeout(() => {
                          openCity(g);
                          if (mapInstance.current) {
                            mapInstance.current.flyTo({ center: [g.lng, g.lat], zoom: 10, duration: 800 });
                          }
                        }, 50);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '11px 12px', borderRadius: 8,
                        background: 'none', border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                        transition: 'background .1s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{ fontSize: 15, fontWeight: 800, color: '#EDEAE2', letterSpacing: '-.01em' }}>
                            {(g.city || '').toUpperCase()}
                          </span>
                          <span style={{ fontSize: 11, opacity: .35, color: '#EDEAE2' }}>{g.country}</span>
                        </div>
                        <div style={{ fontSize: 10, opacity: .35, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>
                          {venueNames}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: g.accent || '#F4A93C' }}>{totalSets}</span>
                        <span style={{ fontSize: 9, opacity: .4, letterSpacing: '.08em' }}>sets</span>
                        <span style={{ color: g.accent || '#F4A93C', opacity: .5, fontSize: 12 }}>›</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Controls: view toggle + back button in directory mode */}
      <div className="am-controls">
        <div style={{ display: 'flex', gap: 4, marginRight: 8, borderRight: '1px solid rgba(255,255,255,.12)', paddingRight: 8 }}>
          {[
              { id: 'map', label: '🗺 Map' },
              { id: 'cities', label: '◉ Cities' },
              { id: 'directory', label: '◈ Festivals' },
            ].map((v) => (
            <button
              key={v.id}
              className={'am-region-chip' + (atlasView === v.id ? ' on' : '')}
              onClick={() => {
                setAtlasView(v.id);
                if (v.id === 'directory') { setDirRegion(null); setSelected(null); }
                if (v.id === 'cities') { setSelected(null); setSelectedCity(null); setSideOpen(false); setCitySearch(''); }
              }}
              style={atlasView === v.id ? { borderColor: '#EDEAE2', color: '#EDEAE2' } : undefined}
            >
              {v.label}
            </button>
          ))}
        </div>
        {atlasView === 'directory' && dirRegion && (
          <button
            className="am-region-chip"
            onClick={() => { setDirRegion(null); setSelected(null); }}
            style={{ marginRight: 4 }}
          >
            ← Back
          </button>
        )}
        {atlasView === 'map' && REGIONS.map((r) => (
          <button
            key={r.id}
            className={'am-region-chip' + (regionFilter === r.id ? ' on' : '')}
            onClick={() => setRegionFilter(r.id)}
            style={regionFilter === r.id ? { borderColor: r.color, color: r.color } : undefined}
          >
            {r.id !== 'all' && <span className="am-region-dot" style={{ background: r.color }} />}
            {r.label}
          </button>
        ))}
      </div>

      {/* Level 1 drawer: city with multiple festivals */}
      {selectedCity && !selected && (
        <div className={'am-drawer open'} style={{ borderColor: selectedCity.accent || '#F4A93C' }}>
          <button className="am-drawer-close" onClick={() => setSelectedCity(null)}>✕</button>
          <div className="am-drawer-city" style={{ color: selectedCity.accent || '#F4A93C' }}>
            {selectedCity.city}{selectedCity.country ? `, ${selectedCity.country}` : ''}
          </div>
          <h2 className="am-drawer-name" style={{ margin: '4px 0 16px' }}>
            {selectedCity.venues.length} Festivals
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedCity.venues
              .slice()
              .sort((a, b) => b.setCount - a.setCount)
              .map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelected(v)}
                  style={{
                    background: 'rgba(255,255,255,.04)', border: `1px solid ${v.accent || '#F4A93C'}33`,
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
                  }}
                >
                  {v.thumbId && (
                    <img
                      src={`https://img.youtube.com/vi/${v.thumbId}/mqdefault.jpg`}
                      alt={v.name}
                      style={{ width: 52, height: 34, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#EDEAE2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.name}</div>
                    <div style={{ fontSize: 10, color: v.accent || '#F4A93C', marginTop: 2 }}>{v.setCount} sets</div>
                  </div>
                  <span style={{ color: v.accent || '#F4A93C', fontSize: 14, flexShrink: 0 }}>›</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Level 2 drawer: sets for a specific festival */}
      {selected && (
        <div className={'am-drawer open'} style={{ borderColor: selected.accent || '#F4A93C' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            {selectedCity && (
              <button
                onClick={() => setSelected(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(237,234,226,.4)', fontSize: 13, padding: '0 4px 0 0', flexShrink: 0 }}
              >
                ‹
              </button>
            )}
            <button className="am-drawer-close" onClick={() => { setSelected(null); setSelectedCity(null); }}>✕</button>
          </div>
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
