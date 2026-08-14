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

  useEffect(() => {
    let cancelled = false;
    if (!videoId) { setMoments(null); setMining(false); return; }
    setMoments(null);
    setMining(false);

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

  // Nothing to show → render nothing (keeps the UI clean for un-mined sets)
  if (!moments || moments.length === 0) return null;

  // Sort by timestamp for a natural top-to-bottom read
  const ordered = [...moments].sort((a, b) => (a.t_sec || 0) - (b.t_sec || 0));

  return (
    <div className="jb-radar">
      <div className="jb-radar-head">
        <span style={{ color: accent }}>ID Radar</span>
        <span className="jb-radar-sub">
          auto-identified{onSeek ? ' · tap to jump' : ''}
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
