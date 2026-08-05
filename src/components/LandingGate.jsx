import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

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
      6000
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
          The world's best
          <br />
          <span className="jb-hero-em">DJ sets.</span>
          <br />
          <span className="jb-hero-sub">Playing in your room.</span>
        </h1>

        {nowPlaying && (
          <div className="jb-livefeed">
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

        <div className="jb-gate-meta">
          {stats.sets ? (
            <><span className="jb-meta-num">{stats.sets}</span> sets · <span className="jb-meta-num">{stats.venues}</span> venues worldwide</>
          ) : 'Curated sets from the best venues worldwide'}
          <span className="jb-meta-dot">·</span>
          Free forever
          <span className="jb-meta-dot">·</span>
          No ads
        </div>

        <button className="jb-submitlink" onClick={(e) => { e.stopPropagation(); onOpenSubmit?.(); }}>
          Know a set that belongs here? →
        </button>
      </div>
    </div>
  );
}
