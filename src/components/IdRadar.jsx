import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';

function formatTs(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * Reusable ID Radar — the mined tracklist for a set, shown seamlessly under
 * any player (Radar / Vault / Atlas / Preview). Pass `onSeek(t_sec)` to make
 * the chips jump the player; omit it to render read-only chips.
 */
// Remember which videos we've already tried to mine this session so we never
// hit the miner twice for the same set.
const mineAttempted = new Set();

export default function IdRadar({ videoId, accent = '#F4A93C', onSeek }) {
  const [moments, setMoments] = useState(null);
  const [mining, setMining] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!videoId) { setMoments(null); setMining(false); return; }
    setMoments(null);
    setMining(false);
    setRescanning(false);

    fetch(
      `${SUPABASE_URL}/rest/v1/set_id_moments?select=*&video_id=eq.${encodeURIComponent(videoId)}&order=likes.desc&limit=200`,
      { headers: supabaseHeaders }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (cancelled) return;
        const list = Array.isArray(rows) ? rows : [];
        if (list.length > 0) { setMoments(list); return; }
        // No IDs yet → mine on-demand (once per set per session)
        if (mineAttempted.has(videoId)) { setMoments([]); return; }
        mineAttempted.add(videoId);
        setMining(true);
        fetch(`/api/radar?mine=${encodeURIComponent(videoId)}`)
          .then((r) => (r.ok ? r.json() : { moments: [] }))
          .then((data) => {
            if (cancelled) return;
            setMoments(Array.isArray(data.moments) ? data.moments : []);
            setMining(false);
          })
          .catch(() => { if (!cancelled) { setMoments([]); setMining(false); } });
      })
      .catch(() => { if (!cancelled) setMoments([]); });
    return () => { cancelled = true; };
  }, [videoId]);

  // Manual re-scan: force-re-mine the set's comments to pick up tracklists posted
  // after the first pass. Bypasses the once-per-session guard and the "already has
  // IDs" short-circuit; duplicates are ignored server-side.
  function rescan() {
    if (!videoId || rescanning) return;
    setRescanning(true);
    mineAttempted.add(videoId);
    fetch(`/api/radar?mine=${encodeURIComponent(videoId)}&force=1`)
      .then((r) => (r.ok ? r.json() : { moments: [] }))
      .then((data) => setMoments(Array.isArray(data.moments) ? data.moments : (moments || [])))
      .catch(() => {})
      .finally(() => setRescanning(false));
  }

  // While mining a fresh set, show a subtle placeholder so it doesn't feel broken.
  if (mining && (!moments || moments.length === 0)) {
    return (
      <div className="jb-radar">
        <div className="jb-radar-head">
          <span style={{ color: accent }}>ID Radar</span>
          <span className="jb-radar-sub">finding IDs…</span>
        </div>
      </div>
    );
  }

  const rescanBtn = (
    <button
      type="button"
      className="jb-radar-rescan"
      onClick={rescan}
      disabled={rescanning}
      title="Re-scan the YouTube comments for new track IDs"
      style={{
        background: 'none', border: 'none', cursor: rescanning ? 'default' : 'pointer',
        color: accent, opacity: rescanning ? 0.5 : 0.8, fontSize: 11,
        fontFamily: 'inherit', padding: 0, letterSpacing: '0.02em',
      }}
    >
      {rescanning ? 'scanning…' : '⟳ re-scan'}
    </button>
  );

  // Nothing to show → still offer a re-scan so a set that got a tracklist comment
  // after its first (empty) mine can be refreshed without reloading.
  if (!moments || moments.length === 0) {
    return (
      <div className="jb-radar">
        <div className="jb-radar-head">
          <span style={{ color: accent }}>ID Radar</span>
          <span className="jb-radar-sub" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            No IDs yet{rescanBtn}
          </span>
        </div>
      </div>
    );
  }

  // Sort by timestamp for a natural top-to-bottom read
  const ordered = [...moments].sort((a, b) => (a.t_sec || 0) - (b.t_sec || 0));

  return (
    <div className="jb-radar">
      <div className="jb-radar-head">
        <span style={{ color: accent }}>ID Radar</span>
        <span className="jb-radar-sub" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          Mined IDs{onSeek ? ' · tap to jump' : ''}{rescanBtn}
        </span>
      </div>
      <div className="jb-radar-row">
        {ordered.map((v, d) => {
          const Tag = onSeek ? 'button' : 'div';
          return (
            <Tag
              key={d}
              className={'jb-id' + (v.resolved ? ' resolved' : '')}
              style={v.resolved ? { borderColor: accent } : undefined}
              onClick={onSeek ? () => onSeek(v.t_sec) : undefined}
              title={v.label}
            >
              <span className="jb-id-ts" style={{ color: accent }}>{formatTs(v.t_sec)}</span>
              <span className="jb-id-label">{v.resolved ? v.label : 'ID?'}</span>
              {v.likes > 0 && <span className="jb-id-likes">▲{v.likes}</span>}
            </Tag>
          );
        })}
      </div>
    </div>
  );
}
