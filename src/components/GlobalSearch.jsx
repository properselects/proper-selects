import React, { useEffect, useRef, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

const ACCENT = '#F4A93C';

async function searchDB(q) {
  const enc = encodeURIComponent(`%${q}%`);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?or=(artist.ilike.${enc},title.ilike.${enc})&select=video_id,artist,title,festival_name,city&order=published_at.desc&limit=30`,
    { headers: supabaseHeaders }
  );
  if (!r.ok) return [];
  return r.json();
}

// Fire-and-forget: record the (debounced) search term for "most searched" analytics. Anon insert-only.
function logSearch(q) {
  fetch(`${SUPABASE_URL}/rest/v1/searches`, {
    method: 'POST',
    headers: { ...supabaseHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ q: q.slice(0, 80) }),
  }).catch(() => {});
}

export default function GlobalSearch({ open, onClose, lineup, onLineupChange, onPreview }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 60);
    if (!open) { setQuery(''); setResults([]); }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchDB(query);
        logSearch(query);
        setResults(rows);
        // Also run the YouTube finder when catalog matches are thin — a couple of tangential
        // hits (e.g. an artist appearing only in group/festival sets) shouldn't hide their solo sets.
        if (rows.length < 5) {
          // Keep spinner while YouTube search runs
          const data = await fetch(`/api/search-sets?q=${encodeURIComponent(query)}`)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null);
          if (data?.sets?.length) {
            const seen = new Set(rows.map(r => r.video_id));
            const fresh = data.sets.filter(s => !seen.has(s.video_id));
            if (fresh.length) setResults(prev => [...prev, ...fresh]);
          }
        }
      } finally {
        setSearching(false);
      }
    }, 280);
  }, [query]);

  const lineupIds = new Set((lineup || []).map(s => s.video_id));

  function toggle(s) {
    if (lineupIds.has(s.video_id)) {
      onLineupChange(lineup.filter(x => x.video_id !== s.video_id));
    } else {
      if (lineup.length >= 12) return;
      onLineupChange([...lineup, s]);
    }
  }

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)', zIndex: 1500 }} />
      <div style={{
        position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
        width: 'min(560px, 92vw)', maxHeight: '75vh',
        background: '#111118', border: '1px solid rgba(255,255,255,.12)',
        borderRadius: 12, zIndex: 1501, display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)',
      }}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.07)', position: 'relative' }}>
          <span style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: 14 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artist, venue, city…"
            style={{
              width: '100%', background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 8, padding: '10px 40px 10px 38px',
              color: '#EDEAE2', fontSize: 14, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <button onClick={onClose} style={{ position: 'absolute', right: 22, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(237,234,226,.4)', fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
          {searching && <span style={{ position: 'absolute', right: 46, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 11 }}>···</span>}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 100 }}>
          {results.length === 0 && query.length >= 2 && !searching && (
            <div style={{ padding: 30, textAlign: 'center', opacity: 0.4, fontSize: 13 }}>No sets found</div>
          )}
          {results.length === 0 && query.length < 2 && (
            <div style={{ padding: 30, textAlign: 'center', opacity: 0.35, fontSize: 13 }}>
              Search 300+ sets from Boiler Room, Cercle, Thuishaven & more
            </div>
          )}
          {results.map((s) => {
            const inList = lineupIds.has(s.video_id);
            return (
              <div key={s.video_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <img
                  src={`https://img.youtube.com/vi/${s.video_id}/default.jpg`}
                  alt="" width={48} height={36}
                  style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                  loading="lazy"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {parseArtist(s.artist || s.title)}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.festival_name ? `${s.festival_name}${s.city ? ` · ${s.city}` : ''}` : (s.title || '')}
                  </div>
                </div>
                <button
                  onClick={() => onPreview && onPreview(s)}
                  title="Preview"
                  style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 6, padding: '5px 10px', color: ACCENT, cursor: 'pointer', fontSize: 12, flexShrink: 0 }}
                >
                  ▷
                </button>
                <button
                  onClick={() => toggle(s)}
                  title={inList ? 'Remove' : 'Add to lineup'}
                  style={{ background: 'none', border: 'none', color: inList ? ACCENT : 'rgba(237,234,226,.4)', fontSize: 18, cursor: 'pointer', padding: '4px 6px', flexShrink: 0 }}
                >
                  {inList ? '◈' : '＋'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
