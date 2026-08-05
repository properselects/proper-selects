import React, { useEffect, useRef, useState } from 'react';
import { loadYT } from '../lib/youtubePlayer.js';

/**
 * YouTube player that fires onEnded when a set finishes, and auto-fires
 * onEnded after 3s if the video errors out (private / removed). Enables
 * true "set and forget" background listening.
 */
// Detect Apple/Chrome once for the AirPlay/Cast hint pills.
const IS_APPLE =
  typeof navigator !== 'undefined' &&
  (/^((?!chrome|android).)*safari/i.test(navigator.userAgent) || /iPad|iPhone|iPod/.test(navigator.userAgent));
const IS_CHROME =
  typeof navigator !== 'undefined' &&
  /Chrome/.test(navigator.userAgent) &&
  !/Safari/.test(navigator.userAgent.replace(/Chrome[^\s]*/, ''));

export default function StagePlayer({ set, onEnded, seekRef, timeRef }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const [state, setState] = useState('loading');

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
          },
          onStateChange: (e) => {
            const S = window.YT.PlayerState;
            if (e.data === S.PLAYING) setState('playing');
            else if (e.data === S.PAUSED) setState('paused');
            else if (e.data === S.ENDED) onEnded();
          },
          onError: () => {
            setState('error');
            setTimeout(onEnded, 3000);
          },
        },
      });
    });
    return () => {
      cancelled = true;
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
          {state === 'playing' ? 'Now playing' : state === 'error' ? 'Unavailable' : 'Cueing'} · {set.artist}
          {set.festival_name && (
            <span className="jb-fest">
              — {set.festival_name}
              {set.city ? `, ${set.city}` : ''}
            </span>
          )}
        </div>
        {state === 'playing' && IS_APPLE && (
          <span className="tg-airplay-hint">⊹ AirPlay</span>
        )}
        {state === 'playing' && IS_CHROME && !IS_APPLE && (
          <span className="tg-airplay-hint">⊹ Cast</span>
        )}
      </div>
    </div>
  );
}
