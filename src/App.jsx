import React, { useEffect, useState } from 'react';
import { TABS } from './data/stages.js';
import { supabaseHeaders, SUPABASE_URL } from './lib/supabase.js';
import LandingGate from './components/LandingGate.jsx';
import RadarTab from './components/RadarTab.jsx';
import VaultTab from './components/VaultTab.jsx';
import SubscribeModal from './components/SubscribeModal.jsx';
import SubmitModal from './components/SubmitModal.jsx';

export default function App() {
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState('jukebox');
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [topSets, setTopSets] = useState([]);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id,artist&order=published_at.desc&limit=10`, {
      headers: supabaseHeaders,
    })
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setTopSets(rows))
      .catch(() => {});
  }, []);

  if (!entered) {
    return (
      <>
        <LandingGate
          onEnter={() => setEntered(true)}
          onOpenSubmit={() => setSubmitOpen(true)}
          topSets={topSets}
        />
        <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
      </>
    );
  }

  const active = TABS.find((t) => t.id === tab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <header
        style={{
          padding: 16,
          borderBottom: '1px solid rgba(255,255,255,.08)',
          display: 'flex',
          gap: 12,
          alignItems: 'baseline',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <button
            onClick={() => setEntered(false)}
            style={{ background: 'none', border: 'none', color: '#EDEAE2', fontWeight: 800, letterSpacing: '.16em', fontSize: 14 }}
          >
            PROPER SELECTS
          </button>
          <span style={{ opacity: 0.5, fontSize: 10, letterSpacing: '.2em' }}>{active?.label?.toUpperCase()}</span>
        </div>
        <button
          onClick={() => setSubscribeOpen(true)}
          style={{
            background: 'rgba(255,255,255,.06)',
            border: '1px solid rgba(255,255,255,.12)',
            color: 'rgba(237,234,226,.7)',
            padding: '5px 12px',
            borderRadius: 16,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.06em',
            cursor: 'pointer',
          }}
        >
          Subscribe
        </button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'radar' ? (
          <RadarTab />
        ) : tab === 'grid' ? (
          <VaultTab />
        ) : (
          <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 22, marginBottom: 12 }}>
              {active?.icon} {active?.label}
            </h1>
            <p style={{ opacity: 0.6, fontSize: 13 }}>{active?.desc}</p>
            <p style={{ opacity: 0.4, fontSize: 12, marginTop: 16 }}>
              {tab === 'jukebox' ? 'Today tab' : 'Atlas tab'} — port in progress.
              Use the production build (main branch) for now.
            </p>
          </div>
        )}
      </main>

      <nav
        style={{
          display: 'flex',
          height: 60,
          background: 'rgba(9,9,15,.97)',
          borderTop: '1px solid rgba(255,255,255,.1)',
        }}
      >
        {TABS.map(({ id, label, icon }) => {
          const on = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                borderTop: on ? '2px solid #F4A93C' : '2px solid transparent',
                color: on ? '#F4A93C' : 'rgba(237,234,226,.5)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
              }}
            >
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      <SubscribeModal open={subscribeOpen} onClose={() => setSubscribeOpen(false)} />
      <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}
