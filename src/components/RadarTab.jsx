import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';

const YT_KEY = ''; // client-side we skip view fetch; server /api/radar has it

async function fetchRadarSets() {
  // Simple fetch of recent sets + venue join for the grid
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/public_sets?select=video_id,artist,festival_id,published_at&order=published_at.desc&limit=60`,
    { headers: supabaseHeaders }
  );
  return r.ok ? r.json() : [];
}

async function fetchVenues() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/festivals?select=id,name,city,accent,region&active=eq.true`, {
    headers: supabaseHeaders,
  });
  return r.ok ? r.json() : [];
}

async function fetchViewCounts(videoIds) {
  // Uses our /api/radar endpoint which has the server-side YouTube key
  try {
    const r = await fetch('/api/radar');
    if (!r.ok) return {};
    const data = await r.json();
    const out = {};
    for (const s of data?.sets || []) out[s.video_id] = s.views || 0;
    return out;
  } catch {
    return {};
  }
}

function formatViews(v) {
  if (!v || v === 0) return '—';
  if (v > 1e6) return (v / 1e6).toFixed(1) + 'M views';
  if (v > 1e3) return Math.round(v / 1e3) + 'K views';
  return v + ' views';
}

export default function RadarTab() {
  const [sets, setSets] = useState([]);
  const [venues, setVenues] = useState({});
  const [views, setViews] = useState({});
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    (async () => {
      const [rawSets, venueList] = await Promise.all([fetchRadarSets(), fetchVenues()]);
      const venueMap = {};
      for (const v of venueList) venueMap[v.id] = v;
      setVenues(venueMap);
      setSets(rawSets);
      // fire-and-forget view counts
      fetchViewCounts(rawSets.map((s) => s.video_id)).then(setViews);
    })();
  }, []);

  const sorted = [...sets].sort((a, b) => (views[b.video_id] || 0) - (views[a.video_id] || 0));

  return (
    <div style={{ background: '#06080c', minHeight: '100%', color: '#EDEAE2' }}>
      <header style={{ padding: '20px 24px 8px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '.16em' }}>
          PROPER SELECTS <span style={{ opacity: 0.5, fontSize: 11, letterSpacing: '.3em', marginLeft: 4 }}>RADAR</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.5, letterSpacing: '.14em', textTransform: 'uppercase' }}>
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22C55E',
              boxShadow: '0 0 8px #22C55E',
              marginRight: 6,
            }}
          />
          Most viewed this month
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 14,
          padding: '16px 20px 24px',
        }}
      >
        {sorted.map((s, i) => {
          const venue = venues[s.festival_id] || { name: s.festival_id, city: '', accent: '#F4A93C' };
          const isSelected = selected?.video_id === s.video_id;
          return (
            <div
              key={s.video_id}
              className="radar-card"
              style={{ '--acc': venue.accent }}
              onClick={() => setSelected(isSelected ? null : s)}
            >
              <div className="radar-thumb-wrap">
                <img
                  className="radar-thumb"
                  src={`https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`}
                  alt={s.artist}
                  draggable={false}
                />
                <div className="radar-thumb-grad" />
                {isSelected && <div className="radar-playing-badge">▷ PLAYING</div>}
                <div className="radar-rank">#{i + 1}</div>
              </div>
              <div className="radar-card-body">
                <div className="radar-festival" style={{ color: venue.accent }}>
                  {venue.name} · {venue.city}
                </div>
                <div className="radar-artist">{s.artist ?? 'ID'}</div>
                <div className="radar-views">{formatViews(views[s.video_id])}</div>
              </div>
            </div>
          );
        })}
      </div>

      {selected && (
        <div
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}
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
              src={`https://www.youtube.com/embed/${selected.video_id}?autoplay=1&rel=0`}
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
