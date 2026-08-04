import React, { useState } from 'react';
import { STAGES, TABS } from './data/stages.js';

/**
 * Proper Selects — App Shell
 *
 * Vite/React rebuild in progress. Currently a scaffold; individual tabs
 * (TodayTab, VaultTab, AtlasTab, RadarTab) will be ported from the
 * beautified reference bundle at `reference/bundle-beautified.js` one
 * component at a time, verified against production behaviour.
 */
export default function App() {
  const [tab, setTab] = useState('jukebox');
  const active = TABS.find((t) => t.id === tab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh' }}>
      <header style={{ padding: 16, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <span style={{ fontWeight: 800, letterSpacing: '.16em', fontSize: 14 }}>
          PROPER SELECTS <span style={{ opacity: 0.5, fontSize: 10, marginLeft: 6 }}>REBUILD</span>
        </span>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <h1 style={{ fontSize: 22, marginBottom: 12 }}>
          {active?.icon} {active?.label}
        </h1>
        <p style={{ opacity: 0.6, fontSize: 13 }}>{active?.desc}</p>
        <p style={{ opacity: 0.4, fontSize: 12, marginTop: 16 }}>
          Tab component pending port from beautified reference bundle.
        </p>
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
    </div>
  );
}
