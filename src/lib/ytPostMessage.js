// Control a raw YouTube embed iframe via postMessage.
// The iframe src MUST include `enablejsapi=1` (and ideally an `origin`) for
// these commands to take effect.
export function ytSeek(iframeEl, sec) {
  const cw = iframeEl && iframeEl.contentWindow;
  if (!cw) return;
  const t = Math.max(0, Math.floor(sec || 0));
  cw.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [t, true] }), '*');
  cw.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
}
