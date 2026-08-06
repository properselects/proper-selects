import React, { useEffect, useMemo, useRef, useState } from 'react';
import { STAGES } from '../data/stages.js';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { geoRegion } from '../lib/geoRegion.js';
import { parseArtist } from '../lib/parseArtist.js';
import StagePlayer from './StagePlayer.jsx';

const BAD_CONTENT_RE = [
  /\bpanel\b/i, /\bdiscussion\b/i, /\binterview\b/i, /\bconference\b/i,
  /\bresearch\b/i, /\blab\s+finale\b/i, /\bresynthesising\b/i,
  /\baftermovie\b/i, /\brecap\b/i, /\btrailer\b/i, /\bdocumentary\b/i,
  /\bpodcast\b/i, /\bepisode\s*\d+/i, /\d{4}\s+\d{2}\s+\d{2}\s+\d{2}/,
  /\binjected\b/i, /\bkhao\s+san\b/i, /@beatport\s+live\b/i,
  /\bhip\s*[- ]?hop\b/i, /\bneo\s+soul\b/i, /\bchillhop\b/i, /\blo-?fi\b/i,
  /\btrap\s+(mix|set)\b/i, /\bdrill\b/i, /\breggaeton\b/i, /\bdancehall\b/i,
];

function isBadContent(row) {
  const t = (row.artist || row.title || '').toLowerCase();
  return BAD_CONTENT_RE.some((re) => re.test(t));
}

async function fetchLineup() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/todays_lineup?select=*`, { headers: supabaseHeaders });
  if (!r.ok) return [];
  const rows = await r.json();
  const seenId = new Set();
  return rows
    .filter((r) => !isBadContent(r))
    .filter((r) => {
      if (seenId.has(r.video_id)) return false;
      seenId.add(r.video_id);
      return true;
    })
    .map((r) => ({ ...r, vibe: geoRegion(r) }));
}

async function fetchIdMoments() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/set_id_moments?select=*`, { headers: supabaseHeaders });
  if (!r.ok) return {};
  const rows = await r.json();
  const map = {};
  for (const m of rows) (map[m.video_id] ??= []).push(m);
  return map;
}

function formatTs(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

// Dedupe sets by artist key so a DJ doesn't repeat within a stage's daily lineup
function djKey(t) {
  if (!t) return '';
  return t
    .toLowerCase()
    .split(/\s*[·@:]\s*/)[0]
    .split(/\s+-\s+/)[0]
    .replace(/\s+(live set|dj set|full set|live at)\b.*/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function CastBanner({ dismissed, onDismiss }) {
  if (dismissed) return null;
  return (
    <div className="jb-cast-banner">
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Don't know what set to play?</div>
        <div style={{ fontSize: 11, opacity: 0.65 }}>
          Hit play. Cast to your TV. Let the room take care of itself.
        </div>
      </div>
      <button className="jb-cast-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

function NearYouRow({ nearby }) {
  if (!nearby?.length) return null;
  return (
    <div className="jb-near">
      <div className="jb-near-head">
        <span>📍 Near you</span>
        <span style={{ opacity: 0.5, fontSize: 10 }}>upcoming shows</span>
      </div>
      <div className="jb-near-row">
        {nearby.map((e) => (
          <a
            key={e.festival_id}
            href={e.ticket_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="jb-near-card"
          >
            <div className="jb-near-venue">{e.venue_name}</div>
            <div className="jb-near-event">
              {e.headliner && e.headliner !== 'TBA' ? e.headliner : e.title}
            </div>
            <div className="jb-near-meta">
              {new Date(e.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ·{' '}
              {e.dist < 50 ? `${e.dist} mi away` : `${e.dist} mi`}
              {e.ticket_price_from ? ` · from $${e.ticket_price_from}` : ''}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function TodayTab({ lineup = [], onLineupChange, onOpenLineup }) {
  const lineupIds = React.useMemo(() => new Set((lineup || []).map((s) => s.video_id)), [lineup]);

  function toggleLineup(set) {
    if (lineupIds.has(set.video_id)) {
      onLineupChange && onLineupChange(lineup.filter((s) => s.video_id !== set.video_id));
    } else {
      if (lineup.length >= 12) { onOpenLineup && onOpenLineup(); return; }
      onLineupChange && onLineupChange([...lineup, set]);
    }
  }

  const [rows, setRows] = useState(null);
  const [stageIdx, setStageIdx] = useState(0);
  const [slotIdx, setSlotIdx] = useState(0);
  const [castDismissed, setCastDismissed] = useState(() => {
    try {
      return localStorage.getItem('psCastDismissed') === '1';
    } catch {
      return false;
    }
  });
  const [nearYou, setNearYou] = useState(null);
  const [idMoments, setIdMoments] = useState({});
  const [toast, setToast] = useState(null);
  const seekRef = useRef(null);
  const timeRef = useRef(null);

  useEffect(() => {
    fetchLineup().then(setRows).catch(() => setRows([]));
    fetchIdMoments().then(setIdMoments).catch(() => {});
  }, []);

  // Group sets by stage
  const byStage = useMemo(() => {
    const map = { americas: [], europe: [], worldwide: [] };
    if (rows) for (const r of rows) (map[r.vibe] || map.worldwide).push(r);
    return map;
  }, [rows]);

  const stage = STAGES[stageIdx];
  const rawSlots = byStage[stage.id] || [];

  // Dedupe by DJ key + cap per venue at 2 for variety
  const slots = useMemo(() => {
    const seenDj = new Set();
    const venueCounts = {};
    return rawSlots.filter((r) => {
      const k = djKey(r.artist || r.title);
      if (!k || seenDj.has(k)) return false;
      const vid = r.festival_id || 'unknown';
      if ((venueCounts[vid] || 0) >= 2) return false;
      seenDj.add(k);
      venueCounts[vid] = (venueCounts[vid] || 0) + 1;
      return true;
    });
  }, [rawSlots]);

  const current = slots[slotIdx];

  const advance = () => setSlotIdx((i) => (slots.length ? (i + 1) % slots.length : 0));

  const shareCurrent = async () => {
    if (!current) return;
    const t = Math.floor(timeRef.current?.() || 0);
    const url = `https://www.youtube.com/watch?v=${current.video_id}${t > 0 ? `&t=${t}s` : ''}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast({ label: 'Link copied ✓', accent: stage.accent });
      setTimeout(() => setToast(null), 1800);
    } catch {
      setToast({ label: 'Copy failed', accent: '#F87171' });
      setTimeout(() => setToast(null), 1800);
    }
  };

  // Near-you geolocation + event proximity
  useEffect(() => {
    if (nearYou !== null || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const now = new Date().toISOString();
        try {
          const r = await fetch(
            `${SUPABASE_URL}/rest/v1/events?verified=eq.true&starts_at=gte.${now}` +
              `&lat=not.is.null&select=festival_id,venue_name,title,starts_at,headliner,ticket_url,ticket_price_from,lat,lng` +
              `&order=starts_at.asc&limit=50`,
            { headers: supabaseHeaders }
          );
          const events = r.ok ? await r.json() : [];
          function hav(la1, lo1, la2, lo2) {
            const R = 3958.8;
            const dLat = ((la2 - la1) * Math.PI) / 180;
            const dLon = ((lo2 - lo1) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) ** 2 +
              Math.cos((la1 * Math.PI) / 180) * Math.cos((la2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
            return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          }
          const seen = new Set();
          const nearby = events
            .map((e) => ({ ...e, dist: Math.round(hav(latitude, longitude, e.lat, e.lng)) }))
            .filter((e) => {
              if (e.dist > 2000 || seen.has(e.festival_id)) return false;
              seen.add(e.festival_id);
              return true;
            })
            .sort((a, b) => a.dist - b.dist)
            .slice(0, 3);
          setNearYou(nearby.length ? nearby : []);
        } catch {
          setNearYou([]);
        }
      },
      () => setNearYou([]),
      { timeout: 5000, maximumAge: 3600000 }
    );
  }, []);

  const dismissCast = () => {
    try {
      localStorage.setItem('psCastDismissed', '1');
    } catch {}
    setCastDismissed(true);
  };

  const pickStage = (i) => {
    setStageIdx(i);
    setSlotIdx(0);
  };

  if (!rows) return <div style={{ padding: 40, opacity: 0.5, textAlign: 'center' }}>Loading lineup…</div>;

  return (
    <div className="jb-stage" style={{ background: stage.bg, color: stage.text }}>
      <header className="jb-top">
        <span className="jb-prog">today's program</span>
        <nav className="jb-tabs">
          {STAGES.map((s, i) => (
            <button
              key={s.id}
              className={'jb-tab' + (i === stageIdx ? ' on' : '')}
              style={i === stageIdx ? { borderColor: s.accent, color: s.accent } : undefined}
              onClick={() => pickStage(i)}
            >
              {s.name}
            </button>
          ))}
        </nav>
      </header>

      <div className="jb-body">
        <CastBanner dismissed={castDismissed} onDismiss={dismissCast} />
        <NearYouRow nearby={nearYou} />

        <div className="jb-head">
          <h2 className="jb-stage-name">{stage.name}</h2>
          <p className="jb-stage-tag">{stage.tagline}</p>
        </div>

        <div className="jb-playcol">
          {current ? (
            <>
              <StagePlayer set={current} onEnded={advance} seekRef={seekRef} timeRef={timeRef} />
              <div className="jb-actions">
                <button
                  className="jb-share"
                  onClick={shareCurrent}
                  style={{ borderColor: stage.accent, color: stage.accent }}
                >
                  Share at current time
                </button>
                <button
                  className="jb-share"
                  onClick={() => current && toggleLineup(current)}
                  style={{
                    borderColor: current && lineupIds.has(current.video_id) ? stage.accent : 'rgba(255,255,255,.2)',
                    color: current && lineupIds.has(current.video_id) ? stage.accent : 'rgba(237,234,226,.5)',
                  }}
                >
                  {current && lineupIds.has(current.video_id) ? '◈ In lineup' : '＋ Add to lineup'}
                </button>
              </div>
              {(idMoments[current.video_id] || []).length > 0 && (
                <div className="jb-radar">
                  <div className="jb-radar-head">
                    <span style={{ color: stage.accent }}>ID Radar</span>
                    <span className="jb-radar-sub">mined from the comments · tap to jump</span>
                  </div>
                  <div className="jb-radar-row">
                    {idMoments[current.video_id].map((v, d) => (
                      <button
                        key={d}
                        className={'jb-id' + (v.resolved ? ' resolved' : '')}
                        style={v.resolved ? { borderColor: stage.accent } : undefined}
                        onClick={() => seekRef.current && seekRef.current(v.t_sec)}
                        title={v.label}
                      >
                        <span className="jb-id-ts" style={{ color: stage.accent }}>{formatTs(v.t_sec)}</span>
                        <span className="jb-id-label">{v.resolved ? v.label : 'ID?'}</span>
                        {v.likes > 0 && <span className="jb-id-likes">▲{v.likes}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="jb-empty">No sets in today's program for this stage yet.</div>
          )}

          <div className="jb-list" style={{ background: stage.panel }}>
            <div className="jb-list-head">
              <span style={{ color: stage.accent }}>On {stage.name} today</span>
              <span className="jb-list-sub">new lineup at midnight</span>
            </div>
            {slots.map((v, d) => (
              <div key={v.video_id} style={{ display: 'flex', alignItems: 'center' }}>
                <button
                  className={'jb-slot' + (d === slotIdx ? ' on' : '')}
                  onClick={() => setSlotIdx(d)}
                  style={{ flex: 1, ...(d === slotIdx ? { borderColor: stage.accent } : {}) }}
                >
                  <span className="jb-slot-num" style={{ color: stage.accent }}>
                    {String(d + 1).padStart(2, '0')}
                  </span>
                  <img
                    className="jb-slot-thumb"
                    src={`https://img.youtube.com/vi/${v.video_id}/default.jpg`}
                    alt=""
                    loading="lazy"
                  />
                  <span className="jb-slot-main">
                    <span className="jb-slot-artist">{parseArtist(v.artist)}</span>
                    <span className="jb-slot-meta">
                      {v.festival_name}
                      {v.city ? ` · ${v.city}` : ''}
                    </span>
                  </span>
                  {d === slotIdx && <span style={{ color: stage.accent }}>▷</span>}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleLineup(v); }}
                  title={lineupIds.has(v.video_id) ? 'Remove from lineup' : 'Add to lineup'}
                  style={{
                    background: 'none', border: 'none', padding: '0 12px',
                    color: lineupIds.has(v.video_id) ? stage.accent : 'rgba(237,234,226,.3)',
                    fontSize: 16, cursor: 'pointer', flexShrink: 0, lineHeight: 1,
                  }}
                >
                  {lineupIds.has(v.video_id) ? '◈' : '＋'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {toast && (
        <div className="jb-toast" style={{ borderColor: toast.accent }}>
          <span className="jb-toast-label">{toast.label}</span>
        </div>
      )}
    </div>
  );
}
