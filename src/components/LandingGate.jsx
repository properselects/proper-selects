import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

const STACK = [
  { icon: '◈', text: 'Build a lineup in 30 seconds' },
  { icon: '⟶', text: 'Send one link. They click. It plays.' },
  { icon: '⊞', text: 'New sets every morning — 70+ venues' },
  { icon: '◎', text: 'Boiler Room · Cercle · Thuishaven · Dekmantel' },
];

export default function LandingGate({ onEnter, onOpenSubmit, topSets = [] }) {
  const [stats, setStats] = useState({ sets: null, venues: null });
  const [liveIdx, setLiveIdx] = useState(0);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id,festival_id`, {
      headers: supabaseHeaders,
    })
      .then((r) => r.json())
      .then((rows) => {
        if (!Array.isArray(rows)) return;
        const venues = new Set(rows.map((r) => r.festival_id).filter(Boolean));
        setStats({ sets: rows.length, venues: venues.size });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!topSets || topSets.length < 2) return;
    const id = setInterval(
      () => setLiveIdx((i) => (i + 1) % Math.min(topSets.length, 10)),
      5000
    );
    return () => clearInterval(id);
  }, [topSets.length]);

  const nowPlaying = topSets[liveIdx];

  return (
    <div className="jb-gate">
      <div className="jb-gate-bg" aria-hidden="true" />

      <div className="jb-gate-inner">
        <div className="jb-wordmark">PROPER SELECTS</div>

        <h1 className="jb-hero">
          Stop sending
          <br />
          <span className="jb-hero-em">sets one by one.</span>
          <br />
          <span className="jb-hero-sub">Send the whole night.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(15px, 2.2vw, 20px)',
          color: 'rgba(237,234,226,.55)',
          maxWidth: 480,
          lineHeight: 1.55,
          margin: '0 auto 32px',
          fontWeight: 500,
          letterSpacing: '-.01em',
        }}>
          Pick sets from Boiler Room, Cercle, Thuishaven and more.
          Build your lineup. One link. They click and it plays.
        </p>

        {/* Value stack */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          marginBottom: 36,
          width: '100%',
          maxWidth: 380,
          textAlign: 'left',
        }}>
          {STACK.map(({ icon, text }) => (
            <div key={text} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 14,
              color: 'rgba(237,234,226,.75)',
              fontWeight: 600,
            }}>
              <span style={{ color: '#F4A93C', fontSize: 15, flexShrink: 0 }}>{icon}</span>
              {text}
            </div>
          ))}
        </div>

        {nowPlaying && (
          <div className="jb-livefeed" style={{ marginBottom: 20 }}>
            <span className="jb-livedot" />
            <span className="jb-livefeed-text">
              Now playing · <strong>{parseArtist(nowPlaying.artist)}</strong>
            </span>
          </div>
        )}

        <button className="jb-enter" onClick={onEnter}>
          <span className="jb-enter-play">▷</span>
          Start Listening
        </button>

        <div className="jb-gate-meta" style={{ marginTop: 20 }}>
          {stats.sets ? (
            <><span className="jb-meta-num">{stats.sets}</span> sets · <span className="jb-meta-num">{stats.venues}</span> venues worldwide</>
          ) : 'Curated from the world\'s best venues'}
          <span className="jb-meta-dot">·</span>
          Free forever
          <span className="jb-meta-dot">·</span>
          No signup
        </div>

        <button className="jb-submitlink" onClick={(e) => { e.stopPropagation(); onOpenSubmit?.(); }}>
          Know a set that belongs here? →
        </button>
      </div>
    </div>
  );
}
