import React, { useState, useEffect } from 'react';
import { SUPABASE_URL } from '../lib/supabase.js';

// Proper Selects × Dream Rentals — B2B Event Hospitality Portal.
// A production company (e.g. The Concourse Project) provisions housing + on-site
// services for its artists, crew and event staff in one itemized order.

const C = {
  bg: '#0a0a0f', bg2: '#12121c', card: '#16161f', card2: '#1c1c28',
  gold: '#F4A93C', gold2: '#ffcb6b', line: 'rgba(255,255,255,.08)',
  txt: '#EDEAE2', dim: '#9aa0ad', dim2: '#6b7280', green: '#34d399', blue: '#60a5fa',
};
const CONCIERGE_RATE = 0.15;
const PARTY_COLOR = { Artists: C.blue, Crew: C.gold, Staff: C.green };

// Real Austin inventory from partner property managers (Dream Rentals & Five Star rates indicative; Cribs live).
const MGR = {
  dream: { name: 'Dream Rentals', color: '#F4A93C' },
  five: { name: 'Five Star VHR', color: '#a78bfa' },
  cribs: { name: 'CRIBS', color: '#2dd4bf' },
};
const PROPS = [
  // ── Dream Rentals ──
  { id: 'p1', mgr: 'dream', name: 'ATX 4BD Oasis', badge: 'Headliner-ready', price: 1450, br: '4 BR · sleeps 19', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/fq52vxb7991srcgosgj0-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/austin-4bd-oasis-sauna-cold-plunge-beauty-bar/', amen: 'Sauna · Cold Plunge · Beauty Bar' },
  { id: 'p2', mgr: 'dream', name: 'ATX Getaway', badge: 'Crew favorite', price: 895, br: '3 BR · sleeps 14', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/szr2hafqsmrmwoppk2s1-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/atx-getaway-with-cowboy-pool-fire-pit-rooftop/', amen: 'Cowboy Pool · Fire Pit · Rooftop' },
  { id: 'p3', mgr: 'dream', name: 'Luxury Austin Retreat', badge: 'Full compound', price: 2100, br: '7 BR · sleeps 30', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/07/zva0hfsyhmnnxxdruh6w-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/luxury-7bd-austin-retreat-for-30-w-outdoor-oasis/', amen: 'Pool · Sauna · Cold Plunge · Outdoor Oasis' },
  // ── Five Star Vacation Home Rentals ──
  { id: 'p4', mgr: 'five', name: 'Serenita Estate', badge: 'Hill Country', price: 1850, br: '10 acres · large groups', hood: 'Austin',
    img: 'https://uc.orez.io/i/3b74ac54f80c4d0d87af495a70616e3c-Medium',
    url: 'https://www.fivestarvacationhomerentals.com/serenita-estatehill-country-retreat-10-acres-pooljacuzzi-orp5b6cffbx', amen: 'Pool · Jacuzzi · 10 private acres' },
  { id: 'p5', mgr: 'five', name: 'La Mariposa', badge: 'Biggest group', price: 2400, br: '2 homes · sleeps 25', hood: 'Austin',
    img: 'https://uc.orez.io/i/a110e28a0f32492c89869f40d84faa38-Medium',
    url: 'https://www.fivestarvacationhomerentals.com/la-mariposa-2-luxury-homes-on-full-acre-sleeps-25-orp5b6addcx', amen: 'Two luxury homes on a full acre' },
  { id: 'p6', mgr: 'five', name: 'Estrella Azul', badge: 'Central Austin', price: 1250, br: 'Luxury · central', hood: 'Austin',
    img: 'https://uc.orez.io/i/02207f1c3726418798aae00f0e39b1b0-Medium',
    url: 'https://www.fivestarvacationhomerentals.com/estrella-azul-a-luxury-escape-in-the-heart-of-austin-orp5b6d7c1x', amen: 'Luxury escape in the heart of Austin' },
  // ── CRIBS (real listings + live nightly rates) ──
  { id: 'p7', mgr: 'cribs', name: 'Eastside Lux Group Retreat', badge: 'Near downtown', price: 250, br: '5 BR · 4 BA', hood: 'East Austin',
    img: 'https://assets.wander.com/639647620880404389/1200.webp',
    url: 'https://www.cribsconsulting.com/', amen: 'Pool · Group retreat · walk to downtown' },
  { id: 'p8', mgr: 'cribs', name: 'ATX Creekside Duplex', badge: 'Value pick', price: 295, br: '6 BR · 6.5 BA', hood: 'Austin',
    img: 'https://assets.wander.com/639648356141892280/1200.webp',
    url: 'https://www.cribsconsulting.com/', amen: 'Modern full duplex · Hot Tub · creekside' },
  { id: 'p9', mgr: 'cribs', name: 'Lake Travis Estate', badge: 'Waterfront', price: 342, br: '7 BR · 4.5 BA', hood: 'Lake Travis',
    img: 'https://assets.wander.com/639650825639038929/1200.webp',
    url: 'https://www.cribsconsulting.com/', amen: 'Spectacular pool · lake views' },
];

const IMG = (id) => `https://images.unsplash.com/photo-${id}?w=680&h=420&fit=crop&q=80`;
const ADDONS = {
  gear: [
    { id: 'g1', img: IMG('1682006294765-45c81d7f366d'), name: '2× CDJ-3000 + DJM-A9', vend: 'Pro AV Rental', desc: 'Club-standard Pioneer booth for artist rehearsal / green room.', price: 425, unit: '/day', per: 'night' },
    { id: 'g2', img: IMG('1624089735305-63854867db06'), name: 'QSC PA System (2 tops + 2 subs)', vend: 'Pro AV Rental', desc: 'Room-filling sound for artist housing sessions.', price: 350, unit: '/day', per: 'night' },
    { id: 'g3', img: IMG('1572327918628-bf61496743ce'), name: 'XDJ-XZ All-in-One', vend: 'Pro AV Rental', desc: 'Standalone practice rig for support acts.', price: 180, unit: '/day', per: 'night' },
    { id: 'g4', img: IMG('1581548708095-7158f2e63857'), name: 'Booth Monitor + Mic Pack', vend: 'Pro AV Rental', desc: 'Wedge monitor + wireless mics.', price: 120, unit: '/day', per: 'night' },
  ],
  chef: [
    { id: 'c1', img: IMG('1758892170660-3ad271f3d672'), name: 'Private Chef Dinner', vend: 'Airbnb Experiences', desc: 'Multi-course crew dinner, per guest (min 6).', price: 125, unit: '/guest', per: 'one' },
    { id: 'c2', img: IMG('1786918467070-65f61fcbe44f'), name: 'Recovery Brunch Service', vend: 'Airbnb Experiences', desc: 'Post-show brunch for artists & crew, per guest.', price: 85, unit: '/guest', per: 'one' },
    { id: 'c3', img: IMG('1786918517993-38764ffcb264'), name: 'Full-Day Chef (per house)', vend: 'Airbnb Experiences', desc: 'Dedicated chef, all meals, per day.', price: 800, unit: '/day', per: 'night' },
  ],
  sec: [
    { id: 's1', img: IMG('1566245024852-04fbf7842ce9'), name: 'Unarmed Guard (8-hr shift)', vend: 'Licensed subcontractor', desc: 'Uniformed guard for artist housing / load-in.', price: 420, unit: '/shift', per: 'one' },
    { id: 's2', img: IMG('1659273144088-202efb9b86c8'), name: 'Executive Protection (Armed)', vend: 'Licensed subcontractor', desc: 'Trained EP agent assigned to headliner.', price: 820, unit: '/shift', per: 'one' },
    { id: 's3', img: IMG('1653592956557-48ae49fc5ef5'), name: 'Overnight Property Watch', vend: 'Licensed subcontractor', desc: 'On-site guard per house, per night.', price: 520, unit: '/night', per: 'night' },
  ],
  van: [
    { id: 'v1', img: IMG('1656426650699-a76ffe479608'), name: 'Sprinter + Driver (4-hr block)', vend: 'Group Transport', desc: 'Up to 14 pax — housing ↔ venue runs.', price: 600, unit: '/block', per: 'one' },
    { id: 'v2', img: IMG('1569520884908-682f382556e1'), name: 'Airport Transfer (AUS)', vend: 'Group Transport', desc: 'One-way group transfer per vehicle.', price: 260, unit: '/trip', per: 'one' },
    { id: 'v3', img: IMG('1656426672889-31d16c31f4de'), name: 'Full-Day Charter', vend: 'Group Transport', desc: 'Van + driver on call all day.', price: 1350, unit: '/day', per: 'night' },
  ],
};
const findAddon = (id) => { for (const c in ADDONS) { const f = ADDONS[c].find((a) => a.id === id); if (f) return f; } };
const fmt = (n) => '$' + Math.round(n).toLocaleString();
const fmtDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function StaysVIP() {
  const [propQty, setPropQty] = useState({});
  const [propParty, setPropParty] = useState({});
  const [qty, setQty] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [mgrFilter, setMgrFilter] = useState('all'); // 'all' | 'dream' | 'five'
  // Editable intake — pre-filled with the demo event, fully overridable.
  const [prodCo, setProdCo] = useState('');
  const [eventName, setEventName] = useState('F1 US Grand Prix');
  const [checkIn, setCheckIn] = useState('2026-10-22');
  const [checkOut, setCheckOut] = useState('2026-10-26');
  const [headcount, setHeadcount] = useState('8');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invNum, setInvNum] = useState('');

  // Nights derive from the actual reservation window; min 1 night.
  const nights = (() => {
    if (!checkIn || !checkOut) return 1;
    const ms = new Date(checkOut) - new Date(checkIn);
    const n = Math.round(ms / 86400000);
    return n > 0 ? n : 1;
  })();

  // The SPA locks html/body/#root to overflow:hidden for the tabbed app shell.
  // This is a standalone scrolling page, so re-enable scroll while it's mounted.
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

  const chgProp = (id, d) => {
    setPropQty((p) => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }));
    setPropParty((p) => (p[id] ? p : { ...p, [id]: 'Artists' }));
  };
  const setParty = (id, pt) => {
    setPropParty((p) => ({ ...p, [id]: pt }));
    setPropQty((p) => (p[id] ? p : { ...p, [id]: 1 }));
  };
  const chg = (id, d) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] || 0) + d) }));
  const clearAll = () => { setPropQty({}); setPropParty({}); setQty({}); };

  // Build order lines
  const lines = [];
  let sub = 0;
  for (const id in propQty) {
    const q = propQty[id]; if (q <= 0) continue;
    const p = PROPS.find((x) => x.id === id);
    const t = p.price * q * nights; sub += t;
    const party = propParty[id] || 'Artists'; const col = PARTY_COLOR[party];
    lines.push({ name: p.name, mgr: MGR[p.mgr]?.name, sub: `${fmt(p.price)}/night × ${q} home${q > 1 ? 's' : ''} × ${nights} nts`, v: t });
  }
  for (const id in qty) {
    const q = qty[id]; if (q <= 0) continue;
    const a = findAddon(id); const mult = a.per === 'night' ? nights : 1; const t = a.price * q * mult; sub += t;
    lines.push({ name: a.name, sub: a.per === 'night' ? `${fmt(a.price)}${a.unit} × ${q} × ${nights} nts` : `${fmt(a.price)}${a.unit} × ${q}`, v: t });
  }
  const fee = Math.round(sub * CONCIERGE_RATE);
  const grand = sub + fee;

  const submit = async () => {
    if (!Object.values(propQty).some((v) => v > 0)) { alert('Add at least one property to submit your request.'); return; }
    if (!contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
      alert('Add your email so 4TC can send your quote.');
      return;
    }
    setSending(true);
    try {
      const r = await fetch('/api/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'b2b_inquiry', source: 'vip', prodCo, eventName, checkIn, checkOut, nights, headcount, subtotal: sub, fee, total: grand, lines, contactName: prodCo, contactEmail }),
      });
      if (!r.ok) throw new Error('send failed');
      const now = new Date();
      const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
      setInvNum(`INV-${stamp}-${Math.floor(1000 + Math.random() * 9000)}`);
      setSubmitted(true);
    } catch {
      alert('Something went wrong sending your request. Please email contact@4tcproductions.com directly.');
    } finally {
      setSending(false);
    }
  };

  // ---- styles ----
  const s = {
    page: { background: C.bg, color: C.txt, minHeight: '100vh', fontFamily: "'Inter',system-ui,sans-serif" },
    wrap: { maxWidth: 1240, margin: '0 auto', padding: '0 24px' },
    topbar: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(10,10,15,.82)', backdropFilter: 'blur(14px)', borderBottom: `1px solid ${C.line}` },
    hero: { position: 'relative', padding: '60px 0 26px', overflow: 'hidden' },
    kick: { display: 'inline-flex', gap: 8, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: C.gold, border: '1px solid rgba(244,169,60,.3)', background: 'rgba(244,169,60,.06)', padding: '7px 14px', borderRadius: 30, marginBottom: 20 },
    field: { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '10px 14px', minWidth: 180 },
    fieldLabel: { display: 'block', fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: C.dim2, marginBottom: 3 },
    fieldInput: { background: 'transparent', border: 'none', color: C.txt, fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 14, width: '100%', outline: 'none' },
    secNum: { fontFamily: "'Sora',sans-serif", fontWeight: 800, color: C.gold, fontSize: 13, border: '1px solid rgba(244,169,60,.35)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' },
  };
  const stepper = (onMinus, val, onPlus) => (
    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${C.line}`, borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={onMinus} style={btnStep}>−</button>
      <span style={{ width: 34, textAlign: 'center', fontFamily: "'Sora'", fontWeight: 700, fontSize: 14 }}>{val}</span>
      <button onClick={onPlus} style={btnStep}>+</button>
    </div>
  );
  const btnStep = { width: 32, height: 32, background: C.card2, border: 'none', color: C.txt, fontSize: 17, cursor: 'pointer', fontFamily: "'Sora'" };

  return (
    <div style={s.page}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
      <div style={{ height: 3, background: `linear-gradient(90deg,${C.gold},${C.gold2})` }} />

      {/* Top bar */}
      <div style={s.topbar}><div style={{ ...s.wrap, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, fontFamily: "'Sora'", fontWeight: 800, letterSpacing: '.03em', fontSize: 14, color: C.txt, textDecoration: 'none' }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg,${C.gold},${C.gold2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.bg, fontSize: 15 }}>◆</span>
          PROPER SELECTS <span style={{ color: C.gold, fontWeight: 600, fontSize: 11, letterSpacing: '.12em' }}>· VIP CONCIERGE</span>
        </a>
        <div style={{ fontSize: 11, color: C.dim, border: `1px solid ${C.line}`, padding: '5px 12px', borderRadius: 20 }}>Powered by 4TC Concierge Hospitality Group</div>
      </div></div>

      {/* Hero */}
      <section style={{ ...s.hero, position: 'relative' }}>
        {/* Cinematic background image */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: "url('https://thedreamrentals.com/wp-content/uploads/2026/07/zva0hfsyhmnnxxdruh6w-scaled.jpg')", backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.28 }} />
        <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, rgba(10,10,15,.72) 0%, rgba(10,10,15,.86) 55%, ${C.bg} 100%)` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(1100px 460px at 82% -12%,rgba(244,169,60,.22),transparent 62%),radial-gradient(760px 420px at 4% 118%,rgba(167,139,250,.12),transparent 58%)' }} />
        <div style={{ ...s.wrap, position: 'relative' }}>
          <span style={s.kick}>◆ For streamers, artists &amp; private clientele · Powered by 4TC Concierge Hospitality Group</span>
          <h1 style={{ fontFamily: "'Sora'", fontSize: 56, lineHeight: 1.02, fontWeight: 800, letterSpacing: '-.03em', maxWidth: '15ch', textShadow: '0 2px 30px rgba(0,0,0,.5)' }}>
            Your festival weekend, <span style={{ background: `linear-gradient(120deg,${C.gold},${C.gold2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>flawlessly handled.</span>
          </h1>
          <p style={{ color: 'rgba(237,234,226,.72)', fontSize: 17.5, maxWidth: '58ch', marginTop: 18, lineHeight: 1.6 }}>
            Private estates, personal chefs, executive security, and chauffeured transport — arranged end to end for F1, ACL, and the world's marquee events. One discreet point of contact handles everything so you just show up.
          </p>
          <div style={{ marginTop: 30, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...s.secNum }}>✓</span>
            <div>
              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 16, color: C.txt }}>Start your request</div>
              <div style={{ fontSize: 12.5, color: C.dim2 }}>Tell us the event and your party — everything below tailors to it instantly.</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
            <div className="ps-field" style={{ ...s.field, minWidth: 210 }}>
              <label style={s.fieldLabel}>Your Name</label>
              <input value={prodCo} onChange={(e) => setProdCo(e.target.value)} placeholder="Full name" style={s.fieldInput} />
            </div>
            <div className="ps-field" style={{ ...s.field, minWidth: 210 }}>
              <label style={s.fieldLabel}>Event</label>
              <input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="F1 US Grand Prix" style={s.fieldInput} />
            </div>
            <div className="ps-field" style={s.field}>
              <label style={s.fieldLabel}>Check-in</label>
              <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} style={{ ...s.fieldInput, colorScheme: 'dark' }} />
            </div>
            <div className="ps-field" style={s.field}>
              <label style={s.fieldLabel}>Check-out</label>
              <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} style={{ ...s.fieldInput, colorScheme: 'dark' }} />
            </div>
            <div className="ps-field" style={{ ...s.field, minWidth: 120 }}>
              <label style={s.fieldLabel}>Party Size</label>
              <input type="number" min="1" value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="0" style={s.fieldInput} />
            </div>
            <div className="ps-field" style={{ ...s.field, minWidth: 220 }}>
              <label style={s.fieldLabel}>Your Email <span style={{ color: C.gold }}>*</span></label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@email.com" style={s.fieldInput} />
            </div>
          </div>
        </div>
      </section>

      {/* Builder */}
      <div style={{ ...s.wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 372px', gap: 32, padding: '26px 0 90px', alignItems: 'start' }} className="ps-b2b-grid">
        <div>
          {/* Section 1: Housing */}
          <Section num="1" title="Where you'll stay" sub="Hand-picked luxury estates from our Austin partners. Choose one or more.">
            {/* Property-manager filter */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: C.dim2, textTransform: 'uppercase', letterSpacing: '.1em', marginRight: 2 }}>Managed by</span>
              {[['all', 'All partners', C.txt], ['dream', MGR.dream.name, MGR.dream.color], ['five', MGR.five.name, MGR.five.color], ['cribs', MGR.cribs.name, MGR.cribs.color]].map(([k, label, col]) => {
                const on = mgrFilter === k;
                return <span key={k} onClick={() => setMgrFilter(k)} style={{ fontSize: 12, fontWeight: 600, padding: '6px 13px', borderRadius: 20, cursor: 'pointer', border: `1px solid ${on ? col : C.line}`, background: on ? `${col}1f` : 'transparent', color: on ? col : C.dim }}>{label}</span>;
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {PROPS.filter((p) => mgrFilter === 'all' || p.mgr === mgrFilter).map((p) => {
                const q = propQty[p.id] || 0; const party = propParty[p.id] || 'Artists';
                const m = MGR[p.mgr];
                return (
                  <div key={p.id} className="ps-prop" style={{ background: C.card, border: `1px solid ${q > 0 ? C.gold : C.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: q > 0 ? `0 0 0 1px ${C.gold}, 0 18px 44px rgba(244,169,60,.10)` : 'none' }}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" title={`View ${p.name} on ${m.name}`} style={{ display: 'block', height: 158, position: 'relative', cursor: 'pointer', overflow: 'hidden' }}>
                      <div className="ps-img" style={{ position: 'absolute', inset: 0, backgroundImage: `url('${p.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,10,15,.15) 0%,transparent 30%,transparent 60%,rgba(10,10,15,.55) 100%)' }} />
                      {p.badge && <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(10,10,15,.6)', backdropFilter: 'blur(10px)', color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', padding: '5px 10px', borderRadius: 20, textTransform: 'uppercase', border: '1px solid rgba(255,255,255,.08)' }}>{p.badge}</span>}
                      <span style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(10,10,15,.6)', backdropFilter: 'blur(10px)', color: m.color, fontSize: 10, fontWeight: 700, letterSpacing: '.04em', padding: '5px 9px', borderRadius: 20, border: `1px solid ${m.color}55`, display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: m.color, boxShadow: `0 0 8px ${m.color}` }} />{m.name}</span>
                      <span style={{ position: 'absolute', bottom: 11, right: 12, background: 'rgba(255,255,255,.12)', backdropFilter: 'blur(10px)', color: C.txt, fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,.14)' }}>View listing ↗</span>
                    </a>
                    <div style={{ padding: '15px 16px 16px' }}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                        <h3 style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, color: C.txt }}>{p.name}</h3>
                      </a>
                      <div style={{ color: C.dim, fontSize: 12.5, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}><span>📍 {p.hood}</span><span>🛏️ {p.br}</span></div>
                      <div style={{ color: C.dim2, fontSize: 11.5, marginTop: 6 }}>{p.amen}</div>
                      <div style={{ marginTop: 11, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <b style={{ fontFamily: "'Sora'", fontSize: 19, fontWeight: 800 }}>{fmt(p.price)}<span style={{ fontSize: 12, color: C.dim2, fontWeight: 400 }}> / night</span></b>
                        {stepper(() => chgProp(p.id, -1), q, () => chgProp(p.id, 1))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <AddonSection num="2" title="Sound & entertainment" sub="Pro DJ + sound gear delivered to your estate for private sets & content" cat="gear" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="3" title="Private dining" sub="In-estate personal chefs & bespoke menus · Airbnb Experience chefs (per guest / service)" cat="chef" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="4" title="Security & privacy" sub="Discreet executive protection & 24/7 property watch · licensed agents · per guard / shift" cat="sec" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="5" title="Chauffeured transport" sub="Private Sprinter & black-car service — estate, venue & airport" cat="van" qty={qty} chg={chg} stepper={stepper} C={C} />
        </div>

        {/* Cart */}
        <aside>
          <div style={{ position: 'sticky', top: 88, background: `linear-gradient(180deg,${C.card2},${C.card})`, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>
            <h3 style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Your Concierge Itinerary
              <span onClick={clearAll} style={{ fontSize: 11, color: C.dim2, cursor: 'pointer', fontWeight: 500 }}>Clear</span>
            </h3>
            {(prodCo || eventName) && (
              <div style={{ margin: '13px 0 6px', fontSize: 12, color: C.dim, lineHeight: 1.6 }}>
                {prodCo && <div style={{ color: C.txt, fontWeight: 600, fontFamily: "'Sora'" }}>{prodCo}</div>}
                {eventName && <div>{eventName}</div>}
                {headcount && <div style={{ color: C.dim2 }}>Party of {headcount}</div>}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '12px 0', padding: '11px 14px', background: C.bg2, borderRadius: 12, border: `1px solid ${C.line}` }}>
              <div>
                <label style={{ fontSize: 13, color: C.dim }}>Reservation</label>
                <div style={{ fontSize: 11, color: C.dim2, marginTop: 2 }}>{fmtDate(checkIn)} → {fmtDate(checkOut)}</div>
              </div>
              <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 15, color: C.gold, whiteSpace: 'nowrap' }}>{nights} {nights === 1 ? 'night' : 'nights'}</div>
            </div>
            <div style={{ marginTop: 6, maxHeight: 300, overflowY: 'auto' }}>
              {lines.length ? lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: `1px dashed ${C.line}`, fontSize: 13 }}>
                  <div style={{ color: C.txt }}>
                    {l.name}
                    <small style={{ display: 'block', color: C.dim2, fontSize: 11, marginTop: 2 }}>{l.mgr ? `${l.mgr} · ` : ''}{l.sub}</small>
                  </div>
                  <div style={{ fontFamily: "'Sora'", fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(l.v)}</div>
                </div>
              )) : <div style={{ color: C.dim2, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Add housing & services to build the event order.</div>}
            </div>
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              <Row label="Subtotal" val={fmt(sub)} C={C} />
              <Row label="4TC concierge fee (15%)" val={fmt(fee)} C={C} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Sora'", fontSize: 21, fontWeight: 800, marginTop: 6 }}>
                <span>Order total (est.)</span><span style={{ color: C.gold }}>{fmt(grand)}</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim2, marginTop: 4 }}>Single itemized invoice · all vendors coordinated by 4TC Concierge</div>
            </div>
            {!submitted ? (
              <button onClick={submit} disabled={sending} className="ps-cta" style={{ display: 'block', width: '100%', marginTop: 16, background: `linear-gradient(120deg,${C.gold},${C.gold2})`, color: C.bg, border: 'none', padding: 15, borderRadius: 13, fontFamily: "'Sora'", fontWeight: 800, fontSize: 15, cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.75 : 1, boxShadow: '0 10px 26px rgba(244,169,60,.22)' }}>
                {sending ? 'Sending…' : 'Submit Request for Confirmation →'}
              </button>
            ) : (
              <div style={{ marginTop: 16 }}>
                <div style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.3)', borderRadius: 13, padding: '13px 16px', textAlign: 'center', fontFamily: "'Sora'", fontWeight: 700, color: C.green, fontSize: 14 }}>
                  ✓ Request sent — 4TC will reply within 24h
                </div>
                <button onClick={() => setShowInvoice(true)} style={{ display: 'block', width: '100%', marginTop: 10, background: C.card2, color: C.gold, border: `1px solid rgba(244,169,60,.35)`, padding: '11px 15px', borderRadius: 13, fontFamily: "'Sora'", fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  ↓ Save Invoice / Print
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 11, color: C.dim2, alignItems: 'center', justifyContent: 'center' }}>
              {['Net-30 terms', 'One invoice', 'Dedicated coordinator'].map((t) => <span key={t} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '4px 8px' }}>{t}</span>)}
            </div>
            <div style={{ fontSize: 11, color: C.dim2, textAlign: 'center', marginTop: 11, lineHeight: 1.5 }}>
              No charge today · a PS coordinator confirms vendor availability &amp; returns a signed quote within 24h.<br />
              <button onClick={() => setShowTerms(true)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 11, cursor: 'pointer', textDecoration: 'underline', marginTop: 5 }}>Terms &amp; Conditions</button>
            </div>
          </div>
        </aside>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, padding: '30px 0', color: C.dim2, fontSize: 12, textAlign: 'center' }}>
        Proper Selects · VIP Concierge · Powered by 4TC Concierge Hospitality Group · properselects.com
      </div>

      {/* ── Terms & Conditions modal ── */}
      {showTerms && (
        <div onClick={() => setShowTerms(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#16161f', border: '1px solid rgba(255,255,255,.1)', borderRadius: 18, maxWidth: 680, width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '32px 36px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Sora'", fontWeight: 800, fontSize: 18, color: C.txt }}>Terms &amp; Conditions</div>
                <div style={{ fontSize: 12, color: C.dim, marginTop: 3 }}>4TC Concierge Hospitality Group · VIP Concierge Services Agreement</div>
              </div>
              <button onClick={() => setShowTerms(false)} style={{ background: 'none', border: 'none', color: C.dim, fontSize: 22, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>
            {[
              ['1. Concierge Liaison Role', '4TC Concierge Hospitality Group ("4TC") and Proper Selects act solely as concierge coordinators and booking liaisons. We do not own, operate, manage, or control any of the properties, equipment, vehicles, catering services, or security personnel listed on this platform. All inventory and services are provided by independent third-party vendors.'],
              ['2. No Inventory Ownership', 'All properties are independently owned and managed by Dream Rentals Austin, Five Star Vacation Home Rentals, CRIBS Consulting, or other third-party operators. All AV and backline equipment is provided by independent rental companies. All catering, security, and transport services are provided by independent licensed operators. 4TC and Proper Selects have no ownership interest in any of the above.'],
              ['3. Pricing Estimates', 'All prices shown are estimates based on current vendor rate cards and are subject to change without notice. Final pricing will be confirmed in a written quote provided by 4TC within 24 hours of your request submission. Actual charges may vary based on availability, season, specific property terms, and vendor-imposed minimums.'],
              ['4. Vendor Availability', '4TC makes no guarantee of availability for any property, equipment, or service listed. Submission of an inquiry does not constitute a confirmed reservation. A binding reservation is only established upon receipt of a signed confirmation and applicable deposit as outlined in the vendor\'s individual agreement.'],
              ['5. Third-Party Performance', '4TC is not liable for the performance, quality, conduct, or failure of any third-party vendor. All disputes regarding the quality of a property, equipment, catering, security, or transport must be addressed directly with the applicable vendor. 4TC will use commercially reasonable efforts to assist in resolution but is not a party to vendor-client disputes.'],
              ['6. Cancellation & Refunds', 'Cancellation policies are determined solely by the individual vendors and are outlined in each vendor\'s separate agreement. 4TC\'s concierge coordination fee (15% of estimated order value) is earned upon the execution of coordination services and is non-refundable once a vendor has been contacted on your behalf. Force majeure events (including but not limited to natural disasters, government-mandated cancellations, or festival cancellations) do not obligate 4TC to issue refunds of its coordination fee.'],
              ['7. Limitation of Liability', 'To the maximum extent permitted by law, 4TC and Proper Selects shall not be liable for any indirect, incidental, consequential, or punitive damages arising out of or relating to the concierge services, vendor performance, or platform use. 4TC\'s total aggregate liability shall not exceed the concierge coordination fee paid by the client for the specific inquiry in question.'],
              ['8. Indemnification', 'You agree to indemnify, defend, and hold harmless 4TC Concierge Hospitality Group, Proper Selects, and their respective officers, employees, and agents from and against any claims, damages, losses, or expenses (including reasonable attorneys\' fees) arising out of or relating to: (a) your use of the services, (b) any breach of these terms, or (c) any dispute between you and a third-party vendor.'],
              ['9. No Guarantee of Events', '4TC makes no representations regarding the occurrence, scheduling, or quality of any festival, event, or gathering referenced on this platform (including but not limited to Formula 1, Austin City Limits, or Seismic Dance Event). Occurrence of a referenced event is not a condition of vendor agreements.'],
              ['10. Governing Law', 'These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without regard to conflict of law principles. Any dispute shall be resolved exclusively in the state or federal courts located in Travis County, Texas.'],
              ['11. Contact', 'Questions regarding these terms may be directed to contact@4tcproductions.com.'],
            ].map(([heading, body]) => (
              <div key={heading} style={{ marginBottom: 20 }}>
                <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 13, color: C.gold, marginBottom: 5 }}>{heading}</div>
                <div style={{ fontSize: 13, color: C.dim, lineHeight: 1.7 }}>{body}</div>
              </div>
            ))}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 11, color: C.dim2 }}>
              By submitting an inquiry through this platform, you acknowledge that you have read, understood, and agree to these Terms &amp; Conditions. Last updated: August 2026.
            </div>
          </div>
        </div>
      )}

      {/* ── Invoice overlay ── */}
      {showInvoice && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px 20px 40px', overflowY: 'auto' }}>
          <div style={{ maxWidth: 720, width: '100%' }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button onClick={() => window.print()} style={{ flex: 1, background: C.gold, color: C.bg, border: 'none', padding: '12px 20px', borderRadius: 11, fontFamily: "'Sora'", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Print / Save as PDF</button>
              <button onClick={() => setShowInvoice(false)} style={{ background: C.card2, color: C.txt, border: `1px solid ${C.line}`, padding: '12px 20px', borderRadius: 11, fontFamily: "'Sora'", fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>Close</button>
            </div>
            <div id="ps-invoice" style={{ background: '#fff', color: '#111', borderRadius: 16, padding: '48px 52px', fontFamily: "'Helvetica Neue',Arial,sans-serif" }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 22, letterSpacing: '-.01em', color: '#0a0a0f' }}>4TC Concierge Hospitality Group</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3 }}>Proper Selects · VIP Concierge</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>contact@4tcproductions.com · properselects.com</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 900, fontSize: 28, color: '#F4A93C', letterSpacing: '-.02em' }}>ESTIMATE</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#374151', marginTop: 4 }}>{invNum}</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>
              <div style={{ height: 3, background: 'linear-gradient(90deg,#F4A93C,#ffcb6b)', borderRadius: 2, marginBottom: 32 }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>Prepared For</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{prodCo || contactName || '—'}</div>
                  {contactEmail && <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>{contactEmail}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>Event Details</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{eventName || '—'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{checkIn && checkOut ? `${new Date(checkIn+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})} – ${new Date(checkOut+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : '—'} · {nights} {nights===1?'night':'nights'}</div>
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 1 }}>Party of {headcount}</div>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                    {['Item', 'Detail', 'Amount'].map((h, i) => (
                      <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', textAlign: i === 2 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '11px 12px', fontSize: 14, fontWeight: 600, color: '#111', maxWidth: 200 }}>{l.name}</td>
                      <td style={{ padding: '11px 12px', fontSize: 12, color: '#6b7280' }}>{l.mgr ? `${l.mgr} · ` : ''}{l.sub}</td>
                      <td style={{ padding: '11px 12px', fontSize: 14, fontWeight: 600, color: '#111', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(l.v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ minWidth: 280 }}>
                  {[['Subtotal', fmt(sub)], ['4TC Concierge Fee (15%)', fmt(fee)]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6', fontSize: 14, color: '#374151' }}>
                      <span>{k}</span><span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 0', fontSize: 20, fontWeight: 900, color: '#0a0a0f' }}>
                    <span>Estimated Total</span><span style={{ color: '#F4A93C' }}>{fmt(grand)}</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 36, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>Important Notes</div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
                  This document is a <strong style={{color:'#374151'}}>non-binding estimate</strong>. All pricing is subject to vendor availability and final confirmation. A formal agreement and payment schedule will be provided by 4TC within 24 hours of your request.<br /><br />
                  4TC Concierge Hospitality Group acts solely as a concierge coordinator and liaison. 4TC does not own or operate any of the properties, equipment, or services listed above. All vendors are independent third parties. Client agreements with vendors are separate from this concierge coordination engagement.<br /><br />
                  <strong style={{color:'#374151'}}>Payment Terms:</strong> Net-30 from signed quote. Concierge coordination fee (15%) is due upon engagement confirmation and is non-refundable once vendor coordination has commenced.<br /><br />
                  Questions? Contact <strong style={{color:'#374151'}}>contact@4tcproductions.com</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:980px){.ps-b2b-grid{grid-template-columns:1fr !important}}
        .ps-prop{transition:transform .28s cubic-bezier(.2,.7,.3,1),box-shadow .28s,border-color .2s;will-change:transform}
        .ps-prop:hover{transform:translateY(-6px);box-shadow:0 24px 60px rgba(0,0,0,.55)}
        .ps-prop .ps-img{transition:transform .6s cubic-bezier(.2,.7,.3,1)}
        .ps-prop:hover .ps-img{transform:scale(1.07)}
        .ps-addon{transition:transform .2s,border-color .2s,background .2s}
        .ps-addon:hover{transform:translateY(-2px)}
        .ps-cta{transition:transform .2s,box-shadow .2s,filter .2s}
        .ps-cta:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(244,169,60,.34);filter:brightness(1.05)}
        .ps-field input:focus{outline:none}
        .ps-field:focus-within{border-color:${C.gold}77 !important;box-shadow:0 0 0 3px rgba(244,169,60,.10)}
        .ps-chip{transition:all .16s}
        ::selection{background:${C.gold};color:${C.bg}}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(.7) sepia(1) saturate(3) hue-rotate(5deg);cursor:pointer}
        @media print{body>*:not(#ps-invoice){display:none !important}#ps-invoice{display:block !important;position:fixed;inset:0;z-index:9999;padding:0;border-radius:0}}
      `}</style>
    </div>
  );
}

function Section({ num, title, sub, children }) {
  return (
    <div style={{ marginBottom: 42 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
        <span style={{ fontFamily: "'Sora'", fontWeight: 800, color: '#F4A93C', fontSize: 13, border: '1px solid rgba(244,169,60,.35)', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>{num}</span>
        <h2 style={{ fontFamily: "'Sora'", fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</h2>
      </div>
      <div style={{ color: '#6b7280', fontSize: 13, margin: '2px 0 18px 40px' }}>{sub}</div>
      {children}
    </div>
  );
}

function AddonSection({ num, title, sub, cat, qty, chg, stepper, C }) {
  return (
    <Section num={num} title={title} sub={sub}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
        {ADDONS[cat].map((a) => {
          const q = qty[a.id] || 0;
          return (
            <div key={a.id} className="ps-prop" style={{ background: C.card, border: `1px solid ${q > 0 ? C.gold : C.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: q > 0 ? `0 0 0 1px ${C.gold}, 0 18px 44px rgba(244,169,60,.10)` : 'none' }}>
              {/* Photo header (listing-style) */}
              <div style={{ height: 140, position: 'relative', overflow: 'hidden' }}>
                <div className="ps-img" style={{ position: 'absolute', inset: 0, backgroundImage: `url('${a.img}')`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(10,10,15,.12) 0%,transparent 32%,transparent 55%,rgba(10,10,15,.62) 100%)' }} />
                <span style={{ position: 'absolute', top: 11, left: 11, background: 'rgba(10,10,15,.6)', backdropFilter: 'blur(10px)', color: C.gold, fontSize: 10, fontWeight: 700, letterSpacing: '.05em', padding: '5px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,.08)' }}>{a.vend}</span>
                {q > 0 && <span style={{ position: 'absolute', top: 11, right: 11, minWidth: 22, height: 22, background: C.gold, color: C.bg, fontFamily: "'Sora'", fontWeight: 800, fontSize: 12, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 7px' }}>{q}</span>}
                <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
                  <div style={{ fontFamily: "'Sora'", fontSize: 15, fontWeight: 700, color: '#fff', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>{a.name}</div>
                </div>
              </div>
              <div style={{ padding: '13px 15px 15px' }}>
                <div style={{ fontSize: 12.5, color: C.dim, minHeight: 34 }}>{a.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: "'Sora'", fontWeight: 800, fontSize: 17 }}>{fmt(a.price)}<small style={{ fontSize: 11.5, color: C.dim2, fontWeight: 400 }}> {a.unit}</small></div>
                  {stepper(() => chg(a.id, -1), q, () => chg(a.id, 1))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function Row({ label, val, C }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: C.dim, marginBottom: 8 }}><span>{label}</span><span>{val}</span></div>;
}
