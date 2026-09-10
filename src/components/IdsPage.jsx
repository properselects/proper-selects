import React, { useEffect, useState } from 'react';

const DOT = { display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 8px #a78bfa', marginRight: 7, flexShrink: 0 };

function TrackRow({ track, onClick, selected }) {
  const djs = track.djs || [];
  const venues = track.venues || [];
  const isId = /\bID\b/i.test(track.title);

  return (
    <div
      onClick={() => onClick(track)}
      style={{
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        background: selected ? 'rgba(167,139,250,0.08)' : 'transparent',
        transition: 'background .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {isId && (
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', color: '#a78bfa', background: 'rgba(167,139,250,.15)', padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
            ID
          </span>
        )}
        <span style={{ fontWeight: 500, fontSize: 14, color: '#edeae2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {track.title}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa', flexShrink: 0 }}>
          {track.set_count}×
        </span>
      </div>
      <div style={{ marginTop: 5, fontSize: 11, color: 'rgba(237,234,226,.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {djs.slice(0, 3).join(' · ')}{djs.length > 3 ? ` +${djs.length - 3} more` : ''}
      </div>
    </div>
  );
}

function TrackDetail({ track, appearances, onClose }) {
  if (!track) return null;

  function ytLink(videoId, tSec) {
    const t = tSec > 0 ? `&t=${tSec}s` : '';
    return `https://youtube.com/watch?v=${videoId}${t}`;
  }

  function fmtTime(sec) {
    if (!sec) return '0:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(6,8,12,.92)', zIndex: 50,
      display: 'flex', flexDirection: 'column', overflowY: 'auto',
    }}>
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#edeae2', fontSize: 22, cursor: 'pointer', padding: '0 4px', lineHeight: 1 }}>←</button>
        <span style={{ fontSize: 11, opacity: .4, letterSpacing: '.14em', textTransform: 'uppercase' }}>Track appearances</span>
      </div>

      <div style={{ padding: '20px 20px 10px' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: '#edeae2', lineHeight: 1.3 }}>{track.title}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: '#a78bfa', fontWeight: 500 }}>
          Played in {track.set_count} set{track.set_count !== 1 ? 's' : ''}
        </div>
      </div>

      <div style={{ flex: 1, padding: '0 0 40px' }}>
        {appearances.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(237,234,226,.3)', fontSize: 13 }}>Loading appearances…</div>
        )}
        {appearances.map((a, i) => (
          <a
            key={i}
            href={ytLink(a.video_id, a.t_sec)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none' }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: '#edeae2' }}>{a.dj || 'Unknown DJ'}</div>
            <div style={{ marginTop: 3, fontSize: 11, color: 'rgba(237,234,226,.4)', display: 'flex', gap: 8 }}>
              <span>{a.festival_id || ''}</span>
              {a.t_sec > 0 && <span>@ {fmtTime(a.t_sec)}</span>}
              {a.published_at && <span>{new Date(a.published_at).getFullYear()}</span>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function IdsPage() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [appearances, setAppearances] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all' | 'id' | 'named'

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
    if (filter === 'id') return /\bID\b/i.test(t.title);
    if (filter === 'named') return !/\bID\b/i.test(t.title);
    return true;
  });

  return (
    <div style={{ background: '#06080c', minHeight: '100vh', color: '#edeae2', fontFamily: 'system-ui, sans-serif' }}>
      {selected && (
        <TrackDetail
          track={selected}
          appearances={appearances}
          onClose={() => setSelected(null)}
        />
      )}

      <header style={{ padding: '20px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
        <div style={{ fontSize: 11, opacity: .5, letterSpacing: '.14em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center' }}>
          <span style={DOT} />
          ID Tracker — tracks played across multiple sets
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', 'All'], ['named', 'Named'], ['id', 'Marked ID']].map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '.08em',
                padding: '5px 12px', borderRadius: 20,
                border: filter === v ? '1px solid #a78bfa' : '1px solid rgba(255,255,255,.12)',
                background: filter === v ? 'rgba(167,139,250,.15)' : 'transparent',
                color: filter === v ? '#a78bfa' : 'rgba(237,234,226,.5)',
                cursor: 'pointer',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div style={{ padding: '6px 0' }}>
        {loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(237,234,226,.3)', fontSize: 13 }}>
            Loading…
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(237,234,226,.3)', fontSize: 13 }}>
            No tracks found.
          </div>
        )}
        {filtered.map(t => (
          <TrackRow
            key={t.id}
            track={t}
            onClick={selectTrack}
            selected={selected?.id === t.id}
          />
        ))}
      </div>

      {!loading && filtered.length > 0 && (
        <div style={{ padding: '12px 20px 40px', fontSize: 11, color: 'rgba(237,234,226,.2)', textAlign: 'center' }}>
          {filtered.length} tracks · tap any to see where it was played
        </div>
      )}
    </div>
  );
}
