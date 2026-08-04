import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';

/**
 * Landing/gate screen shown before the user enters the app.
 * Hormozi-style hero, live-feed pill, value stack, and Submit link.
 */
export default function LandingGate({ onEnter, onOpenSubmit, topSets = [] }) {
  const [stats, setStats] = useState({ sets: null, venues: null });
  const [liveIdx, setLiveIdx] = useState(0);

  // Live count from DB
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

  // Live-feed rotator through top sets, cycles every 8s
  useEffect(() => {
    if (!topSets || topSets.length < 2) return;
    const id = setInterval(
      () => setLiveIdx((i) => (i + 1) % Math.min(topSets.length, 10)),
      8000
    );
    return () => clearInterval(id);
  }, [topSets.length]);

  const nowPlaying = topSets[liveIdx];

  return (
    <div className="jb-gate">
      <div className="jb-brand-mark">PROPER SELECTS</div>

      <h1 className="jb-promise">
        The best DJ sets in the world.
        <br />
        <span className="jb-promise-em">Playing in your room. Free forever.</span>
      </h1>

      {nowPlaying && (
        <div className="jb-livefeed">
          <span className="jb-livedot" />
          <span>
            Playing now: <strong>{nowPlaying.artist}</strong>
          </span>
        </div>
      )}

      <button className="jb-enter" onClick={onEnter}>▷&nbsp;&nbsp;START LISTENING</button>

      <div className="jb-nostack">No account · No ads · No algorithm</div>
      <div className="jb-proof">
        {stats.sets
          ? `${stats.sets} sets · ${stats.venues} venues · A new lineup every midnight`
          : 'A new lineup every midnight'}
      </div>

      <button
        className="jb-submitlink"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSubmit?.();
        }}
      >
        Know a set that belongs here? →
      </button>
    </div>
  );
}
