import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

const STACK = [
  { icon: '◈', text: 'Tap + on any set to add it to your lineup' },
  { icon: '⊕', text: 'Share your lineup — one link' },
  { icon: '⟶', text: 'Friends tap play. It runs the whole thing.' },
  { icon: '⊞', text: 'Free forever. No signup.' },
];

const BAR_HEIGHTS = [18, 28, 14, 32, 22, 10, 30, 20, 26, 12, 34, 18, 24, 30, 16, 28, 10, 22, 32, 14, 26, 18, 30, 20];

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
      {/* Layered background */}
      <div className="jb-gate-bg" aria-hidden="true" />
      <div className="jb-grid-overlay" aria-hidden="true" />
      <div className="jb-scanline" aria-hidden="true" />

      <div className="jb-gate-inner">
        {/* Wordmark */}
        <div className="jb-wordmark">
          <span className="jb-wordmark-bracket">[</span>
          PROPER SELECTS
          <span className="jb-wordmark-bracket">]</span>
        </div>

        {/* Hero */}
        <h1 className="jb-hero">
          Build a lineup.
          <br />
          <span className="jb-hero-sub">Share it with friends.</span>
        </h1>

        <p className="jb-desc">
          The world's best DJ sets from 75+ venues —{' '}
          <span className="jb-desc-accent">Boiler Room</span>,{' '}
          <span className="jb-desc-accent">Cercle</span>,{' '}
          <span className="jb-desc-accent">RAW CUTS</span>,{' '}
          <span className="jb-desc-accent">Thuishaven</span>.{' '}
          Fresh every morning.
        </p>

        {/* Feature grid */}
        <div className="jb-stack">
          {STACK.map(({ icon, text }, i) => (
            <div key={text} className="jb-stack-item" style={{ animationDelay: `${i * 80}ms` }}>
              <span className="jb-stack-icon">{icon}</span>
              <span className="jb-stack-text">{text}</span>
            </div>
          ))}
        </div>

        {/* Waveform visualizer — CSS animated */}
        <div className="jb-wave" aria-hidden="true">
          {BAR_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="jb-wave-bar"
              style={{
                '--h': `${h}px`,
                animationDelay: `${(i * 97) % 800}ms`,
                animationDuration: `${600 + (i * 137) % 600}ms`,
              }}
            />
          ))}
        </div>

        {/* Live now playing */}
        {nowPlaying && (
          <div className="jb-livefeed">
            <span className="jb-livedot" />
            <span className="jb-livefeed-label">NOW PLAYING</span>
            <span className="jb-livefeed-sep">·</span>
            <span className="jb-livefeed-text">
              <strong>{parseArtist(nowPlaying.artist)}</strong>
            </span>
          </div>
        )}

        {/* CTA */}
        <button className="jb-enter" onClick={onEnter}>
          <span className="jb-enter-play">▷</span>
          Start Listening
          <span className="jb-enter-shimmer" />
        </button>

        {/* Stats */}
        {stats.sets && (
          <div className="jb-gate-meta">
            <span className="jb-meta-num">{stats.sets.toLocaleString()}</span>
            <span className="jb-meta-sep">/</span>
            sets
            <span className="jb-meta-sep">·</span>
            <span className="jb-meta-num">{stats.venues}</span>
            <span className="jb-meta-sep">/</span>
            venues worldwide
          </div>
        )}

        <button className="jb-submitlink" onClick={(e) => { e.stopPropagation(); onOpenSubmit?.(); }}>
          Know a set that belongs here? →
        </button>

        <a
          className="jb-contactlink"
          href="mailto:properselects@gmail.com?subject=Proper%20Selects%20Inquiry"
          onClick={(e) => e.stopPropagation()}
        >
          Inquiries · properselects@gmail.com
        </a>
      </div>
    </div>
  );
}
