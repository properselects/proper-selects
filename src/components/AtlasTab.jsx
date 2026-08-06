import React, { useEffect, useRef, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { loadLeaflet } from '../lib/leaflet.js';

async function fetchVenuesWithSets() {
  const [venueRes, setRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/festivals?select=id,name,city,country,lat,lng,accent,region,promo_code,promo_label,promo_url&active=eq.true`, { headers: supabaseHeaders }),
    fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=festival_id&limit=2000`, { headers: supabaseHeaders }),
  ]);
  const venues = venueRes.ok ? await venueRes.json() : [];
  const sets = setRes.ok ? await setRes.json() : [];
  const festIdsWithSets = new Set(sets.map((s) => s.festival_id));
  return venues.filter((v) => festIdsWithSets.has(v.id));
}

async function fetchSetsForVenue(festivalId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?festival_id=eq.${encodeURIComponent(festivalId)}&select=video_id,artist,festival_name,city&limit=8`,
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

export default function AtlasTab({ lineup = [], onLineupChange }) {
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
  const [playing, setPlaying] = useState(null);
  const [regionFilter, setRegionFilter] = useState('all');

  useEffect(() => {
    fetchVenuesWithSets().then(setVenues).catch(() => {});
  }, []);

  useEffect(() => {
    if (!venues.length || mapInstance.current) return;
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current, {
        center: [30, 0],
        zoom: 2,
        worldCopyJump: true,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CartoDB',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);
      for (const v of venues) {
        if (v.lat == null || v.lng == null) continue;
        const accent = v.accent || '#F4A93C';
        const pin = L.circleMarker([v.lat, v.lng], {
          radius: 7,
          fillColor: accent,
          color: '#0a0a0e',
          weight: 2,
          fillOpacity: 0.95,
        });
        pin.on('click', () => setSelected(v));
        pin.addTo(map);
        pin._venueRegion = v.region;
        markersRef.current.push(pin);
      }
      mapInstance.current = map;
    });
    return () => {
      cancelled = true;
      try {
        mapInstance.current?.remove();
      } catch {}
      mapInstance.current = null;
    };
  }, [venues]);

  useEffect(() => {
    if (!selected) {
      setSelectedSets([]);
      return;
    }
    fetchSetsForVenue(selected.id).then(setSelectedSets).catch(() => setSelectedSets([]));
  }, [selected]);

  // Show/hide markers based on region filter
  useEffect(() => {
    for (const m of markersRef.current) {
      const show = regionFilter === 'all' || m._venueRegion === regionFilter;
      if (show) m.setStyle({ fillOpacity: 0.95, opacity: 1 });
      else m.setStyle({ fillOpacity: 0.08, opacity: 0.15 });
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
          <h2 className="am-drawer-name">{selected.name}</h2>
          <div className="am-drawer-region">{selected.region}</div>

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
