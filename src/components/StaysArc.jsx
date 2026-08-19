import React, { useState, useEffect } from 'react';

// ARC Music Festival 2026 — actual brand colors
// Source: arcmusicfestival.com, Laylo embed color=4feb9a
const ARC = {
  black:   '#000000',
  bg:      '#050505',
  card:    '#0f0f0f',
  cardBd:  '#1a1a1a',
  mint:    '#4FEB9A',
  mintGlow:'rgba(79,235,154,.12)',
  mintBd:  'rgba(79,235,154,.2)',
  white:   '#FFFFFF',
  dim:     'rgba(255,255,255,.5)',
  dimmer:  'rgba(255,255,255,.28)',
};

const ARC_LINEUP = [
  'ERIC PRYDZ', 'ANYMA', 'HONEY DIJON', 'MICHAEL BIBI',
  'JOHN SUMMIT', 'KETTAMA', 'CHRIS LAKE', 'PEGGY GOU',
  'FISHER', 'BICEP', 'SKRILLEX', 'MACEO PLEX',
  'JAMIE JONES', 'SETH TROXLER', 'SASHA & JOHN DIGWEED',
];

const ARC_SETS = [
  { video_id: 'XCsGK2DWQzc', artist: 'John Summit', venue: 'Main Stage' },
  { video_id: 'eIJIqLkVLZE', artist: 'KETTAMA', venue: 'On The River' },
  { video_id: 'G7n83TVFR-M', artist: 'Ranger Trucco', venue: 'Expansions' },
  { video_id: 'GI9HqiuKUtc', artist: 'AC Slater', venue: 'At The Lake' },
  { video_id: 'fpXpS4mkwic', artist: 'AYYBO b2b OMRI.', venue: 'At Sea' },
  { video_id: 'VWDlZVWqduc', artist: 'HOTPRETTY', venue: 'AREA 909' },
];

const STAYS = [
  {
    name: 'Pilsen Retreat',
    tag: 'CLOSEST TO VENUE',
    desc: '4BR · 3.5BA · Sleeps 8',
    detail: 'Walkable to Union Park',
    url: 'https://thedreamrentals.com/listing/pilsen-retreat-4br-3ba-near-downtown-chicago/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/04/tqpc4ysxafw8jpgpijqf-scaled.jpg',
    highlight: true,
  },
  {
    name: 'United Center Compound',
    tag: 'BEST FOR BIG GROUPS',
    desc: '4BR · 3.5BA · Sleeps 18',
    detail: 'Rooftop · Hot Tub · Sauna',
    url: 'https://thedreamrentals.com/listing/united-center-compound-w-rooftop-hot-tub-sauna/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/05/ozpegyt8xv8u8oxlymsd-scaled.jpg',
    highlight: false,
  },
  {
    name: 'Wicker Park 4BD',
    tag: 'BEST VIBE',
    desc: '4BR · 3.5BA · Sleeps 15',
    detail: 'Theater room · Rooftop deck',
    url: 'https://thedreamrentals.com/listing/wicker-park-4bd-home-with-theater-room-rooftops/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/05/z1uam4xbl8zu66zaxdhp-scaled.jpg',
    highlight: false,
  },
  {
    name: '2BD near United Center',
    tag: 'BUDGET PICK',
    desc: '2BR · 1BA · Sleeps 4',
    detail: '111 S Paulina · walkable',
    url: 'https://thedreamrentals.com/listing/cozy-2bd-apartment-near-united-center-with-parking/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/05/wxgsfri2umtolwqc5dmw-scaled.jpg',
    highlight: false,
  },
  {
    name: 'Plymouth 4BD w/ Rooftop',
    tag: 'DOWNTOWN BASE',
    desc: '4BR · 3BA · Sleeps 8',
    detail: 'Rooftop + Gym · Loop',
    url: 'https://thedreamrentals.com/listing/plymouth-collection-top-floor-w-rooftop-lobby/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/05/lscbf3wvr4rgm9iooxdx-scaled.jpg',
    highlight: false,
  },
  {
    name: 'Charming Pilsen 2BD',
    tag: 'COUPLES / PAIRS',
    desc: '2BR · 2BA · Sleeps 4',
    detail: 'Heart of Pilsen',
    url: 'https://thedreamrentals.com/listing/welcome-to-our-charming-2bd-2ba-pilsen-apartment/',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/05/yhvsm7cu8nknqy0d4meb-scaled.jpg',
    highlight: false,
  },
];

const COUPON = 'DREAMARC15';

export default function StaysArc() {
  const [activeSet, setActiveSet] = useState(null);

  // Coupon unlock via email capture
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem('psArcCoupon') === '1'; } catch { return false; }
  });
  const [subStatus, setSubStatus] = useState('idle'); // idle | loading | error
  const [copied, setCopied] = useState(false);

  async function unlockCoupon(e) {
    e.preventDefault();
    if (!email || !/.+@.+\..+/.test(email)) { setSubStatus('error'); return; }
    setSubStatus('loading');
    try {
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, website }),
      });
    } catch { /* still unlock — email best-effort */ }
    try { localStorage.setItem('psArcCoupon', '1'); } catch {}
    setUnlocked(true);
    setSubStatus('idle');
  }

  function copyCode() {
    try { navigator.clipboard.writeText(COUPON); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch {}
  }

  // Override the SPA's overflow:hidden so this page can scroll
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
      background: ARC.bg, minHeight: '100vh', color: ARC.white,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", sans-serif',
    }}>

      {/* ── HERO ── */}
      <div style={{
        background: ARC.black,
        borderBottom: `1px solid ${ARC.cardBd}`,
        padding: '0 0 40px',
        textAlign: 'center',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* mint glow */}
        <div style={{ position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)', width: 600, height: 300, borderRadius: '50%', background: 'rgba(79,235,154,.06)', filter: 'blur(80px)', pointerEvents: 'none' }} />

        {/* header bar — co-brand logos */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          padding: '16px 24px', borderBottom: `1px solid ${ARC.cardBd}`,
          marginBottom: 40,
        }}>
          <img src="/logo.png" alt="Proper Selects" style={{ height: 44, width: 90, objectFit: 'contain' }} />
          <span style={{ fontSize: 16, fontWeight: 300, color: 'rgba(255,255,255,.3)' }}>×</span>
          <img src="https://thedreamrentals.com/wp-content/uploads/2023/05/Dream-Rentals-Logo-white-1024x751.png" alt="Dream Rentals" style={{ height: 44, width: 90, objectFit: 'contain' }} />
        </div>

        <div style={{ position: 'relative', padding: '0 24px' }}>
          {/* ARC official logo */}
          <img
            src="https://arcmusicfestival.com/wp-content/uploads/2024/03/ARClogo2024_WHT.png"
            alt="ARC Music Festival"
            style={{ width: 'clamp(180px, 50vw, 320px)', display: 'block', margin: '0 auto 16px' }}
          />
          <div style={{
            fontSize: 'clamp(13px, 3vw, 18px)', fontWeight: 400,
            letterSpacing: '.24em', textTransform: 'uppercase',
            color: ARC.mint, marginBottom: 6,
          }}>
            Music Festival 2026
          </div>
          <div style={{ fontSize: 14, color: ARC.dimmer, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 32 }}>
            Sept 4–7 · Union Park · Chicago
          </div>

        </div>
      </div>

      {/* ── OFFICIAL POSTER ── */}
      <div style={{ background: ARC.black, padding: '32px 24px 0', borderBottom: `1px solid ${ARC.cardBd}` }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.28em', color: ARC.mint, marginBottom: 16, textTransform: 'uppercase' }}>
            2026 Lineup
          </div>
          <a href="https://arcmusicfestival.com/tickets/" target="_blank" rel="noopener noreferrer">
            <img
              src="https://arcmusicfestival.com/wp-content/uploads/2026/08/ARC2026_ArtSocialSized_IG-1.png"
              alt="ARC Music Festival 2026 Official Lineup"
              style={{ width: '100%', maxWidth: 560, display: 'block', margin: '0 auto' }}
            />
          </a>
          <a href="https://arcmusicfestival.com/tickets/" target="_blank" rel="noopener noreferrer" style={{
            display: 'inline-block', marginTop: 16, marginBottom: 32,
            padding: '10px 24px', border: `1px solid ${ARC.mintBd}`,
            color: ARC.mint, fontSize: 12, fontWeight: 800,
            letterSpacing: '.1em', textTransform: 'uppercase', textDecoration: 'none',
          }}>
            Get Passes → arcmusicfestival.com
          </a>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* ── COUPON UNLOCK ── */}
        <div style={{ marginTop: 40 }}>
          <div style={{
            position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(160deg, #0c1a12, #0a0a0a)',
            border: `1px solid ${ARC.mintBd}`, borderRadius: 16,
            padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)', width: 360, height: 200, borderRadius: '50%', background: 'rgba(79,235,154,.10)', filter: 'blur(70px)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.24em', textTransform: 'uppercase', color: ARC.mint, marginBottom: 10 }}>
                Exclusive ARC Discount
              </div>
              <div style={{ fontSize: 'clamp(22px,5vw,30px)', fontWeight: 900, color: ARC.white, letterSpacing: '-.01em', marginBottom: 6 }}>
                15% off your stay with Dream Rentals
              </div>

              {/* Code chip — blurred until unlocked */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0 6px' }}>
                <button
                  onClick={unlocked ? copyCode : undefined}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 12,
                    padding: '14px 24px', borderRadius: 10,
                    background: unlocked ? ARC.mint : 'rgba(255,255,255,.06)',
                    border: `1px dashed ${unlocked ? 'transparent' : ARC.mintBd}`,
                    cursor: unlocked ? 'pointer' : 'default',
                  }}
                >
                  <span style={{
                    fontSize: 26, fontWeight: 900, letterSpacing: '.08em',
                    color: unlocked ? '#07120c' : ARC.white,
                    filter: unlocked ? 'none' : 'blur(9px)',
                    userSelect: unlocked ? 'auto' : 'none',
                    transition: 'filter .3s',
                  }}>
                    {COUPON}
                  </span>
                  {unlocked && (
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#07120c', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {copied ? 'Copied ✓' : 'Tap to copy'}
                    </span>
                  )}
                  {!unlocked && (
                    <span style={{ fontSize: 16 }}>🔒</span>
                  )}
                </button>
              </div>

              {!unlocked ? (
                <>
                  <p style={{ fontSize: 13, color: ARC.dimmer, margin: '10px 0 16px' }}>
                    Enter your email to unlock the code &amp; get set drops all weekend.
                  </p>
                  <form onSubmit={unlockCoupon} style={{ display: 'flex', gap: 8, maxWidth: 460, margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {/* honeypot */}
                    <input type="text" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }} aria-hidden="true" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (subStatus === 'error') setSubStatus('idle'); }}
                      placeholder="your@email.com"
                      style={{
                        flex: '1 1 240px', minWidth: 0,
                        padding: '13px 16px', borderRadius: 10,
                        background: '#0a0a0a', color: ARC.white,
                        border: `1px solid ${subStatus === 'error' ? '#FF5A5F' : ARC.cardBd}`,
                        fontSize: 15, outline: 'none',
                      }}
                    />
                    <button
                      type="submit"
                      disabled={subStatus === 'loading'}
                      style={{
                        flex: '0 0 auto', padding: '13px 24px', borderRadius: 10,
                        background: ARC.mint, color: '#07120c',
                        fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer',
                        letterSpacing: '.03em', whiteSpace: 'nowrap',
                      }}
                    >
                      {subStatus === 'loading' ? 'Unlocking…' : 'Unlock 15% off'}
                    </button>
                  </form>
                  {subStatus === 'error' && (
                    <p style={{ fontSize: 12, color: '#FF5A5F', marginTop: 8 }}>Enter a valid email to unlock.</p>
                  )}
                </>
              ) : (
                <p style={{ fontSize: 13, color: ARC.mint, margin: '10px 0 0', fontWeight: 600 }}>
                  Unlocked ✓ Apply <strong>{COUPON}</strong> at checkout on any Dream Rentals home below.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── STAYS ── (first) */}
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            Where to Stay
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-.01em', color: ARC.white }}>
            Curated stays for ARC weekend.
          </h2>
          <p style={{ fontSize: 13, color: ARC.dimmer, margin: '0 0 20px' }}>
            Group-friendly homes near Union Park · Powered by Dream Rentals
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {STAYS.map((stay) => (
              <a key={stay.name} href={stay.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <div style={{
                  background: ARC.card,
                  border: stay.highlight ? `1px solid ${ARC.mint}` : `1px solid ${ARC.cardBd}`,
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
                      background: stay.highlight ? ARC.mint : 'rgba(0,0,0,.75)',
                      color: stay.highlight ? ARC.black : ARC.white,
                      fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase',
                      border: stay.highlight ? 'none' : `1px solid rgba(255,255,255,.2)`,
                    }}>
                      {stay.tag}
                    </div>
                  </div>
                  <div style={{ padding: '14px 14px 16px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 4, color: ARC.white }}>{stay.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>{stay.desc}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 3 }}>{stay.detail}</div>
                    </div>
                    <div style={{
                      marginTop: 14, padding: '8px 0',
                      borderTop: `1px solid ${ARC.cardBd}`,
                      fontSize: 12, fontWeight: 700,
                      color: ARC.mint, textAlign: 'center',
                      letterSpacing: '.04em',
                    }}>
                      Book on Dream Rentals →
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <a
            href="https://thedreamrentals.com/search-results/?state=illinois&city=chicago&check_in=2026-09-04&check_out=2026-09-07"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block', marginTop: 12, padding: '14px',
              border: `1px solid rgba(255,255,255,.12)`, borderRadius: 4,
              textAlign: 'center', textDecoration: 'none',
              fontSize: 13, fontWeight: 700, color: ARC.white,
              background: 'rgba(255,255,255,.04)',
            }}
          >
            View all 69 available listings for ARC weekend →
          </a>
          <div style={{ marginTop: 8, fontSize: 11, color: ARC.dimmer, textAlign: 'center' }}>
            Dream Rentals · 4.87★ Superhost · 164 reviews · info@dreamchi.org
          </div>
        </div>

        {/* ── SETS ── */}
        <div style={{ marginTop: 64 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>
            Prep Sets
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-.01em', color: ARC.white }}>
            Get in the zone before you go.
          </h2>
          <p style={{ fontSize: 13, color: ARC.dimmer, margin: '0 0 20px' }}>
            Tap to play · all from past ARC performances
          </p>
          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 8, scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}>
            {ARC_SETS.map((s) => (
              <div
                key={s.video_id}
                onClick={() => setActiveSet(activeSet === s.video_id ? null : s.video_id)}
                style={{
                  flexShrink: 0, width: 240,
                  background: ARC.card, borderRadius: 4, overflow: 'hidden',
                  border: activeSet === s.video_id ? `1px solid ${ARC.mint}` : `1px solid ${ARC.cardBd}`,
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
                        border: `2px solid ${ARC.mint}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: 13, marginLeft: 3, color: ARC.mint }}>▶</span>
                      </div>
                    </div>
                  </div>
                )}
                <div style={{ padding: '10px 12px', borderTop: `1px solid ${ARC.cardBd}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ARC.white }}>{s.artist}</div>
                  <div style={{ fontSize: 10, color: ARC.dimmer, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>{s.venue}</div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: ARC.dimmer, margin: '6px 0 0', textAlign: 'right' }}>Swipe to browse →</p>
          <a href="https://properselects.com" style={{ display: 'block', textAlign: 'center', marginTop: 14, fontSize: 12, color: ARC.mint, textDecoration: 'none', opacity: .7 }}>
            Browse all 80+ ARC sets on Proper Selects →
          </a>
        </div>

        {/* ── FOOTER ── */}
        <div style={{
          marginTop: 56, padding: '36px 24px', textAlign: 'center',
          border: `1px solid ${ARC.mintBd}`, borderRadius: 4,
          background: 'rgba(79,235,154,.04)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.22em', textTransform: 'uppercase', color: ARC.mint, marginBottom: 12 }}>
            Build your ARC weekend
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 8, letterSpacing: '-.01em' }}>
            Discover. Listen. Book.
          </div>
          <div style={{ fontSize: 13, color: ARC.dimmer, marginBottom: 24 }}>
            Browse the full ARC vault on Proper Selects. Build your lineup. Share with your crew. Book your stay.
          </div>
          <a href="https://properselects.com" style={{
            display: 'inline-block', padding: '12px 28px',
            background: ARC.mint, color: ARC.black,
            fontSize: 13, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase',
            textDecoration: 'none', borderRadius: 2,
          }}>
            Open Proper Selects →
          </a>
        </div>
      </div>
    </div>
  );
}
