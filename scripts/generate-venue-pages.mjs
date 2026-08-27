// Post-build: generate static HTML pages for each venue from Supabase
// Output: dist/venue/[id]/index.html
// Each page is fully indexable by Google, then hands off to the SPA

import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(__dirname, '../dist');

// Static stays landing pages — clone the built index.html (so the SPA still
// boots) but swap the social-share meta so link previews match each page.
const STAYS_PAGES = [
  {
    slug: 'arc',
    title: 'ARC Music Festival — Where to Stay | Proper Selects × Dream Rentals',
    desc: 'Curated Chicago stays for ARC Music Festival 2026 weekend. Group-friendly homes near Union Park + prep sets from past ARC performances.',
    image: 'https://arcmusicfestival.com/wp-content/uploads/2026/08/ARC2026_ArtSocialSized_IG-1.png',
  },
  {
    slug: 'seismic',
    title: 'Seismic Dance Event — Where to Stay | Proper Selects × Dream Rentals',
    desc: 'Curated Austin stays for Seismic Dance Event 2026 at The Concourse Project. Group-friendly homes + prep sets from the Concourse vault.',
    image: 'https://www.seismicdanceevent.com/wp-content/uploads/2026/05/SDE9-OPENGRAPH.png',
  },
  {
    slug: 'b2b',
    title: 'Event Hospitality Portal | Proper Selects × Dream Rentals',
    desc: 'B2B concierge for production companies — provision housing, DJ gear, private chefs, security & transport for your artists, crew & staff in one itemized order.',
    image: 'https://thedreamrentals.com/wp-content/uploads/2026/06/fq52vxb7991srcgosgj0-scaled.jpg',
  },
];

function generateStaysPages() {
  let indexHtml;
  try {
    indexHtml = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  } catch {
    console.log('  ⚠ dist/index.html not found — skipping stays pages');
    return 0;
  }
  let count = 0;
  for (const page of STAYS_PAGES) {
    const url = `https://properselects.com/stays/${page.slug}`;
    let html = indexHtml
      // og:image + twitter:image
      .replace(/(<meta property="og:image" content=")[^"]*(")/,       `$1${page.image}$2`)
      .replace(/(<meta name="twitter:image" content=")[^"]*(")/,      `$1${page.image}$2`)
      // titles
      .replace(/(<title>)[^<]*(<\/title>)/,                            `$1${page.title}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/,       `$1${page.title}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/,      `$1${page.title}$2`)
      // descriptions
      .replace(/(<meta name="description" content=")[^"]*(")/,        `$1${page.desc}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${page.desc}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/,`$1${page.desc}$2`)
      // canonical + og:url
      .replace(/(<link rel="canonical" href=")[^"]*(")/,              `$1${url}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/,         `$1${url}$2`);
    const dir = resolve(DIST, 'stays', page.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), html);
    count++;
    process.stdout.write(`  ✓ stays/${page.slug} (social image set)\n`);
  }
  return count;
}

const SUPABASE_URL = 'https://bcodfuggztfosuzsyyla.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjb2RmdWdnenRmb3N1enN5eWxhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ0MjgyNTQsImV4cCI6MjEwMDAwNDI1NH0.RSD_E1f0Qy9E2s3vHMK5H9Mch0_-aCOrNhJs1hxCv5Y';
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

async function fetchJson(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  return r.json();
}

function slugify(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseArtist(title) {
  if (!title) return '';
  // Strip channel prefixes like "Boiler Room" / "Cercle" from beginning
  return title.replace(/^(Boiler Room|Cercle|RAW CUTS|HÖR|DJ Mag|Beatport|Toolroom|When We Dip)[:\s|–-]+/i, '').trim();
}

function venueHtml({ venue, sets, slug }) {
  const title = `${venue.name} DJ Sets | Proper Selects`;
  const desc = `Stream the best DJ sets from ${venue.name} in ${venue.city}. ${sets.length} sets available — fresh content added daily on Proper Selects.`;
  const setListHtml = sets.slice(0, 50).map((s, i) => `
    <li class="set-item">
      <span class="set-num">${String(i + 1).padStart(2, '0')}</span>
      <span class="set-artist">${parseArtist(s.artist).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
    </li>`).join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${desc.replace(/"/g, '&quot;')}" />
  <link rel="canonical" href="https://properselects.com/venue/${slug}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://properselects.com/venue/${slug}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${desc.replace(/"/g, '&quot;')}" />
  <meta property="og:image" content="https://properselects.com/og-image.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:image" content="https://properselects.com/og-image.png" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "MusicVenue",
    "name": "${venue.name.replace(/"/g, '\\"')}",
    "address": { "@type": "PostalAddress", "addressLocality": "${venue.city.replace(/"/g, '\\"')}" },
    "url": "https://properselects.com/venue/${slug}"
  }
  </script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Helvetica Neue',Arial,sans-serif;background:#050609;color:#EDEAE2;min-height:100vh}
    .hero{padding:60px 24px 40px;max-width:800px;margin:0 auto;text-align:center}
    .wordmark{font-size:10px;font-weight:800;letter-spacing:.38em;color:rgba(237,234,226,.3);text-transform:uppercase;margin-bottom:32px}
    .venue-name{font-size:clamp(36px,8vw,72px);font-weight:900;letter-spacing:-.03em;margin-bottom:8px}
    .venue-city{font-size:18px;color:rgba(237,234,226,.5);margin-bottom:32px;font-weight:500}
    .cta{display:inline-flex;align-items:center;gap:10px;background:#F4A93C;color:#07040a;border:none;padding:16px 40px;border-radius:10px;font-size:15px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;cursor:pointer;text-decoration:none;margin-bottom:48px}
    .sets-section{max-width:800px;margin:0 auto;padding:0 24px 60px}
    .sets-title{font-size:11px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;color:rgba(237,234,226,.4);margin-bottom:20px}
    .set-list{list-style:none;display:flex;flex-direction:column;gap:8px}
    .set-item{display:flex;align-items:center;gap:14px;padding:12px 16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px}
    .set-num{font-size:12px;font-weight:800;color:#F4A93C;min-width:28px;font-variant-numeric:tabular-nums}
    .set-artist{font-size:14px;font-weight:600;color:#EDEAE2}
    .footer{text-align:center;padding:32px;font-size:12px;color:rgba(237,234,226,.25);letter-spacing:.08em}
  </style>
</head>
<body>
  <div class="hero">
    <div class="wordmark">[ Proper Selects ]</div>
    <h1 class="venue-name">${venue.name.replace(/</g, '&lt;')}</h1>
    <p class="venue-city">${venue.city}</p>
    <a class="cta" href="/">▷ Start Listening</a>
  </div>
  <div class="sets-section">
    <p class="sets-title">${sets.length} DJ Sets</p>
    <ul class="set-list">
      ${setListHtml}
    </ul>
  </div>
  <p class="footer">Proper Selects — The world's best DJ sets · properselects.com</p>
</body>
</html>`;
}

async function main() {
  console.log('Fetching venues...');
  const venues = await fetchJson('festivals?select=id,name,city,region&active=eq.true&limit=500');

  console.log('Fetching sets per venue...');
  const sets = await fetchJson('vault_sets?select=festival_id,artist&limit=5000');

  // Group sets by festival_id
  const setsByVenue = {};
  for (const s of sets) {
    if (!setsByVenue[s.festival_id]) setsByVenue[s.festival_id] = [];
    setsByVenue[s.festival_id].push(s);
  }

  let generated = 0;
  const sitemapUrls = ['https://properselects.com/'];

  for (const venue of venues) {
    const venueSets = setsByVenue[venue.id] || [];
    if (venueSets.length === 0) continue;

    const slug = slugify(venue.id);
    const dir = resolve(DIST, 'venue', slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, 'index.html'), venueHtml({ venue, sets: venueSets, slug }));
    sitemapUrls.push(`https://properselects.com/venue/${slug}`);
    generated++;
    process.stdout.write(`  ✓ ${venue.name} (${venueSets.length} sets)\n`);
  }

  // Update sitemap.xml with venue pages
  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map(url => `  <url>\n    <loc>${url}</loc>\n    <changefreq>daily</changefreq>\n    <priority>${url === 'https://properselects.com/' ? '1.0' : '0.8'}</priority>\n  </url>`).join('\n')}
</urlset>`;
  writeFileSync(resolve(DIST, 'sitemap.xml'), sitemapXml);

  const staysCount = generateStaysPages();

  console.log(`\nGenerated ${generated} venue pages + ${staysCount} stays pages + updated sitemap with ${sitemapUrls.length} URLs`);
}

main().catch(console.error);
