import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';
import { parseArtist } from '../lib/parseArtist.js';

const ACCENT = '#F4A93C';
const MAX = 12;

async function searchSets(q) {
  const enc = encodeURIComponent(`%${q}%`);
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/vault_sets?or=(artist.ilike.${enc},title.ilike.${enc})&select=video_id,artist,title,festival_name,city&order=published_at.desc&limit=30`,
    { headers: supabaseHeaders }
  );
  if (!r.ok) return [];
  return r.json();
}

function DragHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" style={{ opacity: 0.3, flexShrink: 0 }}>
      <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
      <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
      <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
    </svg>
  );
}

export default function LineupDrawer({ open, onClose, lineup, onLineupChange, onPreview }) {
  function moveUp(i) {
    if (i === 0) return;
    const arr = [...lineup];
    [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
    onLineupChange(arr);
  }
  function moveDown(i) {
    if (i === lineup.length - 1) return;
    const arr = [...lineup];
    [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
    onLineupChange(arr);
  }
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [subEmail, setSubEmail] = useState('');
  const [subState, setSubState] = useState(null); // null | 'sending' | 'done' | 'error'
  const inputRef = useRef(null);
  const debounce = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
    if (!open) {
      setQuery('');
      setResults([]);
      setShared(null);
      setSubEmail('');
      setSubState(null);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const rows = await searchSets(query);
        setResults(rows);
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

  const lineupIds = useMemo(() => new Set(lineup.map((s) => s.video_id)), [lineup]);

  function addSet(set) {
    if (lineupIds.has(set.video_id) || lineup.length >= MAX) return;
    onLineupChange([...lineup, set]);
    showToast(`Added: ${parseArtist(set.artist || set.title)}`);
  }

  function removeSet(id) {
    onLineupChange(lineup.filter((s) => s.video_id !== id));
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  async function shareLineup() {
    if (!lineup.length) return;
    setSharing(true);
    try {
      const r = await fetch('/api/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          videoIds: lineup.map((s) => s.video_id),
          setMetadata: lineup.map((s) => ({
            video_id: s.video_id,
            artist: s.artist,
            title: s.title,
            festival_name: s.festival_name,
            city: s.city,
          })),
        }),
      });
      const { slug } = await r.json();
      const url = `${window.location.origin}/l/${slug}`;
      setShared(url);
      try { await navigator.clipboard.writeText(url); } catch {}
    } catch {
      showToast('Share failed — try again');
    } finally {
      setSharing(false);
    }
  }

  async function subscribe() {
    const email = subEmail.trim();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setSubState('error'); return; }
    setSubState('sending');
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'lineup-share' }),
      });
      setSubState(r.ok ? 'done' : 'error');
    } catch {
      setSubState('error');
    }
  }

  // Drag-to-reorder
  function onDragStart(e, i) {
    setDragIdx(i);
    e.dataTransfer.effectAllowed = 'move';
  }
  function onDragOver(e, i) {
    e.preventDefault();
    setOverIdx(i);
  }
  function onDrop(e, i) {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) { setDragIdx(null); setOverIdx(null); return; }
    const arr = [...lineup];
    const [item] = arr.splice(dragIdx, 1);
    arr.splice(i, 0, item);
    onLineupChange(arr);
    setDragIdx(null);
    setOverIdx(null);
  }
  function onDragEnd() { setDragIdx(null); setOverIdx(null); }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          backdropFilter: 'blur(4px)', zIndex: 1000,
        }}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 340,
          maxWidth: '100vw', background: '#111118',
          borderLeft: '1px solid rgba(255,255,255,.1)',
          zIndex: 1001, display: 'flex', flexDirection: 'column',
          animation: 'slideInRight .22s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '18px 18px 12px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '.05em' }}>Your Lineup</div>
              <div style={{ fontSize: 11, opacity: 0.45, marginTop: 2 }}>Build it. Share it.</div>
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(237,234,226,.4)', fontSize: 20, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, opacity: 0.4 }}>
              🔍
            </span>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist, venue, city…"
              style={{
                width: '100%', background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.12)',
                borderRadius: 8, padding: '9px 12px 9px 32px',
                color: '#EDEAE2', fontSize: 13, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {searching && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, fontSize: 11 }}>
                ···
              </span>
            )}
          </div>
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div style={{
            maxHeight: 220, overflowY: 'auto', borderBottom: '1px solid rgba(255,255,255,.05)',
            scrollbarWidth: 'thin',
          }}>
            {results.map((s) => {
              const inList = lineupIds.has(s.video_id);
              const full = lineup.length >= MAX;
              return (
                <button
                  key={s.video_id}
                  onClick={() => addSet(s)}
                  disabled={inList || full}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', padding: '8px 16px',
                    color: inList ? 'rgba(237,234,226,.35)' : '#EDEAE2',
                    cursor: inList || full ? 'default' : 'pointer', textAlign: 'left',
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                  }}
                >
                  <img
                    src={`https://img.youtube.com/vi/${s.video_id}/default.jpg`}
                    alt="" width={40} height={30}
                    style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                    loading="lazy"
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {parseArtist(s.artist || s.title)}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.45 }}>
                      {s.festival_name}{s.city ? ` · ${s.city}` : ''}
                    </div>
                  </div>
                  <span
                    onClick={(e) => { e.stopPropagation(); onPreview && onPreview(s); }}
                    style={{ background: 'rgba(255,255,255,.06)', borderRadius: 5, padding: '3px 7px', color: ACCENT, cursor: 'pointer', fontSize: 11, flexShrink: 0, marginRight: 4 }}
                    title="Preview"
                  >
                    ▷
                  </span>
                  <span style={{ fontSize: 16, color: inList ? ACCENT : 'rgba(255,255,255,.3)', flexShrink: 0 }}>
                    {inList ? '✓' : '+'}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Current lineup */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {lineup.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', opacity: 0.35, fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
              Tap ＋ on any set to add it
            </div>
          ) : (
            lineup.map((s, i) => (
              <div
                key={s.video_id}
                draggable
                onDragStart={(e) => onDragStart(e, i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={(e) => onDrop(e, i)}
                onDragEnd={onDragEnd}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                  borderBottom: '1px solid rgba(255,255,255,.04)',
                  background: overIdx === i ? 'rgba(244,169,60,.08)' : 'transparent',
                  opacity: dragIdx === i ? 0.5 : 1,
                  transition: 'background .12s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                  <button
                    onClick={() => moveUp(i)}
                    disabled={i === 0}
                    title="Move up"
                    style={{ background: 'none', border: 'none', color: i === 0 ? 'rgba(255,255,255,.1)' : 'rgba(237,234,226,.5)', cursor: i === 0 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1, height: 14 }}
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveDown(i)}
                    disabled={i === lineup.length - 1}
                    title="Move down"
                    style={{ background: 'none', border: 'none', color: i === lineup.length - 1 ? 'rgba(255,255,255,.1)' : 'rgba(237,234,226,.5)', cursor: i === lineup.length - 1 ? 'default' : 'pointer', fontSize: 10, padding: 0, lineHeight: 1, height: 14 }}
                  >
                    ▼
                  </button>
                </div>
                <span style={{ fontSize: 11, opacity: 0.4, width: 14, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <img
                  src={`https://img.youtube.com/vi/${s.video_id}/default.jpg`}
                  alt="" width={36} height={27}
                  style={{ borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                  loading="lazy"
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {parseArtist(s.artist || s.title)}
                  </div>
                  <div style={{ fontSize: 10, opacity: 0.4 }}>
                    {s.festival_name}{s.city ? ` · ${s.city}` : ''}
                  </div>
                </div>
                <button
                  onClick={() => onPreview && onPreview(s)}
                  title="Preview"
                  style={{ background: 'rgba(255,255,255,.06)', border: 'none', borderRadius: 5, padding: '4px 8px', color: ACCENT, cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
                >
                  ▷
                </button>
                <button
                  onClick={() => removeSet(s.video_id)}
                  title="Remove"
                  style={{ background: 'none', border: 'none', color: 'rgba(237,234,226,.3)', fontSize: 16, cursor: 'pointer', padding: '4px', lineHeight: 1, flexShrink: 0 }}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer: name + share */}
        <div style={{ padding: '12px 16px 16px', borderTop: '1px solid rgba(255,255,255,.07)' }}>
          {lineup.length > 0 && !shared && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name this lineup (optional)"
              maxLength={60}
              style={{
                width: '100%', background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 8, padding: '9px 12px',
                color: '#EDEAE2', fontSize: 13, outline: 'none',
                boxSizing: 'border-box', marginBottom: 10,
              }}
            />
          )}

          {shared ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>🔗</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Link copied to clipboard</div>
              <div
                style={{
                  background: 'rgba(244,169,60,.1)', border: '1px solid rgba(244,169,60,.3)',
                  borderRadius: 8, padding: '8px 12px', fontSize: 11,
                  color: ACCENT, wordBreak: 'break-all', marginBottom: 10,
                }}
              >
                {shared}
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shared).catch(() => {}); showToast('Copied!'); }}
                style={{
                  width: '100%', padding: '10px 12px', background: 'rgba(244,169,60,.15)',
                  border: `1px solid ${ACCENT}`, borderRadius: 8, color: ACCENT,
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Copy again
              </button>
              <button
                onClick={() => { setShared(null); onLineupChange([]); }}
                style={{
                  marginTop: 8, width: '100%', padding: '8px', background: 'none',
                  border: 'none', color: 'rgba(237,234,226,.35)', fontSize: 12, cursor: 'pointer',
                }}
              >
                Start new lineup
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={shareLineup}
                disabled={!lineup.length || sharing}
                style={{
                  width: '100%', padding: '12px', background: lineup.length ? ACCENT : 'rgba(255,255,255,.06)',
                  border: 'none', borderRadius: 10, color: lineup.length ? '#0a0a0e' : 'rgba(237,234,226,.3)',
                  fontSize: 14, fontWeight: 800, cursor: lineup.length ? 'pointer' : 'default',
                  letterSpacing: '.04em', transition: 'background .15s',
                }}
              >
                {sharing ? 'Creating link…' : 'Share Lineup →'}
              </button>
              {lineup.length > 0 && (
                <button
                  onClick={() => onLineupChange([])}
                  style={{
                    marginTop: 8, width: '100%', padding: '7px', background: 'none',
                    border: 'none', color: 'rgba(237,234,226,.3)', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  Clear all ({lineup.length}/{MAX})
                </button>
              )}
            </>
          )}

          {/* Weekly updates subscribe */}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,.07)' }}>
            {subState === 'done' ? (
              <div style={{ textAlign: 'center', fontSize: 12, color: ACCENT, fontWeight: 700, padding: '4px 0' }}>
                ✓ You're in — weekly picks incoming.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.04em', color: 'rgba(237,234,226,.6)', marginBottom: 7 }}>
                  🎧 The best new sets, every week
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="email"
                    value={subEmail}
                    onChange={(e) => { setSubEmail(e.target.value); if (subState === 'error') setSubState(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') subscribe(); }}
                    placeholder="your@email.com"
                    style={{
                      flex: 1, minWidth: 0, background: 'rgba(255,255,255,.06)',
                      border: `1px solid ${subState === 'error' ? 'rgba(255,90,90,.6)' : 'rgba(255,255,255,.12)'}`,
                      borderRadius: 8, padding: '9px 11px', color: '#EDEAE2', fontSize: 13,
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <button
                    onClick={subscribe}
                    disabled={subState === 'sending'}
                    style={{
                      flexShrink: 0, padding: '9px 14px', background: 'rgba(244,169,60,.15)',
                      border: `1px solid ${ACCENT}`, borderRadius: 8, color: ACCENT,
                      fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {subState === 'sending' ? '…' : 'Subscribe'}
                  </button>
                </div>
                {subState === 'error' && (
                  <div style={{ fontSize: 10, color: 'rgba(255,120,120,.9)', marginTop: 5 }}>
                    Enter a valid email and try again.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {toast && (
          <div style={{
            position: 'absolute', bottom: 90, left: '50%', transform: 'translateX(-50%)',
            background: '#1c1c26', border: `1px solid ${ACCENT}`, borderRadius: 8,
            padding: '8px 16px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
          }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
