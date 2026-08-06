import React, { useEffect, useState } from 'react';
import { parseArtist } from '../lib/parseArtist.js';

const ACCENT = '#F4A93C';

export default function LineupSharePage({ slug, onMakeYourOwn }) {
  const [lineup, setLineup] = useState(null);
  const [error, setError] = useState(null);
  const [playIdx, setPlayIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/lineup?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setLineup(data))
      .catch(() => setError(true));
  }, [slug]);

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 12 }}>
        <div style={{ fontSize: 40 }}>◈</div>
        <div style={{ opacity: 0.5 }}>Lineup not found</div>
        <button onClick={onMakeYourOwn} style={{ marginTop: 8, padding: '10px 24px', background: ACCENT, border: 'none', borderRadius: 8, color: '#0a0a0e', fontWeight: 800, cursor: 'pointer' }}>
          Make your own
        </button>
      </div>
    );
  }

  if (!lineup) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', opacity: 0.4 }}>Loading…</div>;
  }

  const sets = lineup.set_metadata || [];
  const current = sets[playIdx];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0a0a0e', color: '#EDEAE2' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: '.2em', opacity: 0.4, marginBottom: 2 }}>PROPER SELECTS · LINEUP</div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{lineup.name || 'A curated lineup'}</div>
        </div>
        <div style={{ fontSize: 11, opacity: 0.4 }}>{sets.length} sets</div>
      </div>

      {/* Player */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {current && (
          <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000', flexShrink: 0 }}>
            <iframe
              key={current.video_id}
              src={`https://www.youtube.com/embed/${current.video_id}?autoplay=1&rel=0`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            />
          </div>
        )}

        {/* Set list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sets.map((s, i) => (
            <button
              key={s.video_id}
              onClick={() => setPlayIdx(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                background: i === playIdx ? 'rgba(244,169,60,.08)' : 'none',
                border: 'none', borderBottom: '1px solid rgba(255,255,255,.05)',
                borderLeft: i === playIdx ? `3px solid ${ACCENT}` : '3px solid transparent',
                padding: '9px 16px', color: '#EDEAE2', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 11, opacity: 0.35, width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
              <img
                src={`https://img.youtube.com/vi/${s.video_id}/default.jpg`}
                alt="" width={44} height={33}
                style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                loading="lazy"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {parseArtist(s.artist || s.title)}
                </div>
                <div style={{ fontSize: 11, opacity: 0.45 }}>
                  {s.festival_name}{s.city ? ` · ${s.city}` : ''}
                </div>
              </div>
              {i === playIdx && <span style={{ color: ACCENT, flexShrink: 0 }}>▷</span>}
            </button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '14px 18px 20px', borderTop: '1px solid rgba(255,255,255,.07)', textAlign: 'center' }}>
        <div style={{ fontSize: 12, opacity: 0.45, marginBottom: 8 }}>Like this lineup?</div>
        <button
          onClick={onMakeYourOwn}
          style={{
            padding: '11px 28px', background: ACCENT, border: 'none', borderRadius: 10,
            color: '#0a0a0e', fontWeight: 900, fontSize: 14, cursor: 'pointer', letterSpacing: '.04em',
          }}
        >
          Make your own →
        </button>
      </div>
    </div>
  );
}
