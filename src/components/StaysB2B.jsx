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

// Real Dream Rentals Austin inventory (nightly rates indicative).
const PROPS = [
  { id: 'p1', name: 'ATX 4BD Oasis', badge: 'Headliner-ready', price: 1450, br: '4 BR · sleeps 19', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/fq52vxb7991srcgosgj0-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/austin-4bd-oasis-sauna-cold-plunge-beauty-bar/', amen: 'Sauna · Cold Plunge · Beauty Bar' },
  { id: 'p2', name: 'ATX Getaway', badge: 'Crew favorite', price: 895, br: '3 BR · sleeps 14', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/06/szr2hafqsmrmwoppk2s1-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/atx-getaway-with-cowboy-pool-fire-pit-rooftop/', amen: 'Cowboy Pool · Fire Pit · Rooftop' },
  { id: 'p3', name: 'Luxury Austin Retreat', badge: 'Full compound', price: 2100, br: '7 BR · sleeps 30', hood: 'Austin',
    img: 'https://thedreamrentals.com/wp-content/uploads/2026/07/zva0hfsyhmnnxxdruh6w-scaled.jpg',
    url: 'https://thedreamrentals.com/listing/luxury-7bd-austin-retreat-for-30-w-outdoor-oasis/', amen: 'Pool · Sauna · Cold Plunge · Outdoor Oasis' },
];

const ADDONS = {
  gear: [
    { id: 'g1', ico: '🎛️', name: '2× CDJ-3000 + DJM-A9', vend: 'Rock N Roll Rentals', desc: 'Club-standard Pioneer booth for artist rehearsal / green room.', price: 425, unit: '/day', per: 'night' },
    { id: 'g2', ico: '🔊', name: 'QSC PA System (2 tops + 2 subs)', vend: 'Rock N Roll Rentals', desc: 'Room-filling sound for artist housing sessions.', price: 350, unit: '/day', per: 'night' },
    { id: 'g3', ico: '🎚️', name: 'XDJ-XZ All-in-One', vend: 'Rock N Roll Rentals', desc: 'Standalone practice rig for support acts.', price: 180, unit: '/day', per: 'night' },
    { id: 'g4', ico: '🎤', name: 'Booth Monitor + Mic Pack', vend: 'Rock N Roll Rentals', desc: 'Wedge monitor + wireless mics.', price: 120, unit: '/day', per: 'night' },
  ],
  chef: [
    { id: 'c1', ico: '🍽️', name: 'Private Chef Dinner', vend: 'Airbnb Experiences', desc: 'Multi-course crew dinner, per guest (min 6).', price: 125, unit: '/guest', per: 'one' },
    { id: 'c2', ico: '🥂', name: 'Recovery Brunch Service', vend: 'Airbnb Experiences', desc: 'Post-show brunch for artists & crew, per guest.', price: 85, unit: '/guest', per: 'one' },
    { id: 'c3', ico: '👨‍🍳', name: 'Full-Day Chef (per house)', vend: 'Airbnb Experiences', desc: 'Dedicated chef, all meals, per day.', price: 800, unit: '/day', per: 'night' },
  ],
  sec: [
    { id: 's1', ico: '🛡️', name: 'Unarmed Guard (8-hr shift)', vend: 'Licensed subcontractor', desc: 'Uniformed guard for artist housing / load-in.', price: 420, unit: '/shift', per: 'one' },
    { id: 's2', ico: '🕴️', name: 'Executive Protection (Armed)', vend: 'Licensed subcontractor', desc: 'Trained EP agent assigned to headliner.', price: 820, unit: '/shift', per: 'one' },
    { id: 's3', ico: '📋', name: 'Overnight Property Watch', vend: 'Licensed subcontractor', desc: 'On-site guard per house, per night.', price: 520, unit: '/night', per: 'night' },
  ],
  van: [
    { id: 'v1', ico: '🚐', name: 'Sprinter + Driver (4-hr block)', vend: 'Fetii', desc: 'Up to 14 pax — housing ↔ venue runs.', price: 600, unit: '/block', per: 'one' },
    { id: 'v2', ico: '✈️', name: 'Airport Transfer (AUS)', vend: 'Fetii', desc: 'One-way group transfer per vehicle.', price: 260, unit: '/trip', per: 'one' },
    { id: 'v3', ico: '🛣️', name: 'Full-Day Charter', vend: 'Fetii', desc: 'Van + driver on call all day.', price: 1350, unit: '/day', per: 'night' },
  ],
};
const findAddon = (id) => { for (const c in ADDONS) { const f = ADDONS[c].find((a) => a.id === id); if (f) return f; } };
const fmt = (n) => '$' + Math.round(n).toLocaleString();

export default function StaysB2B() {
  const [nights, setNights] = useState(3);
  const [propQty, setPropQty] = useState({});
  const [propParty, setPropParty] = useState({});
  const [qty, setQty] = useState({});
  const [submitted, setSubmitted] = useState(false);

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
    lines.push({ name: p.name, party, col, sub: `${fmt(p.price)}/night × ${q} home${q > 1 ? 's' : ''} × ${nights} nts`, v: t });
  }
  for (const id in qty) {
    const q = qty[id]; if (q <= 0) continue;
    const a = findAddon(id); const mult = a.per === 'night' ? nights : 1; const t = a.price * q * mult; sub += t;
    lines.push({ name: a.name, sub: a.per === 'night' ? `${fmt(a.price)}${a.unit} × ${q} × ${nights} nts` : `${fmt(a.price)}${a.unit} × ${q}`, v: t });
  }
  const fee = Math.round(sub * CONCIERGE_RATE);
  const grand = sub + fee;

  const submit = () => {
    if (!Object.values(propQty).some((v) => v > 0)) { alert('Add at least one property to submit the order.'); return; }
    // Fire-and-forget lead capture (reuses subscribe endpoint pattern)
    try {
      fetch(`${SUPABASE_URL}/rest/v1/rpc/log_event`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'b2b_concierge_order', total: grand }) }).catch(() => {});
    } catch {}
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 2600);
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
          PROPER SELECTS <span style={{ color: C.gold, fontWeight: 600, fontSize: 11, letterSpacing: '.12em' }}>· EVENT HOSPITALITY</span>
        </a>
        <div style={{ fontSize: 11, color: C.dim, border: `1px solid ${C.line}`, padding: '5px 12px', borderRadius: 20 }}>B2B Portal · Powered by Dream Rentals</div>
      </div></div>

      {/* Hero */}
      <section style={s.hero}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(900px 380px at 78% -10%,rgba(244,169,60,.16),transparent 60%),radial-gradient(700px 400px at 8% 120%,rgba(96,165,250,.10),transparent 55%)' }} />
        <div style={{ ...s.wrap, position: 'relative' }}>
          <span style={s.kick}>◆ For production companies · Powered by Dream Rentals</span>
          <h1 style={{ fontFamily: "'Sora'", fontSize: 46, lineHeight: 1.06, fontWeight: 800, letterSpacing: '-.02em', maxWidth: '17ch' }}>
            Provision your <span style={{ background: `linear-gradient(120deg,${C.gold},${C.gold2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>entire event's hospitality</span> in one order.
          </h1>
          <p style={{ color: C.dim, fontSize: 17, maxWidth: '60ch', marginTop: 16 }}>
            Book housing and on-site services for your artists, touring crew, and event staff — all in a single itemized order. Proper Selects coordinates every vendor; you get one invoice, one point of contact, net-30 terms.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 26 }}>
            {[['Production Company', 'The Concourse Project'], ['Event', 'Seismic Dance Event 9.0'], ['Dates', 'Nov 13–15, 2026'], ['Total Headcount', '34 (artists + crew + staff)']].map(([l, v]) => (
              <div key={l} style={s.field}><label style={s.fieldLabel}>{l}</label><input defaultValue={v} style={s.fieldInput} /></div>
            ))}
          </div>
        </div>
      </section>

      {/* Builder */}
      <div style={{ ...s.wrap, display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 372px', gap: 32, padding: '26px 0 90px', alignItems: 'start' }} className="ps-b2b-grid">
        <div>
          {/* Section 1: Housing */}
          <Section num="1" title="Housing — assign by group" sub="Book one or more Dream Rentals homes and tag each to a party: Artists · Crew · Staff. Set quantity per property.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
              {PROPS.map((p) => {
                const q = propQty[p.id] || 0; const party = propParty[p.id] || 'Artists';
                return (
                  <div key={p.id} style={{ background: C.card, border: `1px solid ${q > 0 ? C.gold : C.line}`, borderRadius: 18, overflow: 'hidden', boxShadow: q > 0 ? `0 0 0 1px ${C.gold}` : 'none', transition: '.2s' }}>
                    <div style={{ height: 150, backgroundImage: `url('${p.img}')`, backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative' }}>
                      {p.badge && <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(10,10,15,.78)', backdropFilter: 'blur(6px)', color: C.gold, fontSize: 10.5, fontWeight: 700, letterSpacing: '.06em', padding: '5px 10px', borderRadius: 20, textTransform: 'uppercase' }}>{p.badge}</span>}
                    </div>
                    <div style={{ padding: '15px 16px 16px' }}>
                      <h3 style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700 }}>{p.name}</h3>
                      <div style={{ color: C.dim, fontSize: 12.5, marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}><span>📍 {p.hood}</span><span>🛏️ {p.br}</span></div>
                      <div style={{ color: C.dim2, fontSize: 11.5, marginTop: 6 }}>{p.amen}</div>
                      <div style={{ marginTop: 11, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <b style={{ fontFamily: "'Sora'", fontSize: 19, fontWeight: 800 }}>{fmt(p.price)}<span style={{ fontSize: 12, color: C.dim2, fontWeight: 400 }}> / night</span></b>
                        {stepper(() => chgProp(p.id, -1), q, () => chgProp(p.id, 1))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 13, paddingTop: 13, borderTop: `1px solid ${C.line}`, gap: 8 }}>
                        <span style={{ fontSize: 11, color: C.dim2 }}>Assign to</span>
                        <div style={{ display: 'flex', gap: 5 }}>
                          {['Artists', 'Crew', 'Staff'].map((pt) => {
                            const on = party === pt; const col = PARTY_COLOR[pt];
                            return <span key={pt} onClick={() => setParty(p.id, pt)} style={{ fontSize: 10.5, padding: '5px 9px', borderRadius: 20, border: `1px solid ${on ? col : C.line}`, background: on ? `${col}1f` : 'transparent', color: on ? col : C.dim, cursor: 'pointer', fontWeight: 600 }}>{pt}</span>;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <AddonSection num="2" title="Artist backline & sound" sub="Green-room / rehearsal gear delivered to artist housing · Rock N Roll Rentals (daily)" cat="gear" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="3" title="Catering & private chef" sub="Feed artists & crew on-site · Airbnb Experience chefs (per guest / service)" cat="chef" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="4" title="Security & staffing" sub="Licensed Austin subcontractors for protection & property watch · per guard / shift" cat="sec" qty={qty} chg={chg} stepper={stepper} C={C} />
          <AddonSection num="5" title="Ground transport" sub="Move artists, crew & staff between housing, venue & airport · Fetii (per vehicle)" cat="van" qty={qty} chg={chg} stepper={stepper} C={C} />
        </div>

        {/* Cart */}
        <aside>
          <div style={{ position: 'sticky', top: 88, background: `linear-gradient(180deg,${C.card2},${C.card})`, border: `1px solid ${C.line}`, borderRadius: 20, padding: 22, boxShadow: '0 20px 50px rgba(0,0,0,.35)' }}>
            <h3 style={{ fontFamily: "'Sora'", fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Event Hospitality Order
              <span onClick={clearAll} style={{ fontSize: 11, color: C.dim2, cursor: 'pointer', fontWeight: 500 }}>Clear</span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '15px 0', padding: '11px 14px', background: C.bg2, borderRadius: 12, border: `1px solid ${C.line}` }}>
              <label style={{ fontSize: 13, color: C.dim }}>Nights of housing</label>
              {stepper(() => setNights((n) => Math.max(1, n - 1)), nights, () => setNights((n) => n + 1))}
            </div>
            <div style={{ marginTop: 6, maxHeight: 300, overflowY: 'auto' }}>
              {lines.length ? lines.map((l, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', borderBottom: `1px dashed ${C.line}`, fontSize: 13 }}>
                  <div style={{ color: C.txt }}>
                    {l.name}
                    {l.party && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 10, marginLeft: 6, background: `${l.col}22`, color: l.col, fontWeight: 700 }}>{l.party}</span>}
                    <small style={{ display: 'block', color: C.dim2, fontSize: 11, marginTop: 2 }}>{l.sub}</small>
                  </div>
                  <div style={{ fontFamily: "'Sora'", fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(l.v)}</div>
                </div>
              )) : <div style={{ color: C.dim2, fontSize: 13, textAlign: 'center', padding: '24px 0' }}>Add housing & services to build the event order.</div>}
            </div>
            <div style={{ marginTop: 14, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
              <Row label="Subtotal" val={fmt(sub)} C={C} />
              <Row label="Proper Selects concierge fee (15%)" val={fmt(fee)} C={C} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Sora'", fontSize: 21, fontWeight: 800, marginTop: 6 }}>
                <span>Order total (est.)</span><span style={{ color: C.gold }}>{fmt(grand)}</span>
              </div>
              <div style={{ fontSize: 11, color: C.dim2, marginTop: 4 }}>Single itemized invoice · all vendors coordinated by Proper Selects</div>
            </div>
            <button onClick={submit} style={{ display: 'block', width: '100%', marginTop: 16, background: submitted ? C.green : `linear-gradient(120deg,${C.gold},${C.gold2})`, color: C.bg, border: 'none', padding: 15, borderRadius: 13, fontFamily: "'Sora'", fontWeight: 800, fontSize: 15, cursor: 'pointer', transition: '.2s' }}>
              {submitted ? '✓ Order submitted — coordinator notified' : 'Submit Order for Confirmation →'}
            </button>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 11, color: C.dim2, alignItems: 'center', justifyContent: 'center' }}>
              {['Net-30 terms', 'One invoice', 'Dedicated coordinator'].map((t) => <span key={t} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: '4px 8px' }}>{t}</span>)}
            </div>
            <div style={{ fontSize: 11, color: C.dim2, textAlign: 'center', marginTop: 11, lineHeight: 1.5 }}>No charge today · a PS coordinator confirms vendor availability & returns a signed quote within 24h.</div>
          </div>
        </aside>
      </div>

      <div style={{ borderTop: `1px solid ${C.line}`, padding: '30px 0', color: C.dim2, fontSize: 12, textAlign: 'center' }}>
        Proper Selects × Dream Rentals · B2B Event Hospitality Portal · properselects.com
      </div>

      <style>{`@media(max-width:980px){.ps-b2b-grid{grid-template-columns:1fr !important}}`}</style>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
        {ADDONS[cat].map((a) => {
          const q = qty[a.id] || 0;
          return (
            <div key={a.id} style={{ background: C.card, border: `1px solid ${q > 0 ? C.gold : C.line}`, borderRadius: 16, padding: 16, background: q > 0 ? `linear-gradient(180deg,rgba(244,169,60,.06),transparent)` : C.card }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 11, background: C.card2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, flex: '0 0 auto' }}>{a.ico}</div>
                <div><h3 style={{ fontFamily: "'Sora'", fontSize: 14.5, fontWeight: 700 }}>{a.name}</h3><div style={{ fontSize: 11, color: C.gold, marginTop: 2 }}>{a.vend}</div></div>
              </div>
              <div style={{ fontSize: 12.5, color: C.dim, marginTop: 10, minHeight: 34 }}>{a.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
                <div style={{ fontFamily: "'Sora'", fontWeight: 700, fontSize: 15 }}>{fmt(a.price)}<small style={{ fontSize: 11, color: C.dim2, fontWeight: 400 }}>{a.unit}</small></div>
                {stepper(() => chg(a.id, -1), q, () => chg(a.id, 1))}
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
