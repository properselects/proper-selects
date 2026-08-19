import React, { useState, useEffect } from 'react';

// Seismic Dance Event brand colors — extracted from seismicdanceevent.com
const S = {
  black:  '#000000',
  bg:     '#050505',
  card:   '#0f0f0f',
  cardBd: '#1c1c1c',
  pink:   '#FE005E',
  pinkGlow: 'rgba(254,0,94,.1)',
  pinkBd: 'rgba(254,0,94,.25)',
  white:  '#FFFFFF',
  dim:    'rgba(255,255,255,.55)',
  dimmer: 'rgba(255,255,255,.28)',
};

const CONCOURSE_SETS = [
  { video_id: 'yGXyuoeSwBU', artist: 'ALLEYCVT', label: 'The Concourse Project' },
  { video_id: 'TKVw8y1FGgU', artist: 'Ranger Trucco', label: 'The Concourse Project' },
  { video_id: 'SLth9mPN_Lc', artist: 'Lavern', label: 'The Concourse Project' },
  { video_id: 'pJakBxuld-g', artist: 'Wuki', label: 'The Concourse Project' },
  { video_id: 'y1mbaSae5v8', artist: 'Discip', label: 'The Concourse Project' },
  { video_id: 'UhXrLjOvElE', artist: 'Devault', label: 'The Concourse Project' },
];

const STAYS = [
  {
    name: 'ATX Getaway',
    tag: 'GROUP HOUSE',
    desc: '3BR · 3BA · Sleeps 14',
    detail: 'Cowboy Pool · Fire Pit · Rooftop',
    url: 'https://thedreamrentals.com/listing/atx-getaway-with-cowboy-pool-fire-pit-rooftop/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/szr2hafqsmrmwoppk2s1-scaled.jpg',
    highlight: false,
  },
  {
    name: 'ATX 4BD Oasis',
    tag: 'BEST AMENITIES',
    desc: '4BR · 3BA · Sleeps 19',
    detail: 'Sauna · Cold Plunge · Beauty Bar',
    url: 'https://thedreamrentals.com/listing/austin-4bd-oasis-sauna-cold-plunge-beauty-bar/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/fq52vxb7991srcgosgj0-scaled.jpg',
    highlight: true,
  },
  {
    name: 'Luxury Austin Retreat',
    tag: 'BIGGEST GROUP',
    desc: '7BR · 6BA · Sleeps 30',
    detail: 'Pool · Sauna · Cold Plunge · Outdoor Oasis',
    url: 'https://thedreamrentals.com/listing/luxury-7bd-austin-retreat-for-30-w-outdoor-oasis/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/07/zva0hfsyhmnnxxdruh6w-scaled.jpg',
    highlight: false,
  },
];

export default function StaysSeismic() {
  const [activeSet, setActiveSet] = useState(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const prev = { html: html.style.overflow, body: body.style.overflow, root: root?.style.overflow };
    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    if (root) root.style.overflow = 'auto';
    return () => {
      html.style.overflow = prev.html;
      body.style.overflow = prev.body;
      if (root) root.style.overflow = prev.root;
    };
  }, []);

  return (
    <div style={{
      background: S.bg, minHeight: '100vh', color: S.white,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
    }}>

      {/* ── HERO ── */}
      <div style={{
        background: S.black, borderBottom: `1px solid ${S.cardBd}`,
        padding: '0 0 40px', textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 500, height: 250, borderRadius: '50%', background: 'rgba(254,0,94,.07)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '16px 24px', borderBottom: `1px solid ${S.cardBd}`, marginBottom: 40,
        }}>
          <img src="/logo.png" alt="Proper Selects" style={{ height: 44, width: 90, objectFit: 'contain' }} />
          <span style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>×</span>
          <img src="https://thedreamrentals.com/wp-content/uploads/2023/05/Dream-Rentals-Logo-white-1024x751.png" alt="Dream Rentals" style={{ height: 44, width: 90, objectFit: 'contain' }} />
        </div>

        <div style={{ position: 'relative', padding: '0 24px' }}>
          <img
            src="https://www.seismicdanceevent.com/wp-content/uploads/2026/05/SDE9-OPENGRAPH.png"
            alt="Seismic Dance Event 9"
            style={{ width: '100%', maxWidth: 640, display: 'block', margin: '0 auto 20px' }}
          />
          <div style={{ fontSize: 14, color: S.dimmer, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Nov 13–15, 2026 · The Concourse Project · Austin, TX
          </div>
          <a href="https://www.seismicdanceevent.com/" target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-block', marginTop: 16,
            padding: '10px 24px', border: `1px solid ${S.pinkBd}`,
            color: S.pink, fontSize: 12, fontWeight: 800,
            letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Get Passes → seismicdanceevent.com
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ── STAYS ── */}
        <div style={{ marginTop: 48 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            Where to Stay
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', color: S.white }}>
            Curated stays for Seismic weekend.
          </h2>
          <p style={{ fontSize: 13, color: S.dimmer, margin: '0 0 20px' }}>
            Group-friendly homes in Austin · Powered by Dream Rentals
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {STAYS.map((stay) => (
              <a key={stay.name} href={stay.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: S.card,
                  border: stay.highlight ? `1px solid ${S.pink}` : `1px solid ${S.cardBd}`,
                  borderRadius: 4, overflow: 'hidden',
                  height: '100%', display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={stay.img}
                      alt={stay.name}
                      style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      padding: '3px 8px', borderRadius: 2,
                      background: stay.highlight ? S.pink : 'rgba(0,0,0,.75)',
                      color: S.white,
                      fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
                      border: stay.highlight ? 'none' : '1px solid rgba(255,255,255,.2)',
                    }}>
                      {stay.tag}
                    </div>
                  </div>
                  <div style={{ padding: '14px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: S.white }}>{stay.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{stay.desc}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 3 }}>{stay.detail}</div>
                    </div>
                    <div style={{
                      marginTop: 14, padding: '8px 0',
                      borderTop: `1px solid ${S.cardBd}`,
                      fontSize: 12, fontWeight: 700, color: S.pink,
                      textAlign: 'center', letterSpacing: '.04em',
                    }}>
                      Book on Dream Rentals →
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <a
            href="https://thedreamrentals.com/search-results/?state=texas&city=austin&check_in=2026-11-13&check_out=2026-11-15"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', marginTop: 12, padding: '14px',
              border: '1px solid rgba(255,255,255,.12)', borderRadius: 4,
              textAlign: 'center', textDecoration: 'none',
              fontSize: 13, fontWeight: 700, color: S.white,
              background: 'rgba(255,255,255,.04)',
            }}
          >
            View all available Austin listings for Seismic weekend →
          </a>
          <div style={{ marginTop: 8, fontSize: 11, color: S.dimmer, textAlign: 'center' }}>
            Dream Rentals · 4.87★ Superhost · 164 reviews · info@dreamchi.org
          </div>
        </div>

        {/* ── SETS ── */}
        <div style={{ marginTop: 64 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            Prep Sets
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', color: S.white }}>
            From The Concourse Project vault.
          </h2>
          <p style={{ fontSize: 13, color: S.dimmer, margin: '0 0 20px' }}>
            Tap to play · all recorded at The Concourse Project
          </p>

          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 8, scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}>
            {CONCOURSE_SETS.map((s) => (
              <div
                key={s.video_id}
                onClick={() => setActiveSet(activeSet === s.video_id ? null : s.video_id)}
                style={{
                  flexShrink: 0, width: 240,
                  background: S.card, borderRadius: 4, overflow: 'hidden',
                  border: activeSet === s.video_id ? `1px solid ${S.pink}` : `1px solid ${S.cardBd}`,
                  cursor: 'pointer', transition: 'border-color .12s',
                }}
              >
                {activeSet === s.video_id ? (
                  <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${s.video_id}?autoplay=1`}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`https://img.youtube.com/vi/${s.video_id}/mqdefault.jpg`}
                      alt={s.artist}
                      style={{ width: '100%', height: 135, objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        border: `2px solid ${S.pink}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, marginLeft: 3, color: S.pink }}>▶</span>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ padding: '10px 12px', borderTop: `1px solid ${S.cardBd}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: S.white }}>{s.artist}</div>
                  <div style={{ fontSize: 10, color: S.dimmer, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: S.dimmer, margin: '6px 0 0', textAlign: 'right' }}>Swipe to browse →</p>
          <a href="https://properselects.com" style={{ display: 'block', textAlign: 'center', marginTop: 10, fontSize: 12, color: S.pink, textDecoration: 'none', opacity: .8 }}>
            Browse all Concourse Project sets on Proper Selects →
          </a>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          marginTop: 56, padding: '36px 24px', textAlign: 'center',
          border: `1px solid ${S.pinkBd}`, borderRadius: 4,
          background: S.pinkGlow,
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: S.pink, marginBottom: 12 }}>
            Build your Seismic weekend
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8 }}>Discover. Listen. Book.</div>
          <div style={{ fontSize: 13, color: S.dimmer, marginBottom: 24 }}>
            Browse Concourse sets on Proper Selects. Build your lineup. Book your Austin stay.
          </div>
          <a href="https://properselects.com" style={{
            display: 'inline-block', padding: '12px 28px',
            background: S.pink, color: S.white,
            fontSize: 13, fontWeight: 800, letterSpacing: '.04em',
            textDecoration: 'none', borderRadius: 2,
          }}>
            Open Proper Selects →
          </a>
        </div>
      </div>
    </div>
  );
}
