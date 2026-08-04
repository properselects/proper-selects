import React, { useState } from 'react';

export default function SubmitModal({ open, onClose }) {
  const [form, setForm] = useState({ url: '', name: '', loc: '', own: false, why: '' });
  const [state, setState] = useState('idle');
  const [msg, setMsg] = useState('');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const r = await fetch('/api/submit-set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          video_url: form.url,
          submitter_name: form.name,
          submitter_location: form.loc,
          is_own_set: form.own,
          why: form.why,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        setMsg(data.message || 'Thanks');
        setState('done');
      } else {
        setMsg(data.error || 'Something went wrong');
        setState('error');
      }
    } catch {
      setMsg('Network error');
      setState('error');
    }
  };

  return (
    <div className="jb-sub-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="jb-sub-modal" style={{ maxWidth: 440 }}>
        <button className="jb-sub-close" onClick={onClose}>
          ✕
        </button>
        <div style={{ fontSize: 11, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 12 }}>
          BEDROOM DJ
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 }}>Submit a set</h2>
        <p style={{ fontSize: 12, opacity: 0.6, lineHeight: 1.5, margin: '0 0 20px' }}>
          Full DJ sets only. 45+ minutes. Not aftermovies, radio streams, or highlight reels. Your own bedroom set? Even
          better.
        </p>
        {state === 'done' ? (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Submitted</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>{msg}</div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <input
              type="url"
              required
              placeholder="YouTube URL"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              className="jb-sub-input"
              disabled={state === 'loading'}
            />
            <input
              type="text"
              placeholder="Your name (optional)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="jb-sub-input"
              disabled={state === 'loading'}
            />
            <input
              type="text"
              placeholder="City (optional — e.g. Austin, Berlin)"
              value={form.loc}
              onChange={(e) => setForm({ ...form, loc: e.target.value })}
              className="jb-sub-input"
              disabled={state === 'loading'}
            />
            <textarea
              placeholder="One line — why does this belong?"
              value={form.why}
              onChange={(e) => setForm({ ...form, why: e.target.value })}
              className="jb-sub-input"
              rows={2}
              disabled={state === 'loading'}
              style={{ resize: 'none', fontFamily: 'inherit' }}
            />
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 16px', fontSize: 12, opacity: 0.7, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={form.own}
                onChange={(e) => setForm({ ...form, own: e.target.checked })}
                disabled={state === 'loading'}
              />
              This is my own set (Bedroom DJ)
            </label>
            {state === 'error' && <div style={{ fontSize: 11, color: '#F87171', marginBottom: 12 }}>{msg}</div>}
            <button type="submit" className="jb-sub-submit" disabled={state === 'loading'}>
              {state === 'loading' ? 'Sending…' : 'Submit →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
