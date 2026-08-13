import React from 'react';
import ReactDOM from 'react-dom/client';
import { inject } from '@vercel/analytics';
import App from './App.jsx';
import { SUPABASE_URL, supabaseHeaders } from './lib/supabase.js';
import './styles.css';

inject();

// First-party pageview beacon → self-owned traffic stats (page_views table).
// Mirrors the existing search-logging pattern; no PII, anon-insert only, aggregates via pv_* views.
(function logPageView() {
  try {
    let sid = localStorage.getItem('ps_sid');
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem('ps_sid', sid);
    }
    const ua = navigator.userAgent || '';
    const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'desktop';
    let referrer = null;
    try { referrer = document.referrer ? new URL(document.referrer).hostname : null; } catch (_) {}
    fetch(`${SUPABASE_URL}/rest/v1/page_views`, {
      method: 'POST',
      headers: { ...supabaseHeaders, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ path: location.pathname || '/', referrer, device, session_id: sid }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {}
})();

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
