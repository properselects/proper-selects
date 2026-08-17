import React, { useEffect, useState } from 'react';
import { supabaseHeaders, SUPABASE_URL } from '../lib/supabase.js';

const VENUE_CARDS = [
  { img: '/landing/rossi.jpg',      artist: 'Rossi.',       venue: 'Boiler Room' },
  { img: '/landing/franky.jpg',     artist: 'Franky Rizardo', venue: 'Coachella' },
  { img: '/landing/johnsummit.jpg', artist: 'John Summit',  venue: 'Lollapalooza' },
  { img: '/landing/alleycvt.jpg',   artist: 'ALLEYCVT',     venue: 'Concourse' },
];

// Feature pillars — inline SVG glyphs so they render crisp on every device.
const IconCurate = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="15" y2="12" /><line x1="4" y1="17" x2="18" y2="17" />
  </svg>
);
const IconFind = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
  </svg>
);
const IconCast = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="13" rx="2" /><path d="M2 20 h4" /><path d="M2 16.5 a4 4 0 0 1 4 4" /><path d="M2 13 a8 8 0 0 1 8 8" />
  </svg>
);
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="6" r="2.6" /><circle cx="18" cy="18" r="2.6" />
    <line x1="8.3" y1="10.8" x2="15.7" y2="7.2" /><line x1="8.3" y1="13.2" x2="15.7" y2="16.8" />
  </svg>
);

const FEATURES = [
  { key: 'curate', Icon: IconCurate, title: 'Curate a lineup', sub: '1,700+ sets' },
  { key: 'find',   Icon: IconFind,   title: 'Find track IDs',  sub: 'timestamped', highlight: true },
  { key: 'cast',   Icon: IconCast,   title: 'Cast to screen',  sub: 'TV or projector' },
  { key: 'share',  Icon: IconShare,  title: 'Share one link',  sub: 'friends tap play' },
];

export default function LandingGate({ onEnter, onOpenSubmit }) {
  const [stats, setStats] = useState({ sets: null, venues: null });

  useEffect(() => {
    // Real totals via Prefer:count=exact (count is in the Content-Range header).
    Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/vault_sets?select=video_id&limit=1`, {
        headers: { ...supabaseHeaders, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
      }),
      fetch(`${SUPABASE_URL}/rest/v1/festivals?active=eq.true&select=id&limit=1`, {
        headers: { ...supabaseHeaders, Prefer: 'count=exact', 'Range-Unit': 'items', Range: '0-0' },
      }),
    ])
      .then(([setsRes, venuesRes]) => {
        const parse = (res) => {
          const m = (res.headers.get('Content-Range') || '').match(/\/(\d+)$/);
          return m ? parseInt(m[1], 10) : null;
        };
        const sets = parse(setsRes);
        if (sets !== null) setStats({ sets, venues: parse(venuesRes) });
      })
      .catch(() => {});
  }, []);

  return (
    <div className="ng-gate">
      {/* Hero */}
      <div className="ng-hero">
        <div className="ng-hero-img" aria-hidden="true" />
        <div className="ng-hero-scrim" aria-hidden="true" />
        <div className="ng-hero-inner">
          <img className="ng-logo" src="/logo.png" alt="Proper Selects" width="150" height="150" />
          <h1 className="ng-headline">
            Your lineup.<br />
            <span className="ng-headline-accent">Their best sets.</span>
          </h1>
          <p className="ng-venues">Boiler Room · Awakenings · Cercle · Hï Ibiza · Tresor · Club Space</p>
        </div>
      </div>

      {/* Content */}
      <div className="ng-body">
        {/* CTA — sits between the headline and the carousel */}
        <button className="ng-cta ng-cta-top" onClick={onEnter}>
          Browse Sets <span className="ng-cta-arrow">→</span>
        </button>

        {/* Venue strip */}
        <div className="ng-strip">
          {VENUE_CARDS.map((c) => (
            <div key={c.artist} className="ng-card" onClick={onEnter}>
              <img className="ng-card-img" src={c.img} alt={c.artist} loading="lazy" />
              <div className="ng-card-scrim" />
              <div className="ng-card-meta">
                <div className="ng-card-artist">{c.artist}</div>
                <div className="ng-card-venue">{c.venue}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Feature pillars */}
        <div className="ng-features">
          {FEATURES.map(({ key, Icon, title, sub, highlight }) => (
            <div key={key} className={'ng-feat' + (highlight ? ' ng-feat-hl' : '')}>
              <span className="ng-feat-icon"><Icon /></span>
              <div className="ng-feat-title">{title}</div>
              <div className="ng-feat-sub">{sub}</div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="ng-footer">
          <button className="ng-submitlink" onClick={(e) => { e.stopPropagation(); onOpenSubmit?.(); }}>
            Know a set that belongs here? →
          </button>
          <a
            className="ng-contactlink"
            href="mailto:properselects@gmail.com?subject=Proper%20Selects%20Inquiry"
            onClick={(e) => e.stopPropagation()}
          >
            Inquiries · properselects@gmail.com
          </a>
          {stats.sets && (
            <div className="ng-stats">
              {stats.sets.toLocaleString()} sets · {stats.venues} venues worldwide
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
