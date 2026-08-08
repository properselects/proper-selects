import React, { useEffect, useState } from 'react';
import { TABS } from './data/stages.js';
import { supabaseHeaders, SUPABASE_URL } from './lib/supabase.js';
import LandingGate from './components/LandingGate.jsx';
import RadarTab from './components/RadarTab.jsx';
import VaultTab from './components/VaultTab.jsx';
import TodayTab from './components/TodayTab.jsx';
import AtlasTab from './components/AtlasTab.jsx';
import SubscribeModal from './components/SubscribeModal.jsx';
import SubmitModal from './components/SubmitModal.jsx';
import LineupDrawer from './components/LineupDrawer.jsx';
import LineupSharePage from './components/LineupSharePage.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import PreviewModal from './components/PreviewModal.jsx';

// Detect /l/{slug} share pages
function getShareSlug() {
  const m = window.location.pathname.match(/^\/l\/([a-zA-Z0-9]{4,10})$/);
  return m ? m[1] : null;
}

export default function App() {
  const [shareSlug] = useState(() => getShareSlug());
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState('jukebox');
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [topSets, setTopSets] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lineup, setLineup] = useState(() => {
    try { return JSON.parse(localStorage.getItem('psLineup') || '[]'); } catch { return []; }
  });
  const [tooltipSeen, setTooltipSeen] = useState(() => !!localStorage.getItem('psLineupTipSeen'));
  const [showTooltip, setShowTooltip] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [nowPlaying, setNowPlaying] = useState(null);

  useEffect(() => {
    fetch(`${SUPABASE_URL}/rest/v1/public_sets?select=video_id,artist&order=published_at.desc&limit=10`, {
      headers: supabaseHeaders,
    })
      .then((r) => r.json())
      .then((rows) => Array.isArray(rows) && setTopSets(rows))
      .catch(() => {});
  }, []);

  // Persist lineup to localStorage
  useEffect(() => {
    try { localStorage.setItem('psLineup', JSON.stringify(lineup)); } catch {}
  }, [lineup]);

  // Show tooltip on first visit after 2s
  useEffect(() => {
    if (!tooltipSeen && !drawerOpen) {
      const t = setTimeout(() => { setShowTooltip(true); }, 2000);
      return () => clearTimeout(t);
    }
  }, [tooltipSeen, drawerOpen]);

  function openDrawer() {
    setDrawerOpen(true);
    setShowTooltip(false);
    if (!tooltipSeen) {
      setTooltipSeen(true);
      try { localStorage.setItem('psLineupTipSeen', '1'); } catch {}
    }
  }

  // Share page
  if (shareSlug) {
    return (
      <LineupSharePage
        slug={shareSlug}
        onMakeYourOwn={() => {
          window.history.pushState({}, '', '/');
          window.location.reload();
        }}
      />
    );
  }

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
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100dvh' }}>
      <header
        style={{
          padding: 16,
          borderBottom: '1px solid rgba(255,255,255,.08)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
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

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Search button */}
          <button
            onClick={() => setSearchOpen(true)}
            title="Search sets"
            style={{
              background: 'rgba(255,255,255,.06)',
              border: '1px solid rgba(255,255,255,.12)',
              color: 'rgba(237,234,226,.7)',
              padding: '5px 10px',
              borderRadius: 16,
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            🔍 <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.05em' }}>Search</span>
          </button>

          {/* Lineup chip */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={openDrawer}
              style={{
                background: lineup.length ? 'rgba(244,169,60,.12)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${lineup.length ? 'rgba(244,169,60,.4)' : 'rgba(255,255,255,.1)'}`,
                color: lineup.length ? '#F4A93C' : 'rgba(237,234,226,.5)',
                padding: '5px 11px',
                borderRadius: 16,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '.05em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                animation: !tooltipSeen ? 'chipPulse 2.4s ease-in-out infinite' : 'none',
              }}
            >
              <span style={{ fontSize: 12 }}>◈</span>
              {lineup.length > 0 ? `${lineup.length}` : 'Lineup'}
            </button>

            {showTooltip && !tooltipSeen && (
              <div
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#1c1c26', border: '1px solid rgba(244,169,60,.3)',
                  borderRadius: 8, padding: '10px 12px', width: 200,
                  fontSize: 12, lineHeight: 1.5, zIndex: 500,
                  animation: 'fadeInDown .2s ease',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Build your own lineup</div>
                <div style={{ opacity: 0.6 }}>Tap ＋ on any set, then share with friends.</div>
                <button
                  onClick={() => setShowTooltip(false)}
                  style={{ background: 'none', border: 'none', color: 'rgba(237,234,226,.35)', fontSize: 11, cursor: 'pointer', marginTop: 6, padding: 0 }}
                >
                  Got it
                </button>
              </div>
            )}
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
        </div>
      </header>

      {/* main: overflow hidden so atlas map (position:absolute) fills correctly */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative', minHeight: 0 }}>
        {/* All tabs stay mounted so YouTube iframe survives tab switches */}
        <div style={{ display: tab === 'jukebox' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <TodayTab lineup={lineup} onLineupChange={setLineup} onOpenLineup={openDrawer} onSetChange={setNowPlaying} />
        </div>
        <div style={{ display: tab === 'grid' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <VaultTab lineup={lineup} onLineupChange={setLineup} />
        </div>
        {/* Atlas: position absolute so Leaflet map gets real pixel dimensions */}
        <div style={{ display: tab === 'atlas' ? 'block' : 'none', position: 'absolute', inset: 0 }}>
          <AtlasTab lineup={lineup} onLineupChange={setLineup} isActive={tab === 'atlas'} />
        </div>
        <div style={{ display: tab === 'radar' ? 'flex' : 'none', flexDirection: 'column', height: '100%', overflowY: 'auto' }}>
          <RadarTab />
        </div>
      </main>

      {/* Mini player — shown when something is playing and user is on another tab */}
      {nowPlaying && tab !== 'jukebox' && (
        <button
          onClick={() => setTab('jukebox')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', background: 'rgba(10,10,14,.97)',
            border: 'none', borderTop: '1px solid rgba(255,255,255,.1)',
            borderBottom: 'none', padding: '8px 14px', cursor: 'pointer',
            color: '#EDEAE2', textAlign: 'left',
          }}
        >
          <img
            src={`https://img.youtube.com/vi/${nowPlaying.video_id}/default.jpg`}
            alt=""
            style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {nowPlaying.artist}
            </div>
            {nowPlaying.festival_name && (
              <div style={{ fontSize: 11, opacity: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {nowPlaying.festival_name}{nowPlaying.city ? ` · ${nowPlaying.city}` : ''}
              </div>
            )}
          </div>
          <span style={{ fontSize: 18, color: '#F4A93C', flexShrink: 0 }}>▷</span>
        </button>
      )}

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

      <LineupDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        lineup={lineup}
        onLineupChange={setLineup}
        onPreview={setPreview}
      />
      <GlobalSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        lineup={lineup}
        onLineupChange={setLineup}
        onPreview={setPreview}
      />
      <PreviewModal set={preview} onClose={() => setPreview(null)} />
      <SubscribeModal open={subscribeOpen} onClose={() => setSubscribeOpen(false)} />
      <SubmitModal open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </div>
  );
}
