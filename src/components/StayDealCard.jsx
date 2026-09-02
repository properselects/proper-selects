import React, { useEffect, useState } from 'react';

// Festivals that have a curated Dream Rentals stays page.
// Matched against the currently-playing set's festival_name.
const STAY_DEALS = [
  // ARC stays popup removed (campaign ended / per request 2026-09-02).
  {
    match: /concourse|seismic/i,
    href: '/stays/seismic',
    accent: '#FE005E',
    hook: 'Headed to Seismic?',
    eyebrow: 'Where to stay · Nov 13–15 · Austin',
    name: 'ATX 4BD Oasis',
    meta: 'Sauna · Cold Plunge · Sleeps 19',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/fq52vxb7991srcgosgj0-scaled.jpg',
  },
];

const DR_LOGO = 'https://thedreamrentals.com/wp-content/uploads/2023/05/Dream-Rentals-Logo-white-1024x751.png';

function dealFor(nowPlaying) {
  if (!nowPlaying) return null;
  const hay = `${nowPlaying.festival_name || ''} ${nowPlaying.title || ''}`;
  return STAY_DEALS.find((d) => d.match.test(hay)) || null;
}

// No default campaign popup on the Today's Lineup tab. Stay deals now only appear
// contextually when a matching festival set is actually playing. (ARC default removed.)
const ACTIVE_CAMPAIGN = null;

/**
 * StayDealCard — slides up over the player while a festival set is playing,
 * surfacing the matching Dream Rentals stays page. Non-intrusive: appears after
 * a short delay, dismissable, and only once per festival per session.
 */
export default function StayDealCard({ nowPlaying, tab }) {
  // Priority: a matching now-playing set; else a default campaign prompt on Today's Lineup.
  const deal = dealFor(nowPlaying) || (tab === 'jukebox' ? ACTIVE_CAMPAIGN : null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState({});

  useEffect(() => {
    if (!deal) { setVisible(false); return; }
    if (dismissed[deal.href]) { setVisible(false); return; }
    // brief delay so it feels contextual, not an instant pop
    setVisible(false);
    const t = setTimeout(() => setVisible(true), 6000);
    return () => clearTimeout(t);
  }, [deal?.href, dismissed]);

  if (!deal || !visible) return null;

  return (
    <div
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 76, zIndex: 40,
        animation: 'psDealUp .45s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <style>{`@keyframes psDealUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div style={{
        position: 'relative', maxWidth: 620, margin: '0 auto',
        background: 'rgba(14,17,15,.94)', backdropFilter: 'blur(18px)',
        border: `1.5px solid ${deal.accent}55`, borderRadius: 18,
        padding: '16px 16px 14px', boxShadow: '0 16px 44px rgba(0,0,0,.55)',
        color: '#fff',
      }}>
        {/* dismiss */}
        <button
          onClick={() => setDismissed((d) => ({ ...d, [deal.href]: true }))}
          aria-label="Dismiss"
          style={{
            position: 'absolute', top: 10, right: 12, width: 26, height: 26,
            borderRadius: '50%', background: 'rgba(255,255,255,.08)',
            border: 'none', color: 'rgba(255,255,255,.6)', cursor: 'pointer', fontSize: 14,
          }}
        >✕</button>

        <div style={{ marginBottom: 12, paddingRight: 30 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-.01em' }}>
            {deal.hook}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase',
            color: deal.accent, marginTop: 4,
          }}>
            🏠 {deal.eyebrow}
          </div>
        </div>

        <a href={deal.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{
              width: 92, height: 74, borderRadius: 10, flexShrink: 0,
              background: `url('${deal.img}') center/cover`,
              border: '1px solid rgba(255,255,255,.1)',
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.01em' }}>{deal.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', marginTop: 3 }}>{deal.meta}</div>
              <div style={{ fontSize: 12, color: '#fff', marginTop: 7, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#FFC83C' }}>★</span> 4.87 · Airbnb Superhost · 164 reviews
              </div>
            </div>
          </div>
        </a>

        <a href={deal.href} style={{
          display: 'block', textAlign: 'center', marginTop: 14,
          background: deal.accent, color: '#07120c',
          fontSize: 15, fontWeight: 900, padding: '13px', borderRadius: 12,
          textDecoration: 'none', letterSpacing: '.02em',
        }}>
          Explore more stays →
        </a>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 12, opacity: .55 }}>
          <img src="/logo.png" alt="Proper Selects" style={{ height: 18, width: 'auto' }} />
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>×</span>
          <img src={DR_LOGO} alt="Dream Rentals" style={{ height: 20, width: 'auto' }} />
        </div>
      </div>
    </div>
  );
}
