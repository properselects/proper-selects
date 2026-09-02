import React, { useEffect, useRef, useState } from 'react';
import { loadYT } from '../lib/youtubePlayer.js';
import { parseArtist } from '../lib/parseArtist.js';
import { registerPlayer, unregisterPlayer, startExclusive } from '../lib/playbackBus.js';

/**
 * YouTube player that fires onEnded when a set finishes, and auto-fires
 * onEnded after 3s if the video errors out (private / removed). Enables
 * true "set and forget" background listening.
 */
export default function StagePlayer({ set, onEnded, seekRef, timeRef, controlsRef, onPlayingChange }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [state, setState] = useState('loading');

  // Hand off to YouTube at the current position — lets listeners keep the set
  // playing with their screen locked (which YouTube's own player allows and a
  // third-party embed can't). Deep-links to the exact second they're at.
  function openInYouTube() {
    let t = 0;
    try { t = Math.floor(playerRef.current?.getCurrentTime?.() || 0); } catch {}
    const url = `https://www.youtube.com/watch?v=${set.video_id}${t > 0 ? `&t=${t}s` : ''}`;
    window.open(url, '_blank', 'noopener');
  }

  useEffect(() => {
    let cancelled = false;
    loadYT().then((YT) => {
      if (cancelled || !hostRef.current) return;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: set.video_id,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: (e) => {
            try {
              e.target.playVideo();
            } catch {}
            if (seekRef) {
              seekRef.current = (sec) => {
                try {
                  e.target.seekTo(sec, true);
                  e.target.playVideo();
                } catch {}
              };
            }
            if (timeRef) {
              timeRef.current = () => {
                try {
                  return e.target.getCurrentTime() || 0;
                } catch {
                  return 0;
                }
              };
            }
            // Expose play/pause/toggle so the mini player can control playback
            if (controlsRef) {
              controlsRef.current = {
                play: () => { try { e.target.playVideo(); } catch {} },
                pause: () => { try { e.target.pauseVideo(); } catch {} },
                toggle: () => {
                  try {
                    const S = window.YT.PlayerState;
                    if (e.target.getPlayerState() === S.PLAYING) e.target.pauseVideo();
                    else e.target.playVideo();
                  } catch {}
                },
              };
            }
            // Register with the global bus so other surfaces can pause us
            registerPlayer('stage', () => { try { e.target.pauseVideo(); } catch {} });
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) {
              setState('playing');
              onPlayingChange?.(true);
              startExclusive('stage'); // stop any other surface that's playing
            }
            else if (e.data === S.PAUSED) { setState('paused'); onPlayingChange?.(false); }
            else if (e.data === S.ENDED) onEnded();
          },
          onError: (err) => {
            setState('error');
            // YouTube error codes: 100 = removed/private, 101 & 150 = embedding disabled by owner.
            // Only these mean "will never play in an iframe" — report so the vault self-heals.
            // (2 = bad param, 5 = HTML5 error are transient; don't nuke a good set over those.)
            const code = err?.data;
            if (code === 100 || code === 101 || code === 150) {
              try {
                const payload = JSON.stringify({ video_id: set.video_id });
                if (navigator.sendBeacon) {
                  navigator.sendBeacon('/api/lineup?flag=embed', new Blob([payload], { type: 'application/json' }));
                } else {
                  fetch('/api/lineup?flag=embed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true });
                }
              } catch {}
            }
            setTimeout(onEnded, 3000);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      if (controlsRef) controlsRef.current = null;
      unregisterPlayer('stage');
      try {
        playerRef.current?.destroy();
      } catch {}
      playerRef.current = null;
    };
  }, [set.video_id]);

  return (
    <div className="jb-player">
      <div className="jb-screen">
        <div ref={hostRef} className="jb-host" />
        {state === 'error' && (
          <div className="jb-err">
            <p>This set can't be embedded.</p>
            <button onClick={onEnded}>Next set →</button>
          </div>
        )}
      </div>
      <div className="jb-now-row">
        <div className="jb-now">
          {state === 'playing' ? 'Now playing' : state === 'error' ? 'Unavailable' : 'Cueing'} · {parseArtist(set.artist)}
          {set.festival_name && (
            <span className="jb-fest">
              — {set.festival_name}
              {set.city ? `, ${set.city}` : ''}
            </span>
          )}
        </div>
        {state !== 'error' && (
          <button
            className="jb-yt-btn"
            onClick={openInYouTube}
            title="Open in YouTube — keeps playing with your screen locked"
          >
            ▶ YouTube
          </button>
        )}
      </div>
    </div>
  );
}
