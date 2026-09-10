import React, { useEffect, useState } from 'react';

// ── helpers ────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function ytLink(videoId, tSec) {
  if (!videoId) return null;
  const t = tSec > 0 ? `&t=${tSec}s` : '';
  return `https://www.youtube.com/watch?v=${videoId}${t}`;
}

function ytThumb(videoId) {
  if (!videoId) return null;
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}

function accentColor(str) {
  const colors = ['#a78bfa','#f472b6','#34d399','#60a5fa','#fb923c','#facc15','#e879f9','#22d3ee'];
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function isIdLabel(title) { return /\bID\b/i.test(title || ''); }

// ── AppearanceCard ─────────────────────────────────────────────────────────

function AppearanceCard({ a, accent }) {
  const url = ytLink(a.video_id, a.t_sec);
  const thumb = ytThumb(a.video_id);
  const time = fmtTime(a.t_sec);
  const year = a.published_at ? new Date(a.published_at).getFullYear() : null;

  return (
    <a
      href={url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: 'block', textDecoration: 'none', padding: '0 16px 12px' }}
    >
      <div style={{
        borderRadius: 12,
        overflow: 'hidden',
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.07)',
        transition: 'border-color .15s',
      }}>
        {/* thumbnail with timestamp overlay */}
        {thumb && (
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#111' }}>
            <img
              src={thumb}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.85 }}
            />
            {/* dark gradient overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,.85) 0%, rgba(0,0,0,.1) 60%)',
            }} />
            {/* play button */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: `${accent}cc`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `0 0 20px ${accent}66`,
              }}>
                <span style={{ fontSize: 16, color: '#fff', marginLeft: 3 }}>▶</span>
              </div>
            </div>
            {/* timestamp badge */}
            {time && (
              <div style={{
                position: 'absolute', bottom: 8, right: 10,
                background: 'rgba(0,0,0,.8)',
                color: accent,
                fontSize: 11, fontWeight: 700,
                padding: '3px 7px', borderRadius: 6,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '.04em',
                border: `1px solid ${accent}44`,
              }}>
                ⏱ {time}
              </div>
            )}
          </div>
        )}

        {/* info bar */}
        <div style={{ padding: '10px 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.dj || 'Unknown DJ'}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(237,234,226,.38)', marginTop: 2 }}>
              {[a.festival_id?.replace(/-/g,' '), year].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{
            fontSize: 11, color: accent, fontWeight: 600, flexShrink: 0,
            background: `${accent}18`, padding: '4px 8px', borderRadius: 6,
            letterSpacing: '.04em',
          }}>
            Open ↗
          </div>
        </div>
      </div>
    </a>
  );
}

// ── TrackDetail ────────────────────────────────────────────────────────────

function TrackDetail({ track, appearances, onClose }) {
  const accent = accentColor(track.title);
  const isId = isIdLabel(track.title);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: '#07080d',
      display: 'flex', flexDirection: 'column',
      overflowY: 'auto',
    }}>
      {/* sticky header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 2,
        padding: '14px 16px',
        background: 'rgba(7,8,13,.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,.08)', border: 'none', borderRadius: '50%',
          width: 34, height: 34, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#edeae2', fontSize: 16, cursor: 'pointer',
        }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {track.title}
          </div>
          <div style={{ fontSize: 11, color: accent, marginTop: 1 }}>
            {track.set_count} set{track.set_count !== 1 ? 's' : ''}
          </div>
        </div>
        {isId && (
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.1em', color: accent, background: `${accent}20`, padding: '3px 8px', borderRadius: 20, border: `1px solid ${accent}40` }}>
            UNRELEASED
          </span>
        )}
      </div>

      {/* hero gradient */}
      <div style={{
        height: 6,
        background: `linear-gradient(90deg, ${accent}, transparent)`,
      }} />

      {/* section label */}
      <div style={{ padding: '18px 16px 6px', fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(237,234,226,.28)', fontWeight: 600 }}>
        {appearances.length > 0 ? `${appearances.length} appearances — tap to jump to the exact moment` : 'Loading appearances…'}
      </div>

      {/* appearance cards */}
      <div style={{ paddingBottom: 40 }}>
        {appearances.length === 0 && (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'rgba(237,234,226,.2)', fontSize: 13 }}>
            Loading…
          </div>
        )}
        {appearances.map((a, i) => (
          <AppearanceCard key={i} a={a} accent={accent} />
        ))}
      </div>
    </div>
  );
}

// ── TrackRow ───────────────────────────────────────────────────────────────

function TrackRow({ track, onClick }) {
  const accent = accentColor(track.title);
  const isId = isIdLabel(track.title);
  const djs = (track.djs || []).slice(0, 2);

  return (
    <div
      onClick={() => onClick(track)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,.04)',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* accent swatch */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: `${accent}14`, border: `1.5px solid ${accent}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isId
          ? <span style={{ fontSize: 10, fontWeight: 800, color: accent, letterSpacing: '.05em' }}>ID</span>
          : <span style={{ fontSize: 20, opacity: .55 }}>♪</span>
        }
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#edeae2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
          {track.title}
        </div>
        {djs.length > 0 && (
          <div style={{ fontSize: 11, color: 'rgba(237,234,226,.36)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {djs.join(' · ')}{(track.djs || []).length > 2 ? ` +${(track.djs || []).length - 2}` : ''}
          </div>
        )}
      </div>

      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: accent, lineHeight: 1 }}>{track.set_count}</div>
        <div style={{ fontSize: 9, color: 'rgba(237,234,226,.22)', textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 1 }}>sets</div>
      </div>
    </div>
  );
}

// ── IdsPage ────────────────────────────────────────────────────────────────

export default function IdsPage({ embedded = false }) {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [appearances, setAppearances] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/ids?limit=100')
      .then(r => r.json())
      .then(d => { setTracks(d.ids || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function selectTrack(track) {
    setSelected(track);
    setAppearances([]);
    fetch(`/api/ids?track=${track.id}`)
      .then(r => r.json())
      .then(d => setAppearances(d.appearances || []))
      .catch(() => {});
  }

  const filtered = tracks.filter(t => {
    if (filter === 'id') return isIdLabel(t.title);
    if (filter === 'named') return !isIdLabel(t.title);
    return true;
  });

  return (
    <div style={embedded ? { background: '#07080d', color: '#edeae2', fontFamily: "'Helvetica Neue', Arial, sans-serif", flex: 1, minHeight: 0 } : { position: 'fixed', inset: 0, background: '#07080d', color: '#edeae2', fontFamily: "'Helvetica Neue', Arial, sans-serif", overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

      {selected && (
        <TrackDetail
          track={selected}
          appearances={appearances}
          onClose={() => setSelected(null)}
        />
      )}

      {/* page header */}
      <div style={{ padding: '22px 16px 0', background: 'linear-gradient(180deg, rgba(167,139,250,.07) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
          <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(237,234,226,.38)', fontWeight: 600 }}>ID Tracker</span>
        </div>
        <h1 style={{ fontSize: 'clamp(26px,7vw,38px)', fontWeight: 800, letterSpacing: '-.03em', lineHeight: 1.05, margin: '0 0 6px' }}>
          Tracks in the mix
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(237,234,226,.38)', margin: '0 0 18px', lineHeight: 1.45 }}>
          Spotted across multiple sets — tap any track to jump to the exact drop.
        </p>

        {/* filter pills */}
        <div style={{ display: 'flex', gap: 8, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          {[['all','All'], ['named','Named'], ['id','Unreleased ID']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '.06em',
                padding: '6px 14px', borderRadius: 999,
                border: filter === v ? '1.5px solid #a78bfa' : '1.5px solid rgba(255,255,255,.1)',
                background: filter === v ? 'rgba(167,139,250,.18)' : 'transparent',
                color: filter === v ? '#a78bfa' : 'rgba(237,234,226,.42)',
                cursor: 'pointer', transition: 'all .14s',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ padding: '10px 16px 4px', fontSize: 11, color: 'rgba(237,234,226,.22)', letterSpacing: '.04em' }}>
          {filtered.length} tracks
        </div>
      )}

      <div>
        {loading && (
          <div style={{ padding: '80px 16px', textAlign: 'center', color: 'rgba(237,234,226,.2)', fontSize: 13 }}>Loading…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '80px 16px', textAlign: 'center', color: 'rgba(237,234,226,.2)', fontSize: 13 }}>No tracks found.</div>
        )}
        {filtered.map(t => (
          <TrackRow key={t.id} track={t} onClick={selectTrack} />
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ padding: '24px 16px 60px', textAlign: 'center', fontSize: 10, color: 'rgba(237,234,226,.12)', letterSpacing: '.1em' }}>
          PROPER SELECTS
        </div>
      )}
    </div>
  );
}
