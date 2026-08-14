// Global single-player coordinator.
//
// Every surface that can play a video (jukebox StagePlayer, Radar modal,
// Vault/Atlas players, Preview modal) registers a `stop` function. When one
// surface starts playing, it calls startExclusive(id) and every OTHER
// registered surface is stopped — so only one video ever plays at a time.
//
// stop() means "pause" for the persistent jukebox and "close/unmount" for the
// transient raw-iframe surfaces (which have no JS API to pause).

const stoppers = new Map(); // id -> stopFn

export function registerPlayer(id, stopFn) {
  stoppers.set(id, stopFn);
}

export function unregisterPlayer(id) {
  stoppers.delete(id);
}

// Call when surface `id` begins playback — stops everyone else.
export function startExclusive(id) {
  for (const [key, stop] of stoppers) {
    if (key !== id) {
      try { stop(); } catch {}
    }
  }
}
