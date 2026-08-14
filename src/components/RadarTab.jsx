import React, { useEffect, useState } from 'react';
import { parseArtist } from '../lib/parseArtist.js';
import { fetchNextEvent, EventStrip } from '../lib/venueEvents.jsx';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';
import { lockScroll, unlockScroll } from '../lib/scrollLock.js';
import IdRadar from './IdRadar.jsx';
import { ytSeek } from '../lib/ytPostMessage.js';

function formatViews(v) {
  if (!v || v === 0) return null;
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M views';
  if (v >= 1e3) return Math.round(v / 1e3) + 'K views';
  return '< 1K';
}

export default function RadarTab({ onNowPlaying }) {
  const [sets, setSets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const playerFrame = React.useRef(null);

  useEffect(() => {
    fetch('/api/radar')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSets(data);
      })
      .catch(() => {});
  }, []);

  function selectSet(s) {
    setSelected(s);
    setSelectedEvent(null);
    const fid = s?.festival_id;
    if (fid) fetchNextEvent(fid).then(setSelectedEvent).catch(() => {});
  }

  // Single-player: when this modal is open, stop everyone else; and let others
  // close it. Closing (setSelected null) unmounts the iframe, stopping audio.
  useEffect(() => {
    if (!selected) return;
    startExclusive('radar');
    registerPlayer('radar', () => setSelected(null));
    lockScroll();
    // Reflect this set as the current set in the nav mini-player
    onNowPlaying?.({
      video_id: selected.video_id,
      artist: selected.artist,
      festival_name: selected.festival?.name,
      city: selected.festival?.city,
    });
    return () => { unregisterPlayer('radar'); unlockScroll(); };
  }, [selected]);

  return (
    <div style={{ background: '#06080c', minHeight: '100%', color: '#EDEAE2' }}>
      <header
        style={{
          padding: '20px 24px 8px',
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
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
        {sets.map((s, i) => {
          const accent = s.festival?.accent || '#F4A93C';
          const isSelected = selected?.video_id === s.video_id;
          return (
            <div
              key={s.id || s.video_id}
              className="radar-card"
              style={{ '--acc': accent }}
              onClick={() => isSelected ? setSelected(null) : selectSet(s)}
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
                <div className="radar-festival" style={{ color: accent }}>
                  {s.festival?.name || '—'}
                  {s.festival?.city ? ` · ${s.festival.city}` : ''}
                </div>
                <div className="radar-artist">{parseArtist(s.artist ?? 'ID')}</div>
                {formatViews(s.views) && <div className="radar-views">{formatViews(s.views)}</div>}
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
          <div style={{ width: '100%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <button onClick={() => setSelected(null)} className="jb-modal-close">✕ Close</button>
            </div>
            <div style={{ aspectRatio: '16/9' }}>
              <iframe
                ref={playerFrame}
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${selected.video_id}?autoplay=1&rel=0&enablejsapi=1`}
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ border: 0, borderRadius: 12 }}
              />
            </div>
            <EventStrip
              event={selectedEvent}
              accent={selected.festival?.accent || '#F4A93C'}
              label={selected.festival?.name ? `UPCOMING AT ${selected.festival.name.toUpperCase()}` : 'UPCOMING'}
            />
            <IdRadar
              videoId={selected.video_id}
              accent={selected.festival?.accent || '#F4A93C'}
              onSeek={(s) => ytSeek(playerFrame.current, s)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
