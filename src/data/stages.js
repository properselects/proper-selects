// The 3 top-level stages shown on the Today tab.
// Copied verbatim from the original bundle so behaviour matches.
export const STAGES = [
  {
    id: 'americas',
    name: 'Americas',
    tagline: 'LA to Miami · sun to sunrise',
    accent: '#F4A93C',
    bg: 'linear-gradient(180deg,#ffd27a 0%,#ff9d4d 38%,#e8632e 70%,#7a2d1a 100%)',
    text: '#2a1505',
    panel: 'rgba(255,236,200,.9)',
  },
  {
    id: 'europe',
    name: 'Europe',
    tagline: 'Ibiza to Berlin · midnight to morning',
    accent: '#4FC3F7',
    bg: 'linear-gradient(180deg,#1a2a6b 0%,#2a4d8f 30%,#b95e8a 68%,#f0a35e 100%)',
    text: '#eaf4ff',
    panel: 'rgba(10,24,48,.85)',
  },
  {
    id: 'worldwide',
    name: 'Worldwide',
    tagline: 'Beyond the map · everywhere',
    accent: '#FF3B57',
    bg: 'linear-gradient(180deg,#2a0a10 0%,#3a0d14 40%,#1a0508 100%)',
    text: '#ffe2e6',
    panel: 'rgba(28,6,9,.88)',
  },
];

export const TABS = [
  { id: 'jukebox', label: 'Today', icon: '◈', desc: "Tonight's lineup" },
  { id: 'grid',    label: 'Vault', icon: '⊞', desc: 'Every set, every venue' },
  { id: 'atlas',   label: 'Atlas', icon: '◎', desc: 'World map' },
  { id: 'radar',   label: 'Radar', icon: '◉', desc: 'Discover sets' },
];
