// Subtitle for a set row: "Venue · City" when we have real venue info, else the
// raw YouTube title. Treats the generic "Discovered" / "Worldwide" placeholders
// as no-info so results never read "Discovered · Worldwide".
export function venueSubtitle(s) {
  const venue = s.festival_name && s.festival_name !== 'Discovered' ? s.festival_name : '';
  const city = s.city && s.city !== 'Worldwide' ? s.city : '';
  if (venue) return city ? `${venue} · ${city}` : venue;
  return s.title || s.artist || '';
}
