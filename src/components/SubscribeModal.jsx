import React, { useState } from 'react';

export default function SubscribeModal({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle');

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (state === 'loading') return;
    setState('loading');
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(r.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="jb-sub-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="jb-sub-modal">
        <button className="jb-sub-close" onClick={onClose}>
          ✕
        </button>
        <div style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', opacity: 0.5, marginBottom: 16 }}>
          PROPER SELECTS
        </div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>Get the weekly drop</h2>
        <p style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.6, margin: '0 0 24px' }}>
          New sets. Best of the vault. Every Monday.
        </p>
        <form onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="jb-sub-input"
            disabled={state === 'loading' || state === 'done'}
          />
          <button type="submit" className="jb-sub-submit" disabled={state === 'loading' || state === 'done'}>
            {state === 'loading' ? 'Sending…' : state === 'done' ? 'Check your inbox ✓' : state === 'error' ? 'Try again →' : 'Subscribe →'}
          </button>
        </form>
      </div>
    </div>
  );
}
