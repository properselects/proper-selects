/**
 * Extract a clean artist name from a raw YouTube title.
 * Strips venue tags, social handles, "[Full Set]", dates, etc.
 */
export function parseArtist(raw) {
  if (!raw) return '';

  // "10 years of Sónar Istanbul | Marcel Dettmann full set" → recurse on right side
  const yearsOf = raw.match(/^\d+\s+years?\s+of\s+.+?\s*\|\s*(.+)/i);
  if (yearsOf) return parseArtist(yearsOf[1]);

  let t = raw
    .replace(/@\w+/g, ' ')                          // @OfficialClubSpace → gone
    .replace(/\[.*?\]/g, ' ')                         // [Full 4k Set] → gone
    .replace(/\s*\|\s*full\s+set.*/i, '')             // | Full Set (16 Apr 2026) → gone
    .replace(/\(\d{1,2}\s+\w{3,}\s+20\d\d\)/gi, '')  // (07 Mar 2026) → gone
    .replace(/\s{2,}/g, ' ')
    .trim();

  // "TROI presents: Shonky b2b..." → strip the "presents:" prefix
  t = t.replace(/^[\w\s']+presents:\s*/i, '');

  // "Artist @ Venue" — take everything before @
  const atIdx = t.indexOf(' @ ');
  if (atIdx > 0) t = t.slice(0, atIdx).trim();

  // "Artist - Live at Venue" or "Artist - Live @ ..." — strip " - Live..."
  t = t.replace(/\s*-\s*live\b.*/i, '').trim();

  // "Artist dj set at Venue" — strip " dj set..."
  t = t.replace(/\s+dj\s+set\b.*/i, '').trim();

  // "Artist at THE VENUE" — strip " at [uppercase word]..."
  t = t.replace(/\s+at\s+[A-Z][A-Za-z\s,]+$/, '').trim();

  // "Artist · Festival Year" — take first segment
  const dotIdx = t.indexOf(' · ');
  if (dotIdx > 0) t = t.slice(0, dotIdx).trim();

  // "Artist - Subtitle" — take first segment if short
  const dashIdx = t.indexOf(' - ');
  if (dashIdx > 0 && dashIdx < 50) t = t.slice(0, dashIdx).trim();

  // "Artist | Title" — take first segment if short
  const pipeIdx = t.indexOf(' | ');
  if (pipeIdx > 0 && pipeIdx < 50) t = t.slice(0, pipeIdx).trim();

  // Strip trailing year / "full set" / dangling separators
  t = t
    .replace(/\s+20\d\d$/, '')
    .replace(/\s+full\s+set\s*$/i, '')
    .replace(/[·|\-]+$/, '')
    .trim();

  return t || raw;
}
